import React from 'react';
import { TrendingUp, Shield, AlertTriangle, DollarSign, Users, Calendar, Fuel } from 'lucide-react';
import type { YieldOpportunity } from '../types';

interface YieldCardProps {
  opportunity: YieldOpportunity;
  onDeposit: () => void;
}

export const YieldCard: React.FC<YieldCardProps> = ({ opportunity, onDeposit }) => {
  const formatTVL = (tvl: number) => {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(1)}K`;
    return `$${tvl}`;
  };

  const getYearsActive = (launchYear: number) => {
    const currentYear = new Date().getFullYear();
    return currentYear - launchYear;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {opportunity.logo ? (
            <img src={opportunity.logo} alt={opportunity.protocol} className="w-10 h-10 rounded-xl" />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-slate-900">{opportunity.protocol}</h3>
              {opportunity.verified && (
                <Shield className="h-4 w-4 text-green-500" />
              )}
            </div>
            <p className="text-sm text-slate-500 capitalize">{opportunity.chain}</p>
          </div>
        </div>
      </div>

      {/* Pool Info */}
      <div className="mb-4">
        <p className="text-sm text-slate-600 mb-2">{opportunity.pool}</p>
        <div className="flex items-center space-x-2">
          {opportunity.assets.map((asset, index) => (
            <span
              key={asset}
              className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
            >
              {asset}
            </span>
          ))}
          <span className="text-xs text-slate-400 capitalize">
            • {opportunity.type}
          </span>
          <div className="flex items-center space-x-1 text-xs text-slate-400">
            <Calendar className="h-3 w-3" />
            <span>{getYearsActive(opportunity.launchYear)}y active</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">APY</span>
          </div>
          <p className="text-xl font-bold text-green-700">{opportunity.apy.toFixed(2)}%</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">TVL</span>
          </div>
          <p className="text-xl font-bold text-blue-700">{formatTVL(opportunity.tvl)}</p>
        </div>
      </div>

      {/* Deposit Button */}
      <div className="space-y-2">
        <button
          onClick={onDeposit}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 group-hover:shadow-md"
        >
          Deposit & Earn
        </button>
        
      </div>
    </div>
  );
};