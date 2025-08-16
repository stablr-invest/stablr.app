import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ChainData, StablecoinData, StablecoinAddress } from '../hooks/useSupabaseData';
import { useAppConfig } from '../hooks/useAppConfig';

export type SupabaseContextValue = {
  chains: ChainData[];
  stablecoins: StablecoinData[];
  stablecoinAddresses: StablecoinAddress[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getChainById: (chainId: number) => ChainData | undefined;
  getStablecoinAddress: (symbol: string, chainId: number) => string | undefined;
  getStablecoinBySymbol: (symbol: string) => StablecoinData | undefined;
  appConfig: ReturnType<typeof useAppConfig>;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

export const SupabaseProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [chains, setChains] = useState<ChainData[]>([]);
  const [stablecoins, setStablecoins] = useState<StablecoinData[]>([]);
  const [stablecoinAddresses, setStablecoinAddresses] = useState<StablecoinAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appConfig = useAppConfig();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [chainsRes, stablecoinsRes, addressesRes] = await Promise.all([
        supabase
          .from('chains')
          .select('*')
          .eq('enabled', true)
          .order('id'),
        supabase
          .from('stablecoins')
          .select('*')
          .order('symbol'),
        supabase
          .from('stablecoin_addresses')
          .select('*, stablecoin:stablecoins(*)')
          .order('chain_id'),
      ]);

      if (chainsRes.error) throw chainsRes.error;
      if (stablecoinsRes.error) throw stablecoinsRes.error;
      if (addressesRes.error) throw addressesRes.error;

      setChains(chainsRes.data || []);
      setStablecoins(stablecoinsRes.data || []);
      setStablecoinAddresses(addressesRes.data || []);
    } catch (err) {
      console.error('Error fetching Supabase data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getChainById = useCallback((chainId: number) => chains.find(c => c.id === chainId), [chains]);

  const getStablecoinAddress = useCallback((symbol: string, chainId: number) => {
    const normalized = symbol.toLowerCase();
    const record = stablecoinAddresses.find(
      a => (a.stablecoin.symbol || '').toLowerCase() === normalized && a.chain_id === chainId
    );
    return record?.address;
  }, [stablecoinAddresses]);

  const getStablecoinBySymbol = useCallback((symbol: string) => {
    const normalized = symbol.toLowerCase();
    return stablecoins.find(s => (s.symbol || '').toLowerCase() === normalized);
  }, [stablecoins]);

  const value = useMemo<SupabaseContextValue>(() => ({
    chains,
    stablecoins,
    stablecoinAddresses,
    isLoading,
    error,
    refetch: fetchData,
    getChainById,
    getStablecoinAddress,
    getStablecoinBySymbol,
    appConfig,
  }), [chains, stablecoins, stablecoinAddresses, isLoading, error, appConfig, getChainById, getStablecoinAddress, getStablecoinBySymbol]);

  return (
    <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
  );
};

export const useSupabaseContext = (): SupabaseContextValue => {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error('useSupabaseContext must be used within SupabaseProvider');
  }
  return ctx;
};


