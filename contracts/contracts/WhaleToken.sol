// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title $WHALE
/// @notice The whole supply is minted once, at deployment, to the launch
///         address. There is no mint function, no owner and no pause. The only
///         way the supply moves is down: activating a whale burns 1,000,000.
///
/// @dev The 2% buy / 3% sell tax lives in the Flap launch contract, not here.
///      Flap collects it in ETH and forwards it to the Trench. Keeping the tax
///      out of the token means transfers are plain ERC20 transfers -- no
///      hooks, no blocklist, no way for anyone to change the rules later.
contract WhaleToken is ERC20, ERC20Burnable, ERC20Permit {
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18;

    constructor(address launchRecipient) ERC20("Whales", "WHALE") ERC20Permit("Whales") {
        _mint(launchRecipient, MAX_SUPPLY);
    }
}
