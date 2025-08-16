import { useState, useCallback } from 'react';
import { useSupabaseData } from './useSupabaseData';
import { useProtocols } from './useProtocols';

export interface AaveTransaction {
  id: string;
  timestamp: string;
  txHash: string;
  action: 'Supply' | 'RedeemUnderlying' | 'Borrow' | 'Repay' | 'UsageAsCollateral' | 'SwapBorrowRate' | 'LiquidationCall';
  amount?: string;
  reserve?: {
    symbol: string;
    decimals: number;
  };
  assetPriceUSD?: string;
  borrowRateMode?: string;
  borrowRate?: string;
  stableTokenDebt?: string;
  variableTokenDebt?: string;
  fromState?: boolean;
  toState?: boolean;
  borrowRateModeFrom?: string;
  borrowRateModeTo?: string;
  variableBorrowRate?: string;
  stableBorrowRate?: string;
  collateralAmount?: string;
  collateralReserve?: {
    symbol: string;
    decimals: number;
  };
  principalAmount?: string;
  principalReserve?: {
    symbol: string;
    decimals: number;
  };
  collateralAssetPriceUSD?: string;
  borrowAssetPriceUSD?: string;
}

export interface UserPortfolioData {
  totalSupplied: number;
  totalBorrowed: number;
  totalEarnings: number;
  positions: {
    chainId: number;
    chainName: string;
    asset: string;
    supplied: number;
    borrowed: number;
    earnings: number;
    currentBalance: number;
    lastActivity: string;
  }[];
  transactions: AaveTransaction[];
}

// Aave v3 GraphQL API default endpoint; prefer DB `protocols.api_endpoint` when available
const DEFAULT_AAVE_GRAPHQL_URL = 'https://api.v3.aave.com/graphql';

const MARKETS_QUERY = `
  query Markets($chainIds: [ChainId!]!, $user: EvmAddress) {
    markets(request: { chainIds: $chainIds, user: $user }) {
      address
      name
      chain { chainId name }
    }
  }
`;

// USER_TX_HISTORY_QUERY removed; no longer needed when using userSupplies as source of truth

// Fetch all user supplies (current balances) across markets - using provided entry-point
const USER_SUPPLIES_QUERY = `
  query UserSuppliesForMarkets($request: UserSuppliesRequest!) {
    userSupplies(request: $request) {
      market { address chain { chainId name } }
      currency { symbol address decimals }
      balance { amount { raw decimals value } usdPerToken usd }
      apy { value formatted }
      isCollateral
      canBeCollateral
    }
  }
`;

async function queryAave<T>(endpoint: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint || DEFAULT_AAVE_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`Aave API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error((json.errors as Array<{ message: string }>).map((e) => e.message).join(', '));
  return json.data as T;
}

export const useAaveSubgraph = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { chains, getStablecoinBySymbol, isLoading: isChainsLoading } = useSupabaseData();
  const { getProtocolBySlug } = useProtocols();

  const fetchUserPortfolio = useCallback(async (userAddress: string): Promise<UserPortfolioData> => {
    console.log("=== ENTERED fetchUserPortfolio ===");
    console.log(`User Address: ${userAddress}`);
    const aaveProtocol = getProtocolBySlug('aave');
    console.log(`Aave Protocol Found: ${!!aaveProtocol}`);
    
    console.log(`Chains: ${chains.length}`);
    console.log(`Aave Protocol: ${aaveProtocol}`);
    console.log(`User Address: ${userAddress}`);
    if (!userAddress || isChainsLoading || chains.length === 0 || !aaveProtocol) {
      console.log('=== EARLY RETURN: Missing userAddress or chains ===');
      return {
        totalSupplied: 0,
        totalBorrowed: 0,
        totalEarnings: 0,
        positions: [],
        transactions: []
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const lowercaseAddress = userAddress.toLowerCase();
      console.log("=== PROCESSING USER ADDRESS (Aave GraphQL) ===");
      console.log("Lowercase Address: " + lowercaseAddress);
      console.log(`Available chains: ${chains.length}`);
      
      // Use DB endpoint (protocols.api_endpoint) or default
      const endpoint = aaveProtocol?.api_endpoint || DEFAULT_AAVE_GRAPHQL_URL;

      // 1) Load markets for enabled chains
      type Market = { address: string; chain: { chainId: number; name: string } };
      const enabledChainIds = chains.filter((c: { enabled: boolean }) => c.enabled).map((c: { id: number }) => c.id);
      const marketsResp = await queryAave<{ markets: Market[] }>(endpoint, MARKETS_QUERY, { chainIds: enabledChainIds, user: lowercaseAddress });
      const markets = marketsResp?.markets || [];

      // 2) Use UserSupplies as the single source of truth for current balances

      // 4) Fetch current user supplies per market to get current aToken balances
      const marketsInputs = markets.map(m => ({ address: m.address, chainId: m.chain.chainId }));
      const requestVars = {
        request: {
          user: lowercaseAddress,
          markets: marketsInputs,
          collateralsOnly: false,
          orderBy: { name: 'ASC' }
        }
      } as const;
      const suppliesData = await queryAave<{ userSupplies: Array<{ currency: { symbol: string; address: string; decimals: number }, balance: { amount: { value: string } }, market: { chain: { chainId: number } } }> }>(
        endpoint,
        USER_SUPPLIES_QUERY,
        requestVars
      );

      // Build positions directly from supplies response
      const enrichedPositions = (suppliesData.userSupplies || [])
        .filter(s => s?.currency?.symbol && !!getStablecoinBySymbol(s.currency.symbol))
        .map(s => {
          const chainId = s.market.chain.chainId;
          const chainName = (chains.find(c => c.id === chainId)?.name) || `${chainId}`;
          const symbol = s.currency.symbol || '';
          const currentBalance = parseFloat(s.balance?.amount?.value || '0');
          const supplied = currentBalance; // when history not used, treat principal as current
          return {
            chainId,
            chainName,
            asset: symbol,
            supplied,
            borrowed: 0,
            earnings: 0,
            totalSupplied: supplied,
            totalRedeemed: 0,
            netDeposited: supplied,
            lastActivity: '',
            currentBalance,
          };
        })
        .filter(p => p.currentBalance > 0.0000001);

      const totalSupplied = enrichedPositions.reduce((s, p) => s + p.supplied, 0);
      const totalBorrowed = 0;
      const totalEarnings = enrichedPositions.reduce((s, p) => s + p.earnings, 0);

      const portfolioData: UserPortfolioData = { totalSupplied, totalBorrowed, totalEarnings, positions: enrichedPositions as unknown as UserPortfolioData['positions'], transactions: [] };
      console.log('Portfolio Data Object:', portfolioData);
      return portfolioData;
      

    } catch (err) {
      console.error('Error fetching user portfolio from subgraphs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch portfolio data');
      
      return {
        totalSupplied: 0,
        totalBorrowed: 0,
        totalEarnings: 0,
        positions: [],
        transactions: []
      };
    } finally {
      setIsLoading(false);
    }
  }, [chains, getStablecoinBySymbol, getProtocolBySlug, isChainsLoading]);

  return {
    fetchUserPortfolio,
    isLoading,
    error
  };
};

// Helper function to calculate position for a specific chain (currently unused)
/*
function calculateChainPosition(transactions: AaveTransaction[], chain: { id: number; name: string }) {
  const assetPositions: Record<string, {
    totalDeposited: number;
    totalWithdrawn: number;
    totalBorrowed: number;
    totalRepaid: number;
    netPrincipal: number;
    lastActivity: string;
  }> = {};

  // Process transactions to calculate current positions
  transactions.forEach(tx => {
    if (!tx.reserve?.symbol) return;

    const asset = tx.reserve.symbol;
    if (!assetPositions[asset]) {
      assetPositions[asset] = {
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalBorrowed: 0,
        totalRepaid: 0,
        netPrincipal: 0,
        lastActivity: tx.timestamp
      };
    }

    const position = assetPositions[asset];
    // Use exact same calculation as your script
    const value = parseFloat(tx.amount || '0') / Math.pow(10, tx.reserve.decimals);

    switch (tx.action) {
      case 'Supply':
        position.totalDeposited += value;
        break;
      case 'RedeemUnderlying':
        position.totalWithdrawn += value;
        break;
      case 'Borrow':
        position.totalBorrowed += value;
        break;
      case 'Repay':
        position.totalRepaid += value;
        break;
    }

    position.lastActivity = tx.timestamp;
  });

  // Calculate net principal for each asset (exactly like your script)
  Object.values(assetPositions).forEach(position => {
    // Net principal = total deposited - total withdrawn (exact match to your script)
    position.netPrincipal = position.totalDeposited - position.totalWithdrawn;
  });

  // Convert to array and calculate totals
  const positions = Object.entries(assetPositions)
    .filter(([ignored, pos]) => pos.netPrincipal > 0.000001) // Only include positions with net principal > 0
    .map(([asset, pos]) => ({
      chainId: chain.id,
      chainName: chain.name,
      asset,
      supplied: pos.netPrincipal, // Net principal still in protocol
      borrowed: pos.totalBorrowed - pos.totalRepaid, // Net borrowed amount
      earnings: 0, // We can't calculate earnings from subgraph alone - need current aToken balance
      totalDeposited: pos.totalDeposited,
      totalWithdrawn: pos.totalWithdrawn,
      netPrincipal: pos.netPrincipal,
      lastActivity: new Date(parseInt(pos.lastActivity) * 1000).toISOString()
    }));

  const totalSupplied = positions.reduce((sum, pos) => sum + pos.netPrincipal, 0);
  const totalBorrowed = positions.reduce((sum, pos) => sum + (pos.borrowed), 0);
  const totalEarnings = positions.reduce((sum, pos) => sum + pos.earnings, 0);

  return {
    supplied: totalSupplied,
    borrowed: totalBorrowed,
    earnings: totalEarnings,
    positions
  };
}

// Helper function to calculate position for a specific chain with earnings (currently unused)
function calculateChainPositionWithEarnings(transactions: AaveTransaction[], chain: { id: number; name: string }, reservesMap: Map<string, { scaledATokenBalance?: string; reserve?: { liquidityIndex?: string; decimals?: string } }>) {
  type PositionAccumulator = {
    totalSupplied: number;
    totalRedeemed: number;
    netDeposited: number;
    lastActivity: string;
    depositRedeemTxs: AaveTransaction[];
  };

  const assetPositions: Record<string, PositionAccumulator> = {};

  console.log(`Processing ${transactions.length} transactions for ${chain.name}`);

  // 1) Group by asset and collect deposit/redeem txs; accumulate borrow/repay totals
  transactions.forEach(tx => {
    if (!tx.reserve?.symbol) return;

    const asset = tx.reserve.symbol;
      if (!assetPositions[asset]) {
        assetPositions[asset] = {
          totalSupplied: 0,
          totalRedeemed: 0,
          netDeposited: 0,
          lastActivity: tx.timestamp,
          depositRedeemTxs: []
        };
      }

    const position = assetPositions[asset];

    // Track last activity
    position.lastActivity = tx.timestamp;

    const rawAmount = parseFloat(tx.amount || '0');
    const decimals = tx.reserve?.decimals ?? 18;
    const normalizedValue = rawAmount / Math.pow(10, Number(decimals));

    switch (tx.action) {
      case 'Supply':
      case 'RedeemUnderlying':
        position.depositRedeemTxs.push(tx);
        // Keep simple totals for reference/telemetry
        if (tx.action === 'Supply') position.totalSupplied += normalizedValue;
        if (tx.action === 'RedeemUnderlying') position.totalRedeemed += normalizedValue;
        break;
      // Ignore other actions for subgraph-only holdings computation
    }
  });

  // 2) For each asset, sort oldest-first and compute clamped running deposited amount
  Object.entries(assetPositions).forEach(([asset, position]) => {
    // Sort by ascending timestamp (oldest first)
    position.depositRedeemTxs.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

    let runningDeposited = 0;

    for (const tx of position.depositRedeemTxs) {
      const rawAmount = parseFloat(tx.amount || '0');
      const decimals = tx.reserve?.decimals ?? 18;
      const value = rawAmount / Math.pow(10, Number(decimals));

      if (tx.action === 'Supply') {
        // Deposit we add
        runningDeposited += value;
      } else if (tx.action === 'RedeemUnderlying') {
        // Redeem we minus, but clamp at zero if negative
        runningDeposited = Math.max(0, runningDeposited - value);
      }
    }

    position.netDeposited = runningDeposited;

    console.log(`${chain.name} ${asset} computed netDeposited (oldest-first, clamped): ${position.netDeposited}`);
  });

  // 3) Convert to array and calculate totals
  const positions = Object.entries(assetPositions)
    .filter(([asset, pos]) => {
      console.log(`${chain.name} filtering ${asset}: netDeposited=${pos.netDeposited}`);
      return pos.netDeposited > 0.000001; // Only include positions with net deposits > 0
    })
    .map(([asset, pos]) => {
      // Calculate earnings using current aToken balance from reserves
      let earnings = 0;
      const reserveData = reservesMap.get(asset);
      if (reserveData && reserveData.scaledATokenBalance && reserveData.reserve?.liquidityIndex) {
        const scaledBalance = parseFloat(reserveData.scaledATokenBalance || '0');
        const liquidityIndex = parseFloat(reserveData.reserve.liquidityIndex || '0');
        const decimals = parseInt(reserveData.reserve.decimals || '18');

        // Current balance: scaledBalance * liquidityIndex / 1e27
        const currentBalanceRaw = scaledBalance * liquidityIndex / Math.pow(10, 27);
        const currentBalanceNormalized = currentBalanceRaw / Math.pow(10, decimals);

        earnings = Math.max(0, currentBalanceNormalized - pos.netDeposited);
        console.log(`${chain.name} ${asset} earnings: scaled=${scaledBalance}, index=${liquidityIndex}, current=${currentBalanceNormalized}, deposited=${pos.netDeposited}, earnings=${earnings}`);
      } else {
        console.log(`${chain.name} no reserve data for ${asset}`);
      }

      return {
        chainId: chain.id || 0,
        chainName: chain.name || 'Unknown',
        asset,
        supplied: isFinite(pos.netDeposited) ? pos.netDeposited : 0, // Net deposited amount still in protocol
        borrowed: 0,
        earnings: isFinite(earnings) ? earnings : 0, // Calculated earnings
        totalSupplied: isFinite(pos.totalSupplied) ? pos.totalSupplied : 0,
        totalRedeemed: isFinite(pos.totalRedeemed) ? pos.totalRedeemed : 0,
        netDeposited: isFinite(pos.netDeposited) ? pos.netDeposited : 0,
        lastActivity: new Date(parseInt(pos.lastActivity) * 1000).toISOString()
      };
    });

  const totalSupplied = positions.reduce((sum, pos) => sum + (isFinite(pos.supplied) ? pos.supplied : 0), 0);
  const totalBorrowed = 0;
  const totalEarnings = positions.reduce((sum, pos) => sum + (isFinite(pos.earnings) ? pos.earnings : 0), 0);

  console.log(`Chain ${chain.name} totals: supplied=${totalSupplied}, borrowed=${totalBorrowed}, earnings=${totalEarnings}`);

  return {
    supplied: isFinite(totalSupplied) ? totalSupplied : 0,
    borrowed: isFinite(totalBorrowed) ? totalBorrowed : 0,
    earnings: isFinite(totalEarnings) ? totalEarnings : 0,
    positions
  };
}
*/