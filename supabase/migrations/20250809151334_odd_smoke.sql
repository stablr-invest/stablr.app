/*
  # Add Stablr Counter Contract Configuration

  1. New Configuration Entries
    - Add STABLR_COUNTER_CONTRACT_ADDRESS for the deployed contract on Base
    - Add STABLR_COUNTER_ADMIN_PRIVATE_KEY for the admin private key
    - Add STABLR_COUNTER_CHAIN_ID to specify which chain the contract is on

  2. Security
    - Private key is stored in app_config table (should be encrypted in production)
    - Contract address and chain ID are also stored for easy configuration
*/

-- Add Stablr Counter contract configuration
INSERT INTO app_config (key, value, description) VALUES
  ('STABLR_COUNTER_CONTRACT_ADDRESS', '0xAA2373f05a9DA87BC600c5690d9ae948627FFeAD', 'Address of the Stablr counter contract on Base chain'),
  ('STABLR_COUNTER_ADMIN_PRIVATE_KEY', '123456', 'Private key for the admin account that can increment the counter'),
  ('STABLR_COUNTER_CHAIN_ID', '8453', 'Chain ID where the Stablr counter contract is deployed (Base = 8453)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();