// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITrench {
    /// @notice Called by the Whales contract whenever a whale's weight changes.
    /// @dev Settles the whale's pending share at its old weight before the new
    ///      weight takes effect, so weight changes are never retroactive.
    function onWeightChange(uint256 tokenId, uint256 newWeight) external;

    function weightOf(uint256 tokenId) external view returns (uint256);

    function totalWeight() external view returns (uint256);
}
