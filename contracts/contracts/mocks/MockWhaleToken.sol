// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockWhaleToken — a stand-in for the Flap-launched $WHALE
/// @notice TEST DOUBLE ONLY. The real $WHALE is launched on Flap and is not
///         deployed from this repository -- `Whales` takes its address as a
///         constructor argument. This stands in for it so the suite has a
///         token to burn against, and `deploy.js` never touches it.
contract MockWhaleToken is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;

    constructor(address launchRecipient) ERC20("Whales", "WHALE") ERC20Permit("Whales") {
        _mint(launchRecipient, MAX_SUPPLY);
    }
}
