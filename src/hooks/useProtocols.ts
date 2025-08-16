import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export interface ProtocolData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  website_url?: string;
  docs_url?: string;
  logo?: string;
  color: string;
  launch_year?: number;
  verified: boolean;
  api_endpoint?: string;
  api_key?: string;
  api_key_required: boolean;
  supported_chains: number[];
  protocol_type: string;
  created_at?: string;
  updated_at?: string;
}

export const useProtocols = () => {
  const [protocols, setProtocols] = useState<ProtocolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProtocols = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: protocolsError } = await supabase
        .from('protocols')
        .select('*')
        .order('name');

      if (protocolsError) throw protocolsError;

      setProtocols(data || []);
    } catch (err) {
      console.error('Error fetching protocols:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch protocols');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProtocols();
  }, []);

  const getProtocolBySlug = useCallback((slug: string): ProtocolData | undefined => {
    return protocols.find(protocol => protocol.slug === slug);
  }, [protocols]);

  const getProtocolsByChain = useCallback((chainId: number): ProtocolData[] => {
    return protocols.filter(protocol => protocol.supported_chains.includes(chainId));
  }, [protocols]);

  return useMemo(() => ({
    protocols,
    isLoading,
    error,
    refetch: fetchProtocols,
    getProtocolBySlug,
    getProtocolsByChain
  }), [protocols, isLoading, error, fetchProtocols, getProtocolBySlug, getProtocolsByChain]);
};