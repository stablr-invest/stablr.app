import React, { useState } from 'react';
import { X, ArrowLeft, AlertTriangle, Loader2, DollarSign, Check } from 'lucide-react';
import { useAaveWithdraw } from '../hooks/useAaveWithdraw';
import { DEFAULT_STABLR_FEE_RATE, calculateFeeRate } from '../lib/config';
import { useAppConfig } from '../hooks/useAppConfig';
import type { AaveHolding } from '../hooks/useAaveHoldings';

interface WalletLike {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  provider: any;
}

interface WithdrawModalProps {
  holding: AaveHolding;
  wallet: WalletLike;
  switchChain: (chainId: number) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ holding, wallet, switchChain, onClose, onSuccess }) => {
  const { withdraw, isWithdrawing, error: withdrawError } = useAaveWithdraw();
  const { config } = useAppConfig();
  
  const [withdrawType, setWithdrawType] = useState<'partial' | 'full'>('partial');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'input' | 'withdrawing' | 'sendingFee' | 'success'>('input');

  const maxAmount = holding.aTokenBalance;
  const amountNum = Math.max(0, Math.floor((parseFloat(amount) || 0) * 1e6) / 1e6);
  const isValidAmount = amountNum > 0 && amountNum <= maxAmount;

  // Fee logic:
  // Use config from database with fallback
  const feeRate = config.STABLR_FEE_BPS ? calculateFeeRate(config.STABLR_FEE_BPS) : DEFAULT_STABLR_FEE_RATE;
  
  // If withdrawal amount > original deposit (principal), fee is 0.1% of the excess (earnings withdrawn)
  // Else, no fee
  const originalDeposit = (typeof holding.derivedDeposit === 'number' && isFinite(holding.derivedDeposit))
    ? holding.derivedDeposit
    : holding.balance; // fall back to subgraph principal if derived not ready
  const currentBalance = holding.aTokenBalance; // principal + earnings
  const effectiveWithdrawal = withdrawType === 'full' ? currentBalance : amountNum;
  // Guard against tiny floating precision issues when converting to wei
  const decimalPlaces = 6; // UI step uses 6
  const normalizedEffectiveWithdrawal = Math.floor(effectiveWithdrawal * 1e6) / 1e6;

  // Interest earnings portion of this withdrawal (only earnings withdrawn above principal)
  const interestForThisWithdrawal = Math.max(0, effectiveWithdrawal - originalDeposit);

  // Fee is charged only on the interest portion above 1e-6 threshold
  const feeBase = interestForThisWithdrawal;
  const rawFee = feeBase > 0 ? feeBase * feeRate : 0;
  const roundedFee = parseFloat(rawFee.toFixed(6));
  const stablrFee = roundedFee >= 0.000001 ? roundedFee : 0;
  // net payout preview handled below; keep fee only for display

  // Auto-switch to the holding's chain when modal opens if needed
  React.useEffect(() => {
    const doSwitch = async () => {
      if (!wallet.isConnected || wallet.chainId === holding.chainId) return;
      try {
        await switchChain(holding.chainId);
      } catch (e) {
        console.warn('Network switch failed:', e);
        setError(`Please switch to ${holding.chainName} network`);
      }
    };
    doSwitch();
  }, [wallet.isConnected, wallet.chainId, holding.chainId, holding.chainName, switchChain]);

  const handleWithdraw = async () => {
    setError(null);
    
    if (!wallet.isConnected || !wallet.provider) {
      setError('Wallet not connected');
      return;
    }

    // Validate holding data (only underlying needed for Aave Pool.withdraw)
    if (!holding.underlyingAsset || holding.underlyingAsset === '0x' || holding.underlyingAsset.length !== 42) {
      setError('Invalid underlying asset address. Please refresh your portfolio.');
      return;
    }

    // Ensure correct chain; auto switch if needed
    if (wallet.chainId !== holding.chainId) {
      try {
        await switchChain(holding.chainId);
      } catch (e) {
        setError(`Please switch to ${holding.chainName} network`);
        return;
      }
    }

    const isFullWithdraw = withdrawType === 'full';
    
    if (!isFullWithdraw && !isValidAmount) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      console.log('Starting withdrawal:', {
        chainId: holding.chainId,
        aTokenAddress: holding.aTokenAddress,
        underlyingAsset: holding.underlyingAsset,
        amount: isFullWithdraw ? maxAmount : amountNum,
        userAddress: wallet.address,
        isFullWithdraw
      });
      
      setCurrentStep(stablrFee > 0 ? 'withdrawing' : 'withdrawing');
      const result = await withdraw({
        chainId: holding.chainId,
        underlyingAsset: holding.underlyingAsset,
        amount: isFullWithdraw ? holding.aTokenBalance : normalizedEffectiveWithdrawal,
        userAddress: wallet.address!,
        provider: wallet.provider,
        isFullWithdraw,
        // Pass fee once; hook will handle 1-tx (router) or 2-tx (net to user + fee to treasury)
        feeAmount: stablrFee
      });
      if (result) {
        console.log('Verification:', {
          txHash: result.txHash,
          usedRouter: result.usedRouter,
          treasuryReceived: result.treasuryReceived
        });
        if (!result.usedRouter && stablrFee > 0) {
          setCurrentStep('sendingFee');
        }
      }

      setCurrentStep('success');
      // Emit refresh then close modal
      window.dispatchEvent(new CustomEvent('portfolio-updated'));
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Withdrawal error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Withdrawal failed';
      setError(errorMessage);
    }
  };

  const handleMaxClick = () => {
    setAmount(maxAmount.toString());
    setWithdrawType('partial');
  };

  const formatCurrency = (amount: number) => {
    if (!isFinite(amount) || isNaN(amount) || amount === 0) {
      return '$0.00';
    }
    
    if (amount < 0.01 && amount > 0) {
      return '<$0.01';
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  };

  const formatCurrency6 = (amount: number) => {
    const safe = isFinite(amount) && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    }).format(safe);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Withdraw Funds</h3>
            <p className="text-sm text-slate-600 mt-1">
              {holding.protocol} • {holding.chainName} • {holding.asset}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column: position and fee info */}
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-slate-700">Current Balance</span>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(holding.aTokenBalance)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-700">Total Earnings</span>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(holding.earnings)}</p>
                </div>
                
                <div>
                  <span className="text-sm font-medium text-slate-700">APY</span>
                  <p className="text-sm text-slate-600">{holding.apy.toFixed(2)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <DollarSign className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="w-full">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Withdrawal Breakdown</h4>
                  <div className="space-y-2 text-xs text-blue-700 w-full">
                    <div className="flex justify-between"><span>Requested Withdrawal:</span><span>{formatCurrency(effectiveWithdrawal)}</span></div>
                    <div className="flex justify-between"><span>Interest Earnings:</span><span>{formatCurrency(interestForThisWithdrawal)}</span></div>
                    <div className="flex justify-between"><span>Stablr Fee ({(feeRate * 100).toFixed(0)}% of Earnings):</span><span>{formatCurrency6(stablrFee)}</span></div>
                    <div className="flex justify-between font-medium border-t border-blue-300 pt-1"><span>Net Withdrawal Amount:</span><span>{formatCurrency(Math.max(0, effectiveWithdrawal - stablrFee))}</span></div>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

          {/* Right column: type, amount, errors, action */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Withdrawal Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setWithdrawType('partial')} className={`p-3 rounded-xl border-2 transition-all duration-200 ${withdrawType === 'partial' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                  <div className="text-center">
                    <div className="font-medium">Partial</div>
                    <div className="text-xs">Specify amount</div>
                  </div>
                </button>
                <button onClick={() => setWithdrawType('full')} className={`p-3 rounded-xl border-2 transition-all duration-200 ${withdrawType === 'full' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                  <div className="text-center">
                    <div className="font-medium">Full</div>
                    <div className="text-xs">Withdraw all</div>
                  </div>
                </button>
              </div>
            </div>

            {withdrawType === 'partial' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Withdrawal Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`0.00 (Max: ${maxAmount.toFixed(6)})`}
                    max={maxAmount}
                    step="0.000001"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-20 ${amount && !isValidAmount ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                  />
                  <div className="absolute right-3 top-3 flex items-center space-x-2">
                    <button type="button" onClick={handleMaxClick} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors">MAX</button>
                    <span className="text-sm font-medium text-slate-600">{holding.asset}</span>
                  </div>
                </div>
                {amount && !isValidAmount && (
                  <p className="text-xs text-red-600 mt-1">{amountNum > maxAmount ? 'Amount exceeds available balance' : 'Please enter a valid amount'}</p>
                )}
              </div>
            )}

            {(error || withdrawError) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700">{error || withdrawError}</span>
                </div>
              </div>
            )}

            {currentStep !== 'input' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="relative">
                  <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-blue-200" aria-hidden />
                  <div className="space-y-6">
                    <div className="relative flex items-start">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentStep === 'withdrawing' ? 'bg-blue-600 text-white' : currentStep === 'sendingFee' || currentStep === 'success' ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                        {currentStep === 'withdrawing' ? <Loader2 className="h-3 w-3 animate-spin" /> : currentStep === 'sendingFee' || currentStep === 'success' ? <Check className="h-3 w-3" /> : '1'}
                      </div>
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${currentStep === 'withdrawing' ? 'text-blue-700' : currentStep === 'sendingFee' || currentStep === 'success' ? 'text-green-700' : 'text-slate-600'}`}>Withdraw to Wallet</div>
                        {currentStep === 'withdrawing' && <div className="text-xs text-blue-700 mt-1">Confirm the withdrawal transaction in your wallet...</div>}
                      </div>
                    </div>

                    {stablrFee > 0 && (
                      <div className="relative flex items-start">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentStep === 'sendingFee' ? 'bg-blue-600 text-white' : currentStep === 'success' ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                          {currentStep === 'sendingFee' ? <Loader2 className="h-3 w-3 animate-spin" /> : currentStep === 'success' ? <Check className="h-3 w-3" /> : '2'}
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${currentStep === 'sendingFee' ? 'text-blue-700' : currentStep === 'success' ? 'text-green-700' : 'text-slate-600'}`}>Send Stablr Fee</div>
                          {currentStep === 'sendingFee' && <div className="text-xs text-blue-700 mt-1">Confirm the fee transfer in your wallet...</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || (withdrawType === 'partial' && !isValidAmount) || holding.aTokenBalance === 0}
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white py-3 rounded-xl font-medium hover:from-red-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>
                    {currentStep === 'withdrawing' && 'Withdrawing...'}
                    {currentStep === 'sendingFee' && 'Sending Fee...'}
                    {currentStep === 'success' && 'Finalizing...'}
                  </span>
                </>
              ) : holding.aTokenBalance === 0 ? (
                <span>No Balance to Withdraw</span>
              ) : withdrawType === 'full' ? (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Withdraw All ({formatCurrency(maxAmount)})</span>
                </>
              ) : (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Withdraw {amount || '0'} {holding.asset}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};