// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev A single MCOPY, and nothing else.
///
/// The contracts are compiled for Cancun, so solc emits MCOPY (EIP-5656) for
/// memory copies right through them — not only in the ERC-1271 path. On a chain
/// that does not implement it, deployment still succeeds, because an invalid
/// opcode only fails when it is reached; the system would then revert somewhere
/// in mint, activate or deliver, on contracts nobody can fix.
///
/// So this asks the target chain directly, for the price of one small
/// deployment, before anything permanent is on it.
contract CancunProbe {
    function probe() external pure returns (uint256 out) {
        assembly {
            mstore(0x80, 0xda1e)
            mcopy(0xa0, 0x80, 32)
            out := mload(0xa0)
        }
    }
}
