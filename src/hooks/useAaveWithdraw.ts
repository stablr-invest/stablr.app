import { useState } from 'react';
import { providers, Contract, utils, BigNumber } from 'ethers';
import { DEFAULT_STABLR_TREASURY_ADDRESS, DEFAULT_STABLR_FEE_ROUTER_ADDRESS } from '../lib/config';
import { STABLR_FEE_ROUTER_ABI } from '../lib/abis/StablrFeeRouter';
import * as markets from '@bgd-labs/aave-address-book';
import { useAppConfig } from './useAppConfig';

interface WithdrawParams {
  chainId: number;
  underlyingAsset: string;
  amount: number;
  userAddress: string;
  provider: providers.Web3Provider;
  isFullWithdraw?: boolean;
  // Optional feeAmount in asset units (not wei). If provided and router exists, we route in one transaction
  feeAmount?: number;
}

const getMarketConfig = (chainId: number) => ({
  1: markets.AaveV3Ethereum,
  137: markets.AaveV3Polygon,
  43114: markets.AaveV3Avalanche,
  42161: markets.AaveV3Arbitrum,
  10: markets.AaveV3Optimism,
  8453: markets.AaveV3Base,
  56: markets.AaveV3BNB,
  59144: markets.AaveV3Linea,
}[chainId] || null);

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function transfer(address to, uint256 value) external returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

export const useAaveWithdraw = () => {
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { config } = useAppConfig();

  const withdraw = async ({ 
    chainId, 
    underlyingAsset, 
    amount, 
    userAddress, 
    provider,
    isFullWithdraw = false,
    feeAmount
  }: WithdrawParams) => {
    // Use config from database with fallbacks
    const treasuryAddress = config.STABLR_TREASURY || DEFAULT_STABLR_TREASURY_ADDRESS;
    const feeRouterAddress = config.STABLR_FEE_ROUTER || DEFAULT_STABLR_FEE_ROUTER_ADDRESS;
    
    setIsWithdrawing(true);
    setError(null);

    console.log('Withdraw params:', { chainId, underlyingAsset, amount, userAddress, isFullWithdraw });

    try {
      const market = getMarketConfig(chainId);
      if (!market) {
        throw new Error(`Aave not supported on chain ${chainId}`);
      }

      // Validate addresses
      if (!underlyingAsset || underlyingAsset === '0x' || underlyingAsset.length !== 42) {
        throw new Error('Invalid underlying asset address');
      }

      // Ensure provider tolerates network changes
      const resilientProvider = new providers.Web3Provider((provider as any).provider || (window as any).ethereum, 'any');
      const signer = resilientProvider.getSigner();
      
      // Verify we're on the correct network
      const network = await resilientProvider.getNetwork();
      console.log('Provider network:', network.chainId, 'Expected:', chainId);
      
      if (network.chainId !== chainId) {
        throw new Error(`Network mismatch. Connected to chain ${network.chainId}, expected ${chainId}`);
      }

      // Get underlying token decimals (aToken decimals match underlying)
      const underlyingContract = new Contract(underlyingAsset, ERC20_ABI, signer);
      const decimals = await underlyingContract.decimals();
      console.log('Underlying token decimals:', decimals);
      
      // Convert requested amount (partial or full) to wei with flooring to token decimals
      let withdrawAmount;
      let feeAmountWei = utils.parseUnits('0', 0);
      const scale = Math.pow(10, decimals);
      const floored = Math.floor(Number(amount) * scale) / scale;
      const amountStr = Number.isFinite(floored) ? floored.toFixed(decimals) : '0';
      withdrawAmount = utils.parseUnits(amountStr, decimals);
      console.log('Requested withdraw amount (floored, wei):', withdrawAmount.toString());

      if (feeAmount && feeAmount > 0) {
        // Apply 6-decimal rule from UI, and zero-out fees below threshold
        const uiRounded = Number(feeAmount.toFixed ? feeAmount.toFixed(6) : Number(feeAmount).toFixed(6));
        if (uiRounded < 0.000001) {
          feeAmountWei = utils.parseUnits('0', decimals);
        } else {
          // Round down to token decimals to avoid fractional component errors
          const feeStr = Number(uiRounded).toFixed(decimals);
        try {
          feeAmountWei = utils.parseUnits(feeStr, decimals);
        } catch (e) {
          console.warn('Failed to parse fee amount, defaulting to 0. Fee string:', feeStr, 'decimals:', decimals);
          feeAmountWei = utils.parseUnits('0', decimals);
        }
        }
      }

      console.log('Using addresses:', { poolAddress: market.POOL, underlyingAsset, router: feeRouterAddress || 'none' });

      // New flow:
      // Step 1: Withdraw requested amount to user (no fee withheld)
      const poolContract = new Contract(market.POOL, [
        'function withdraw(address asset, uint256 amount, address to) external returns (uint256)'
      ], signer);
      console.log('Pool.withdraw requested amount to user:', (withdrawAmount as BigNumber).toString());
      const tx = await poolContract.withdraw(
        underlyingAsset,
        withdrawAmount,
        userAddress
      );
      
      console.log('Withdrawal transaction submitted:', tx.hash);
      const receipt = await tx.wait();
      console.log('Withdrawal transaction confirmed:', tx.hash);
      console.log('Gas used:', receipt.gasUsed.toString());

      // Step 2: If a fee applies, ask user to send fee from wallet to treasury
      let treasuryReceived = 0;
      if (feeAmountWei.gt(0)) {
        console.log('Sending fee from user to treasury:', feeAmountWei.toString());
        const feeTx = await underlyingContract.transfer(treasuryAddress, feeAmountWei);
        console.log('Fee transfer submitted:', feeTx.hash);
        const feeReceipt = await feeTx.wait();
        console.log('Fee transfer confirmed:', feeTx.hash);

        // Parse logs to confirm amount received
        const iface = new utils.Interface(ERC20_ABI);
        const treasury = utils.getAddress(treasuryAddress);
        const tokenAddress = utils.getAddress(underlyingAsset);
        let treasuryReceivedWei = utils.parseUnits('0', decimals);
        for (const log of feeReceipt.logs) {
          if (log.address && utils.getAddress(log.address) === tokenAddress) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed && parsed.name === 'Transfer') {
                const to = utils.getAddress(parsed.args[1]);
                if (to === treasury) {
                  const value = parsed.args[2] as any;
                  treasuryReceivedWei = treasuryReceivedWei.add(value);
                }
              }
            } catch {}
          }
        }
        treasuryReceived = parseFloat(utils.formatUnits(treasuryReceivedWei, decimals));
        console.log('Treasury received (from user):', treasuryReceived, 'token units');
      }

      console.log('Withdrawal completed successfully');

      return {
        txHash: tx.hash as string,
        usedRouter: false,
        treasuryReceived,
      };
      
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      
      // Handle specific error types
      if (err.code === 4001) {
        setError('Transaction rejected by user');
      } else if (err.code === -32603) {
        setError('Transaction failed. Please try again.');
      } else if (err.message?.includes('insufficient funds')) {
        setError('Insufficient funds for gas fees');
      } else if (err.message?.includes('Insufficient aToken balance')) {
        setError('Insufficient balance for withdrawal');
      } else if (err.message?.includes('invalid contract address')) {
        setError('Invalid contract address. Please try refreshing and reconnecting your wallet.');
      } else {
        setError(err.message || 'Withdrawal failed. Please try again.');
      }
      
      throw err;
    } finally {
      setIsWithdrawing(false);
    }
  };

  return {
    withdraw,
    isWithdrawing,
    error
  };
};