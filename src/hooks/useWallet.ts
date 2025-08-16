import { useState, useEffect, useCallback, useRef } from 'react';
import * as ethers from 'ethers';
import { useSupabaseData } from './useSupabaseData';
import { walletMiddleware } from '../lib/walletMiddleware';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  provider: ethers.providers.Web3Provider | null;
  walletName?: string;
}

interface TokenBalance {
  chainId: number;
  chainName: string;
  usdc: number;
  usdt: number;
  isLoading: boolean;
  error?: string;
}

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];
const MULTICALL_ABI = [
  'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public returns (tuple(bool success, bytes returnData)[] returnData)'
];

export const useWallet = () => {
  const { chains, getStablecoinAddress, isLoading: isDataLoading } = useSupabaseData();

  const [wallet, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    provider: null,
    walletName: undefined
  });
  
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [balancesLastUpdated, setBalancesLastUpdated] = useState<number>(0);
  const isFetchingBalancesRef = useRef(false);
  const lastFetchMsRef = useRef(0);
  const runIdRef = useRef(0);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connection = await walletMiddleware.checkExistingConnection();
        if (connection) {
          setWalletState({
            isConnected: true,
            address: connection.address,
            chainId: connection.chainId,
            // use 'any' network wrapper
            provider: new ethers.providers.Web3Provider((connection.provider as any).provider || (window as any).ethereum, 'any'),
            walletName: 'Connected Wallet'
          });
          // Fire the same event used after an interactive connect to unify flows
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('wallet-connected'));
          }, 100);
        }
      } catch (error) {
      }
    };

    checkConnection();
  }, []);

  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setWalletState({
          isConnected: false,
          address: null,
          chainId: null,
          provider: null,
          walletName: undefined
        });
        setBalances([]);
      } else {
        setWalletState(prev => {
          if (prev.isConnected) {
            return {
              ...prev,
              address: accounts[0]
            };
          }
          return prev;
        });
      }
    };

    const handleChainChanged = (chainId: string) => {
      setWalletState(prev => ({
        ...prev,
        chainId: parseInt(chainId, 16)
      }));
    };

    const removeListeners = walletMiddleware.setupEventListeners(
      handleAccountsChanged,
      handleChainChanged
    );

    return removeListeners;
  }, []);

  const connectWallet = async () => {
    try {
      const connection = await walletMiddleware.connectWallet();
      
      // Step 1: Clear the state
      setWalletState({
        isConnected: false,
        address: null,
        chainId: null,
        provider: null,
        walletName: undefined
      });
      
      // Then set the connected state after a brief delay
      setTimeout(() => {
        const newState = {
          isConnected: true,
          address: connection.address,
          chainId: connection.chainId,
          // Re-wrap provider with 'any' network to tolerate chain changes
          provider: new ethers.providers.Web3Provider((connection.provider as any).provider || (window as any).ethereum, 'any'),
          walletName: connection.walletName
        };
        
        setWalletState(newState);
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('wallet-connected'));
        }, 100);
      }, 50);
      
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to connect wallet');
    }
  };

  const getTokenBalance = async (
    tokenAddress: string,
    userAddress: string,
    provider: ethers.providers.JsonRpcProvider | ethers.providers.Web3Provider,
    decimals?: number
  ): Promise<number> => {
    try {
      if (!tokenAddress || tokenAddress === '0x' || tokenAddress.length !== 42) return 0;
      if (!userAddress || userAddress === '0x' || userAddress.length !== 42) return 0;

      const checksummedAddress = ethers.utils.getAddress(tokenAddress);
      const contract = new ethers.Contract(checksummedAddress, ERC20_ABI, provider);
      
      // If decimals not provided, fetch from contract
      let tokenDecimals = decimals;
      if (tokenDecimals === undefined) {
        try {
          tokenDecimals = await contract.decimals();
        } catch (error) {
          // Fallback to 18 decimals if decimals() call fails
          tokenDecimals = 18;
        }
      }
      
      const balance = await contract.balanceOf(userAddress);
      return parseFloat(ethers.utils.formatUnits(balance, tokenDecimals));
    } catch {
      return 0;
    }
  };

  const fetchBalances = useCallback(async () => {
    if (!wallet.address || isDataLoading || chains.length === 0) return;

    // Prevent overlapping or overly frequent refreshes
    if (isFetchingBalancesRef.current) return;
    const now = Date.now();
    if (now - lastFetchMsRef.current < 1200) return;
    isFetchingBalancesRef.current = true;
    lastFetchMsRef.current = now;

    if (balances.length === 0) setIsLoadingBalances(true); else setIsRefreshingBalances(true);

    // Priming UI with skeleton per-chain rows (so idle section isn't blank after hard refresh)
    if (balances.length === 0) {
      setBalances(chains.map(c => ({ chainId: c.id, chainName: c.name, usdc: 0, usdt: 0, isLoading: true })));
    }

    const thisRun = ++runIdRef.current;
    let pending = chains.length;

    const balancePromises = chains.map(async (chain): Promise<TokenBalance> => {
      const chainBalance: TokenBalance = {
        chainId: chain.id,
        chainName: chain.name,
        usdc: 0,
        usdt: 0,
        isLoading: true
      };

      try {
        const provider = new ethers.providers.JsonRpcProvider({ url: chain.rpc_url, timeout: 10000 });

        const [usdcAddress, usdtAddress] = [
          getStablecoinAddress('USDC', chain.id),
          getStablecoinAddress('USDT', chain.id)
        ];

        // Prefer multicall if available
        const mcAddress = (chain as any).multicall_address as string | undefined;
        if (mcAddress && usdcAddress && usdtAddress) {
          try {
            const iface = new ethers.utils.Interface(ERC20_ABI);
            const multicall = new ethers.Contract(mcAddress, MULTICALL_ABI, provider);
            const calls = [
              { target: usdcAddress, callData: iface.encodeFunctionData('balanceOf', [wallet.address]) },
              { target: usdtAddress, callData: iface.encodeFunctionData('balanceOf', [wallet.address]) },
            ];
            const resp: { success: boolean; returnData: string }[] = await multicall.tryAggregate(false, calls);
            const [usdcRaw, usdtRaw] = [
              resp[0]?.success ? iface.decodeFunctionResult('balanceOf', resp[0].returnData)[0] as ethers.BigNumber : ethers.BigNumber.from(0),
              resp[1]?.success ? iface.decodeFunctionResult('balanceOf', resp[1].returnData)[0] as ethers.BigNumber : ethers.BigNumber.from(0),
            ];
            // decimals known for USDC/USDT (6) on most chains; avoid on-chain decimals() call
            chainBalance.usdc = parseFloat(ethers.utils.formatUnits(usdcRaw, 6));
            chainBalance.usdt = parseFloat(ethers.utils.formatUnits(usdtRaw, 6));
            chainBalance.isLoading = false;
            return chainBalance;
          } catch {}
        }

        const [usdcBalance, usdtBalance] = await Promise.all([
          usdcAddress ? getTokenBalance(usdcAddress, wallet.address!, provider, 6) : Promise.resolve(0),
          usdtAddress ? getTokenBalance(usdtAddress, wallet.address!, provider, 6) : Promise.resolve(0)
        ]);

        chainBalance.usdc = usdcBalance;
        chainBalance.usdt = usdtBalance;
        chainBalance.isLoading = false;
      } catch (error) {
        chainBalance.error = error instanceof Error ? error.message : 'Failed to fetch balances';
        chainBalance.isLoading = false;
      }

      return chainBalance;
    });

    try {
      // Stream results to UI as they complete (so chains appear one by one)
      balancePromises.forEach(async (p) => {
        try {
          const res = await p;
          if (runIdRef.current !== thisRun) return;
          setBalances(prev => {
            const next = prev.slice();
            const idx = next.findIndex(b => b.chainId === res.chainId);
            if (idx >= 0) next[idx] = res; else next.push(res);
            return next;
          });
        } finally {
          pending -= 1;
          if (pending === 0 && runIdRef.current === thisRun) {
            setBalancesLastUpdated(Date.now());
            setIsLoadingBalances(false);
            setIsRefreshingBalances(false);
            isFetchingBalancesRef.current = false;
          }
        }
      });

      await Promise.allSettled(balancePromises);
    } finally {
      if (pending > 0) {
        setIsLoadingBalances(false);
        setIsRefreshingBalances(false);
        isFetchingBalancesRef.current = false;
      }
    }
  }, [wallet.address, chains.length, isDataLoading]);

  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      fetchBalances();
    }
  }, [wallet.isConnected, wallet.address, chains.length, isDataLoading]);

  const switchChain = async (chainId: number) => {
    if (!window.ethereum) return;
    const chain = chains.find(c => c.id === chainId);
    if (!chain) return;

    const hexId = `0x${chainId.toString(16)}`;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexId }]
      });
      // Optimistically update local state; the 'chainChanged' listener will also sync
      setWalletState(prev => ({ ...prev, chainId }));
    } catch (error: any) {
      if (error?.code === 4902) {
        // Chain not added – add then retry switch
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: hexId,
              chainName: chain.name,
              nativeCurrency: {
                name: chain.symbol,
                symbol: chain.symbol,
                decimals: 18
              },
              rpcUrls: [chain.rpc_url],
              blockExplorerUrls: [chain.block_explorer]
            }]
          });
          // Retry switch after adding
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexId }]
          });
          setWalletState(prev => ({ ...prev, chainId }));
        } catch (addErr) {
          // swallow; UI callers handle error feedback
        }
      }
    }
  };

  return {
    wallet,
    balances,
    isLoadingBalances,
    isRefreshingBalances,
    balancesLastUpdated,
    connectWallet,
    switchChain,
    refreshBalances: fetchBalances,
    supportedChains: chains,
    isDataLoading
  };
};

declare global {
  interface Window {
    ethereum?: any;
  }
}