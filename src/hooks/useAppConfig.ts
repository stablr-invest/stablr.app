import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AppConfigData {
  STABLR_FEE_ROUTER: string;
  STABLR_FEE_BPS: number;
  STABLR_TREASURY: string;
  STABLR_CONTRACT_ADDRESS: string;
  STABLR_ADMIN_PRIVATE_KEY: string;
  STABLR_CONTRACT_CHAIN_ID: string;
}

export const useAppConfig = () => {
  const [config, setConfig] = useState<AppConfigData>({
    STABLR_FEE_ROUTER: '',
    STABLR_FEE_BPS: 100,
    STABLR_TREASURY: '0xb60DEa2837cf00b556A824aA9b7bd6E58aD8C8D1',
    STABLR_CONTRACT_ADDRESS: '',
    STABLR_ADMIN_PRIVATE_KEY: '',
    STABLR_CONTRACT_CHAIN_ID: '8453'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: configError } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['STABLR_FEE_ROUTER', 'STABLR_FEE_BPS', 'STABLR_TREASURY', 'STABLR_CONTRACT_ADDRESS', 'STABLR_ADMIN_PRIVATE_KEY', 'STABLR_CONTRACT_CHAIN_ID']);

      if (configError) throw configError;

      // Convert array to object
      const configObj: Partial<AppConfigData> = {};
      data?.forEach((item: { key: string; value: string }) => {
        switch (item.key) {
          case 'STABLR_FEE_BPS':
            (configObj as any).STABLR_FEE_BPS = parseInt(item.value, 10) || 100;
            break;
          case 'STABLR_CONTRACT_CHAIN_ID':
            (configObj as any).STABLR_CONTRACT_CHAIN_ID = item.value || '8453';
            break;
          case 'STABLR_FEE_ROUTER':
            (configObj as any).STABLR_FEE_ROUTER = item.value;
            break;
          case 'STABLR_TREASURY':
            (configObj as any).STABLR_TREASURY = item.value;
            break;
          case 'STABLR_CONTRACT_ADDRESS':
            (configObj as any).STABLR_CONTRACT_ADDRESS = item.value;
            break;
          case 'STABLR_ADMIN_PRIVATE_KEY':
            (configObj as any).STABLR_ADMIN_PRIVATE_KEY = item.value;
            break;
        }
      });

      // Merge with defaults
      setConfig(prev => ({ ...prev, ...configObj }));
    } catch (err) {
      console.error('Error fetching app config:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch app config');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    isLoading,
    error,
    refetch: fetchConfig
  };
};