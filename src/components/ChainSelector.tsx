import React from 'react';
import { useSupabaseData } from '../hooks/useSupabaseData';
import type { Chain } from '../types';

interface ChainSelectorProps {
  selectedChain: Chain;
  onChainChange: (chain: Chain) => void;
}

export const ChainSelector: React.FC<ChainSelectorProps> = ({
  selectedChain,
  onChainChange
}) => {
  const { chains: dbChains, isLoading } = useSupabaseData();

  // Convert database chains to the format expected by the component
  const chains = [
    { id: 'all' as Chain, name: 'All Chains', logo: '/save.png', color: '#64748b' },
    ...dbChains.map(chain => ({
      id: chain.name.toLowerCase().replace(/\s+/g, '') as Chain,
      name: chain.name,
      logo: chain.logo || '/save.png',
      color: chain.color
    }))
  ];

  if (isLoading) {
    return (
      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Select Chain
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-3 rounded-xl border-2 border-slate-200 animate-pulse">
              <div className="flex flex-col items-center space-y-1">
                <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                <div className="w-12 h-3 bg-slate-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-slate-700 mb-3">
        Select Chain
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
        {chains.map((chain) => (
          <button
            key={chain.id}
            onClick={() => onChainChange(chain.id)}
            className={`p-3 rounded-xl border-2 transition-all duration-200 ${
              selectedChain === chain.id
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
            title={chain.name}
          >
            <div className="flex flex-col items-center space-y-1">
              <img 
                src={chain.logo}
                alt={chain.name}
                className="w-6 h-6 rounded-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.className = 'w-6 h-6 rounded-full';
                  fallback.style.backgroundColor = chain.color;
                  target.parentNode?.insertBefore(fallback, target);
                }}
              />
              <span className="text-xs font-medium truncate w-full">
                {chain.id === 'all' ? 'All' : chain.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};