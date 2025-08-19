import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { Wallet, Receipt, Github, HandCoins } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useStablrContract } from '../hooks/useStablrContract';
import { DonateModal } from './DonateModal';
import { useAppConfig } from '../hooks/useAppConfig';

export const Header: React.FC = () => {
  const { wallet, connectWallet } = useWallet();
  const { getTotalValueDeposited } = useStablrContract();
  const { config } = useAppConfig();
  const [totalValueDeposited, setTotalValueDeposited] = useState<string | null>(null);
  const [isLoadingTotalValue, setIsLoadingTotalValue] = useState<boolean>(false);
  const [isDonateOpen, setIsDonateOpen] = useState<boolean>(false);

  const fetchTotalValueDeposited = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    try {
      if (!silent) setIsLoadingTotalValue(true);
      const res = await getTotalValueDeposited();
      if (res.success) {
        const usdLikeDecimals = 6;
        const amount = res.amountWei ? ethers.utils.formatUnits(res.amountWei, usdLikeDecimals) : null;
        const formatted = amount !== null
          ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(amount))
          : null;
        setTotalValueDeposited(formatted);
      } else {
        setTotalValueDeposited(null);
      }
    } finally {
      if (!silent) setIsLoadingTotalValue(false);
    }
  };

  useEffect(() => {
    // Wait until config has the contract address before fetching
    const hasAddress = Boolean(config?.STABLR_CONTRACT_ADDRESS);
    if (hasAddress) {
      fetchTotalValueDeposited();
    } else {
      // Clear to placeholder when not ready
      setTotalValueDeposited(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.STABLR_CONTRACT_ADDRESS]);

  // Auto-refresh disabled to reduce RPC load; user can refresh manually elsewhere if needed

  // Refresh header totals when portfolio issues a manual refresh event
  useEffect(() => {
    const handler = () => fetchTotalValueDeposited();
    window.addEventListener('portfolio-refresh', handler);
    return () => window.removeEventListener('portfolio-refresh', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const treasuryAddress = config.STABLR_TREASURY;

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <img src="/stablr-logo.svg" alt="Stablr" className="h-14 w-14 rounded-2xl" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Stablr</h1>
              <p className="text-xs text-slate-500">Maximize your Stablecoin Yields</p>
            </div>
          </div>

          {/* Navigation */}
          {/* <nav className="hidden md:flex space-x-8">
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-dashboard'))}
              className="text-slate-700 hover:text-blue-600 font-medium transition-colors"
            >
              Dashboard
            </button>
           
          </nav> */}

          {/* Right side */}
          <div className="flex items-center space-x-2">
            <a
              href="https://dune.com/stablr/stablr"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              title="View on Dune Analytics"
            >
              <img src="/dune-logo.svg" alt="Dune" className="h-4 w-4 p-0 object-contain" />
              <span className="text-xs text-slate-600">Total Value Deposited</span>
              <span className="text-sm font-semibold text-slate-900">
                {isLoadingTotalValue ? '…' : (totalValueDeposited ?? '—')}
              </span>
            </a>
            
            <a
              href="https://x.com/stablrapp"
              target="_blank"
              rel="noopener noreferrer"
              title="Follow us on X"
              className="block shrink-0"
            >
              <span className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors ring-1 ring-slate-200 flex items-center justify-center">
                <img src="/x-logo.svg" alt="X" className="h-full w-full p-2 object-contain" />
              </span>
            </a>

            <a
              href="https://github.com/stablr-invest/stablr.app"
              target="_blank"
              rel="noopener noreferrer"
              title="View on GitHub"
              className="block shrink-0"
            >
              <span className="h-7 w-7 md:h-8 md:w-8 rounded-lg p-1.5 bg-slate-900 hover:bg-slate-800 transition-colors ring-1 ring-slate-200 flex items-center justify-center">
                <Github className="h-full w-full text-white" />
              </span>
            </a>

            <button
              onClick={() => setIsDonateOpen(true)}
              className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-2.5 py-2 md:px-3 rounded-xl font-medium hover:from-emerald-700 hover:to-green-700 transition-all duration-200 flex items-center gap-2 shadow-sm"
              title="Donate"
              aria-label="Donate"
            >
              <HandCoins className="h-5 w-5" />
              <span className="hidden md:inline">Donate</span>
            </button>
            {wallet.isConnected ? (
              <div className="flex items-center space-x-3">
                
                
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 px-4 py-2 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-green-800">
                        {formatAddress(wallet.address!)}
                      </span>
                      {wallet.walletName && (
                        <span className="text-xs text-green-600">
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                title="Connect Wallet"
                aria-label="Connect Wallet"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-2 md:px-4 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2 shadow-sm"
              >
                <Wallet className="h-5 w-5" />
                <span className="hidden md:inline">Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {isDonateOpen && (
        <DonateModal
          onClose={() => setIsDonateOpen(false)}
          treasuryAddress={treasuryAddress}
          chainSymbol={wallet.chainId === 56 ? 'BNB' : 'ETH'}
        />
      )}
    </header>
  );
};

//