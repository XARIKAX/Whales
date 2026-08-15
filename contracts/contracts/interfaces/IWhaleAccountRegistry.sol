// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IWhaleAccountRegistry {
    /// @notice Deterministic address of a whale's own wallet. Valid whether or
    ///         not the account has been deployed yet.
    function accountOf(uint256 tokenId) external view returns (address);

    /// @notice Deploys the whale's wallet if it does not exist. Idempotent.
    function createAccount(uint256 tokenId) external returns (address);
}
