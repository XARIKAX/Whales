// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IWhalesMint {
    function mint(uint256 quantity) external payable;
    function activate(uint256 tokenId) external;
    function totalMinted() external view returns (uint256);
}

/// @dev Reenters `mint` from inside `onERC721Received`, which `_safeMint`
///      invokes before the minting loop has finished. The question is whether
///      supply accounting can be tricked into overshooting MAX_SUPPLY.
contract ReentrantMinter is IERC721Receiver {
    IWhalesMint public immutable whales;
    uint256 public immutable price;
    uint256 public depth;
    uint256 public maxDepth;

    constructor(IWhalesMint whales_, uint256 price_) {
        whales = whales_;
        price = price_;
    }

    receive() external payable {}

    function attack(uint256 quantity, uint256 maxDepth_) external payable {
        maxDepth = maxDepth_;
        whales.mint{value: price * quantity}(quantity);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        returns (bytes4)
    {
        if (depth < maxDepth && address(this).balance >= price) {
            depth++;
            // Deliberately swallow the revert: the attack succeeding or failing
            // is measured by supply afterwards, not by this call's outcome.
            try whales.mint{value: price}(1) {} catch {}
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @dev A token that takes a cut of every transfer. $WHALE comes from a
///      launchpad, so `Whales` cannot assume a transfer delivers what it was
///      asked to send — this is the token that proves the measured burn is
///      measured rather than assumed.
contract TaxedToken is ERC20 {
    uint256 public immutable feeBps;
    address public constant FEE_SINK = address(0xFEE);

    constructor(uint256 feeBps_) ERC20("Taxed Whale", "TWHALE") {
        feeBps = feeBps_;
        _mint(msg.sender, 1_000_000_000e18);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || feeBps == 0) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, FEE_SINK, fee);
        super._update(from, to, value - fee);
    }
}

/// @dev A token that calls back into `Whales` mid-transfer, the way an ERC777
///      style hook would. Activation performs an external token call, so the
///      question is whether a token can re-enter it profitably.
contract ReentrantToken is ERC20 {
    IWhalesMint public whales;
    uint256 public reenterTokenId;
    bool public armed;
    bool public reentered;
    bytes public lastRevert;

    constructor() ERC20("Reentrant Whale", "RWHALE") {
        _mint(msg.sender, 1_000_000_000e18);
    }

    function arm(IWhalesMint whales_, uint256 tokenId) external {
        whales = whales_;
        reenterTokenId = tokenId;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);

        if (armed && from != address(0)) {
            armed = false;
            reentered = true;
            try whales.activate(reenterTokenId) {} catch (bytes memory reason) {
                lastRevert = reason;
            }
        }
    }
}

/// @dev A whale wallet that refuses ETH would wedge a delivery batch. The real
///      accounts cannot behave this way, and this exists to prove the delivery
///      path's failure mode is a revert rather than silent loss.
contract GreedyReceiver {
    receive() external payable {
        revert("no");
    }
}

/// @dev A token whose supply is whatever the caller says. Used to prove the
///      wiring script refuses a supply too small to activate the collection.
contract FixedSupplyToken is ERC20 {
    constructor(uint256 supply) ERC20("Small Whale", "SWHALE") {
        _mint(msg.sender, supply);
    }
}
