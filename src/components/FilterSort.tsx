import React from 'react';
import { Search } from 'lucide-react';
import type { FilterOptions } from '../types';

interface FilterSortProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
}

export const FilterSort: React.FC<FilterSortProps> = ({
  filters,
  onFiltersChange
}) => {
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-slate-700 mb-3">
        <Search className="inline h-4 w-4 mr-1" />
        Search & Filter
      </label>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Protocol Search */}
        <input
          type="text"
          value={filters.protocolSearch}
          onChange={(e) => handleFilterChange('protocolSearch', e.target.value)}
          placeholder="Search protocols..."
          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />

        {/* Asset Filter */}
        <select
          value={filters.asset}
          onChange={(e) => handleFilterChange('asset', e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="all">All Assets</option>
          <option value="USDC">USDC</option>
          <option value="USDT">USDT</option>
        </select>
      </div>
    </div>
  );
};