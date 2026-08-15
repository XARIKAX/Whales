// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IWhaleAccountRegistry} from "./interfaces/IWhaleAccountRegistry.sol";
import {WhaleAccount} from "./WhaleAccount.sol";

/// @title WhaleAccountRegistry
/// @notice Mints one wallet per whale, at an address fixed forever by the token
///         id. Nothing here is permissioned: the address is a pure function of
///         the token id, so anyone can deploy any whale's wallet and nobody can
///         deploy a different one.
contract WhaleAccountRegistry is IWhaleAccountRegistry {
    /// @notice The implementation every whale wallet delegates to.
    address public immutable implementation;

    /// @notice The whale collection these accounts are bound to.
    address public immutable whales;

    event AccountCreated(uint256 indexed tokenId, address account);

    constructor(address whales_) {
        whales = whales_;
        implementation = address(new WhaleAccount());
    }

    /// @inheritdoc IWhaleAccountRegistry
    function accountOf(uint256 tokenId) public view returns (address) {
        return Clones.predictDeterministicAddressWithImmutableArgs(
            implementation, _args(tokenId), _salt(tokenId), address(this)
        );
    }

    /// @inheritdoc IWhaleAccountRegistry
    function createAccount(uint256 tokenId) external returns (address account) {
        account = accountOf(tokenId);
        if (account.code.length != 0) return account;

        account = Clones.cloneDeterministicWithImmutableArgs(implementation, _args(tokenId), _salt(tokenId));
        emit AccountCreated(tokenId, account);
    }

    /// @notice Whether a whale's wallet has been deployed yet. ETH sent to an
    ///         undeployed account is not lost -- the address is fixed, so it is
    ///         waiting there when the account is created.
    function isDeployed(uint256 tokenId) external view returns (bool) {
        return accountOf(tokenId).code.length != 0;
    }

    function _args(uint256 tokenId) internal view returns (bytes memory) {
        return abi.encode(whales, tokenId);
    }

    function _salt(uint256 tokenId) internal pure returns (bytes32) {
        return bytes32(tokenId);
    }
}
