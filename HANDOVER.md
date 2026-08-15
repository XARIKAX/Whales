# Handover — contract work outstanding

Written for the developer taking this to mainnet. Everything below is either
verified against the code in this repo or flagged as an open decision.

---

## What is finished

Five contracts in `contracts/contracts/`, 62 passing tests (`npx hardhat test`):

| Contract | State |
| --- | --- |
| `WhaleToken.sol` | ERC20, 1B minted once at deploy, no mint function, no owner. Done. |
| `Whales.sol` | ERC721, 1000 supply, burn-to-activate, loyalty weighting, transfer-hook deactivation. Done **except `tokenURI`** — see blocker 1. |
| `Trench.sol` | Fee sink. No withdraw function. `haul()` splits by weight via an O(1) accumulator, `deliver()` pushes into whale wallets. Done. |
| `WhaleAccount.sol` + `WhaleAccountRegistry.sol` | ERC-6551-style wallet per whale, identity in bytecode. Done, but see blocker 2. |
| `WhaleRenderer.sol` | On-chain SVG art. **Superseded** by the PNG collection — see blocker 1. |

Also: `contracts/scripts/deploy.js` (refuses to report success unless the
deployer role actually died), and `keeper/keeper.js`.

**Never deployed to any live network.** Only a local Hardhat chain.
**Never audited.**

---

## ~~Blocker 1~~ — resolved

The two rarity systems have been reconciled. `Whales.sol` no longer rolls tiers
on chain or renders SVG; the on-chain renderer is gone. `tokenURI` now returns
`<baseURI><id padded to 4>.json`, matching the generated files.

In its place the contract carries a **provenance hash** — the keccak of every
metadata file in token order, fixed at deployment and immutable after it. The
collection is reproducible from the `WHALES-2026` seed, so anyone can
regenerate it, re-run `scripts/provenance.js` and prove the art was not
changed after launch.

`setBaseURI` is callable only by the curator, and `freezeMetadata()` is one-way:
it locks the URI and destroys the curator role, after which no address in the
system can change what a whale looks like. That is what backs the claim on the
site.

Current provenance for the committed collection:

```
0x7f1908587224fd9d204fc67ef385aeccdb808c959fe19876fa167c949f36d709
```

Regenerate and verify it with:

```bash
cd pipeline && python3 generate.py
cd ../contracts && node scripts/provenance.js ../pipeline/output/metadata
```

## Blocker 2 — the contracts require a Cancun-era chain

Verified by recompiling for `shanghai`:

```
TypeError: The "mcopy" instruction is only available for Cancun-compatible VMs
  --> @openzeppelin/contracts/utils/Bytes.sol:94
```

`MCOPY` (EIP-5656) arrives via `SignatureChecker`, which `WhaleAccount` uses for
ERC-1271 signature validation. `hardhat.config.js` is pinned to
`evmVersion: "cancun"` for this reason.

**Confirm Robinhood Chain is at or past Cancun before doing anything else.** If
it is not, the fix is small: drop `isValidSignature` from `WhaleAccount.sol`
(nothing else uses it), remove the `SignatureChecker` import, and compile for
`shanghai` or `paris`.

Note `Trench.sol` deliberately uses the storage-based `ReentrancyGuard`, not
`ReentrancyGuardTransient`, so there is no `TSTORE` dependency.

---

## Open decisions

**Mint policy.** `Whales.mint()` caps at 10 per transaction but has **no
per-wallet limit** — one address can take all 1000 across 100 transactions.
There is no allowlist and no pause. Meanwhile the site's step 01 reads "All
1000 whales minted. Pick one up on secondary," which implies you mint them
yourself rather than running a public sale. Decide which, and if it is a public
sale, add the constraints you want before deploy.

**Flap integration.** The Trench takes ETH from any sender, so integration is
just pointing the launch tax at its address. Confirm Flap's launch contract
actually allows an arbitrary tax recipient — that has never been verified
against Flap's real contract, only assumed.

**Stock election.** `Trench` takes a router and WETH address at construction.
Both are `address(0)` today, which disables the feature and pays everyone in
ETH. Supply a real AMM router and WETH for Robinhood Chain to turn it on. The
swap is gas-capped at 400k on purpose — the elected token is unvetted by
design, so a hostile one must not be able to burn a keeper's whole batch.

**Mint proceeds.** They accumulate in `Whales` until anyone calls
`sweepToTrench()`, which sends them to the Trench and therefore to holders.
That is deliberate. Confirm it is what you want.

---

## Before mainnet

**Get an audit.** Unaudited code holding other people's money. Two areas
deserve the most attention:

1. The accumulator arithmetic in `Trench` — rounding, and the `reserved` bound
   that keeps credited balances at or under the contract's actual balance.
2. The transfer-hook deactivation path in `Whales._update`. If it can ever
   revert, an activated whale becomes untransferable. It is currently pure
   arithmetic, but it is the highest-consequence path in the system.

**Gas-test at real scale.** All local testing ran with at most 40 activated
whales. Specifically check:

- `Trench.deliverMany()` — the keeper batches 50; confirm that fits the block
  gas limit on Robinhood Chain with account creation included.
- `Trench.deliverable()` and `Whales.staleWhales()` both loop over all 1000
  token ids. They are `view`, so they cost nothing to call, but they can exceed
  an RPC node's `eth_call` gas cap. The dashboard already hit exactly this and
  had to chunk `whaleStates` into hundreds. Chunk these too if needed.

**Set the real IPFS CID.** Every metadata file currently reads
`ipfs://__REPLACE_WITH_CID__/0042.png`. Pin the images, then regenerate with
`python3 generate.py --cid bafy...`.

**Deploy parameters** (`contracts/scripts/deploy.js` reads these from env):

```
ROBINHOOD_RPC_URL   https, not http
PRIVATE_KEY         funded deployer — never in Vercel, local shell only
LAUNCH_RECIPIENT    receives the 1B $WHALE for the Flap launch
MINT_PRICE          default 0.02
HAUL_THRESHOLD      default 0.1
SWAP_ROUTER / WETH  both, or neither
```

`deploy.js` calls `setTrench` and asserts the deployer role is zero afterwards.
That is the only privileged action in the system and it destroys itself.

---

## After deploy

Set these in Vercel and **redeploy** — they are baked in at build time, so
setting them alone does nothing:

```
VITE_CHAIN_ID  VITE_RPC_URL  VITE_WHALE_TOKEN  VITE_WHALES  VITE_TRENCH  VITE_REGISTRY
```

Then point the Flap launch tax at the Trench address. That is the entire
integration.
