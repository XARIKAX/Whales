// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITrench} from "./interfaces/ITrench.sol";
import {IWhales} from "./interfaces/IWhales.sol";
import {IWhaleAccountRegistry} from "./interfaces/IWhaleAccountRegistry.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

/// @title The Trench
/// @notice Every fee in the ocean ends up here. The Flap launch tax arrives as
///         ETH, mint proceeds arrive as ETH, and anyone can throw ETH in at any
///         time. Nothing can be taken out.
///
/// @dev Read the contract for the guarantee: there is no withdraw function, no
///      owner, no upgrade path, and no address with a special role. The only
///      way ETH leaves is `haul` -- which splits the pot across activated
///      whales by weight and pays the caller a 0.5% tip -- followed by
///      `deliver`, which pushes a whale's settled share into its own wallet.
///      Both are callable by anybody.
///
///      Payouts use a cumulative accumulator, so one `haul` transaction splits
///      the entire pot across every activated whale at once regardless of how
///      many there are. `deliver` is the separate, batchable step that moves
///      the ETH; a whale's share is safe in the contract until then.
contract Trench is ITrench, ReentrancyGuard {
    /// @dev Fixed-point scale for the per-weight accumulator.
    uint256 private constant ACC_PRECISION = 1e27;

    uint256 public constant TIP_BPS = 50; // 0.5% to whoever presses the button
    uint256 public constant BPS = 10_000;

    // --- Immutable wiring -------------------------------------------------

    IWhales public immutable whales;
    IWhaleAccountRegistry public immutable registry;

    /// @notice Minimum pot before the net can be hauled.
    uint256 public immutable haulThreshold;

    /// @notice Optional AMM used for stock election. Zero disables it and every
    ///         whale is paid in ETH.
    ISwapRouter public immutable router;
    address public immutable weth;

    // --- Distribution accounting ------------------------------------------

    /// @notice Cumulative ETH per unit of weight, scaled by 1e27.
    uint256 public accPerWeight;

    /// @inheritdoc ITrench
    uint256 public totalWeight;

    /// @inheritdoc ITrench
    mapping(uint256 => uint256) public weightOf;

    /// @dev Accumulator value at each whale's last settlement.
    mapping(uint256 => uint256) public accCheckpoint;

    /// @notice Settled but not yet delivered, per whale.
    mapping(uint256 => uint256) public accrued;

    /// @notice Total ETH ever delivered into a whale's wallet.
    mapping(uint256 => uint256) public lifetimeEarned;

    /// @notice ETH credited to whales and not yet delivered. Never part of the
    ///         pot -- it already belongs to a whale.
    uint256 public reserved;

    /// @notice The stock each whale is paid in, or zero for ETH.
    mapping(uint256 => address) public stockElection;

    // --- Lifetime stats ---------------------------------------------------

    uint256 public totalReceived;
    uint256 public totalDistributed;
    uint256 public totalTipped;
    uint256 public totalDelivered;
    uint256 public haulCount;
    uint256 public lastHaulAt;

    // --- Errors and events ------------------------------------------------

    error OnlyWhales();
    error BelowThreshold(uint256 pot, uint256 threshold);
    error NoActiveWhales();
    error NotHolder(uint256 tokenId, address caller);
    error DeliveryFailed(uint256 tokenId, address account);
    error TipFailed();

    event Received(address indexed from, uint256 amount);
    event Hauled(address indexed keeper, uint256 pot, uint256 distributed, uint256 tip, uint256 totalWeight);
    event Delivered(uint256 indexed tokenId, address indexed account, uint256 amount, address asset);
    event StockElected(uint256 indexed tokenId, address indexed stock);
    event WeightChanged(uint256 indexed tokenId, uint256 oldWeight, uint256 newWeight, uint256 totalWeight);

    constructor(
        IWhales whales_,
        IWhaleAccountRegistry registry_,
        uint256 haulThreshold_,
        ISwapRouter router_,
        address weth_
    ) {
        whales = whales_;
        registry = registry_;
        haulThreshold = haulThreshold_;
        router = router_;
        weth = weth_;
    }

    // --- Taking money in --------------------------------------------------

    /// @notice The Flap tax lands here. So does anything else anyone sends.
    receive() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    /// @notice Same as sending ETH directly, for callers that want an ABI.
    function feed() external payable {
        totalReceived += msg.value;
        emit Received(msg.sender, msg.value);
    }

    /// @notice ETH in the contract that has not been credited to a whale yet.
    function pot() public view returns (uint256) {
        return address(this).balance - reserved;
    }

    function readyToHaul() external view returns (bool) {
        return pot() >= haulThreshold && totalWeight != 0;
    }

    // --- Paying it out ----------------------------------------------------

    /// @notice Split the whole pot across every activated whale, by weight.
    ///         Anyone can call this; the caller keeps 0.5%.
    /// @dev A keeper bot normally presses the button. It has no special powers:
    ///      if it stops, any wallet earns the tip by doing its job.
    function haul() external nonReentrant returns (uint256 distributed, uint256 tip) {
        uint256 amount = pot();
        if (amount < haulThreshold) revert BelowThreshold(amount, haulThreshold);

        uint256 weight = totalWeight;
        if (weight == 0) revert NoActiveWhales();

        tip = (amount * TIP_BPS) / BPS;
        uint256 net = amount - tip;

        // Credit only what divides evenly across the weight; the remainder
        // stays in the pot and rolls into the next haul.
        uint256 perWeight = (net * ACC_PRECISION) / weight;
        distributed = (perWeight * weight) / ACC_PRECISION;

        accPerWeight += perWeight;
        reserved += distributed;

        totalDistributed += distributed;
        totalTipped += tip;
        haulCount += 1;
        lastHaulAt = block.timestamp;

        emit Hauled(msg.sender, amount, distributed, tip, weight);

        if (tip != 0) {
            (bool ok,) = msg.sender.call{value: tip}("");
            if (!ok) revert TipFailed();
        }
    }

    /// @notice A whale's share that has been hauled but not yet settled.
    function pending(uint256 tokenId) public view returns (uint256) {
        return (weightOf[tokenId] * (accPerWeight - accCheckpoint[tokenId])) / ACC_PRECISION;
    }

    /// @notice Everything a whale is owed: settled plus pending.
    function claimable(uint256 tokenId) public view returns (uint256) {
        return accrued[tokenId] + pending(tokenId);
    }

    /// @inheritdoc ITrench
    function onWeightChange(uint256 tokenId, uint256 newWeight) external {
        if (msg.sender != address(whales)) revert OnlyWhales();

        uint256 oldWeight = weightOf[tokenId];
        _settle(tokenId, oldWeight);

        weightOf[tokenId] = newWeight;
        totalWeight = totalWeight - oldWeight + newWeight;

        emit WeightChanged(tokenId, oldWeight, newWeight, totalWeight);
    }

    /// @dev Bank everything earned at the whale's current weight, so a weight
    ///      change never applies backwards.
    function _settle(uint256 tokenId, uint256 weight) internal {
        uint256 acc = accPerWeight;
        uint256 checkpoint = accCheckpoint[tokenId];
        if (checkpoint == acc) return;

        if (weight != 0) {
            accrued[tokenId] += (weight * (acc - checkpoint)) / ACC_PRECISION;
        }
        accCheckpoint[tokenId] = acc;
    }

    /// @notice Push a whale's share into the whale's own wallet.
    /// @dev Permissionless -- no claim form, and the holder does not have to be
    ///      the one to call it. Delivers the elected stock when one is set and
    ///      the swap succeeds, otherwise ETH.
    function deliver(uint256 tokenId) public nonReentrant returns (uint256 amount) {
        return _deliver(tokenId);
    }

    function deliverMany(uint256[] calldata tokenIds) external nonReentrant returns (uint256 total) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            total += _deliver(tokenIds[i]);
        }
    }

    function _deliver(uint256 tokenId) internal returns (uint256 amount) {
        _settle(tokenId, weightOf[tokenId]);

        amount = accrued[tokenId];
        if (amount == 0) return 0;

        accrued[tokenId] = 0;
        reserved -= amount;
        lifetimeEarned[tokenId] += amount;
        totalDelivered += amount;

        address account = registry.createAccount(tokenId);
        address stock = stockElection[tokenId];

        if (stock != address(0) && address(router) != address(0)) {
            address[] memory path = new address[](2);
            path[0] = weth;
            path[1] = stock;

            try router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: amount}(
                0, path, account, block.timestamp
            ) {
                emit Delivered(tokenId, account, amount, stock);
                return amount;
            } catch {
                // Thin book, bad token, dead router -- the whale still gets paid.
            }
        }

        (bool ok,) = account.call{value: amount}("");
        if (!ok) revert DeliveryFailed(tokenId, account);
        emit Delivered(tokenId, account, amount, address(0));
    }

    /// @notice Choose the asset this whale is paid in. Zero means ETH.
    /// @dev The holder names the token themselves -- there is no allowlist and
    ///      nobody curates it. A token that cannot be bought just falls back to
    ///      ETH at delivery.
    function electStock(uint256 tokenId, address stock) external {
        if (whales.ownerOf(tokenId) != msg.sender) revert NotHolder(tokenId, msg.sender);
        stockElection[tokenId] = stock;
        emit StockElected(tokenId, stock);
    }

    // --- Views for the dashboard and the keeper ---------------------------

    struct WhaleState {
        uint256 tokenId;
        address holder;
        address account;
        uint64 activatedAt;
        uint256 weight;
        uint256 claimable;
        uint256 lifetimeEarned;
        address stock;
    }

    function whaleState(uint256 tokenId) public view returns (WhaleState memory) {
        return WhaleState({
            tokenId: tokenId,
            holder: whales.ownerOf(tokenId),
            account: registry.accountOf(tokenId),
            activatedAt: whales.activatedAt(tokenId),
            weight: weightOf[tokenId],
            claimable: claimable(tokenId),
            lifetimeEarned: lifetimeEarned[tokenId],
            stock: stockElection[tokenId]
        });
    }

    function whaleStates(uint256[] calldata tokenIds) external view returns (WhaleState[] memory out) {
        out = new WhaleState[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            out[i] = whaleState(tokenIds[i]);
        }
    }

    /// @notice Whales holding an undelivered balance, for the keeper to batch.
    function deliverable() external view returns (uint256[] memory ids) {
        uint256 minted = whales.totalMinted();
        uint256[] memory buf = new uint256[](minted);
        uint256 n;
        for (uint256 id = 1; id <= minted; id++) {
            if (claimable(id) != 0) buf[n++] = id;
        }
        ids = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = buf[i];
        }
    }

    struct OceanState {
        uint256 pot;
        uint256 haulThreshold;
        bool readyToHaul;
        uint256 totalWeight;
        uint256 activeWhales;
        uint256 totalReceived;
        uint256 totalDistributed;
        uint256 totalDelivered;
        uint256 totalTipped;
        uint256 haulCount;
        uint256 lastHaulAt;
        uint256 reserved;
    }

    /// @notice One call for the whole dashboard header.
    function ocean() external view returns (OceanState memory) {
        uint256 p = pot();
        return OceanState({
            pot: p,
            haulThreshold: haulThreshold,
            readyToHaul: p >= haulThreshold && totalWeight != 0,
            totalWeight: totalWeight,
            activeWhales: whales.totalActivated(),
            totalReceived: totalReceived,
            totalDistributed: totalDistributed,
            totalDelivered: totalDelivered,
            totalTipped: totalTipped,
            haulCount: haulCount,
            lastHaulAt: lastHaulAt,
            reserved: reserved
        });
    }
}
