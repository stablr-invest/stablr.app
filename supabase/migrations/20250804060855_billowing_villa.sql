/*
  # Update chain logos with image URLs

  1. Changes
    - Update existing chains with logo image URLs pointing to uploaded images
    - Set logo URLs for Ethereum, Polygon, Optimism, Arbitrum, BNB Chain, and save icon for general use

  2. Security
    - No RLS changes needed as this only updates existing data
*/

-- Update chain logos with the uploaded image URLs
UPDATE chains SET logo = '/ethereum.png' WHERE id = 1;
UPDATE chains SET logo = '/arbitrum.png' WHERE id = 42161;
UPDATE chains SET logo = '/optimism.png' WHERE id = 10;
UPDATE chains SET logo = '/bnb.png' WHERE id = 56;
UPDATE chains SET logo = '/polygon.png' WHERE id = 137;

-- Add any missing chains that might be referenced in the app
INSERT INTO chains (id, name, symbol, rpc_url, block_explorer, color, logo) VALUES
  (8453, 'Base', 'ETH', 'https://mainnet.base.org', 'https://basescan.org', '#0052FF', '/save.png')
ON CONFLICT (id) DO UPDATE SET logo = EXCLUDED.logo;

INSERT INTO chains (id, name, symbol, rpc_url, block_explorer, color, logo) VALUES
  (43114, 'Avalanche', 'AVAX', 'https://api.avax.network/ext/bc/C/rpc', 'https://snowtrace.io', '#E84142', '/save.png')
ON CONFLICT (id) DO UPDATE SET logo = EXCLUDED.logo;