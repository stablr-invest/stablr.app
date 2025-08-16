export type Chain = 
  | 'all'
  | 'ethereum'
  | 'bnb'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'avalanche'
  | 'optimism'
  | 'mantle'
  | 'unichain'
  | 'sonic'
  | 'linea';

export type ProtocolType = 'lending' | 'lp';
export type Asset = 'USDC' | 'USDT';

export interface YieldOpportunity {
  id: string;
  protocol: string;
  chain: Chain;
  type: ProtocolType;
  pool: string;
  assets: Asset[];
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  verified: boolean;
  logo: string;
  launchYear: number;
  gasEstimate: string;
  incentives?: {
    type: 'MeritSupplyIncentive' | 'AaveSupplyIncentive' | 'Other';
    apr: number; // percent, e.g., 1.00 for 1%
    label?: string; // e.g., OP, ARB, Merit
    claimLink?: string; // present for MeritSupplyIncentive
  }[];
}

export interface FilterOptions {
  protocolSearch: string;
  asset: 'all' | 'USDC' | 'USDT';
}

export interface SortOptions {
  column: 'protocol' | 'chain' | 'tvl' | 'apy' | null;
  order: 'asc' | 'desc';
}

export interface PortfolioData {
  totalValue: number;
  totalEarnings: number;
  totalDeposited: number;
  idleBalances: {
    chain: Chain;
    usdc: number;
    usdt: number;
  }[];
  positions: {
    id: string;
    protocol: string;
    chain: Chain;
    amount: number;
    earnings: number;
    apy: number;
  }[];
}

export interface ChainConfig {
  id: Chain;
  name: string;
  logo: string;
  color: string;
}