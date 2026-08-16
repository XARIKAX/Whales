// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWhales} from "./interfaces/IWhales.sol";
import {ITrench} from "./interfaces/ITrench.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Whales
/// @notice 1000 pixel whales. A whale does not earn until it is fed: activating
///         burns 1,000,000 $WHALE and puts the whale on the payroll. Selling it
///         takes it off, in the same transaction as the transfer.
///
/// @dev Activation state lives here, on the NFT itself, so the Trench never
///      needs a list of who is eligible -- it reads the whale.
contract Whales is ERC721, IWhales {
    using Strings for uint256;
    using SafeERC20 for IERC20;
    // --- Fixed parameters -------------------------------------------------

    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant MAX_PER_MINT = 10;

    /// @notice 1,000,000 $WHALE -- 0.1% of supply -- burned per activation.
    uint256 public constant ACTIVATION_BURN = 1_000_000e18;

    /// @notice Where the burn goes.
    ///
    /// @dev $WHALE is launched on Flap, so this contract cannot assume anything
    ///      about it beyond ERC20. `burnFrom` is an OpenZeppelin extension, not
    ///      part of the standard -- calling it on a token that does not
    ///      implement it would revert, and `activate` would be permanently
    ///      broken on a contract with no owner and no upgrade path. A transfer
    ///      to an address nobody holds the key to works against every ERC20 and
    ///      puts the tokens equally far beyond reach.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @notice Every activated whale starts here: 1.00x.
    uint256 public constant BASE_WEIGHT = 10_000;

    /// @notice And climbs no further than 3.33x.
    uint256 public constant MAX_WEIGHT = 33_300;

    // --- Wiring -----------------------------------------------------------

    uint256 public immutable mintPrice;

    /// @notice The $WHALE launched on Flap, burned to activate a whale.
    ///
    /// @dev Not a constructor argument, because the NFTs deploy before the
    ///      token exists: Flap mints it at launch, and its address is unknown
    ///      until then. Wired exactly once afterwards, and never changeable.
    ///      Minting works without it; activation does not.
    IERC20 public whaleToken;

    /// @notice The Trench. Wired exactly once, because it and this contract
    ///         reference each other and one has to be deployed first.
    ITrench public trench;

    /// @notice May perform the two wiring calls above, each once, and nothing
    ///         else. Zeroed automatically the moment both are done, so the role
    ///         cannot outlive the job it exists for.
    address public deployer;

    // --- State ------------------------------------------------------------

    uint256 public totalMinted;
    uint256 public totalActivated;
    uint256 public totalBurnedForActivation;

    /// @inheritdoc IWhales
    mapping(uint256 => uint64) public activatedAt;

    /// @notice Number of times a whale has been fed, across all its owners.
    mapping(uint256 => uint32) public activationCount;

    /// @notice Commitment to the finished collection, fixed at deployment.
    ///
    /// @dev The art is generated off chain and every token's traits are already
    ///      decided before launch, so there is nothing to roll here. What this
    ///      contract owes holders instead is proof that the images were not
    ///      changed afterwards: `provenance` is the hash of the concatenated
    ///      metadata files, computed before deploy and immutable after it.
    ///      Anyone can regenerate the collection and check it matches.
    bytes32 public immutable provenance;

    /// @notice Where the metadata lives. Settable until frozen, then never again.
    string private _baseTokenURI;
    bool public metadataFrozen;

    /// @notice May set the base URI until the metadata is frozen. Destroyed by
    ///         `freezeMetadata`, after which no address can touch the art.
    address public curator;

    // --- Errors and events ------------------------------------------------

    error NotHolder(uint256 tokenId, address caller);
    error AlreadyActive(uint256 tokenId);
    error NotActive(uint256 tokenId);
    error SoldOut();
    error BadQuantity(uint256 quantity);
    error WrongPayment(uint256 sent, uint256 expected);
    error TrenchNotSet();
    error TrenchAlreadySet();
    error WhaleTokenNotSet();
    error WhaleTokenAlreadySet();
    error NotAContract(address target);
    error NotDeployer();
    error NotCurator();
    error MetadataIsFrozen();
    error SweepFailed();

    event Activated(uint256 indexed tokenId, address indexed holder, uint256 burned);
    event Deactivated(uint256 indexed tokenId, address indexed formerHolder);
    event WeightSynced(uint256 indexed tokenId, uint256 weight);
    event TrenchSet(address trench);
    event WhaleTokenSet(address whaleToken);
    event BaseURISet(string uri);
    event MetadataFrozen(string uri);
    event SweptToTrench(uint256 amount);

    constructor(bytes32 provenance_, uint256 mintPrice_)
        ERC721("Whales", "WHALE")
    {
        provenance = provenance_;
        mintPrice = mintPrice_;
        deployer = msg.sender;
        curator = msg.sender;
    }

    /// @notice One-shot wiring. The role dies once both are connected.
    function setTrench(ITrench trench_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (address(trench) != address(0)) revert TrenchAlreadySet();
        trench = trench_;
        emit TrenchSet(address(trench_));
        _retireWhenWired();
    }

    /// @notice Name the token activation burns. Once, permanently.
    ///
    /// @dev Requires code at the address. Wiring an EOA or a mistyped address
    ///      would leave a collection nobody can ever activate, and there is no
    ///      second attempt and nobody able to correct it.
    function setWhaleToken(IERC20 whaleToken_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (address(whaleToken) != address(0)) revert WhaleTokenAlreadySet();
        if (address(whaleToken_).code.length == 0) revert NotAContract(address(whaleToken_));
        whaleToken = whaleToken_;
        emit WhaleTokenSet(address(whaleToken_));
        _retireWhenWired();
    }

    /// @dev The deployer role exists only to connect the two addresses that
    ///      cannot be known at construction. With both connected there is
    ///      nothing left for it to do, so it stops existing.
    function _retireWhenWired() internal {
        if (address(trench) != address(0) && address(whaleToken) != address(0)) {
            deployer = address(0);
        }
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

    // --- Metadata control -------------------------------------------------

    /// @notice Point the collection at its metadata. Callable until frozen.
    function setBaseURI(string calldata uri) external {
        if (msg.sender != curator) revert NotCurator();
        if (metadataFrozen) revert MetadataIsFrozen();
        _baseTokenURI = uri;
        emit BaseURISet(uri);
    }

    /// @notice Freeze the art permanently and destroy the curator role.
    ///
    /// @dev One way. After this there is no address anywhere in the system that
    ///      can change what a whale looks like, which is the claim the site
    ///      makes and this is what backs it.
    function freezeMetadata() external {
        if (msg.sender != curator) revert NotCurator();
        metadataFrozen = true;
        curator = address(0);
        emit MetadataFrozen(_baseTokenURI);
    }

    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    // --- Activation -------------------------------------------------------

    /// @notice Feed a whale. Burns 1,000,000 $WHALE from the caller and starts
    ///         the whale's loyalty clock at 1.00x.
    /// @dev Requires an ERC20 allowance of `ACTIVATION_BURN` to this contract.
    function activate(uint256 tokenId) public {
        if (address(trench) == address(0)) revert TrenchNotSet();
        if (address(whaleToken) == address(0)) revert WhaleTokenNotSet();
        if (ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId, msg.sender);
        if (activatedAt[tokenId] != 0) revert AlreadyActive(tokenId);

        activatedAt[tokenId] = uint64(block.timestamp);
        activationCount[tokenId] += 1;
        totalActivated += 1;

        // Measured rather than assumed. A launchpad token may tax transfers, in
        // which case less than ACTIVATION_BURN reaches the burn address, and the
        // counter holders read should say what actually left circulation.
        uint256 before = whaleToken.balanceOf(BURN_ADDRESS);
        whaleToken.safeTransferFrom(msg.sender, BURN_ADDRESS, ACTIVATION_BURN);
        uint256 burned = whaleToken.balanceOf(BURN_ADDRESS) - before;

        totalBurnedForActivation += burned;
        trench.onWeightChange(tokenId, BASE_WEIGHT);

        emit Activated(tokenId, msg.sender, burned);
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

    /// @dev Token ids are zero-padded to four digits to match the generated
    ///      files: 0001.json, not 1.json.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, _padded(tokenId), ".json");
    }

    function _padded(uint256 tokenId) internal pure returns (string memory) {
        if (tokenId < 10) return string.concat("000", tokenId.toString());
        if (tokenId < 100) return string.concat("00", tokenId.toString());
        if (tokenId < 1000) return string.concat("0", tokenId.toString());
        return tokenId.toString();
    }

    receive() external payable {}
}
