export const STABLR_FEE_ROUTER_ABI = [
  // Minimal interface for a helper that splits withdrawal into user + treasury in a single tx
  // function withdrawAndDistribute(address pool,address asset,uint256 amount,address user,address treasury,uint256 feeAmount) external returns (uint256 userReceived, uint256 treasuryReceived);
  {
    "inputs": [
      { "internalType": "address", "name": "pool", "type": "address" },
      { "internalType": "address", "name": "asset", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "address", "name": "treasury", "type": "address" },
      { "internalType": "uint256", "name": "feeAmount", "type": "uint256" }
    ],
    "name": "withdrawAndDistribute",
    "outputs": [
      { "internalType": "uint256", "name": "userReceived", "type": "uint256" },
      { "internalType": "uint256", "name": "treasuryReceived", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];



