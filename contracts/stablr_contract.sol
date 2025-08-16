// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title StablrContract - records successful deposits and tracks global and per-chain totals
/// @notice Only the contract owner can record a deposit. Rotate owner to rotate the signer.
contract StablrContract {
    address public owner;
    /// @notice Total value deposited across all chains
    uint256 public totalAmountDeposited;

    /// @notice Total value deposited per chainId
    mapping(uint256 => uint256) public totalAmountDepositedByChain;
    /// @notice Total number of deposits recorded per chainId
    mapping(uint256 => uint256) public totalDepositsByChain;
    /// @dev Tracks chainIds that have at least one recorded deposit to enable iteration in getters
    uint256[] private trackedChainIds;
    mapping(uint256 => bool) private isTrackedChainId;

    /// @dev Emitted when a deposit is recorded
    event DepositRecorded(
        address indexed by,
        uint256 indexed chainId,
        uint256 amount,
        uint256 newTotalDeposits,
        uint256 newTotalAmountDeposited
    );
    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddressNotAllowed();
    error ZeroAmountNotAllowed();
    error InvalidChainId();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddressNotAllowed();
        owner = initialOwner;
        emit OwnerUpdated(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Record a successful deposit associated with a specific chainId and amount
    /// @param chainId The EVM chainId the deposit occurred on
    /// @param amount The value deposited (in the smallest unit, e.g., wei for ETH/ERC20)
    /// @return newTotalDeposits The updated global deposits count (computed)
    /// @return newTotalAmountDeposited The updated global total amount deposited
    function recordDeposit(uint256 chainId, uint256 amount)
        external
        onlyOwner
        returns (uint256 newTotalDeposits, uint256 newTotalAmountDeposited)
    {
        if (chainId == 0) revert InvalidChainId();
        if (amount == 0) revert ZeroAmountNotAllowed();

        if (!isTrackedChainId[chainId]) {
            isTrackedChainId[chainId] = true;
            trackedChainIds.push(chainId);
        }

        unchecked {
            totalDepositsByChain[chainId] += 1;
            totalAmountDeposited += amount;
            totalAmountDepositedByChain[chainId] += amount;
        }

        // compute total deposits by summing per-chain counts
        uint256 depositsSum = 0;
        uint256 len = trackedChainIds.length;
        for (uint256 i = 0; i < len; i++) {
            depositsSum += totalDepositsByChain[trackedChainIds[i]];
        }

        emit DepositRecorded(
            msg.sender,
            chainId,
            amount,
            depositsSum,
            totalAmountDeposited
        );

        return (depositsSum, totalAmountDeposited);
    }

    /// @notice Update the owner to a new address
    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddressNotAllowed();
        address previous = owner;
        owner = newOwner;
        emit OwnerUpdated(previous, newOwner);
    }

    /// @notice Get total value deposited across all chains
    function getTotalValueDeposited() external view returns (uint256) {
        return totalAmountDeposited;
    }

    /// @notice Get total value deposited for a specific chainId
    function getTotalValueDepositedByChain(uint256 chainId) external view returns (uint256) {
        return totalAmountDepositedByChain[chainId];
    }

    /// @notice Get total number of deposits across all chains (computed)
    function getTotalDepositsCount() external view returns (uint256) {
        uint256 depositsSum = 0;
        uint256 len = trackedChainIds.length;
        for (uint256 i = 0; i < len; i++) {
            depositsSum += totalDepositsByChain[trackedChainIds[i]];
        }
        return depositsSum;
    }

    /// @notice Get total number of deposits for a specific chainId
    function getTotalDepositsCountByChain(uint256 chainId) external view returns (uint256) {
        return totalDepositsByChain[chainId];
    }
}


