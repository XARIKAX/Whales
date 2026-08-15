// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IWhales} from "./interfaces/IWhales.sol";

/// @title WhaleAccount
/// @notice Every whale owns a wallet. Hauls are delivered into it, and only the
///         current holder of the NFT can move what is inside.
///
/// @dev Deployed as a minimal clone with `(whales, tokenId)` appended to the
///      runtime code, so the account's identity is part of its bytecode and can
///      never be reassigned. Ownership follows the NFT automatically: sell the
///      whale and the wallet -- and everything in it -- goes with it.
contract WhaleAccount is IERC721Receiver, IERC1155Receiver {
    error NotWhaleHolder(address caller);
    error CallFailed(bytes returndata);

    event Executed(address indexed to, uint256 value, bytes data);
    event Received(address indexed from, uint256 value);

    /// @notice Incremented on every successful execution (ERC-6551 semantics).
    uint256 public state;

    /// @notice The NFT collection and token id this account is bound to.
    function token() public view returns (IWhales whales, uint256 tokenId) {
        bytes memory args = Clones.fetchCloneArgs(address(this));
        return abi.decode(args, (IWhales, uint256));
    }

    /// @notice The address that currently controls this account: whoever holds
    ///         the whale.
    function owner() public view returns (address) {
        (IWhales whales, uint256 tokenId) = token();
        return whales.ownerOf(tokenId);
    }

    /// @notice Execute an arbitrary call from the whale's wallet.
    function execute(address to, uint256 value, bytes calldata data)
        external
        payable
        returns (bytes memory result)
    {
        if (msg.sender != owner()) revert NotWhaleHolder(msg.sender);
        state++;

        bool ok;
        (ok, result) = to.call{value: value}(data);
        if (!ok) revert CallFailed(result);

        emit Executed(to, value, data);
    }

    /// @notice ERC-1271: a signature from the whale's holder is a valid
    ///         signature for the whale, so the wallet can sign into apps.
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        if (SignatureChecker.isValidSignatureNow(owner(), hash, signature)) {
            return IERC1271.isValidSignature.selector;
        }
        return bytes4(0);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC1271).interfaceId
            || interfaceId == type(IERC721Receiver).interfaceId
            || interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
