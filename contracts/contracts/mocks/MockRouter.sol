// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISwapRouter} from "../interfaces/ISwapRouter.sol";
import {MockStock} from "./MockStock.sol";

/// @dev Test double for an AMM: mints `rate` stock per wei of ETH, or reverts
///      when `broken` is set, so the ETH fallback path can be exercised.
contract MockRouter is ISwapRouter {
    uint256 public rate = 2;
    bool public broken;

    function setRate(uint256 rate_) external {
        rate = rate_;
    }

    function setBroken(bool broken_) external {
        broken = broken_;
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external payable {
        require(!broken, "MockRouter: broken");
        MockStock(path[path.length - 1]).mint(to, msg.value * rate);
    }
}
