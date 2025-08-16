import { useSupabaseContext } from '../providers/SupabaseProvider';

export interface ChainData {
  id: number;
  name: string;
  symbol: string;
  rpc_url: string;
  block_explorer: string;
  color: string;
  logo?: string;
  enabled: boolean;
  aave_subgraph_url?: string;
  multicall_address?: string;
}

export interface StablecoinData {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  color: string;
}

export interface StablecoinAddress {
  id: string;
  stablecoin_id: string;
  chain_id: number;
  address: string;
  stablecoin: StablecoinData;
}

export const useSupabaseData = () => useSupabaseContext();