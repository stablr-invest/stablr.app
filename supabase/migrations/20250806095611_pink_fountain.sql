/*
  # Add Aave subgraph URL column to chains table

  1. Schema Changes
    - Add `aave_subgraph_url` column to `chains` table
    - Update existing chains with their respective Aave subgraph URLs

  2. Data Population
    - Populate subgraph URLs for supported chains based on Aave protocol subgraphs
    - URLs from https://github.com/aave/protocol-subgraphs
*/

-- Add the aave_subgraph_url column to chains table
ALTER TABLE chains 
ADD COLUMN IF NOT EXISTS aave_subgraph_url text;

-- Update chains with their respective Aave V3 subgraph URLs
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3' WHERE id = 1; -- Ethereum
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon' WHERE id = 137; -- Polygon
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-avalanche' WHERE id = 43114; -- Avalanche
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum' WHERE id = 42161; -- Arbitrum
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism' WHERE id = 10; -- Optimism
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base' WHERE id = 8453; -- Base
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-bnb' WHERE id = 56; -- BNB Chain
UPDATE chains SET aave_subgraph_url = 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3-linea' WHERE id = 59144; -- Linea