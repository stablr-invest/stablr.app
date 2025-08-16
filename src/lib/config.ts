// Central config for treasury and optional router
// Configuration values are now stored in the database and accessed via useAppConfig hook
// These are fallback values in case database is unavailable

// Default treasury address fallback
export const DEFAULT_STABLR_TREASURY_ADDRESS: string = '0xb60DEa2837cf00b556A824aA9b7bd6E58aD8C8D1';

// Default fee router address (empty = disabled)
export const DEFAULT_STABLR_FEE_ROUTER_ADDRESS: string = '';

// Default fee in basis points (100 bps = 1.00%)
export const DEFAULT_STABLR_FEE_BPS: number = 100;
export const DEFAULT_STABLR_FEE_RATE: number = DEFAULT_STABLR_FEE_BPS / 10000; // decimal rate

// Helper function to calculate fee rate from basis points
export const calculateFeeRate = (bps: number): number => bps / 10000;