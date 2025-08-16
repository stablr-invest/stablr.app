import * as ethers from 'ethers';

// Re-export all of ethers v6
export * from 'ethers';

// Provide a compatibility layer for 'utils'
// This attempts to re-create the ethers.utils object from v5 for compatibility.
// It includes commonly used functions that were previously in ethers.utils.
export const utils = {
  getAddress: ethers.getAddress,
  isAddress: ethers.isAddress,
  formatUnits: ethers.formatUnits,
  parseUnits: ethers.parseUnits,
  keccak256: ethers.keccak256,
  toUtf8Bytes: ethers.toUtf8Bytes,
  id: ethers.id, // For keccak256 hash of a string
  hexlify: ethers.hexlify,
  arrayify: ethers.getBytes,
  splitSignature: ethers.Signature.from,
  base58: {
    encode: (data: Uint8Array) => ethers.encodeBase58(data),
    decode: (data: string) => ethers.decodeBase58(data)
  }
};

// Provide a compatibility layer for 'BigNumber'
// In ethers v6, use native BigInt instead of BigNumber
export const BigNumber = {
  from: (value: any) => BigInt(value),
  isBigNumber: (value: any) => typeof value === 'bigint'
};

// Re-export constants that might be needed
export const constants = {
  AddressZero: ethers.ZeroAddress,
  HashZero: ethers.ZeroHash,
  MaxUint256: ethers.MaxUint256
};