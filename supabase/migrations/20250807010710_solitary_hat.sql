/*
  # Update Base subgraph URL to use gateway

  Updates the Base chain's Aave subgraph URL to use The Graph's gateway endpoint
  which should resolve CORS issues.
*/

UPDATE chains 
SET aave_subgraph_url = 'https://gateway.thegraph.com/api/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF'
WHERE id = 8453; -- Base chain ID