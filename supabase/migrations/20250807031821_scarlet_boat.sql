/*
  # Update Aave API Configuration

  1. Updates
    - Update Aave protocol with API key and new endpoint
    - Update chains with new subgraph URL pattern
    - Store API key securely in protocols table

  2. Changes
    - Set Aave api_endpoint to The Graph gateway
    - Store API key for Aave protocol
    - Update all chain aave_subgraph_url to use new gateway pattern
*/

-- Update Aave protocol with new API configuration
UPDATE protocols 
SET 
  api_endpoint = 'https://gateway.thegraph.com/api',
  api_key_required = true
WHERE slug = 'aave';

-- Insert API key for Aave (you may want to store this more securely in production)
-- For now, we'll add a new column to store API keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'protocols' AND column_name = 'api_key'
  ) THEN
    ALTER TABLE protocols ADD COLUMN api_key text;
  END IF;
END $$;

-- Update Aave with the API key
UPDATE protocols 
SET api_key = '66d1ab8f4cf3da2887af3caf414715ad'
WHERE slug = 'aave';

-- Update chain subgraph URLs to use the new gateway pattern
-- The pattern will be: https://gateway.thegraph.com/api/{api_key}/subgraphs/id/{subgraph_id}

UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV' WHERE id = 1; -- Ethereum
UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV' WHERE id = 137; -- Polygon  
UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV' WHERE id = 43114; -- Avalanche
UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV' WHERE id = 42161; -- Arbitrum
UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV' WHERE id = 10; -- Optimism
UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV' WHERE id = 8453; -- Base
UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/6z2kjnmVifQJ3RCcso2a5yDVTanhDo4Mh7nMJdHa' WHERE id = 59144; -- Linea
UPDATE chains SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV' WHERE id = 56; -- BNB Chain