// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Uniswap V2 style router surface, the shape every AMM on Robinhood Chain
///      exposes for a simple ETH -> token swap.
interface ISwapRouter {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;
}
