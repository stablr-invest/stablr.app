import React, { useState } from 'react';
import { X, ArrowRight, Shield, AlertTriangle, Wallet, Loader2, Check } from 'lucide-react';
import type { providers } from 'ethers';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useAaveDeposit } from '../hooks/useAaveDeposit';
import type { YieldOpportunity, Asset } from '../types';

interface DepositModalProps {
  opportunity: YieldOpportunity;
  onClose: () => void;
  wallet: {
    isConnected: boolean;
    address: string | null;
    chainId: number | null;
    provider: providers.Web3Provider | null;
  };
  balances: Array<{ chainId: number; chainName: string; usdc: number; usdt: number; isLoading: boolean; error?: string }>;
  isLoadingBalances: boolean;
  connectWallet: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  refreshBalances: () => Promise<void> | void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ opportunity, onClose, wallet, balances, isLoadingBalances, connectWallet, switchChain, refreshBalances }) => {
  const { getStablecoinAddress } = useSupabaseData();
  const { deposit, isDepositing, error: depositError } = useAaveDeposit();
  
  const [selectedAsset, setSelectedAsset] = useState<Asset>(opportunity.assets[0]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'input' | 'approving' | 'depositing' | 'success'>('input');
  const [txHash, setTxHash] = useState<string | null>(null);

  // Get chain ID from opportunity chain name
  const getChainId = (chainName: string): number => {
    const chainMap: Record<string, number> = {
      'ethereum': 1,
      'base': 8453,
      'arbitrum': 42161,
      'polygon': 137,
      'optimism': 10,
      'avalanche': 43114,
      'bnb': 56,
      'linea': 59144,
      'bnbchain': 56,
      'polygonpos': 137
    };
    return chainMap[chainName.toLowerCase()] || 1;
  };

  const chainId = getChainId(opportunity.chain);
  
  // On open or when switching asset/chain, refresh balances to get freshest data
  React.useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      refreshBalances?.();
    }
  }, [wallet.isConnected, wallet.address, chainId, selectedAsset, refreshBalances]);

  // Get user's balance for selected asset on the current chain
  const getUserBalance = (): number => {
    if (!wallet.isConnected || !balances.length) return 0;
    
    const chainBalance = balances.find(b => b.chainId === chainId);
    if (!chainBalance) return 0;
    
    return selectedAsset === 'USDC' ? chainBalance.usdc : chainBalance.usdt;
  };

  const userBalance = getUserBalance();
  const maxAmount = userBalance;
  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum > 0 && amountNum <= maxAmount;

   // Auto-switch to the holding's chain when modal opens if needed
  React.useEffect(() => {
    const doSwitch = async () => {
      if (!wallet.isConnected || wallet.chainId === chainId) return;
      try {
        await switchChain(chainId);
        refreshBalances?.();
      } catch (e) {
        console.warn('Network switch failed:', e);
        setError(`Please switch to ${opportunity.chain} network`);
      }
    };
    doSwitch();
  }, [wallet.isConnected, wallet.chainId, chainId, opportunity.chain, switchChain, refreshBalances]);

  
  const handleDeposit = async () => {
    setError(null);
    setCurrentStep('input');
    
    if (!wallet.isConnected) {
      try {
        setCurrentStep('input');
        await connectWallet();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect wallet');
        setCurrentStep('input');
        return;
      }
    }

    if (!isValidAmount) {
      setError('Please enter a valid amount');
      setCurrentStep('input');
      return;
    }

    const tokenAddress = getStablecoinAddress(selectedAsset, chainId);
    if (!tokenAddress) {
      setError(`${selectedAsset} not supported on ${opportunity.chain}`);
      setCurrentStep('input');
      return;
    }

    try {
      console.log('Starting deposit:', {
        chainId,
        tokenAddress,
        amount: amountNum,
        userAddress: wallet.address,
        currentChainId: wallet.chainId
      });
      
      // Set step to approving initially - the deposit hook will handle the actual steps
      setCurrentStep('approving');
      
      await deposit({
        chainId,
        tokenAddress,
        amount: amountNum,
        userAddress: wallet.address!,
        provider: wallet.provider!,
        onStepChange: (step: 'approving' | 'depositing') => {
          setCurrentStep(step);
        }
      });
      
      setCurrentStep('success');
      
      // Success - trigger immediate wallet balance refresh (ignore errors)
      try {
        await Promise.resolve(refreshBalances?.());
      } catch {
        // ignore refresh errors
      }

      // Emit one-off portfolio refresh and schedule a couple of delayed retries
      window.dispatchEvent(new CustomEvent('portfolio-updated'));
      setTimeout(() => window.dispatchEvent(new CustomEvent('portfolio-updated')), 1500);
      setTimeout(() => window.dispatchEvent(new CustomEvent('portfolio-updated')), 5000);
      
      // Close modal after showing success for 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Deposit error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Deposit failed';
      setError(errorMessage);
      setCurrentStep('input');
    }
  };

  const handleMaxClick = () => {
    setAmount(maxAmount.toString());
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return '0.00';
    if (balance < 0.01) return '<0.01';
    return balance.toFixed(2);
  };

  // Check if user needs to connect wallet
  if (!wallet.isConnected) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Connect Wallet</h3>
              <p className="text-sm text-slate-600 mt-1">
                Connect your wallet to deposit into {opportunity.protocol}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          <div className="text-center py-8">
            <Wallet className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 mb-6">
              You need to connect your wallet to make deposits
            </p>
            <button
              onClick={connectWallet}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main deposit modal

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Deposit Funds</h3>
            <p className="text-sm text-slate-600 mt-1">
              {`${opportunity.protocol.charAt(0).toUpperCase()}${opportunity.protocol.slice(1)} • ${opportunity.chain.charAt(0).toUpperCase()}${opportunity.chain.slice(1)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
          {/* Left column: pool info, notice, asset selection */}
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Pool</span>
                <span className="text-sm text-slate-600">{opportunity.pool}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">APY</span>
                <span className="text-sm font-bold text-green-600">{opportunity.apy.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Risk Level</span>
                <div className="flex items-center space-x-1">
                  {opportunity.risk === 'low' ? (
                    <Shield className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                  <span className="text-sm text-slate-600 capitalize">{opportunity.risk}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 mb-1">Direct Protocol Interaction</h4>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Your funds will be deposited directly to {opportunity.protocol}'s smart contracts.
                    Stablr never holds your assets, eliminating custodial risk.
                  </p>
                </div>
              </div>
            </div>

            {opportunity.assets.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Asset</label>
                <div className="flex flex-wrap gap-2">
                  {opportunity.assets.map((asset) => (
                    <button
                      key={asset}
                      onClick={() => setSelectedAsset(asset)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedAsset === asset
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {asset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: balances, amount, errors, steps, primary action */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Available Balance</label>
                {isLoadingBalances && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{selectedAsset} on {opportunity.chain.charAt(0).toUpperCase()}{opportunity.chain.slice(1)}</span>
                  <span className="font-semibold text-slate-900">{formatBalance(userBalance)} {selectedAsset}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`0.00 (Max: ${formatBalance(maxAmount)})`}
                  max={maxAmount}
                  step="0.01"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-20 ${
                    amount && !isValidAmount ? 'border-red-300 bg-red-50' : 'border-slate-300'
                  }`}
                />
                <div className="absolute right-3 top-3 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    MAX
                  </button>
                  <span className="text-sm font-medium text-slate-600">{selectedAsset}</span>
                </div>
              </div>
              {amount && !isValidAmount && (
                <p className="text-xs text-red-600 mt-1">{amountNum > maxAmount ? 'Insufficient balance' : 'Please enter a valid amount'}</p>
              )}
            </div>

            {(error || depositError) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700">{error || depositError}</span>
                </div>
              </div>
            )}

            {currentStep !== 'input' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="relative">
                  <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-blue-200" aria-hidden />
                  <div className="space-y-6">
                    <div className="relative flex items-start">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentStep === 'approving' ? 'bg-blue-600 text-white' : currentStep === 'depositing' || currentStep === 'success' ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                        {currentStep === 'approving' ? <Loader2 className="h-3 w-3 animate-spin" /> : currentStep === 'depositing' || currentStep === 'success' ? <Check className="h-3 w-3" /> : '1'}
                      </div>
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${currentStep === 'approving' ? 'text-blue-700' : currentStep === 'depositing' || currentStep === 'success' ? 'text-green-700' : 'text-slate-600'}`}>Approve Token Spending</div>
                        {currentStep === 'approving' && <div className="text-xs text-blue-700 mt-1">Please approve the token spending in your wallet...</div>}
                      </div>
                    </div>
                    <div className="relative flex items-start">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentStep === 'depositing' ? 'bg-blue-600 text-white' : currentStep === 'success' ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                        {currentStep === 'depositing' ? <Loader2 className="h-3 w-3 animate-spin" /> : currentStep === 'success' ? <Check className="h-3 w-3" /> : '2'}
                      </div>
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${currentStep === 'depositing' ? 'text-blue-700' : currentStep === 'success' ? 'text-green-700' : 'text-slate-600'}`}>Deposit to Protocol</div>
                        {currentStep === 'depositing' && <div className="text-xs text-blue-700 mt-1">Please confirm the deposit transaction in your wallet...</div>}
                        {currentStep === 'success' && <div className="text-xs text-green-700 mt-1">Deposit completed successfully! 🎉</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleDeposit}
              disabled={!isValidAmount || userBalance === 0 || currentStep !== 'input' || isDepositing}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {currentStep === 'approving' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Approving...</span>
                </>
              ) : currentStep === 'depositing' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Depositing...</span>
                </>
              ) : currentStep === 'success' ? (
                <>
                  <span>✓ Deposit Complete!</span>
                </>
              ) : userBalance === 0 ? (
                <span>No {selectedAsset} Balance</span>
              ) : wallet.chainId !== chainId ? (
                <>
                  <span>Deposit {amount || '0'} {selectedAsset}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Deposit {amount || '0'} {selectedAsset}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};