# Handover

For the developer taking this to mainnet. Everything below is either verified
against the code in this repo or flagged as a decision someone has to make.

**Never deployed to any live network. Never audited.** All testing ran on a
local Hardhat chain.

---

## What exists

Five contracts in `contracts/contracts/`, 60 passing tests (`npx hardhat test`):

| Contract | State |
| --- | --- |
| `WhaleToken.sol` | ERC20. 1B minted once at deploy, no mint function, no owner. |
| `Whales.sol` | ERC721, 1000 supply, burn-to-activate, loyalty weighting, transfer-hook deactivation, IPFS metadata with a one-way freeze. |
| `Trench.sol` | Fee sink. No withdraw function. `haul()` splits by weight via an O(1) accumulator; `deliver()` pushes into whale wallets. |
| `WhaleAccount.sol` + `WhaleAccountRegistry.sol` | ERC-6551-style wallet per whale, identity in bytecode. |

Plus `contracts/scripts/deploy.js` (refuses to report success unless the
deployer role actually died), `scripts/provenance.js`, and `keeper/keeper.js`.

The 1000 PNGs and their metadata are committed under `pipeline/output/`.

---

## Do these, in order

### 1. Confirm Robinhood Chain is at or past Cancun

The contracts will not compile for an older EVM. Verified by recompiling for
`shanghai`:

```
TypeError: The "mcopy" instruction is only available for Cancun-compatible VMs
  --> @openzeppelin/contracts/utils/Bytes.sol:94
```

`MCOPY` (EIP-5656) arrives via `SignatureChecker`, which `WhaleAccount` uses for
ERC-1271 signature validation. `hardhat.config.js` is pinned to
`evmVersion: "cancun"` for this reason.

If the chain is pre-Cancun the fix is small: drop `isValidSignature` from
`WhaleAccount.sol` (nothing else uses it), remove the `SignatureChecker`
import, and compile for `shanghai`.

`Trench.sol` deliberately uses the storage-based `ReentrancyGuard`, not
`ReentrancyGuardTransient`, so there is no `TSTORE` dependency.

### 2. Pin the art to IPFS and set the real CID

Every metadata file currently reads `ipfs://__REPLACE_WITH_CID__/0042.png`.
Two CIDs, in this order:

```bash
# a. pin pipeline/output/images/ (1000 PNGs) → gives you the image CID
# b. regenerate metadata pointing at it
cd pipeline && python3 generate.py --cid <image-CID>
# c. pin pipeline/output/metadata/ (1000 JSON) → gives you BASE_URI
# d. recompute the provenance hash over the final metadata
cd ../contracts && node scripts/provenance.js ../pipeline/output/metadata
```

Use a pinning service (Pinata, web3.storage, NFT.Storage) or a node you keep
running — an unpinned CID is garbage-collected and the art disappears.

The provenance hash **changes when the CID changes**, because the CID is inside
the metadata. Compute it last, from the exact files you pinned. The hash in the
README is for the placeholder-CID files and is not the deploy value.

### 3. Deploy

`contracts/scripts/deploy.js` reads these from the environment:

```
ROBINHOOD_RPC_URL   https, not http
PRIVATE_KEY         funded deployer — local shell only, never in Vercel
LAUNCH_RECIPIENT    receives the 1B $WHALE for the Flap launch
PROVENANCE          0x… from step 2 — required, the deploy refuses without it
BASE_URI            ipfs://<metadata-CID>/  (can also be set after)
MINT_PRICE          default 0.02
HAUL_THRESHOLD      default 0.1
SWAP_ROUTER / WETH  both, or neither
```

`deploy.js` calls `setTrench` and asserts the deployer role is zero afterwards.
That is the only privileged action in the system and it destroys itself.

### 4. Check a token renders, then freeze

Load `tokenURI(1)` through a gateway and confirm the image resolves. Then call
`freezeMetadata()`. It is one-way and destroys the curator role — after it,
nobody can point the collection anywhere else. Do not freeze before checking.

### 5. Point the Flap launch tax at the Trench

That is the entire integration.

### 6. Configure the site

Set these in Vercel (or wherever it's hosted) and **redeploy** — they are baked
in at build time, so setting them alone does nothing:

```
VITE_CHAIN_ID  VITE_RPC_URL  VITE_WHALE_TOKEN  VITE_WHALES  VITE_TRENCH  VITE_REGISTRY
```

---

## Decisions someone has to make

**Mint policy.** `Whales.mint()` caps at 10 per transaction but has **no
per-wallet limit** — one address can take all 1000 across 100 transactions.
There is no allowlist and no pause. Meanwhile the site's step 01 reads "All
1000 whales minted. Pick one up on secondary," which implies you mint them
yourself rather than running a public sale. Decide which. If it's a public
sale, add the constraints you want before deploy — that is a contract change.

**Flap integration.** The Trench takes ETH from any sender, so integration is
just pointing the launch tax at its address. Confirm Flap's launch contract
actually allows an arbitrary tax recipient. That has never been verified
against Flap's real contract, only assumed.

**Stock election.** `Trench` takes a router and WETH address at construction.
Both are `address(0)` today, which disables the feature and pays everyone in
ETH. Supply a real AMM router and WETH to turn it on. The swap is gas-capped at
400k on purpose — the elected token is unvetted by design, so a hostile one
must not be able to burn a keeper's whole batch.

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

**Gas-test at real scale.** Local testing ran with at most 40 activated whales.
Specifically:

- `Trench.deliverMany()` — the keeper batches 50. Confirm that fits the block
  gas limit on Robinhood Chain with account creation included.
- `Trench.deliverable()` and `Whales.staleWhales()` both loop over all 1000
  token ids. They are `view`, so they cost nothing to call, but they can exceed
  an RPC node's `eth_call` gas cap. The dashboard already hit exactly this and
  had to chunk `whaleStates` into hundreds. Chunk these too if needed.
