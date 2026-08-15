// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Refuses ETH, to prove `haul` reverts rather than losing the tip when
///      the keeper cannot be paid.
contract RejectingReceiver {
    function haul(address trench) external returns (bool ok) {
        (ok,) = trench.call(abi.encodeWithSignature("haul()"));
    }

    receive() external payable {
        revert("RejectingReceiver: no");
    }
}
