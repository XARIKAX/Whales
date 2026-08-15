// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IWhales is IERC721 {
    /// @notice Unix timestamp the whale was activated, or 0 if it is dormant.
    function activatedAt(uint256 tokenId) external view returns (uint64);

    /// @notice Current payout weight of a whale in basis points (10000 = 1.00x).
    /// @dev Returns 0 for dormant whales. This is the *true* weight; the Trench
    ///      may hold a staler, lower value until someone calls `syncWeight`.
    function weightOf(uint256 tokenId) external view returns (uint256);

    function totalMinted() external view returns (uint256);

    function totalActivated() external view returns (uint256);
}
