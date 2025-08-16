/*
  # Create chains and stablecoins tables

  1. New Tables
    - `chains`
      - `id` (integer, primary key)
      - `name` (text)
      - `symbol` (text)
      - `rpc_url` (text)
      - `block_explorer` (text)
      - `color` (text)
      - `logo` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `stablecoins`
      - `id` (uuid, primary key)
      - `symbol` (text)
      - `name` (text)
      - `decimals` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `stablecoin_addresses`
      - `id` (uuid, primary key)
      - `stablecoin_id` (uuid, foreign key)
      - `chain_id` (integer, foreign key)
      - `address` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access (since this is reference data)

  3. Data
    - Insert initial chain and stablecoin data
*/

-- Create chains table
CREATE TABLE IF NOT EXISTS chains (
  id integer PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  rpc_url text NOT NULL,
  block_explorer text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  logo text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stablecoins table
CREATE TABLE IF NOT EXISTS stablecoins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,
  name text NOT NULL,
  decimals integer NOT NULL DEFAULT 6,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stablecoin_addresses table
CREATE TABLE IF NOT EXISTS stablecoin_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stablecoin_id uuid NOT NULL REFERENCES stablecoins(id) ON DELETE CASCADE,
  chain_id integer NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  address text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(stablecoin_id, chain_id)
);

-- Enable RLS
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE stablecoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE stablecoin_addresses ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to chains"
  ON chains
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to stablecoins"
  ON stablecoins
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to stablecoin_addresses"
  ON stablecoin_addresses
  FOR SELECT
  TO public
  USING (true);

-- Insert chain data
INSERT INTO chains (id, name, symbol, rpc_url, block_explorer, color, logo) VALUES
  (1, 'Ethereum', 'ETH', 'https://eth.llamarpc.com', 'https://etherscan.io', '#627EEA', 'https://cryptologos.cc/logos/ethereum-eth-logo.png'),
  (42161, 'Arbitrum', 'ETH', 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io', '#28A0F0', 'https://cryptologos.cc/logos/arbitrum-arb-logo.png'),
  (10, 'Optimism', 'ETH', 'https://mainnet.optimism.io', 'https://optimistic.etherscan.io', '#FF0420', 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png'),
  (56, 'BNB Chain', 'BNB', 'https://bsc-dataseed1.binance.org', 'https://bscscan.com', '#F3BA2F', 'https://cryptologos.cc/logos/bnb-bnb-logo.png'),
  (8453, 'Base', 'ETH', 'https://mainnet.base.org', 'https://basescan.org', '#0052FF', 'https://cryptologos.cc/logos/base-base-logo.png'),
  (137, 'Polygon', 'MATIC', 'https://polygon-rpc.com', 'https://polygonscan.com', '#8247E5', 'https://cryptologos.cc/logos/polygon-matic-logo.png')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol,
  rpc_url = EXCLUDED.rpc_url,
  block_explorer = EXCLUDED.block_explorer,
  color = EXCLUDED.color,
  logo = EXCLUDED.logo,
  updated_at = now();

-- Insert stablecoin data
INSERT INTO stablecoins (symbol, name, decimals) VALUES
  ('USDC', 'USD Coin', 6),
  ('USDT', 'Tether USD', 6)
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  decimals = EXCLUDED.decimals,
  updated_at = now();

-- Insert stablecoin addresses
WITH usdc_id AS (SELECT id FROM stablecoins WHERE symbol = 'USDC'),
     usdt_id AS (SELECT id FROM stablecoins WHERE symbol = 'USDT')
INSERT INTO stablecoin_addresses (stablecoin_id, chain_id, address) VALUES
  -- USDC addresses
  ((SELECT id FROM usdc_id), 1, '0xA0b86a91c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  ((SELECT id FROM usdc_id), 42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'),
  ((SELECT id FROM usdc_id), 10, '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'),
  ((SELECT id FROM usdc_id), 56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
  ((SELECT id FROM usdc_id), 8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  ((SELECT id FROM usdc_id), 137, '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'),
  -- USDT addresses
  ((SELECT id FROM usdt_id), 1, '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
  ((SELECT id FROM usdt_id), 42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'),
  ((SELECT id FROM usdt_id), 10, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'),
  ((SELECT id FROM usdt_id), 56, '0x55d398326f99059fF775485246999027B3197955'),
  ((SELECT id FROM usdt_id), 8453, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'),
  ((SELECT id FROM usdt_id), 137, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F')
ON CONFLICT (stablecoin_id, chain_id) DO UPDATE SET
  address = EXCLUDED.address,
  updated_at = now();