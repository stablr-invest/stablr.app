import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { providers, Contract, utils } from 'ethers';
import { useSupabaseData } from './useSupabaseData';
import { useAaveSubgraph } from './useAaveSubgraph';
import { useAaveData } from './useAaveData';
import { useProtocols } from './useProtocols';
import * as markets from '@bgd-labs/aave-address-book';

export interface AaveHolding {
  id: string;
  chainId: number;
  chainName: string;
  protocol: string;
  asset: string;
  balance: number;
  aTokenBalance: number;
  earnings: number;
  apy: number;
  aTokenAddress: string;
  underlyingAsset: string;
  scaledATokenBalance?: number;
  derivedDeposit?: number;
  decimals?: number;
}

export const useAaveHoldings = (userAddress: string | null) => {
  const [holdings, setHoldings] = useState<AaveHolding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isDepositsLoading, setIsDepositsLoading] = useState(false);
  const { chains, getStablecoinBySymbol, getStablecoinAddress, getChainById, isLoading: isDataLoading } = useSupabaseData();
  const { fetchUserPortfolio } = useAaveSubgraph();
  const { aaveOpportunities } = useAaveData();
  const { isLoading: isProtocolsLoading, getProtocolBySlug } = useProtocols();
  const aaveProtocol = getProtocolBySlug('aave');

  // Minimal typings for Aave address book structures we use
  type AaveAssetConfig = {
    UNDERLYING?: string | { address: string };
    A_TOKEN?: string | { address: string };
    aToken?: string | { address: string };
    A_TOKEN_ADDRESS?: string;
  };

  type AaveMarketConfig = { ASSETS?: Record<string, AaveAssetConfig> } | null;

  // Resolve aToken address from chain and underlying token via address book
  const getATokenAddress = useCallback((chainId: number, underlying: string): string => {
    try {
      if (!underlying) return '';
      const marketMap: Record<number, AaveMarketConfig> = {
        1: (markets as unknown as Record<string, unknown>).AaveV3Ethereum as AaveMarketConfig,
        137: (markets as unknown as Record<string, unknown>).AaveV3Polygon as AaveMarketConfig,
        43114: (markets as unknown as Record<string, unknown>).AaveV3Avalanche as AaveMarketConfig,
        42161: (markets as unknown as Record<string, unknown>).AaveV3Arbitrum as AaveMarketConfig,
        10: (markets as unknown as Record<string, unknown>).AaveV3Optimism as AaveMarketConfig,
        8453: (markets as unknown as Record<string, unknown>).AaveV3Base as AaveMarketConfig,
        56: (markets as unknown as Record<string, unknown>).AaveV3BNB as AaveMarketConfig,
        59144: (markets as unknown as Record<string, unknown>).AaveV3Linea as AaveMarketConfig,
      };
      const market = marketMap[chainId] || null;
      const assets = market?.ASSETS;
      if (!assets) return '';
      const target = underlying.toLowerCase();
      for (const key of Object.keys(assets)) {
        const assetCfg = assets[key] as AaveAssetConfig;
        const underlyingField = assetCfg?.UNDERLYING as string | { address: string } | undefined;
        const u = typeof underlyingField === 'string' ? underlyingField : underlyingField?.address;
        if (typeof u === 'string' && u.toLowerCase() === target) {
          const candidate = (assetCfg?.A_TOKEN as string | { address: string } | undefined) ||
                           (assetCfg?.aToken as string | { address: string } | undefined) ||
                           assetCfg?.A_TOKEN_ADDRESS;
          if (typeof candidate === 'string') return candidate;
          if (candidate && typeof candidate.address === 'string') return candidate.address;
          return '';
        }
      }
      return '';
    } catch {
      return '';
    }
  }, []);

  const fetchAaveHoldings = useCallback(async () => {
    if (!userAddress || chains.length === 0 || isDataLoading || isProtocolsLoading || !aaveProtocol) {
      setHoldings([]);
      return;
    }
    
    // Previously had rate limit guard from subgraph; removed to simplify and ensure fresh data

    if (holdings.length === 0) setIsLoading(true); else setIsRefreshing(true);
    setError(null);
    console.log(`Starting Aave holdings fetch using subgraph only`);

    try {
      // Fetch portfolio data from subgraph only
      console.log('Fetching portfolio data from subgraph...');
      const portfolioData = await fetchUserPortfolio(userAddress);
      
      // Convert subgraph positions to holdings format
      const subgraphHoldings: AaveHolding[] = portfolioData.positions
        .filter(position => {
          // Only include stablecoins that exist in our database
          const stablecoin = getStablecoinBySymbol(position.asset);
          if (!stablecoin) {
            console.log(`Filtering out non-stablecoin: ${position.asset}`);
            return false;
          }
          return position.supplied > 0 || position.earnings > 0;
        })
        .map(position => {
          // Get stablecoin address for this chain
          const underlyingAsset = getStablecoinAddress(position.asset, position.chainId) || '';
          const aTokenAddress = getATokenAddress(position.chainId, underlyingAsset);
          
          // APY will be synced later via enrichment; set 0 here to avoid refetch loops
          const currentAPY = 0;
          
          console.log(`=== CREATING HOLDING FROM SUBGRAPH DATA ===`);
          console.log(`Chain: ${position.chainName} (${position.chainId})`);
          console.log(`Asset: ${position.asset}`);
          console.log(`Net Deposited: ${position.supplied}`);
          console.log(`Earnings: ${position.earnings}`);
          console.log(`Current Balance: ${position.currentBalance ?? (position.supplied + position.earnings)}`);
          console.log(`Underlying Asset: ${underlyingAsset}`);
          
          return {
            id: `aave-${position.chainId}-${position.asset}-${underlyingAsset}`,
            chainId: position.chainId,
            chainName: position.chainName,
            protocol: 'Aave',
            asset: position.asset,
            balance: position.supplied, // Net deposited from transactions
            aTokenBalance: (position as { currentBalance?: number }).currentBalance ?? (position.supplied + position.earnings), // Current balance from GraphQL
            earnings: position.earnings, // Calculated earnings from subgraph
            apy: currentAPY, // Current APY from yield opportunities
            aTokenAddress: aTokenAddress,
            underlyingAsset: underlyingAsset,
            // Defer on-chain derived values until we successfully read them
            scaledATokenBalance: undefined,
            derivedDeposit: undefined,
          };
        });

      console.log('=== FINAL HOLDINGS FROM SUBGRAPH ===');
      subgraphHoldings.forEach((holding, index) => {
        console.log(`Holding ${index + 1}:`);
        console.log(`  Protocol: ${holding.protocol}`);
        console.log(`  Chain: ${holding.chainName} (${holding.chainId})`);
        console.log(`  Asset: ${holding.asset}`);
        console.log(`  Deposited: $${holding.balance.toFixed(6)}`);
        console.log(`  Current Balance: $${holding.aTokenBalance.toFixed(6)}`);
        console.log(`  Earnings: $${holding.earnings.toFixed(6)}`);
        console.log(`  APY: ${holding.apy.toFixed(2)}%`);
        console.log('');
      });
      console.log('=== END FINAL HOLDINGS ===');
      
      setHoldings(subgraphHoldings);
      setLastUpdated(Date.now());
      
    } catch (err: unknown) {
      console.error('Error fetching Aave holdings:', err);
      setError(err instanceof Error ? err.message : 'Error fetching Aave holdings');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userAddress, chains.length, getStablecoinBySymbol, getStablecoinAddress, fetchUserPortfolio, isDataLoading, isProtocolsLoading, aaveProtocol, getATokenAddress, holdings.length]);

  // Build a stable signature of holdings identities (id + aToken) to avoid re-fetch loops on minor value changes
  const holdingsSignature = React.useMemo(() => {
    if (holdings.length === 0) return '';
    return holdings
      .map(h => `${h.id}:${h.aTokenAddress}`)
      .sort()
      .join('|');
  }, [holdings]);

  const balancesFetchInFlight = React.useRef(false);
  const lastFetchSignature = React.useRef<string>('');
  const lastFetchAt = React.useRef<number>(0);

  // Enrich holdings with on-chain scaled aToken balances (principal derived from history already)
  useEffect(() => {
    const fetchScaledBalances = async () => {
      if (!userAddress) return;
      if (holdings.length === 0) return;
      if (!holdingsSignature) return;

      // Skip if a fetch for same signature ran recently (within 20s)
      const now = Date.now();
      if (balancesFetchInFlight.current) return;
      if (lastFetchSignature.current === holdingsSignature && now - lastFetchAt.current < 20000) return;
      balancesFetchInFlight.current = true;
      setIsDepositsLoading(true);
      lastFetchSignature.current = holdingsSignature;

      // Build tasks grouped per chain to reuse providers
      const chainProviderById: Record<number, providers.JsonRpcProvider> = {};
      const getProvider = (chainId: number) => {
        if (chainProviderById[chainId]) return chainProviderById[chainId];
        const chain = getChainById(chainId);
        const rpcUrl = chain?.rpc_url || '';
        const isInvalid = !rpcUrl || /blastapi|example|YOUR_API_KEY/i.test(rpcUrl);
        if (isInvalid) return null;
        const p = new providers.JsonRpcProvider(rpcUrl);
        chainProviderById[chainId] = p;
        return p;
      };

      const ATOKEN_ABI = [
        'function scaledBalanceOf(address user) view returns (uint256)',
        'function balanceOf(address account) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function getPreviousIndex(address user) view returns (uint256)',
        'function previousIndex(address user) view returns (uint256)'
      ];
      const POOL_ABI = [
        'function getReserveNormalizedIncome(address asset) view returns (uint256)'
      ];
      const MULTICALL_ABI = [
        'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public returns (tuple(bool success, bytes returnData)[] returnData)'
      ];
      // Group by chain to batch multicalls
      const holdingsByChain = holdings.filter(h => h.aTokenAddress && h.aTokenAddress.length === 42).reduce((acc: Record<number, AaveHolding[]>, h) => {
        acc[h.chainId] = acc[h.chainId] || [];
        acc[h.chainId].push(h);
        return acc;
      }, {} as Record<number, AaveHolding[]>);

      const resultsPerChain: Array<{ id: string; scaled?: number; derived?: number; actual?: number }> = [];

      const mergePartial = (partial: Array<{ id: string; scaled?: number; derived?: number; actual?: number }>) => {
        if (!partial || partial.length === 0) return;
        const scaledMap = new Map(partial.map(r => [r.id, r.scaled]));
        const derivedMap = new Map(partial.map(r => [r.id, r.derived]));
        const actualMap = new Map(partial.map(r => [r.id, r.actual]));
        let changed = false;
        setHoldings(prev => prev.map(h => {
          const scaledVal = scaledMap.get(h.id);
          const derivedVal = derivedMap.get(h.id);
          const actualVal = actualMap.get(h.id);
          let next = h;
          if (typeof scaledVal === 'number') {
            const prevScaled = h.scaledATokenBalance ?? 0;
            if (Math.abs(prevScaled - scaledVal) > 1e-12) {
              next = { ...next, scaledATokenBalance: scaledVal } as AaveHolding;
              changed = true;
            }
          }
          if (typeof actualVal === 'number') {
            const prevActual = h.aTokenBalance;
            const roundedActual = Math.floor(actualVal * 1e6) / 1e6;
            if (Math.abs(prevActual - roundedActual) > 1e-12) {
              next = { ...next, aTokenBalance: roundedActual } as AaveHolding;
              changed = true;
            }
          }
          if (typeof derivedVal === 'number') {
            const prevDerived = h.derivedDeposit ?? h.balance;
            const roundedDerived = Math.floor(derivedVal * 1e6) / 1e6;
            if (Math.abs(prevDerived - roundedDerived) > 1e-12) {
              next = { ...next, derivedDeposit: roundedDerived } as AaveHolding;
              changed = true;
            }
          }
          if (next !== h) {
            const principal = (next.derivedDeposit ?? next.balance) ?? next.balance;
            if (typeof next.aTokenBalance === 'number') {
              const newEarnings = Math.max(0, next.aTokenBalance - principal);
              const roundedEarnings = Math.floor(newEarnings * 1e6) / 1e6;
              if (Math.abs((next.earnings ?? 0) - roundedEarnings) > 1e-12) {
                next = { ...next, earnings: roundedEarnings } as AaveHolding;
              }
            }
          }
          return next;
        }));
        if (changed) setLastUpdated(Date.now());
      };

      await Promise.all(Object.entries(holdingsByChain).map(async ([chainIdStr, list]) => {
        const chainId = Number(chainIdStr);
        const provider = getProvider(chainId);
        if (!provider) return;
        const chainRecord = getChainById(chainId) as (ReturnType<typeof getChainById> & { multicall_address?: string }) | undefined;
        const mcAddress = chainRecord?.multicall_address;

        const iface = new utils.Interface(ATOKEN_ABI);
        const poolIface = new utils.Interface(POOL_ABI);

        // Resolve pool per chain from address book
        let poolAddress: string | undefined;
        try {
          type MarketShape = { POOL?: string } | undefined;
          const marketMap: Record<number, MarketShape> = {
            1: (markets as unknown as Record<string, unknown>).AaveV3Ethereum as MarketShape,
            137: (markets as unknown as Record<string, unknown>).AaveV3Polygon as MarketShape,
            43114: (markets as unknown as Record<string, unknown>).AaveV3Avalanche as MarketShape,
            42161: (markets as unknown as Record<string, unknown>).AaveV3Arbitrum as MarketShape,
            10: (markets as unknown as Record<string, unknown>).AaveV3Optimism as MarketShape,
            8453: (markets as unknown as Record<string, unknown>).AaveV3Base as MarketShape,
            56: (markets as unknown as Record<string, unknown>).AaveV3BNB as MarketShape,
            59144: (markets as unknown as Record<string, unknown>).AaveV3Linea as MarketShape,
          };
          const market = marketMap[chainId];
          poolAddress = market?.POOL;
        } catch {
          // ignore
        }

        // Unique underlying assets for normalized income
        const uniqueUnderlyings: string[] = Array.from(new Set(list.map(h => h.underlyingAsset).filter(a => typeof a === 'string' && (a as string).length === 42))) as string[];
        // Prefetch known decimals for common stables to avoid decimals() calls
        const knownDecimals: Record<string, number> = {};
        list.forEach(h => {
          const sym = h.asset?.toUpperCase?.();
          if ((sym === 'USDC' || sym === 'USDT') && h.underlyingAsset && h.underlyingAsset.length === 42) {
            knownDecimals[h.aTokenAddress] = 6;
          }
        });

        if (mcAddress && typeof mcAddress === 'string' && mcAddress.length === 42) {
          try {
            const multicall = new Contract(mcAddress, MULTICALL_ABI, provider);
            const calls: { target: string; callData: string }[] = [];
            const offsets: Record<string, { scaled: number; actual: number; dec?: number; prevIdxStart?: number; decOverride?: number }> = {};
            list.forEach((h) => {
              const decOverride = knownDecimals[h.aTokenAddress];
              offsets[h.id] = { scaled: calls.length, actual: calls.length + 1, decOverride };
              calls.push({ target: h.aTokenAddress, callData: iface.encodeFunctionData('scaledBalanceOf', [userAddress]) });
              calls.push({ target: h.aTokenAddress, callData: iface.encodeFunctionData('balanceOf', [userAddress]) });
              if (decOverride === undefined) {
                offsets[h.id].dec = calls.length;
                calls.push({ target: h.aTokenAddress, callData: iface.encodeFunctionData('decimals', []) });
              }
              // only one call for index; try getPreviousIndex first, then fallback to pool income once
              calls.push({ target: h.aTokenAddress, callData: iface.encodeFunctionData('getPreviousIndex', [userAddress]) });
              offsets[h.id].prevIdxStart = calls.length - 1;
            });
            // Add normalized income calls once per underlying
            const underlyingOffset: Record<string, number> = {};
            if (poolAddress) {
              uniqueUnderlyings.forEach(ua => {
                underlyingOffset[ua] = calls.length;
                calls.push({ target: poolAddress as string, callData: poolIface.encodeFunctionData('getReserveNormalizedIncome', [ua]) });
              });
            }

            const response: { success: boolean; returnData: string }[] = await multicall.tryAggregate(false, calls);

            const readBn = (idx: number, decode: (data: string) => import('ethers').BigNumber): import('ethers').BigNumber | null => {
              const r = response[idx];
              if (!r || !r.success || !r.returnData || r.returnData === '0x') return null;
              try { return decode(r.returnData); } catch { return null; }
            };
            const decodeScaled = (d: string) => iface.decodeFunctionResult('scaledBalanceOf', d)[0] as import('ethers').BigNumber;
            const decodeBal = (d: string) => iface.decodeFunctionResult('balanceOf', d)[0] as import('ethers').BigNumber;
            const decodeDec = (d: string) => Number(iface.decodeFunctionResult('decimals', d)[0] as unknown);
            const decodePrev = (d: string) => iface.decodeFunctionResult('getPreviousIndex', d)[0] as import('ethers').BigNumber;
            const decodeIncome = (d: string) => poolIface.decodeFunctionResult('getReserveNormalizedIncome', d)[0] as import('ethers').BigNumber;

            const chainResults: Array<{ id: string; scaled?: number; derived?: number; actual?: number }> = [];
            list.forEach(h => {
              const off = offsets[h.id]!;
              const scaledRaw = readBn(off.scaled, decodeScaled);
              const balanceRaw = readBn(off.actual, decodeBal);
              const decRaw = off.decOverride !== undefined ? off.decOverride : (() => { const r = response[off.dec!]; if (!r || !r.success) return null; try { return decodeDec(r.returnData); } catch { return null; } })();
              let prevIndex: import('ethers').BigNumber | null = null;
              // try user-specific previousIndex; if it failed, fallback to normalized income
              if (typeof off.prevIdxStart === 'number') {
                prevIndex = readBn(off.prevIdxStart, decodePrev) || null;
              }
              if (!prevIndex && poolAddress && h.underlyingAsset && underlyingOffset[h.underlyingAsset]) {
                prevIndex = readBn(underlyingOffset[h.underlyingAsset], decodeIncome);
              }
              if (scaledRaw && balanceRaw && typeof decRaw === 'number') {
                const dec = decRaw;
                const scaledNormalized = parseFloat(utils.formatUnits(scaledRaw, dec));
                const actualNormalized = parseFloat(utils.formatUnits(balanceRaw, dec));
                let derivedNormalized = scaledNormalized;
                if (prevIndex && !prevIndex.isZero()) {
                  const RAY = utils.parseUnits('1', 27);
                  const derivedWei = scaledRaw.mul(prevIndex).div(RAY);
                  derivedNormalized = parseFloat(utils.formatUnits(derivedWei, dec));
                }
                chainResults.push({ id: h.id, scaled: scaledNormalized, actual: actualNormalized, derived: derivedNormalized });
              } else {
                chainResults.push({ id: h.id });
              }
            });
            resultsPerChain.push(...chainResults);
            mergePartial(chainResults);
          } catch {
            // ignore and fallback to per-holding calls below
          }
        }

        // Fallback: if multicall missing or failed to populate, do per-holding calls
        const haveIds = new Set(resultsPerChain.map(r => r.id));
        const missing = list.filter(h => !haveIds.has(h.id));
        if (missing.length > 0) {
          // Prepare pool contract if available
          const pool = poolAddress ? new Contract(poolAddress, POOL_ABI, provider) : null;
          // Cache normalized income per underlying
          const incomeCache = new Map<string, import('ethers').BigNumber>();
          const fallbackResults: Array<{ id: string; scaled?: number; derived?: number; actual?: number }> = [];
          await Promise.all(missing.map(async (h) => {
            try {
              const atoken = new Contract(h.aTokenAddress, ATOKEN_ABI, provider);
              const [scaledRaw, balanceRaw, dec]: [import('ethers').BigNumber, import('ethers').BigNumber, number] = await Promise.all([
                atoken.scaledBalanceOf(userAddress),
                atoken.balanceOf(userAddress),
                Promise.resolve((h.asset?.toUpperCase?.() === 'USDC' || h.asset?.toUpperCase?.() === 'USDT') ? 6 : await atoken.decimals())
              ]);
              let prevIndex: import('ethers').BigNumber | null = null;
              try { const fn = (atoken as unknown as { getPreviousIndex?: (u: string) => Promise<import('ethers').BigNumber> }).getPreviousIndex; if (fn) prevIndex = await fn(userAddress); } catch { /* ignore */ }
              if (!prevIndex) { try { const fn2 = (atoken as unknown as { previousIndex?: (u: string) => Promise<import('ethers').BigNumber> }).previousIndex; if (fn2) prevIndex = await fn2(userAddress); } catch { /* ignore */ } }
              if (!prevIndex && pool && h.underlyingAsset && h.underlyingAsset.length === 42) {
                let inc = incomeCache.get(h.underlyingAsset);
                if (!inc) { const fetched = await (pool as Contract).getReserveNormalizedIncome(h.underlyingAsset); incomeCache.set(h.underlyingAsset, fetched); inc = fetched; }
                prevIndex = inc ?? null;
              }
              const scaledNormalized = parseFloat(utils.formatUnits(scaledRaw, dec));
              const actualNormalized = parseFloat(utils.formatUnits(balanceRaw, dec));
              let derivedNormalized = scaledNormalized;
              if (prevIndex && !prevIndex.isZero()) {
                const RAY = utils.parseUnits('1', 27);
                const derivedWei = scaledRaw.mul(prevIndex).div(RAY);
                derivedNormalized = parseFloat(utils.formatUnits(derivedWei, dec));
              }
              fallbackResults.push({ id: h.id, scaled: scaledNormalized, actual: actualNormalized, derived: derivedNormalized });
            } catch {
              fallbackResults.push({ id: h.id });
            }
          }));
          resultsPerChain.push(...fallbackResults);
          mergePartial(fallbackResults);
        }
      }));

      const results = resultsPerChain;
      if (results.length === 0) { setIsDepositsLoading(false); return; }

      // Merge only if values actually changed to avoid re-render loops
      const scaledMap = new Map(results.map(r => [r.id, r.scaled]));
      const derivedMap = new Map(results.map(r => [r.id, r.derived]));
      const actualMap = new Map(results.map(r => [r.id, r.actual]));
      let changed = false;
      const updated = holdings.map(h => {
        const scaledVal = scaledMap.get(h.id);
        const derivedVal = derivedMap.get(h.id);
        const actualVal = actualMap.get(h.id);
        let next = h;
        if (typeof scaledVal === 'number') {
          const prevScaled = h.scaledATokenBalance ?? 0;
          if (Math.abs(prevScaled - scaledVal) > 1e-12) {
            next = { ...next, scaledATokenBalance: scaledVal } as AaveHolding;
            changed = true;
          }
        }
        if (typeof actualVal === 'number') {
          const prevActual = h.aTokenBalance;
          // Round to 6 decimals for stability
          const roundedActual = Math.floor(actualVal * 1e6) / 1e6;
          if (Math.abs(prevActual - roundedActual) > 1e-12) {
            next = { ...next, aTokenBalance: roundedActual } as AaveHolding;
            changed = true;
          }
        }
        if (typeof derivedVal === 'number') {
          const prevDerived = h.derivedDeposit ?? h.balance;
          // Round to 6 decimals to stabilize UI and comparisons
          const roundedDerived = Math.floor(derivedVal * 1e6) / 1e6;
          if (Math.abs(prevDerived - roundedDerived) > 1e-12) {
            next = { ...next, derivedDeposit: roundedDerived } as AaveHolding;
            changed = true;
          }
        }
        // Recalculate earnings from on-chain balance if available
        const principal = (next.derivedDeposit ?? next.balance) ?? next.balance;
        if (typeof next.aTokenBalance === 'number') {
          const newEarnings = Math.max(0, next.aTokenBalance - principal);
          // Round earnings for stability
          const roundedEarnings = Math.floor(newEarnings * 1e6) / 1e6;
          if (Math.abs((next.earnings ?? 0) - roundedEarnings) > 1e-12) {
            next = { ...next, earnings: roundedEarnings } as AaveHolding;
            changed = true;
          }
        }
        return next;
      });
      if (changed) setHoldings(updated);
      lastFetchAt.current = Date.now();
      setLastUpdated(lastFetchAt.current);
      balancesFetchInFlight.current = false;
      setIsDepositsLoading(false);
    };

    fetchScaledBalances();
    // We intentionally do not include setHoldings to avoid unnecessary effect triggers
    // Depend only on stable identifiers
  }, [userAddress, holdingsSignature, getChainById, holdings]);

  // When yield opportunities arrive later, enrich existing holdings with up-to-date APYs
  React.useEffect(() => {
    if (holdings.length === 0 || aaveOpportunities.length === 0) return;
    
    console.log('=== APY ENRICHMENT DEBUG ===');
    console.log('Holdings:', holdings.map(h => ({ asset: h.asset, chainId: h.chainId, chainName: h.chainName, currentAPY: h.apy })));
    console.log('Opportunities:', aaveOpportunities.map(o => ({ assets: o.assets, chain: o.chain, apy: o.apy })));
    
    const updated = holdings.map(h => {
      const dbChain = getChainById(h.chainId);
      
      // Try multiple matching strategies
      let matchingOpp = null;
      
      // Strategy 1: Direct chain name match (case insensitive)
      matchingOpp = aaveOpportunities.find(o =>
        o.protocol === 'Aave' &&
        (o.assets as string[]).some(a => a.toLowerCase() === h.asset.toLowerCase()) &&
        o.chain.toLowerCase() === h.chainName.toLowerCase()
      );
      
      // Strategy 2: Chain slug match (remove spaces, lowercase)
      if (!matchingOpp && dbChain) {
        const chainSlug = dbChain.name.toLowerCase().replace(/\s+/g, '');
        matchingOpp = aaveOpportunities.find(o =>
          o.protocol === 'Aave' &&
          (o.assets as string[]).some(a => a.toLowerCase() === h.asset.toLowerCase()) &&
          o.chain.toLowerCase() === chainSlug
        );
      }
      
      // Strategy 3: Fallback - try holding chain name as slug
      if (!matchingOpp) {
        const holdingChainSlug = h.chainName.toLowerCase().replace(/\s+/g, '');
        matchingOpp = aaveOpportunities.find(o =>
          o.protocol === 'Aave' &&
          (o.assets as string[]).some(a => a.toLowerCase() === h.asset.toLowerCase()) &&
          o.chain.toLowerCase() === holdingChainSlug
        );
      }
      
      console.log(`Matching for ${h.asset} on ${h.chainName} (ID: ${h.chainId}):`, {
        dbChainName: dbChain?.name,
        foundMatch: !!matchingOpp,
        matchedAPY: matchingOpp?.apy,
        currentAPY: h.apy
      });
      
      if (matchingOpp && matchingOpp.apy !== h.apy) {
        console.log(`Updating APY for ${h.asset} on ${h.chainName}: ${h.apy}% -> ${matchingOpp.apy}%`);
        return { ...h, apy: matchingOpp.apy };
      }
      return h;
    });
    
    // Only update if something changed
    const changed = updated.some((h, i) => h.apy !== holdings[i].apy);
    if (changed) {
      console.log('APY enrichment: Updating holdings with new APYs');
      setHoldings(updated);
    } else {
      console.log('APY enrichment: No changes needed');
    }
  }, [aaveOpportunities, holdings, getChainById]);

  // Always derive/display APY from the same source as Yield Opportunities
  // This guarantees visual parity even if holdings were fetched earlier
  const holdingsWithSyncedApy = React.useMemo(() => {
    if (holdings.length === 0) return holdings;
    if (aaveOpportunities.length === 0) return holdings;

    return holdings.map(h => {
      const dbChain = getChainById(h.chainId);

      // Strategy 1: Direct chain name match (case insensitive)
      let matchingOpp = aaveOpportunities.find(o =>
        o.protocol === 'Aave' &&
        (o.assets as string[]).some(a => a.toLowerCase() === h.asset.toLowerCase()) &&
        o.chain.toLowerCase() === h.chainName.toLowerCase()
      );

      // Strategy 2: Chain slug match (remove spaces, lowercase)
      if (!matchingOpp && dbChain) {
        const chainSlug = dbChain.name.toLowerCase().replace(/\s+/g, '');
        matchingOpp = aaveOpportunities.find(o =>
          o.protocol === 'Aave' &&
          (o.assets as string[]).some(a => a.toLowerCase() === h.asset.toLowerCase()) &&
          o.chain.toLowerCase() === chainSlug
        );
      }

      // Strategy 3: Fallback - try holding chain name as slug
      if (!matchingOpp) {
        const holdingChainSlug = h.chainName.toLowerCase().replace(/\s+/g, '');
        matchingOpp = aaveOpportunities.find(o =>
          o.protocol === 'Aave' &&
          (o.assets as string[]).some(a => a.toLowerCase() === h.asset.toLowerCase()) &&
          o.chain.toLowerCase() === holdingChainSlug
        );
      }

      return matchingOpp ? { ...h, apy: matchingOpp.apy } : h;
    });
  }, [holdings, aaveOpportunities, getChainById]);

  // Manual refresh function that can be called explicitly
  const manualRefresh = useCallback(() => {
    // Reset cooldowns so derived deposit recomputes immediately
    lastFetchSignature.current = '';
    lastFetchAt.current = 0;
    balancesFetchInFlight.current = false;
    hasInitiallyFetched.current = false; // Allow refetch
    fetchAaveHoldings();
  }, [fetchAaveHoldings]);

  // removed duplicate unguarded fetch effect; guarded effect below handles initial fetch

  // Only fetch once when dependencies are ready - no automatic retries
  const hasInitiallyFetched = React.useRef(false);
  
  React.useEffect(() => {
    if (userAddress && chains.length > 0 && !isDataLoading && !isProtocolsLoading && aaveProtocol && !hasInitiallyFetched.current) {
      hasInitiallyFetched.current = true;
      fetchAaveHoldings();
    }
  }, [userAddress, chains.length, isDataLoading, isProtocolsLoading, aaveProtocol, fetchAaveHoldings]);


  const totalValue = holdings.reduce((sum, h) => sum + h.aTokenBalance, 0);
  const totalEarnings = holdings.reduce((sum, h) => sum + h.earnings, 0);
  const totalDeposited = holdings.reduce((sum, h) => sum + h.balance, 0);

  return { 
    holdings: holdingsWithSyncedApy, 
    isLoading, 
    isRefreshing,
    isDepositsLoading,
    error, 
    refetch: manualRefresh, 
    lastUpdated,
    totalValue, 
    totalEarnings, 
    totalDeposited
  };
};