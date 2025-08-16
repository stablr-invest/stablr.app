/*
  # Update chains subgraph paths

  Update the aave_subgraph_url field in chains table to store only the subgraph path portions:
  - Base: /subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV
  - Linea: /subgraphs/id/Gz2kjnmRV1fQj3R8cssoZa5y9VTanhrDo4Mh7nWW1wHa
*/

-- Update Base chain subgraph path
UPDATE chains 
SET aave_subgraph_url = '/subgraphs/id/GQFbb95cE6d8mV98mL5figjaGkCQ83oV'
WHERE id = 8453;

-- Update Linea chain subgraph path  
UPDATE chains 
SET aave_subgraph_url = '/subgraphs/id/Gz2kjnmRV1fQj3R8cssoZa5y9VTanhrDo4Mh7nWW1wHa'
WHERE id = 59144;

-- Clear subgraph URLs for other chains since you only specified Base and Linea
UPDATE chains 
SET aave_subgraph_url = NULL
WHERE id NOT IN (8453, 59144);