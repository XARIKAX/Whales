// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISwapRouter} from "../interfaces/ISwapRouter.sol";

/// @dev A hostile router: burns every drop of gas it is given, then reverts.
///      Stands in for a malicious elected token doing the same thing, to prove
///      one bad election cannot take a whole delivery batch down with it.
contract GasBurner is ISwapRouter {
    uint256 public sink;

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256,
        address[] calldata,
        address,
        uint256
    ) external payable {
        while (true) {
            sink++;
        }
    }
}
