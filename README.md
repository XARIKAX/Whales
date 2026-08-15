# WHALES — $WHALE

**1000 pixel whales. Every fee in the ocean flows to them.**

Whales don't chase liquidity. They are liquidity.

$WHALE launches on Flap with a 2% buy / 3% sell tax. Every cent flows to activated whale NFTs — paid in ETH on Robinhood Chain, tracked live in dollars. No claim forms, no admin, no trust.

Hold a whale. Feed it. Own the tide.

---

## The loop

```
trades taxed  →  tax lands in the Trench  →  anyone hauls
                                                  ↓
     ETH (or stock) arrives  ←  split by weight across fed whales
     in the whale's own wallet
```

## What is in this repository

| Path | What it is |
| --- | --- |
| `contracts/` | The five contracts, their tests, and the deploy scripts |
| `keeper/` | The bot that presses the buttons anyone can press |
| `web/` | The dashboard: live pot, haul countdown, per-whale earnings |

---

## The contracts

Five contracts. No owner, no upgrade path, no pause, no admin key.

### `WhaleToken` — $WHALE

1,000,000,000 minted once, at deployment, to the launch address. There is no mint function and no owner. The supply only ever goes down.

The 2%/3% tax lives in the Flap launch contract, **not** in the token. Flap collects it in ETH and forwards it to the Trench. Keeping the tax out of the token means transfers are plain ERC20 transfers — no hooks, no blocklist, and no way for anyone to change the rules later.

### `Whales` — the NFTs

1000 pixel whales, fixed supply, never more. Rarity tiers run surface swimmer → reef cruiser → twilight diver → abyss dweller → the leviathan. **Rarer whales don't earn more — they just flex harder.** Weight comes from loyalty alone.

Rarity is drawn from a block hash committed only *after* the collection mints out, so no minter can pick the leviathan out of the lineup — at buy time nobody knows which token it is. A live commitment cannot be replaced either, so nobody can peek at the hash, dislike it, and reroll. (The proposer of the committed block retains the usual one-shot blockhash influence: they could drop their block to force a redraw. Rarity is cosmetic — rarer whales earn exactly the same — so the stakes on that are low, but it is inherent to on-chain randomness and worth knowing.)

**Burn to activate.** A whale doesn't earn until it's fed:

- Activating burns **1,000,000 $WHALE** (0.1% of the 1B supply) and starts the whale at 1.00x.
- No burn, no yield. Dormant whales carry zero weight — automatically, not by anyone's decision.
- Sell your whale and the ERC-721 transfer hook takes it off the payroll **in the same transaction**. The new owner activates again. Every hand change burns another million.

Two markets emerge: dormant whales (cheap, silent) and fed whales (earning, premium).

### `Trench` — where every fee lands

All fees flow to one contract. It accepts ETH from anyone, any time, no permission needed.

**Nobody can withdraw. Not holders. Not us. The contract has no withdraw function.** What enters the Trench leaves one way: the Haul.

```solidity
// The complete list of functions that move ETH out of the Trench:
function haul()    external returns (uint256 distributed, uint256 tip);
function deliver(uint256 tokenId)         external returns (uint256);
function deliverMany(uint256[] calldata)  external returns (uint256);
```

All three are callable by anybody. There is no `withdraw`, no `rescue`, no `owner`, no `upgradeTo` — and a test asserts the ABI does not contain them.

### `WhaleAccount` + `WhaleAccountRegistry` — a wallet per whale

Every whale owns its own on-chain wallet, ERC-6551 style. Earnings land in the whale, not just your address. The account's identity is baked into its bytecode, so it can never be reassigned, and ownership follows the NFT automatically — sell the whale and the wallet goes with it, contents and all.

The address is a pure function of the token id, so it is known before the account is even deployed. ETH sent there early is not lost; it is waiting when the account is created.

### `WhaleRenderer` — the art

Every pixel is generated on chain from the reveal seed. No server, no IPFS pin, no metadata anyone can swap out later. The whale is a 24×16 grid packed into two words per layer; the palette comes from the rarity tier and the accents from the token's own hash.

Whale #787, a leviathan, as the chain actually serves it — one character per
pixel, `#` accent, `%` body, `*` fin and barnacles, `+` belly:

```
      ## #
     #  # #                ← spout
      ## #
      %%%%%%%%
    %%*%%%%%%%*%%     %%
  %%%%%%%%%%%%%%%%%   %*
 %*%%%%%%%%%%%%%%%%%  %%   ← barnacles, scattered by the token's own hash
%%#%%%%%%%%%%%%%%%%*% %%   ← eye
%%%%%%%%%%%%%%%%%%%%%%%%   ← the peduncle, the one row joining the flukes
%++++++++++++++++++++ ++
 +++++++****++++++++  ++   ← fin
  ++++++****+++++++   ++
    +++++***+++++     ++
      ++++++++
```

---

## How the haul works

When the pot hits the threshold, anyone can haul it. The whole pot splits across every activated whale **in one transaction**, and whoever pressed the button keeps 0.5%.

That is possible at 1000 whales because the split is an accumulator, not a loop: `haul` adds to a cumulative ETH-per-unit-of-weight figure, which credits every fed whale at once in O(1). `deliver` is the separate, batchable step that physically moves each whale's share into its wallet. A whale's share is safe in the contract until then.

**Split by weight.** Every activated whale starts at 1x and climbs toward a 3.33x cap by staying active. Loyalty compounds:

| Fed for | Weight |
| --- | --- |
| 0–7 days | 1.00x |
| 7 days | 1.25x |
| 14 days | 1.50x |
| 30 days | 1.80x |
| 60 days | 2.15x |
| 90 days | 2.50x |
| 180 days | 2.90x |
| 365 days | **3.33x** |

Diamond-fin whales out-earn tourists 3.33 to 1.

Tier promotion is permissionless — anyone can promote any whale to the tier it has already earned, and the call can only ever *raise* a weight. A whale nobody bothers to sync simply keeps earning at its old rate. There is no way to use it to pay a whale more than it is owed.

**Dormant whales get nothing.** The contract checks activation against the NFT itself — no lists, no admin.

**Stock election.** Each whale's share is delivered into its own wallet as ETH, or auto-swapped into the stock the holder elected. The holder names the token themselves; there is no allowlist and nobody curates it. If the swap fails for any reason — thin book, bad token, dead router — the whale is paid in ETH rather than stranded.

Because the elected token is unvetted by design, the swap is called with a hard gas ceiling. Otherwise a hostile token could burn the whole transaction's gas and take a keeper's entire delivery batch down with it. Capped, a bad election costs only its own whale a swap, and that whale still gets its ETH.

**A keeper bot presses the buttons. But it has no special powers** — whoever hauls earns the 0.5% tip. If the bot dies, any wallet does its job.

---

## Trustless by construction

The system has exactly **one** privileged action, and it destroys itself:

```solidity
function setTrench(ITrench trench_) external {
    if (msg.sender != deployer) revert NotDeployer();
    if (address(trench) != address(0)) revert TrenchAlreadySet();
    trench = trench_;
    deployer = address(0);   // the role is gone, permanently
}
```

It exists because `Whales` and `Trench` reference each other and one has to be deployed first. It can be called once, and it burns the deployer role in the same transaction. `deploy.js` refuses to report success unless `deployer` is actually zero afterwards.

After that there is no address anywhere in the system with any power that a random wallet does not also have.

---

## Running it

### Contracts

```bash
cd contracts
npm install
npx hardhat test        # 62 tests
npx hardhat compile
```

Builds compile with the `solc` package pinned in `devDependencies` rather than a binary fetched at build time, so bytecode is a function of the lockfile alone and CI runners without egress to `binaries.soliditylang.org` still work.

Preview the art without a chain:

```bash
npx hardhat run scripts/render.js   # writes contracts/art-preview/index.html
```

### Deploying

```bash
LAUNCH_RECIPIENT=0x...   \
MINT_PRICE=0.02          \
HAUL_THRESHOLD=0.1       \
npx hardhat run scripts/deploy.js --network robinhood
```

Set `ROBINHOOD_RPC_URL` and `PRIVATE_KEY` in the environment first. `SWAP_ROUTER` and `WETH` are optional — set both to enable stock election, leave them unset and every whale is paid in ETH.

Addresses are written to `contracts/deployments/<network>.json`, which the keeper and the dashboard both read.

**Then point the Flap launch tax recipient at the Trench address.** That is the entire integration.

### Locally, end to end

```bash
cd contracts
npx hardhat node                                            # terminal 1
npx hardhat run scripts/deploy.js     --network localhost   # terminal 2
npx hardhat run scripts/seed-local.js --network localhost   # mints, feeds, ages, funds

cd ../keeper && npm install
RPC_URL=http://127.0.0.1:8545 \
DEPLOYMENT=../contracts/deployments/localhost.json \
PRIVATE_KEY=0x... node keeper.js --once

cd ../web && npm install
cp .env.example .env                                        # addresses from the deploy
npm run dev
```

### The keeper

```bash
cd keeper
RPC_URL=... PRIVATE_KEY=... npm start        # loop
npm run once                                 # single pass, for cron
npm run dry-run                              # report only, sends nothing
```

Each pass syncs stale tiers, hauls if the net is full, then delivers. A failed pass is not fatal — the next one retries, and in the meantime anyone else can do the same work for the same tip.

### The dashboard

```bash
cd web
cp .env.example .env    # fill in from contracts/deployments/<network>.json
npm run dev
```

Live Trench pot in ETH and dollars, the haul countdown as the net fills, per-whale lifetime earnings and weight multiplier and activation status, total burned and distributed all-time — and an ocean-depth UI where the deeper you scroll, the darker the water.

Dollar figures come from whatever price feed you configure. With none configured, or when it is unreachable, the dashboard shows ETH only rather than inventing a number.

---

## Tests

```
contracts/test/
  token.test.js       supply is minted once and only ever falls
  whales.test.js      minting, the commit-reveal, tier spread, on-chain art
  activation.test.js  the burn, and selling dropping a whale off the payroll
  loyalty.test.js     the weight curve, and permissionless syncing
  trench.test.js      haul maths, the tip, delivery, conservation
  account.test.js     token-bound wallets and who controls them
  stock.test.js       stock election, its ETH fallback, and a hostile token
```

The one worth reading is the conservation invariant in `trench.test.js`: across five hauls with three whales at drifting weights and interleaved deliveries, `paid into whale wallets + keeper tips + what is left in the Trench` equals exactly what went in. Nothing appears and nothing vanishes.

---

## Why it wins

- **Real yield, day one.** Fees flow from the first trade.
- **Burn-gated.** You must buy and destroy $WHALE to earn. Demand and deflation in one motion.
- **Loyalty-weighted.** Diamond-fin whales out-earn tourists 3.33 to 1.
- **Trustless by construction.** No withdraw function, permissionless haul, NFT-bound payroll.
- **Stock election.** Your whale can pay you in equities. On Robinhood Chain, that's the flex.

**Feed the whale. Haul the Trench. Own the tide.**

---

## Before mainnet

This is complete, tested, working code — but it has not been audited, and it holds other people's money. Get an audit before it is pointed at a live Flap launch. Two areas deserve an auditor's attention in particular: the accumulator arithmetic in `Trench` (rounding, and the `reserved` bound that keeps credited balances at or under the contract's actual balance), and the transfer-hook deactivation path in `Whales`, which must never be able to revert or an activated whale becomes untransferable.
