import { useState } from 'react';
import { ethers } from 'ethers';
import { useAppConfig } from './useAppConfig';
import { useSupabaseData } from './useSupabaseData';

const STABLR_CONTRACT_ABI = [
  // write functions
  {
    inputs: [
      { internalType: 'uint256', name: 'chainId', type: 'uint256' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'recordDeposit',
    outputs: [
      { internalType: 'uint256', name: 'newTotalDeposits', type: 'uint256' },
      { internalType: 'uint256', name: 'newTotalAmountDeposited', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // read functions
  {
    inputs: [],
    name: 'totalAmountDeposited',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'getTotalDepositsCount', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'chainId', type: 'uint256' }], name: 'getTotalDepositsCountByChain', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getTotalValueDeposited', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'chainId', type: 'uint256' }], name: 'getTotalValueDepositedByChain', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'totalAmountDepositedByChain',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'totalDepositsByChain',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'by', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'chainId', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'newTotalDeposits', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'newTotalAmountDeposited', type: 'uint256' },
    ],
    name: 'DepositRecorded',
    type: 'event',
  },
] as const;

export const useStablrContract = () => {
  const [isIncrementing, setIsIncrementing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { config } = useAppConfig();
  const { getChainById } = useSupabaseData();

    const getRuntimeConfig = () => {
      const contractAddress = config.STABLR_CONTRACT_ADDRESS;
      const adminPrivateKey = config.STABLR_ADMIN_PRIVATE_KEY;
      const chainId = parseInt(config.STABLR_CONTRACT_CHAIN_ID || '8453');
      if (!contractAddress) throw new Error('Stablr contract configuration not found in database');
      const chain = getChainById(chainId);
      if (!chain) throw new Error(`Chain with ID ${chainId} not found in database`);
      return { contractAddress, adminPrivateKey, chain, chainId } as const;
    };

    const getFeeParams = async (provider: ethers.providers.JsonRpcProvider) => {
      const feeData = await provider.getFeeData();
      const base = feeData.lastBaseFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
      const priority = ethers.utils.parseUnits('0.0', 'gwei');
      const maxFeePerGas = base.mul(2).add(priority);
      return { priority, maxFeePerGas } as const;
    };

  // Removed incrementCounter: contract no longer supports it

    const recordDeposit = async (
      params: { chainId: number; amount: ethers.BigNumberish }
    ): Promise<{ success: boolean; txHash?: string; newTotals?: { deposits: number; amount: string }; error?: string }> => {
      setIsIncrementing(true);
      setError(null);
      try {
        const { contractAddress, adminPrivateKey, chain } = getRuntimeConfig();
        if (!adminPrivateKey) throw new Error('STABLR_COUNTER_ADMIN_PRIVATE_KEY missing');

        const provider = new ethers.providers.JsonRpcProvider(getRpcWithFallback(chain.id, chain.rpc_url));
        const signer = new ethers.Wallet(adminPrivateKey, provider);
        const contract = new ethers.Contract(contractAddress, STABLR_CONTRACT_ABI, signer);

        const gasLimit = await contract.estimateGas.recordDeposit(params.chainId, params.amount);
        const { priority, maxFeePerGas } = await getFeeParams(provider);

        const tx = await contract.recordDeposit(params.chainId, params.amount, {
          type: 2,
          gasLimit,
          maxPriorityFeePerGas: priority,
          maxFeePerGas,
        });
        const receipt = await tx.wait();

        // Try decode event for new totals
        let newDeposits: number | undefined;
        let newAmount: string | undefined;
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed.name === 'DepositRecorded') {
              newDeposits = parsed.args.newTotalDeposits.toNumber();
              newAmount = parsed.args.newTotalAmountDeposited.toString();
              break;
            }
          } catch {
            // ignore
          }
        }

        return {
          success: true,
          txHash: receipt.transactionHash,
          newTotals: newDeposits !== undefined && newAmount !== undefined
            ? { deposits: newDeposits, amount: newAmount }
            : undefined,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to record deposit';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsIncrementing(false);
      }
    };

    const getTotalDeposits = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
      try {
        const { contractAddress, chain } = getRuntimeConfig();
        const provider = new ethers.providers.JsonRpcProvider(getRpcWithFallback(chain.id, chain.rpc_url));
        const contract = new ethers.Contract(contractAddress, STABLR_CONTRACT_ABI, provider);

        // Prefer new getter; fallback to legacy public var if calling an older deployed contract
        let countBn: ethers.BigNumber;
        try {
          countBn = await contract.getTotalDepositsCount();
        } catch {
          countBn = await contract.totalDeposits();
        }
        const count = countBn.toNumber();

        console.log('Current total deposits:', count);

        return { success: true, count };

      } catch (err: unknown) {
        console.error('Error getting total deposits:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to get total deposits'
        };
      }
    };

    const getTotalValueDeposited = async (): Promise<{ success: boolean; amountWei?: string; error?: string }> => {
      try {
        const { contractAddress, chain } = getRuntimeConfig();
        const provider = new ethers.providers.JsonRpcProvider(getRpcWithFallback(chain.id, chain.rpc_url));
        const contract = new ethers.Contract(contractAddress, STABLR_CONTRACT_ABI, provider);
        const amount = await contract.totalAmountDeposited();
        return { success: true, amountWei: amount.toString() };
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to get total value' };
      }
    };

    const getTotalValueDepositedByChain = async (chainId: number): Promise<{ success: boolean; amountWei?: string; error?: string }> => {
      try {
        const { contractAddress, chain } = getRuntimeConfig();
        const provider = new ethers.providers.JsonRpcProvider(getRpcWithFallback(chain.id, chain.rpc_url));
        const contract = new ethers.Contract(contractAddress, STABLR_CONTRACT_ABI, provider);
        const amount = await contract.totalAmountDepositedByChain(chainId);
        return { success: true, amountWei: amount.toString() };
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to get value by chain' };
      }
    };

    const getTotalDepositsByChain = async (chainId: number): Promise<{ success: boolean; count?: number; error?: string }> => {
      try {
        const { contractAddress, chain } = getRuntimeConfig();
        const provider = new ethers.providers.JsonRpcProvider(chain.rpc_url);
        const contract = new ethers.Contract(contractAddress, STABLR_CONTRACT_ABI, provider);
        const countBn = await contract.totalDepositsByChain(chainId);
        return { success: true, count: countBn.toNumber() };
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : 'Failed to get deposits by chain' };
      }
    };

    return {
      recordDeposit,
    getTotalDeposits,
      getTotalValueDeposited,
      getTotalValueDepositedByChain,
      getTotalDepositsByChain,
    isIncrementing,
    error
  };

  function getRpcWithFallback(chainId: number, rpcUrl?: string) {
    const fallbackRpcByChainId: Record<number, string> = {
      1: 'https://cloudflare-eth.com',
      137: 'https://polygon-rpc.com',
      42161: 'https://arb1.arbitrum.io/rpc',
      10: 'https://mainnet.optimism.io',
      8453: 'https://mainnet.base.org',
      43114: 'https://api.avax.network/ext/bc/C/rpc',
      56: 'https://bsc-dataseed.binance.org',
      59144: 'https://rpc.linea.build',
    };
    const invalid = !rpcUrl || /blastapi|example|YOUR_API_KEY/i.test(rpcUrl);
    return invalid ? (fallbackRpcByChainId[chainId] || rpcUrl) : rpcUrl!;
  }
};