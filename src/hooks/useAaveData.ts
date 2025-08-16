import { useState, useEffect, useCallback, useRef } from 'react';
import { useProtocols } from './useProtocols';
import { useSupabaseData } from './useSupabaseData';
import type { YieldOpportunity } from '../types';

const DEFAULT_AAVE_GRAPHQL_URL = import.meta.env.DEV ? '/aave-graphql' : 'https://api.v3.aave.com/graphql';

const MARKETS_QUERY = `
  query Markets($chainIds: [ChainId!]!) {
    markets(request: { chainIds: $chainIds }) { address name chain { chainId name } }
  }
`;

const MARKET_RESERVES_QUERY = `
  query MarketReserves($address: EvmAddress!, $chainId: ChainId!) {
    market(request: { address: $address, chainId: $chainId }) {
      reserves(request: { reserveType: SUPPLY, orderBy: { tokenName: ASC } }) {
        underlyingToken { symbol address }
        isFrozen
        isPaused
        size { usd }
        supplyInfo { apy { formatted value } }
        incentives {
          __typename
          ... on AaveSupplyIncentive {
            rewardTokenSymbol
            rewardTokenAddress
            extraSupplyApr { decimals raw value formatted }
          }
          ... on MeritSupplyIncentive {
            extraSupplyApr { decimals raw value formatted }
            claimLink
          }
        }
      }
    }
  }
`;

async function queryAave<T>(endpoint: string, query: string, variables: Record<string, unknown>, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const res = await fetch(endpoint || DEFAULT_AAVE_GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`Aave API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error((json.errors as Array<{ message: string }>).map((e) => e.message).join(', '));
  return json.data as T;
}

export const useAaveData = () => {
  const [aaveOpportunities, setAaveOpportunities] = useState<YieldOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  const lastFetchMsRef = useRef(0);
  
  const { getProtocolBySlug, isLoading: isProtocolsLoading } = useProtocols();
  const { chains, getStablecoinBySymbol, getChainById } = useSupabaseData();

  const fetchAaveData = useCallback(async () => {
    const aaveProtocol = getProtocolBySlug('aave');
    if (!aaveProtocol || chains.length === 0) {
      //console.log('Aave protocol not found or no chains available');
      return;
    }

    const now = Date.now();
    if (isFetchingRef.current) return;
    if (now - lastFetchMsRef.current < 30000) return; // cooldown 30s
    isFetchingRef.current = true;
    lastFetchMsRef.current = now;
    setIsLoading(true);
    setError(null);

    try {
      // Aggregated per-chain lists below; top-level variable not needed

      // Get available chain IDs from database
      const availableChainIds = chains.map(chain => chain.id);

      // Only fetch data for chains present in DB and protocol supported list
      const supportedChains = aaveProtocol.supported_chains.filter(chainId => availableChainIds.includes(chainId));

      console.log(`Fetching Aave data (GraphQL) for ${supportedChains.length} chains:`, supportedChains);

      if (supportedChains.length === 0) {
        console.log('No supported chains found');
        setError('No supported chains found for Aave protocol');
        return;
      }

      // Fetch data for each supported chain; limit concurrency to avoid bursts
      const chainQueue = [...supportedChains];
      const concurrency = Math.min(3, chainQueue.length);
      const workers: Array<Promise<YieldOpportunity[]>> = [];
      const runWorker = async (): Promise<YieldOpportunity[]> => {
        const results: YieldOpportunity[] = [];
        while (chainQueue.length > 0) {
          const chainId = chainQueue.shift()!;
          const dbChain = getChainById(chainId);
          if (!dbChain) continue;
          try {
            const endpoint = import.meta.env.DEV ? '/aave-graphql' : (aaveProtocol.api_endpoint || 'https://api.v3.aave.com/graphql');
            // 1) discover markets on chain
            const mkts = await queryAave<{ markets: Array<{ address: string; chain: { chainId: number; name: string } }> }>(
              endpoint,
              MARKETS_QUERY,
              { chainIds: [chainId] },
              aaveProtocol.api_key
            );
            const markets = mkts.markets || [];
            for (const mkt of markets) {
              type Incentive = { __typename?: 'MeritSupplyIncentive' | 'AaveSupplyIncentive' | string; extraSupplyApr?: { formatted?: string }; rewardTokenSymbol?: string; claimLink?: string };
              type Reserve = { underlyingToken: { symbol: string; address: string }, isFrozen: boolean, isPaused: boolean, size: { usd: string }, supplyInfo: { apy: { formatted: string, value: string } }, incentives?: Incentive[] };
              type MarketRes = { market: { reserves: Reserve[] } };
              const res = await queryAave<MarketRes>(
                endpoint,
                MARKET_RESERVES_QUERY,
                { address: mkt.address, chainId },
                aaveProtocol.api_key
              );
              const reserves = res.market?.reserves || [];
              for (const r of reserves) {
                if (r.isPaused || r.isFrozen) continue;
                const symbol = r.underlyingToken?.symbol;
                if (!symbol || !getStablecoinBySymbol(symbol)) continue;
                const apy = parseFloat(r.supplyInfo?.apy?.formatted ?? '0');
                const tvl = parseFloat(r.size?.usd ?? '0');
                const incentives = (r.incentives ?? []).flatMap((inc: Incentive) => {
                  if (!inc || !inc.__typename) return [] as Array<{ type: 'MeritSupplyIncentive' | 'AaveSupplyIncentive' | 'Other'; apr: number; label?: string; claimLink?: string }>;
                  if (inc.__typename === 'MeritSupplyIncentive') {
                    const apr = parseFloat(inc.extraSupplyApr?.formatted ?? '0');
                    return [{ type: 'MeritSupplyIncentive' as const, apr, label: 'Merit', claimLink: inc.claimLink }];
                  }
                  if (inc.__typename === 'AaveSupplyIncentive') {
                    const apr = parseFloat(inc.extraSupplyApr?.formatted ?? '0');
                    const label = inc.rewardTokenSymbol || 'Aave';
                    return [{ type: 'AaveSupplyIncentive' as const, apr, label }];
                  }
                  return [] as Array<{ type: 'Other'; apr: number; label?: string; claimLink?: string }>;
                });
                results.push({
                  id: `aave-${symbol.toLowerCase()}-${getChainSlugFromDb(dbChain)}-${r.underlyingToken.address}`,
                  protocol: 'Aave',
                  chain: getChainSlugFromDb(dbChain) as unknown as YieldOpportunity['chain'],
                  type: 'lending',
                  pool: `${symbol} Lending Pool`,
                  assets: [symbol as unknown as YieldOpportunity['assets'][number]],
                  apy,
                  tvl,
                  risk: 'low',
                  verified: true,
                  logo: aaveProtocol.logo || '',
                  launchYear: aaveProtocol.launch_year || 2020,
                  gasEstimate: getGasEstimate(chainId),
                  incentives
                });
              }
            }
          } catch (chainError) {
            console.error(`Error fetching Aave data for chain ${chainId} (${dbChain.name}):`, chainError);
          }
        }
        return results;
      };
      for (let i = 0; i < concurrency; i++) workers.push(runWorker());

      // Wait for all chain data to be fetched
      const chainResults = await Promise.all(workers);
      const allOpportunities = chainResults.flat();

      // Deduplicate opportunities - keep only the highest APY for each Protocol/Chain/Asset combination
      const deduplicatedOpportunities = deduplicateOpportunities(allOpportunities);

      console.log(`Successfully fetched ${allOpportunities.length} Aave opportunities (GraphQL), ${deduplicatedOpportunities.length} after deduplication`);
      setAaveOpportunities(prev => {
        const sameLen = prev.length === deduplicatedOpportunities.length;
        if (sameLen) {
          const byId = new Map(prev.map(o => [o.id, o]));
          let equal = true;
          for (const o of deduplicatedOpportunities) {
            const p = byId.get(o.id);
            if (!p || p.apy !== o.apy || p.tvl !== o.tvl) { equal = false; break; }
          }
          if (equal) return prev;
        }
        return deduplicatedOpportunities;
      });

      if (deduplicatedOpportunities.length === 0) {
        setError('No active Aave opportunities found. This may be due to network issues or all pools having very low yields.');
      }

    } catch (err) {
      console.error('Error fetching Aave data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Aave data');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [chains, getProtocolBySlug, getStablecoinBySymbol, getChainById]);

  useEffect(() => {
    if (!hasFetchedRef.current && chains.length > 0 && !isProtocolsLoading) {
      hasFetchedRef.current = true;
      fetchAaveData();
    }
  }, [fetchAaveData, chains.length, isProtocolsLoading]);

  const refetch = useCallback(() => {
    hasFetchedRef.current = false;
    fetchAaveData();
  }, [fetchAaveData]);

  return {
    aaveOpportunities,
    isLoading,
    error,
    refetch,
    fetchAaveData
  };
};

// Deduplication function to keep only the highest APY for each Protocol/Chain/Asset combination
function deduplicateOpportunities(opportunities: YieldOpportunity[]): YieldOpportunity[] {
  const opportunityMap = new Map<string, YieldOpportunity>();
  
  opportunities.forEach(opportunity => {
    // Create a unique key for Protocol/Chain/Asset combination
    const key = `${opportunity.protocol}-${opportunity.chain}-${opportunity.assets.join(',')}`;
    
    const existing = opportunityMap.get(key);
    if (!existing || opportunity.apy > existing.apy) {
      opportunityMap.set(key, opportunity);
      console.log(`Keeping ${opportunity.protocol} ${opportunity.chain} ${opportunity.assets.join(',')} with ${opportunity.apy.toFixed(2)}% APY`);
    } else {
      console.log(`Skipping duplicate ${opportunity.protocol} ${opportunity.chain} ${opportunity.assets.join(',')} with ${opportunity.apy.toFixed(2)}% APY (existing has ${existing.apy.toFixed(2)}%)`);
    }
  });
  
  return Array.from(opportunityMap.values());
}

// Helper functions
type ChainLike = { name: string };
function getChainSlugFromDb(chain: ChainLike): string {
  // Handle special cases and normalize chain names
  const name = chain.name.toLowerCase();
  if (name === 'linea') return 'linea';
  return name.replace(/\s+/g, '');
}

function getGasEstimate(chainId: number): string {
  // Default gas estimates - could be moved to database in the future
  switch (chainId) {
    case 1: return '~$8-12';
    case 137: return '~$0.30';
    case 43114: return '~$2.50';
    case 42161: return '~$1.20';
    case 10: return '~$1.50';
    case 8453: return '~$0.80';
    default: return '~$1-5';
  }
}

// legacy placeholder removed (incentives parsed from API)