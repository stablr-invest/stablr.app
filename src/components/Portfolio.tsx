import React from 'react';
import { Wallet, TrendingUp, Coins, Building2, LogOut, ChevronDown, ChevronUp, Loader2, AlertCircle, RefreshCw, PiggyBank } from 'lucide-react';
import type { PortfolioData } from '../types';
import { useWallet } from '../hooks/useWallet';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useAaveHoldings } from '../hooks/useAaveHoldings';
import { WithdrawModal } from './WithdrawModal';
import type { AaveHolding } from '../hooks/useAaveHoldings';
import { useAaveData } from '../hooks/useAaveData';

interface PortfolioProps {
  data: PortfolioData;
}

export const Portfolio: React.FC<PortfolioProps> = ({ data }) => {
  const { wallet, balances, isLoadingBalances, isRefreshingBalances, balancesLastUpdated, refreshBalances, switchChain } = useWallet();
  const { getChainById, isLoading: isDataLoading } = useSupabaseData();
  const { holdings, isLoading: isHoldingsLoading, isRefreshing: isHoldingsRefreshing, isDepositsLoading, lastUpdated: holdingsLastUpdated, totalEarnings: holdingsEarnings, refetch: refetchHoldings } = useAaveHoldings(wallet.address);
  const { aaveOpportunities, fetchAaveData } = useAaveData();
  const [selectedChainBalance, setSelectedChainBalance] = React.useState<string | null>(null);
  const [selectedChainEarnings, setSelectedChainEarnings] = React.useState<string | null>(null);
  const [selectedChainDeposited, setSelectedChainDeposited] = React.useState<string | null>(null);
  const [forceRender, setForceRender] = React.useState(0);
  const [withdrawModal, setWithdrawModal] = React.useState<{
    isOpen: boolean;
    holding: AaveHolding | null;
  }>({
    isOpen: false,
    holding: null
  });

  const overallLastUpdated = React.useMemo(() => {
    const ts = Math.max(holdingsLastUpdated || 0, balancesLastUpdated || 0);
    return ts === 0 ? null : ts;
  }, [holdingsLastUpdated, balancesLastUpdated]);

  const updatedLabel = React.useMemo(() => {
    if (!overallLastUpdated) return '—';
    const secs = Math.max(1, Math.floor((Date.now() - overallLastUpdated) / 1000));
    return `Updated ${secs}s ago`;
  }, [overallLastUpdated, forceRender]);

  // Listen for wallet connection events and force refresh
  React.useEffect(() => {
    const handleWalletConnected = () => {
      console.log('Wallet connected');
      refreshBalances();
      refetchHoldings();
      fetchAaveData();
    };

    window.addEventListener('wallet-connected', handleWalletConnected);
    
    return () => {
      window.removeEventListener('wallet-connected', handleWalletConnected);
    };
  }, [refreshBalances, refetchHoldings, fetchAaveData]);
  
  // Listen for one-off portfolio update events (withdraw/deposit complete)
  React.useEffect(() => {
    const handlePortfolioUpdated = () => {
      // Immediate refresh
      refreshBalances();
      refetchHoldings();
      fetchAaveData();
    };

    window.addEventListener('portfolio-updated', handlePortfolioUpdated);
    return () => window.removeEventListener('portfolio-updated', handlePortfolioUpdated);
  }, [refreshBalances, refetchHoldings, fetchAaveData]);

  // // Safety: on first mount, if wallet is connected and holdings are empty, trigger one-time fetch
  // React.useEffect(() => {
  //   if (wallet.isConnected && wallet.address && !isHoldingsLoading && holdings.length === 0) {
  //     const timer = setTimeout(() => {
  //       refetchHoldings();
  //     }, 300);
  //     return () => clearTimeout(timer);
  //   }
  // }, [wallet.isConnected, wallet.address, isHoldingsLoading, holdings.length, refetchHoldings]);

  const formatCurrency = (amount: number) => {
    // Handle very large or invalid numbers
    if (!isFinite(amount) || isNaN(amount) || amount === 0) {
      return '$0.00';
    }
    
    // Handle very small amounts
    if (amount < 0.01 && amount > 0) {
      return '<$0.01';
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Helper kept minimal; display uses color only

  const getChainColor = (chainId: number | string) => {
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
    const chain = getChainById(numericChainId);
    return chain ? chain.color : '#64748b';
  };

  // Ensure the APY shown in Holdings matches the Yield Opportunities source exactly
  const getApyForHolding = (holding: AaveHolding): number => {
    if (!aaveOpportunities || aaveOpportunities.length === 0) return holding.apy || 0;
    const dbChain = getChainById(holding.chainId);

    // Strategy 1: direct chain name match
    let match = aaveOpportunities.find(o =>
      o.protocol === 'Aave' &&
      (o.assets as string[]).some(a => a.toLowerCase() === holding.asset.toLowerCase()) &&
      o.chain.toLowerCase() === holding.chainName.toLowerCase()
    );

    // Strategy 2: slug from DB chain name
    if (!match && dbChain) {
      const slug = dbChain.name.toLowerCase().replace(/\s+/g, '');
      match = aaveOpportunities.find(o =>
        o.protocol === 'Aave' &&
        (o.assets as string[]).some(a => a.toLowerCase() === holding.asset.toLowerCase()) &&
        o.chain.toLowerCase() === slug
      );
    }

    // Strategy 3: slug from holding chainName
    if (!match) {
      const holdingSlug = holding.chainName.toLowerCase().replace(/\s+/g, '');
      match = aaveOpportunities.find(o =>
        o.protocol === 'Aave' &&
        (o.assets as string[]).some(a => a.toLowerCase() === holding.asset.toLowerCase()) &&
        o.chain.toLowerCase() === holdingSlug
      );
    }

    return match ? match.apy : (holding.apy || 0);
  };

  const handleWithdraw = (holding: AaveHolding) => {
    setWithdrawModal({ isOpen: true, holding });
  };

  const handleCloseWithdrawModal = () => {
    setWithdrawModal({ isOpen: false, holding: null });
  };

  const handleWithdrawSuccess = () => {
    // Refresh holdings and balances after successful withdrawal
    refetchHoldings();
    refreshBalances();
    setForceRender(prev => prev + 1);
  };

  // Group holdings by chain for breakdowns
  const holdingsByChain = holdings.reduce((acc, holding) => {
    const chainId = holding.chainId.toString();
    if (!acc[chainId]) {
      acc[chainId] = {
        chainId: holding.chainId,
        chainName: holding.chainName,
        totalValue: 0,
        totalEarnings: 0,
        totalDeposited: 0,
        holdings: [] as AaveHolding[]
      };
    }
    acc[chainId].totalValue += holding.aTokenBalance;
    acc[chainId].totalEarnings += holding.earnings;
    acc[chainId].totalDeposited += holding.balance;
    acc[chainId].holdings.push(holding);
    return acc;
  }, {} as Record<string, {
    chainId: number;
    chainName: string;
    totalValue: number;
    totalEarnings: number;
    totalDeposited: number;
    holdings: AaveHolding[];
  }>);

  // Calculate totals from real wallet balances
  const totalIdleValue = wallet.isConnected 
    ? balances.reduce((sum, balance) => sum + balance.usdc + balance.usdt, 0)
    : data.totalValue;
    
  // Derived non-zero balances not required in current UI

  const totalPortfolioEarnings = isFinite(holdingsEarnings) ? holdingsEarnings : 0;
  // Total Yield Token Balance across all chains/tokens (aToken balances)
  const totalPortfolioBalance = holdings.reduce((sum, h) => sum + (isFinite(h.aTokenBalance) ? h.aTokenBalance : 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8" key={forceRender}>
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-2">
          <Wallet className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Portfolio Overview</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{updatedLabel}</span>
            <button
              disabled={isHoldingsLoading || isLoadingBalances}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              onClick={() => {
                refreshBalances();
                refetchHoldings();
                fetchAaveData();
                setForceRender(prev => prev + 1);
                window.dispatchEvent(new CustomEvent('portfolio-refresh'));
              }}
              title="Refresh Portfolio"
            >
              <RefreshCw className={`h-4 w-4 ${(isHoldingsRefreshing || isRefreshingBalances) ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 relative">
          <div className="flex items-center space-x-3 mb-2">
            <Coins className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Idle Stablecoins</span>
            {isLoadingBalances && balances.length === 0 && (
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            )}
          </div>
          <p className="text-2xl font-bold text-blue-900">
            {formatCurrency(totalIdleValue)}
          </p>
          
          {/* Chain Balance Boxes (show even while loading; per-chain spinners update on the fly) */}
          {wallet.isConnected && (
            <div className="mt-4">
              {balances.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {balances.map((balance) => {
                      const totalBalance = balance.usdc + balance.usdt;
                      const hasBalance = totalBalance > 0;
                      
                      return (
                        <div key={balance.chainId} className="flex flex-col">
                          <button
                            onClick={() => setSelectedChainBalance(
                              selectedChainBalance === balance.chainId.toString() ? null : balance.chainId.toString()
                            )}
                            className={`flex items-center space-x-2 px-3 py-2 rounded-lg border-2 transition-all duration-200 ${
                              selectedChainBalance === balance.chainId.toString()
                                ? 'border-blue-500 bg-blue-100'
                                : hasBalance 
                                  ? 'border-slate-200 hover:border-slate-300 bg-white'
                                  : 'border-slate-100 bg-slate-50 opacity-60'
                            }`}
                            disabled={balance.isLoading || isDataLoading}
                          >
                            {balance.isLoading || isLoadingBalances ? (
                              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                            ) : balance.error ? (
                              <AlertCircle className="w-3 h-3 text-red-500" />
                            ) : (
                              (() => {
                                const chain = getChainById(balance.chainId);
                                return chain?.logo ? (
                                  <img 
                                    src={chain.logo}
                                    alt={balance.chainName}
                                    className="w-3 h-3 rounded-full"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const fallback = document.createElement('div');
                                      fallback.className = 'w-3 h-3 rounded-full';
                                      fallback.style.backgroundColor = getChainColor(balance.chainId);
                                      target.parentNode?.insertBefore(fallback, target);
                                    }}
                                  />
                                ) : (
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: getChainColor(balance.chainId) }}
                                  />
                                );
                              })()
                            )}
                            <span className="text-xs font-medium text-slate-700">
                              {balance.chainName}
                            </span>
                            <span className={`text-xs font-bold ${hasBalance ? 'text-blue-600' : 'text-slate-400'}`}>
                              {formatCurrency(totalBalance)}
                            </span>
                            {selectedChainBalance === balance.chainId.toString() ? (
                              <ChevronUp className="h-3 w-3 text-slate-500" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-slate-500" />
                            )}
                          </button>
                          
                          {/* Chain Balance Breakdown - appears directly under the clicked chain */}
                          {selectedChainBalance === balance.chainId.toString() && (
                            <div className="mt-2 bg-white rounded-lg border border-slate-200 p-3 min-w-[200px]">
                              {balance.error ? (
                                <div className="flex items-center space-x-2 text-red-600">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-sm">{balance.error}</span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-600">
                                      {balance.chainName} Balances
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">USDC</span>
                                    <span className="text-xs font-semibold text-slate-700">
                                      {formatCurrency(balance.usdc)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">USDT</span>
                                    <span className="text-xs font-semibold text-slate-700">
                                      {formatCurrency(balance.usdt)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500">
                    No stablecoin balances found
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">Earnings</span>
            {isHoldingsLoading && holdings.length === 0 && (
              <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
            )}
          </div>
          <p className="text-2xl font-bold text-green-900">{formatCurrency(totalPortfolioEarnings)}</p>
          
          {/* Chain Earnings Breakdown */}
          {wallet.isConnected && Object.keys(holdingsByChain).length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.values(holdingsByChain).map((chainData) => {
                  const hasEarnings = chainData.totalEarnings > 0;
                  
                  return (
                    <div key={chainData.chainId} className="flex flex-col">
                      <button
                        onClick={() => setSelectedChainEarnings(
                          selectedChainEarnings === chainData.chainId.toString() ? null : chainData.chainId.toString()
                        )}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border-2 transition-all duration-200 ${
                          selectedChainEarnings === chainData.chainId.toString()
                            ? 'border-green-500 bg-green-100'
                            : hasEarnings 
                              ? 'border-slate-200 hover:border-slate-300 bg-white'
                              : 'border-slate-100 bg-slate-50 opacity-60'
                        }`}
                        disabled={isHoldingsLoading || isDataLoading}
                      >
                        {(() => {
                          const chain = getChainById(chainData.chainId);
                          return chain?.logo ? (
                            <img
                              src={chain.logo}
                              alt={chainData.chainName}
                              className="w-4 h-4 rounded-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'w-3 h-3 rounded-full';
                                fallback.style.backgroundColor = getChainColor(chainData.chainId);
                                target.parentNode?.insertBefore(fallback, target);
                              }}
                            />
                          ) : (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getChainColor(chainData.chainId) }}
                            />
                          );
                        })()}
                        <span className="text-xs font-medium text-slate-700">
                          {chainData.chainName}
                        </span>
                        <span className={`text-xs font-bold ${hasEarnings ? 'text-green-600' : 'text-slate-400'}`}>
                          {formatCurrency(chainData.totalEarnings)}
                        </span>
                        {selectedChainEarnings === chainData.chainId.toString() ? (
                          <ChevronUp className="h-3 w-3 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-500" />
                        )}
                      </button>
                      
                      {selectedChainEarnings === chainData.chainId.toString() && (
                        <div className="mt-2 bg-white rounded-lg border border-slate-200 p-3 min-w-[200px]">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-600">
                                {chainData.chainName} Earnings
                              </span>
                            </div>
                            {chainData.holdings.map((holding) => (
                              <div key={holding.id} className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">{holding.asset}</span>
                                <span className="text-xs font-semibold text-green-600">
                                  {formatCurrency(holding.earnings)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-2">
            <PiggyBank className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">Balance</span>
            {isHoldingsLoading && (
              <Loader2 className="h-4 w-4 text-orange-600 animate-spin" />
            )}
          </div>
          <p className="text-2xl font-bold text-orange-900">{formatCurrency(totalPortfolioBalance)}</p>
          
          {/* Chain Balance Breakdown */}
          {wallet.isConnected && Object.keys(holdingsByChain).length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.values(holdingsByChain).map((chainData) => {
                  const hasBalance = chainData.totalValue > 0;
                  
                  return (
                    <div key={chainData.chainId} className="flex flex-col">
                      <button
                        onClick={() => setSelectedChainDeposited(
                          selectedChainDeposited === chainData.chainId.toString() ? null : chainData.chainId.toString()
                        )}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border-2 transition-all duration-200 ${
                          selectedChainDeposited === chainData.chainId.toString()
                            ? 'border-orange-500 bg-orange-100'
                            : hasBalance 
                              ? 'border-slate-200 hover:border-slate-300 bg-white'
                              : 'border-slate-100 bg-slate-50 opacity-60'
                        }`}
                        disabled={isHoldingsLoading || isDataLoading}
                      >
                        {(() => {
                          const chain = getChainById(chainData.chainId);
                          return chain?.logo ? (
                            <img
                              src={chain.logo}
                              alt={chainData.chainName}
                              className="w-4 h-4 rounded-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'w-3 h-3 rounded-full';
                                fallback.style.backgroundColor = getChainColor(chainData.chainId);
                                target.parentNode?.insertBefore(fallback, target);
                              }}
                            />
                          ) : (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getChainColor(chainData.chainId) }}
                            />
                          );
                        })()}
                        <span className="text-xs font-medium text-slate-700">
                          {chainData.chainName}
                        </span>
                        <span className={`text-xs font-bold ${hasBalance ? 'text-orange-600' : 'text-slate-400'}`}>
                          {formatCurrency(chainData.totalValue)}
                        </span>
                        {selectedChainDeposited === chainData.chainId.toString() ? (
                          <ChevronUp className="h-3 w-3 text-slate-500" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-slate-500" />
                        )}
                      </button>
                      
                      {selectedChainDeposited === chainData.chainId.toString() && (
                        <div className="mt-2 bg-white rounded-lg border border-slate-200 p-3 min-w-[200px]">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-600">
                                {chainData.chainName} Balance
                              </span>
                            </div>
                            {chainData.holdings.map((holding) => (
                              <div key={holding.id} className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">{holding.asset}</span>
                                <span className="text-xs font-semibold text-orange-600">
                                  {formatCurrency(holding.aTokenBalance)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aave Holdings */}
      {holdings.length > 0 && (
        <div>
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-2">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Holdings</h3>
            {isHoldingsLoading && holdings.length === 0 && (
              <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Protocol</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Chain</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Asset</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Deposited</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Yield Token Balance</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">APY</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Earnings</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <img 
                          src="/aave-logo.png" 
                          alt="Aave" 
                          className="w-6 h-6 rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <span className="font-medium text-slate-900">{holding.protocol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const chain = getChainById(holding.chainId);
                          return chain?.logo ? (
                            <img
                              src={chain.logo}
                              alt={holding.chainName}
                              className="w-4 h-4 rounded-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'w-3 h-3 rounded-full';
                                fallback.style.backgroundColor = getChainColor(holding.chainId);
                                // Insert fallback before the hidden image for layout stability
                                target.parentNode?.insertBefore(fallback, target);
                              }}
                            />
                          ) : (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getChainColor(holding.chainId) }}
                            />
                          );
                        })()}
                        <span className="text-slate-600">{holding.chainName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {holding.asset}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {typeof holding.derivedDeposit === 'number' && isFinite(holding.derivedDeposit) ? (
                        `$${holding.derivedDeposit.toFixed(2)}`
                      ) : isDepositsLoading ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <svg className="animate-spin h-3 w-3 text-slate-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Calculating
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-blue-600">{formatCurrency(holding.aTokenBalance)}</td>
                    
                    
                    
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{getApyForHolding(holding).toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right font-medium text-green-600">{formatCurrency(holding.earnings)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleWithdraw(holding)}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center space-x-1 mx-auto"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Withdraw</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading State for Holdings */}
      {isHoldingsLoading && holdings.length === 0 && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading your Aave holdings...</p>
        </div>
      )}

      {/* No Holdings State */}
      {!isHoldingsLoading && holdings.length === 0 && wallet.isConnected && (
        <div className="text-center py-8 bg-slate-50 rounded-xl">
          <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Active Holdings</h3>
          <p className="text-slate-600">
            You don't have any active positions in DeFi protocols yet.
          </p>
        </div>
      )}

      {/* Withdraw Modal */}
      {withdrawModal.isOpen && withdrawModal.holding && (
        <WithdrawModal
          holding={withdrawModal.holding}
          switchChain={switchChain}
          wallet={wallet}
          onClose={handleCloseWithdrawModal}
          onSuccess={handleWithdrawSuccess}
        />
      )}
    </div>
  );
};