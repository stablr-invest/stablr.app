import { useState } from 'react';
import { Pool } from '@aave/contract-helpers';
import { providers, Contract, utils } from 'ethers';
import * as markets from '@bgd-labs/aave-address-book';
import { useStablrContract } from './useStablrContract';

interface DepositParams {
  chainId: number;
  tokenAddress: string;
  amount: number;
  userAddress: string;
  provider: providers.Web3Provider;
  onStepChange?: (step: 'approving' | 'depositing') => void;
}

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

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

export const useAaveDeposit = () => {
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { recordDeposit } = useStablrContract();

  const deposit = async ({ chainId, tokenAddress, amount, userAddress, provider, onStepChange }: DepositParams) => {
    setIsDepositing(true);
    setError(null);

    console.log('Deposit params:', { chainId, tokenAddress, amount, userAddress });

    try {
      const market = getMarketConfig(chainId);
      if (!market) {
        throw new Error(`Aave not supported on chain ${chainId}`);
      }

      const signer = provider.getSigner();
      
      // Verify we're on the correct network
      const network = await provider.getNetwork();
      console.log('Provider network:', network.chainId, 'Expected:', chainId);
      
      if (network.chainId !== chainId) {
        throw new Error(`Network mismatch. Connected to chain ${network.chainId}, expected ${chainId}`);
      }
      
      // Get token contract
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
      
      // Get token decimals
      const decimals = await tokenContract.decimals();
      const symbol = await (async () => { try { return await tokenContract.symbol(); } catch { return selectedSymbolFallback(tokenAddress); } })();
      const amountWei = utils.parseUnits(amount.toString(), decimals);

      // Normalize to base-6 units for Stablr logging (USDC-style)
      const diff = Math.abs(decimals - 6);
      const factor = diff === 0 ? undefined : utils.parseUnits('1', diff);
      const normalizedAmount = decimals === 6
        ? amountWei
        : (decimals > 6 ? amountWei.div(factor!) : amountWei.mul(factor!));
      
      console.log('Token details:', { tokenAddress, symbol, decimals, amountWei: amountWei.toString(), normalizedAmount: normalizedAmount.toString(), userAddress });
      
      // Check user balance
      const checksummedUser = utils.getAddress(userAddress);
      const balance = await tokenContract.balanceOf(checksummedUser);
      console.log('User balance:', balance.toString(), 'Required:', amountWei.toString());
      
      if (balance.lt(amountWei)) {
        throw new Error('Insufficient balance');
      }

      // Initialize Aave Pool (config retained for reference)
      new Pool(provider, {
        POOL: market.POOL,
        WETH_GATEWAY: market.WETH_GATEWAY,
      });

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(userAddress, market.POOL);
      console.log('Current allowance:', currentAllowance.toString());
      
      // Approve if needed
      if (currentAllowance.lt(amountWei)) {
        console.log('Approving token spend...');
        onStepChange?.('approving');
        const approveTx = await tokenContract.approve(market.POOL, amountWei);
        await approveTx.wait();
        console.log('Token approved');
      }

      // Execute deposit
      console.log('Executing deposit...');
      onStepChange?.('depositing');
      
      // Use the Pool contract directly instead of the helper
      const poolContract = new Contract(market.POOL, [
        'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external'
      ], signer);
      
      console.log('Calling supply function directly...');
      const tx = await poolContract.supply(
        tokenAddress,
        amountWei,
        userAddress,
        0 // referral code
      );
      
      console.log('Transaction submitted:', tx.hash);
      await tx.wait();
      console.log('Deposit transaction confirmed:', tx.hash);
      
      // Record the Stablr deposit on successful Aave supply
      console.log('Recording Stablr deposit after successful supply (base-6 units)...');
      try {
        const counterResult = await recordDeposit({ chainId, amount: normalizedAmount });
        if (counterResult.success) {
          console.log('Stablr deposit recorded successfully:', {
            txHash: counterResult.txHash,
            newTotals: counterResult.newTotals
          });
        } else {
          console.warn('Failed to record Stablr deposit:', counterResult.error);
          // Don't fail the deposit if counter increment fails
        }
      } catch (counterError) {
        console.warn('Error recording Stablr deposit:', counterError);
        // Don't fail the deposit if counter increment fails
      }

      console.log('Deposit completed successfully');
      
    } catch (err: unknown) {
      console.error('Deposit error:', err);
      
      // Handle specific error types
      const e = err as { code?: number; message?: string };
      if (e.code === 4001) {
        setError('Transaction rejected by user');
      } else if (e.code === -32603) {
        setError('Transaction failed. Please try again.');
      } else if ((e.message as string | undefined)?.includes('insufficient funds')) {
        setError('Insufficient funds for gas fees');
      } else if ((e.message as string | undefined)?.includes('Insufficient balance')) {
        setError('Insufficient token balance');
      } else {
        const message = err instanceof Error ? err.message : 'Deposit failed. Please try again.';
        setError(message);
      }
      
      throw err;
    } finally {
      setIsDepositing(false);
    }
  };

  return {
    deposit,
    isDepositing,
    error
  };
};