// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IWhales} from "./interfaces/IWhales.sol";
import {ITrench} from "./interfaces/ITrench.sol";
import {IWhaleRenderer} from "./WhaleRenderer.sol";

/// @title Whales
/// @notice 1000 pixel whales. A whale does not earn until it is fed: activating
///         burns 1,000,000 $WHALE and puts the whale on the payroll. Selling it
///         takes it off, in the same transaction as the transfer.
///
/// @dev Activation state lives here, on the NFT itself, so the Trench never
///      needs a list of who is eligible -- it reads the whale.
contract Whales is ERC721, IWhales {
    // --- Fixed parameters -------------------------------------------------

    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant MAX_PER_MINT = 10;

    /// @notice 1,000,000 $WHALE -- 0.1% of supply -- burned per activation.
    uint256 public constant ACTIVATION_BURN = 1_000_000e18;

    /// @notice Every activated whale starts here: 1.00x.
    uint256 public constant BASE_WEIGHT = 10_000;

    /// @notice And climbs no further than 3.33x.
    uint256 public constant MAX_WEIGHT = 33_300;

    // --- Wiring -----------------------------------------------------------

    ERC20Burnable public immutable whaleToken;
    IWhaleRenderer public immutable renderer;
    uint256 public immutable mintPrice;

    /// @notice The Trench. Set exactly once, right after deployment, because
    ///         the two contracts reference each other. `deployer` is zeroed in
    ///         the same call -- this is the only privileged action that ever
    ///         exists in the system, and it can only happen once.
    ITrench public trench;
    address public deployer;

    // --- State ------------------------------------------------------------

    uint256 public totalMinted;
    uint256 public totalActivated;
    uint256 public totalBurnedForActivation;

    /// @inheritdoc IWhales
    mapping(uint256 => uint64) public activatedAt;

    /// @notice Number of times a whale has been fed, across all its owners.
    mapping(uint256 => uint32) public activationCount;

    /// @notice Rarity seed, drawn from a future block once the collection has
    ///         minted out. Zero until revealed.
    uint256 public seed;
    uint256 public seedBlock;

    // --- Errors and events ------------------------------------------------

    error NotHolder(uint256 tokenId, address caller);
    error AlreadyActive(uint256 tokenId);
    error NotActive(uint256 tokenId);
    error SoldOut();
    error BadQuantity(uint256 quantity);
    error WrongPayment(uint256 sent, uint256 expected);
    error TrenchNotSet();
    error TrenchAlreadySet();
    error NotDeployer();
    error MintNotFinished();
    error SeedAlreadyDrawn();
    error SeedNotCommitted();
    error SeedNotReady();
    error SeedExpired();
    error NotRevealed();
    error SweepFailed();

    event Activated(uint256 indexed tokenId, address indexed holder, uint256 burned);
    event Deactivated(uint256 indexed tokenId, address indexed formerHolder);
    event WeightSynced(uint256 indexed tokenId, uint256 weight);
    event TrenchSet(address trench);
    event SeedCommitted(uint256 block_);
    event SeedRevealed(uint256 seed);
    event SweptToTrench(uint256 amount);

    constructor(ERC20Burnable whaleToken_, IWhaleRenderer renderer_, uint256 mintPrice_)
        ERC721("Whales", "WHALE")
    {
        whaleToken = whaleToken_;
        renderer = renderer_;
        mintPrice = mintPrice_;
        deployer = msg.sender;
    }

    /// @notice One-shot wiring, then the deployer role is destroyed.
    function setTrench(ITrench trench_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (address(trench) != address(0)) revert TrenchAlreadySet();
        trench = trench_;
        deployer = address(0);
        emit TrenchSet(address(trench_));
    }

    // --- Minting ----------------------------------------------------------

    function mint(uint256 quantity) external payable {
        if (quantity == 0 || quantity > MAX_PER_MINT) revert BadQuantity(quantity);
        uint256 minted = totalMinted;
        if (minted + quantity > MAX_SUPPLY) revert SoldOut();

        uint256 cost = mintPrice * quantity;
        if (msg.value != cost) revert WrongPayment(msg.value, cost);

        totalMinted = minted + quantity;
        for (uint256 i = 1; i <= quantity; i++) {
            _safeMint(msg.sender, minted + i);
        }
    }

    /// @notice Push mint proceeds into the Trench, where they become the first
    ///         haul. Permissionless, and the only exit from this contract.
    function sweepToTrench() external returns (uint256 amount) {
        if (address(trench) == address(0)) revert TrenchNotSet();
        amount = address(this).balance;
        if (amount == 0) return 0;

        (bool ok,) = address(trench).call{value: amount}("");
        if (!ok) revert SweepFailed();
        emit SweptToTrench(amount);
    }

    // --- Rarity reveal ----------------------------------------------------

    /// @notice After mint-out, lock in a future block. Nobody -- including the
    ///         caller -- knows its hash yet.
    function commitSeed() external {
        if (totalMinted < MAX_SUPPLY) revert MintNotFinished();
        if (seed != 0) revert SeedAlreadyDrawn();
        seedBlock = block.number + 1;
        emit SeedCommitted(seedBlock);
    }

    /// @notice Draw the seed from the committed block's hash. If more than 256
    ///         blocks pass the hash is gone; commit again.
    function revealSeed() external {
        if (seed != 0) revert SeedAlreadyDrawn();
        uint256 target = seedBlock;
        if (target == 0) revert SeedNotCommitted();
        if (block.number <= target) revert SeedNotReady();

        bytes32 hash = blockhash(target);
        if (hash == bytes32(0)) revert SeedExpired();

        seed = uint256(keccak256(abi.encode(hash, address(this))));
        emit SeedRevealed(seed);
    }

    function revealed() public view returns (bool) {
        return seed != 0;
    }

    /// @notice Rarity tier: 0 surface swimmer, 1 reef cruiser, 2 twilight
    ///         diver, 3 abyss dweller, 4 leviathan.
    /// @dev Rarer whales do not earn more. Weight comes from loyalty alone.
    function tierOf(uint256 tokenId) public view returns (uint8) {
        _requireOwned(tokenId);
        if (seed == 0) revert NotRevealed();
        return renderer.tierOf(tokenId, seed);
    }

    // --- Activation -------------------------------------------------------

    /// @notice Feed a whale. Burns 1,000,000 $WHALE from the caller and starts
    ///         the whale's loyalty clock at 1.00x.
    /// @dev Requires an ERC20 allowance of `ACTIVATION_BURN` to this contract.
    function activate(uint256 tokenId) public {
        if (address(trench) == address(0)) revert TrenchNotSet();
        if (ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId, msg.sender);
        if (activatedAt[tokenId] != 0) revert AlreadyActive(tokenId);

        activatedAt[tokenId] = uint64(block.timestamp);
        activationCount[tokenId] += 1;
        totalActivated += 1;
        totalBurnedForActivation += ACTIVATION_BURN;

        whaleToken.burnFrom(msg.sender, ACTIVATION_BURN);
        trench.onWeightChange(tokenId, BASE_WEIGHT);

        emit Activated(tokenId, msg.sender, ACTIVATION_BURN);
    }

    function activateMany(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            activate(tokenIds[i]);
        }
    }

    /// @notice The loyalty curve. An activated whale starts at 1.00x and climbs
    ///         toward the 3.33x cap the longer it stays fed under one owner.
    function weightForAge(uint256 age) public pure returns (uint256) {
        if (age >= 365 days) return 33_300; // 3.33x
        if (age >= 180 days) return 29_000; // 2.90x
        if (age >= 90 days) return 25_000; //  2.50x
        if (age >= 60 days) return 21_500; //  2.15x
        if (age >= 30 days) return 18_000; //  1.80x
        if (age >= 14 days) return 15_000; //  1.50x
        if (age >= 7 days) return 12_500; //   1.25x
        return 10_000; //                      1.00x
    }

    /// @inheritdoc IWhales
    function weightOf(uint256 tokenId) public view returns (uint256) {
        uint64 since = activatedAt[tokenId];
        if (since == 0) return 0;
        return weightForAge(block.timestamp - since);
    }

    /// @notice The timestamp at which this whale's weight next steps up, or 0
    ///         if it is dormant or already at the cap.
    function nextTierAt(uint256 tokenId) external view returns (uint256) {
        uint64 since = activatedAt[tokenId];
        if (since == 0) return 0;

        uint256 age = block.timestamp - since;
        uint256[7] memory steps = [uint256(7 days), 14 days, 30 days, 60 days, 90 days, 180 days, 365 days];
        for (uint256 i = 0; i < steps.length; i++) {
            if (age < steps[i]) return since + steps[i];
        }
        return 0;
    }

    /// @notice Promote a whale to the tier it has already earned. Anyone can
    ///         call it for anyone -- it can only ever raise a whale's weight.
    /// @dev The Trench pays on the weight it has been told about. A whale whose
    ///      tier is never synced simply keeps earning at its old rate; there is
    ///      no way to use this to pay a whale more than it is owed.
    function syncWeight(uint256 tokenId) public {
        if (address(trench) == address(0)) revert TrenchNotSet();
        uint256 weight = weightOf(tokenId);
        if (weight == trench.weightOf(tokenId)) return;

        trench.onWeightChange(tokenId, weight);
        emit WeightSynced(tokenId, weight);
    }

    function syncWeights(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            syncWeight(tokenIds[i]);
        }
    }

    /// @notice Whales that are behind on their tier, for the keeper to sync.
    function staleWhales() external view returns (uint256[] memory ids) {
        uint256 minted = totalMinted;
        uint256[] memory buf = new uint256[](minted);
        uint256 n;
        for (uint256 id = 1; id <= minted; id++) {
            if (activatedAt[id] != 0 && weightOf(id) != trench.weightOf(id)) {
                buf[n++] = id;
            }
        }
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = buf[i];
        }
    }

    // --- Transfers drop a whale off the payroll ---------------------------

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);

        // Mints and burns are not hand-changes; a real transfer is.
        if (from != address(0) && from != to && activatedAt[tokenId] != 0) {
            activatedAt[tokenId] = 0;
            totalActivated -= 1;
            trench.onWeightChange(tokenId, 0);
            emit Deactivated(tokenId, from);
        }
    }

    // --- Metadata ---------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return renderer.render(
            tokenId,
            seed,
            activatedAt[tokenId],
            activatedAt[tokenId] == 0 ? 0 : weightOf(tokenId),
            activationCount[tokenId]
        );
    }

    receive() external payable {}
}
