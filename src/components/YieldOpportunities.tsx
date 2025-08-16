import React from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { ChainSelector } from './ChainSelector';
import { FilterSort } from './FilterSort';
import { YieldTable } from './YieldTable';
import type { Chain, YieldOpportunity, FilterOptions, SortOptions } from '../types';

interface YieldOpportunitiesProps {
  selectedChain: Chain;
  onChainChange: (chain: Chain) => void;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  opportunities: YieldOpportunity[];
  onDeposit: (opportunity: YieldOpportunity) => void;
  sort: SortOptions;
  onSort: (column: 'protocol' | 'chain' | 'tvl' | 'apy') => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export const YieldOpportunities: React.FC<YieldOpportunitiesProps> = ({
  selectedChain,
  onChainChange,
  filters,
  onFiltersChange,
  opportunities,
  onDeposit,
  sort,
  onSort,
  isLoading,
  onRefresh
}) => {
  return (
    <div className="space-y-6">
      {/* Yield Opportunities Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-2">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Yield Opportunities</h2>
              <p className="text-sm text-slate-600">
                {opportunities.length} opportunities found
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh Yield Opportunities"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-6">
          <ChainSelector 
            selectedChain={selectedChain} 
            onChainChange={onChainChange} 
          />
          <FilterSort 
            filters={filters} 
            onFiltersChange={onFiltersChange} 
          />
        </div>
      </div>

      {/* Yield Table - Integrated into the section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <YieldTable 
          opportunities={opportunities}
          onDeposit={onDeposit}
          sort={sort}
          onSort={onSort}
        />
      </div>
    </div>
  );
};