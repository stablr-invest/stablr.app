import React from 'react';
import { TrendingUp, Shield, AlertTriangle, ExternalLink, Calendar, Fuel, ChevronUp, ChevronDown } from 'lucide-react';
import { useSupabaseData } from '../hooks/useSupabaseData';
import type { YieldOpportunity, SortOptions } from '../types';

interface YieldTableProps {
  opportunities: YieldOpportunity[];
  onDeposit: (opportunity: YieldOpportunity) => void;
  sort: SortOptions;
  onSort: (column: 'protocol' | 'chain' | 'tvl' | 'apy') => void;
}

export const YieldTable: React.FC<YieldTableProps> = ({ opportunities, onDeposit, sort, onSort }) => {
  const { getChainById, chains, getStablecoinBySymbol } = useSupabaseData();

  const formatTVL = (tvl: number) => {
    // tvl is already in USD from GraphQL (size.usd). No 1e18 scaling.
    const v = Number.isFinite(tvl) ? tvl : 0;
    if (v === 0) return '$0';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    return `$${v.toFixed(6)}`;
  };

  const getChainName = (chainSlug: string) => {
    // Find chain by matching the slug (lowercase name without spaces) to database chains
    const dbChain = chains.find(chain => 
      chain.name.toLowerCase().replace(/\s+/g, '') === chainSlug.toLowerCase() ||
      chain.name.toLowerCase() === chainSlug.toLowerCase()
    );
    return dbChain ? dbChain.name : chainSlug;
  };

  const getChainColor = (chainSlug: string) => {
    // Find chain by matching the slug (lowercase name without spaces) to database chains
    const dbChain = chains.find(chain => 
      chain.name.toLowerCase().replace(/\s+/g, '') === chainSlug.toLowerCase() ||
      chain.name.toLowerCase() === chainSlug.toLowerCase()
    );
    return dbChain ? dbChain.color : '#64748b';
  };

  const getChainLogo = (chainSlug: string) => {
    // Find chain by matching the slug (lowercase name without spaces) to database chains
    const dbChain = chains.find(chain => 
      chain.name.toLowerCase().replace(/\s+/g, '') === chainSlug.toLowerCase() ||
      chain.name.toLowerCase() === chainSlug.toLowerCase()
    );
    return dbChain?.logo || `/${chainSlug.toLowerCase()}.png`;
  };

  const getYearsActive = (launchYear: number) => {
    const currentYear = new Date().getFullYear();
    return currentYear - launchYear;
  };

  const getSortIcon = (column: string) => {
    if (sort.column !== column) return null;
    return sort.order === 'desc' ? 
      <ChevronDown className="h-4 w-4 text-blue-600" /> : 
      <ChevronUp className="h-4 w-4 text-blue-600" />;
  };
  return (
    <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th 
                className="text-left py-4 px-6 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onSort('protocol')}
              >
                <div className="flex items-center space-x-1">
                  <span>Protocol</span>
                  {getSortIcon('protocol')}
                </div>
              </th>
              <th 
                className="text-left py-4 px-6 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onSort('chain')}
              >
                <div className="flex items-center space-x-1">
                  <span>Chain</span>
                  {getSortIcon('chain')}
                </div>
              </th>
              <th className="text-left py-4 px-6 font-semibold text-slate-700">Pool</th>
              <th className="text-left py-4 px-6 font-semibold text-slate-700">Assets</th>
              <th 
                className="text-right py-4 px-6 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onSort('tvl')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>TVL</span>
                  {getSortIcon('tvl')}
                </div>
              </th>
              <th 
                className="text-right py-4 px-6 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => onSort('apy')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>APY</span>
                  {getSortIcon('apy')}
                </div>
              </th>
              <th className="text-center py-4 px-6 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opportunity, index) => (
              <tr 
                key={opportunity.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-3">
                    {opportunity.logo ? (
                      <img src={opportunity.logo} alt={opportunity.protocol} className="w-8 h-8 rounded-lg" />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900">{opportunity.protocol}</span>
                        {opportunity.verified && (
                          <Shield className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500 capitalize">{opportunity.type}</span>
                        <div className="flex items-center space-x-1 text-xs text-slate-400">
                          <Calendar className="h-3 w-3" />
                          <span>{getYearsActive(opportunity.launchYear)}y</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-2">
                    <img 
                      src={getChainLogo(opportunity.chain)}
                      alt={getChainName(opportunity.chain)}
                      className="w-4 h-4 rounded-full"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'w-4 h-4 rounded-full';
                        fallback.style.backgroundColor = getChainColor(opportunity.chain);
                        target.parentNode?.insertBefore(fallback, target);
                      }}
                    />
                    <span className="text-slate-700 font-medium">{getChainName(opportunity.chain)}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="text-slate-700">{opportunity.pool}</span>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-1">
                    {opportunity.assets.map((asset, assetIndex) => (
                      (() => {
                        const stablecoin = getStablecoinBySymbol(asset);
                        const assetColor = stablecoin?.color || '#64748b';
                        return (
                          <span
                            key={asset}
                            className="px-2 py-1 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: assetColor }}
                          >
                            {asset}
                          </span>
                        );
                      })()
                    ))}
                  </div>
                </td>
                <td className="py-4 px-6 text-right">
                  <span className="font-semibold text-slate-700">{formatTVL(opportunity.tvl)}</span>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex flex-col items-end space-y-1">
                    <span className="text-lg font-bold text-green-600">{opportunity.apy.toFixed(2)}%</span>
                    {opportunity.incentives && opportunity.incentives.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1">
                        {opportunity.incentives.map((inc, idx) => {
                          const text = `+${(inc.apr || 0).toFixed(2)}% ${inc.label || (inc.type === 'MeritSupplyIncentive' ? 'Merit' : inc.type === 'AaveSupplyIncentive' ? 'AAVE' : 'Incentive')}`;
                          const baseClass = "px-2 py-0.5 text-[10px] rounded-full border inline-flex items-center gap-1";
                          const colorClass = inc.type === 'MeritSupplyIncentive' 
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-indigo-100 text-indigo-800 border-indigo-200';
                          return inc.claimLink ? (
                            <a
                              key={idx}
                              href={inc.claimLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${baseClass} ${colorClass} hover:brightness-95`}
                              title="Claim incentive"
                            >
                              <span>{text}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span key={idx} className={`${baseClass} ${colorClass}`}>
                              {text}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-4 px-6 text-center">
                  <div className="flex flex-col items-center space-y-1">
                    <button
                      onClick={() => onDeposit(opportunity)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 text-sm font-medium flex items-center space-x-1"
                    >
                      <span>Deposit</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
};