import { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { YieldOpportunities } from './components/YieldOpportunities';
import { Portfolio } from './components/Portfolio';
import { DepositModal } from './components/DepositModal';
import { TabSection } from './components/TabSection';
import { SystemStatus } from './components/SystemStatus';
import { useWallet } from './hooks/useWallet';
import { useAaveData } from './hooks/useAaveData';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Loader2 } from 'lucide-react';
import type { Chain, YieldOpportunity, FilterOptions, SortOptions } from './types';

function App() {
  const { isLoading: isSupabaseLoading, error: supabaseError } = useSupabaseData();
  const { wallet, balances, isLoadingBalances, connectWallet, switchChain, refreshBalances } = useWallet();
  const { aaveOpportunities, isLoading: isAaveLoading, fetchAaveData } = useAaveData();
  // removed renderKey; not needed
  const [currentView, setCurrentView] = useState<'dashboard' | 'status'>('dashboard');
  const [walletConnected, setWalletConnected] = useState(false);
  const [selectedChain, setSelectedChain] = useState<Chain>('all');
  const [filters, setFilters] = useState<FilterOptions>({
    protocolSearch: '',
    asset: 'all'
  });
  const [sort, setSort] = useState<SortOptions>({
    column: 'apy',
    order: 'desc'
  });
  const [depositModal, setDepositModal] = useState<{
    isOpen: boolean;
    opportunity: YieldOpportunity | null;
  }>({
    isOpen: false,
    opportunity: null
  });

  // Listen for wallet connection events and force refresh
  useEffect(() => {
    const handleWalletConnected = () => {
      setWalletConnected(true);
    };

    window.addEventListener('wallet-connected', handleWalletConnected as EventListener);
    
    return () => {
      window.removeEventListener('wallet-connected', handleWalletConnected as EventListener);
    };
  }, []);

  // Mark as connected when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      setWalletConnected(true);
    }
  }, [wallet.isConnected, wallet.address]);

  // const shouldShowPortfolio = Boolean(wallet.isConnected && wallet.address);

  const filteredOpportunities = useMemo(() => {
    let filtered = aaveOpportunities.filter(opportunity => {
      if (selectedChain !== 'all' && opportunity.chain !== selectedChain) return false;
      if (filters.protocolSearch && !opportunity.protocol.toLowerCase().includes(filters.protocolSearch.toLowerCase())) return false;
      if (
        filters.asset !== 'all' &&
        !(opportunity.assets as string[]).some(a => a.toLowerCase() === filters.asset.toLowerCase())
      ) return false;
      return true;
    });

    // Sort opportunities
    if (sort.column) {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (sort.column) {
          case 'apy':
            comparison = a.apy - b.apy;
            break;
          case 'tvl':
            comparison = a.tvl - b.tvl;
            break;
          case 'protocol':
            comparison = a.protocol.localeCompare(b.protocol);
            break;
          case 'chain':
            comparison = a.chain.localeCompare(b.chain);
            break;
        }
        
        return sort.order === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [aaveOpportunities, selectedChain, filters, sort]);

  const handleDeposit = (opportunity: YieldOpportunity) => {
    setDepositModal({ isOpen: true, opportunity });
  };

  const handleCloseModal = () => {
    setDepositModal({ isOpen: false, opportunity: null });
  };

  // Listen for navigation events
  useEffect(() => {
    const handleNavigateToStatus = () => setCurrentView('status');
    const handleNavigateToDashboard = () => setCurrentView('dashboard');
    
    window.addEventListener('navigate-to-status', handleNavigateToStatus);
    window.addEventListener('navigate-to-dashboard', handleNavigateToDashboard);
    
    return () => {
      window.removeEventListener('navigate-to-status', handleNavigateToStatus);
      window.removeEventListener('navigate-to-dashboard', handleNavigateToDashboard);
    };
  }, []);

  const handleSort = (column: 'protocol' | 'chain' | 'tvl' | 'apy') => {
    setSort(prevSort => ({
      column,
      order: prevSort.column === column && prevSort.order === 'desc' ? 'asc' : 'desc'
    }));
  };

  if (isSupabaseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-600">Loading network configuration…</p>
        </div>
      </div>
    );
  }

  if (supabaseError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="bg-white border border-red-200 text-red-700 rounded-xl p-6 shadow-sm max-w-md mx-auto text-center">
          <p className="font-semibold mb-2">Failed to load configuration</p>
          <p className="text-sm opacity-80">{supabaseError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'status' ? (
          <SystemStatus />
        ) : (
          <>
            {/* Portfolio Overview - Always show when wallet is connected */}
            {((wallet.isConnected && wallet.address) || walletConnected) && (
              <>
               
                <Portfolio 
                  data={{
                    totalValue: 0,
                    totalEarnings: 0,
                    totalDeposited: 0,
                    idleBalances: [],
                    positions: []
                  }} 
                />
              </>
            )}
            
            {/* Show message when not connected - check both wallet states */}
            {!wallet.isConnected && !walletConnected && (
              <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-2xl">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Connect Your Wallet</h3>
                <p className="text-yellow-700">
                  Connect your wallet to view your portfolio overview and manage your stablecoin positions.
                </p>
              </div>
            )}
            
            {/* Yield Opportunities */}
            <div className="mb-12">
              <YieldOpportunities
                selectedChain={selectedChain}
                onChainChange={setSelectedChain}
                filters={filters}
                onFiltersChange={setFilters}
                opportunities={filteredOpportunities}
                onDeposit={handleDeposit}
                sort={sort}
                onSort={handleSort}
                isLoading={isAaveLoading}
                onRefresh={fetchAaveData}
              />
            </div>

            {/* FAQ and Roadmap Tabs */}
            <TabSection />
          </>
        )}
      </main>

      {/* Deposit Modal */}
      {depositModal.isOpen && depositModal.opportunity && (
        <DepositModal
          opportunity={depositModal.opportunity}
          onClose={handleCloseModal}
          wallet={wallet}
          balances={balances}
          isLoadingBalances={isLoadingBalances}
          connectWallet={connectWallet}
          switchChain={switchChain}
          refreshBalances={refreshBalances}
        />
      )}
    </div>
  );
}

export default App;