# Handover

For the developer taking this to mainnet. Everything below is either verified
against the code in this repo or flagged as a decision someone has to make.

**Never deployed to any live network. Never audited.** All testing ran on a
local Hardhat chain.

---

## What exists

Five contracts in `contracts/contracts/`, 56 passing tests (`npx hardhat test`):

| Contract | State |
| --- | --- |
| `WhaleToken.sol` | ERC20. 1B minted once at deploy, no mint function, no owner. |
| `Whales.sol` | ERC721, 1000 supply, burn-to-activate, loyalty weighting, transfer-hook deactivation, IPFS metadata with a one-way freeze. |
| `Trench.sol` | Fee sink. No withdraw function. `haul()` splits by weight via an O(1) accumulator; `deliver()` pushes ETH into whale wallets. ETH in, ETH out — no router, no swap. |
| `WhaleAccount.sol` + `WhaleAccountRegistry.sol` | ERC-6551-style wallet per whale, identity in bytecode. `execute` is holder-only and is how ETH leaves; the dashboard drives it from a Withdraw button. |

Plus `contracts/scripts/deploy.js` (refuses to report success unless the
deployer role actually died), `scripts/provenance.js`, and `keeper/keeper.js`.

The 1000 metadata files and ten contact sheets are committed under
`pipeline/output/`; the full-size renders are regenerated (see step 2).

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

### 2. The art — done, with a caveat that matters

**Already done.** The collection is served from the site's own domain rather
than IPFS:

```
tokenURI(42)  →  https://whalenft.fun/metadata/0042.json
   image      →  https://whalenft.fun/whales/0042.png
```

Both directories are in `web/public/` and go out with the site. `vercel.json`
adds `Access-Control-Allow-Origin: *` to both, and a year's immutable cache to
the images. The files carry real `.json` and `.png` extensions and are named to
match what the contract already emits — zero-padded to four digits — so no
contract change and no `Content-Type` override were needed.

Rebuild them with:

```bash
cd pipeline && python3 generate.py && python3 publish.py
cd ../contracts && node scripts/provenance.js ../web/public/metadata
```

The published PNGs are 728px, not the 1248px masters. 1000 masters is 122 MB
and Vercel's Hobby plan caps a deployment's source files at 100 MB, so they
would not deploy at all. `publish.py --size 1248` is one flag if the project
moves to Pro, whose ceiling is 1 GB.

**The caveat.** A domain is not IPFS. The images can be replaced by whoever
controls the domain, and if it lapses they are gone. Provenance makes a change
to the metadata *detectable*, not impossible.

Two consequences, and both are easy to get wrong:

1. **Do not call `freezeMetadata()` while the base URI is a domain.** It would
   lock the pointer permanently at a URL whose contents are still mutable —
   the worst of both, since it also removes the ability to move to IPFS later.
2. **The provenance hash is set at deploy and is immutable.** It currently
   covers metadata containing `https://whalenft.fun/...` image URLs. Moving to
   IPFS later changes those URLs, changes the files, and changes the hash — at
   which point the hash on chain will not match the files being served, and the
   verification instructions on the docs page become false.

So decide *before* deploying which of these is the launch configuration:

- **Ship self-hosted.** Deploy with the current hash, leave metadata unfrozen,
  and be straight in the docs that the art is verifiable rather than immutable.
- **Move to IPFS first.** Pin `web/public/whales/` then `web/public/metadata/`
  (regenerating the metadata between the two so the `image` fields carry the
  image CID), recompute provenance over the pinned files, deploy with that
  hash, check a token renders, then `freezeMetadata()`.

The second is the stronger claim and the one the site's copy currently makes.
The first is live today.

Current provenance, over the published metadata:

```
0xbe5d0cdd294722826d3f314623f29a168a5cfd3e762f2aa1f34915adcb2881e6
```

### 3. Deploy

`contracts/scripts/deploy.js` reads these from the environment:

```
ROBINHOOD_RPC_URL   https, not http
PRIVATE_KEY         funded deployer — local shell only, never in Vercel
LAUNCH_RECIPIENT    receives the 1B $WHALE for the Flap launch
PROVENANCE          0x… from step 2 — required, the deploy refuses without it
BASE_URI            ipfs://<metadata-CID>/  (can also be set after)
MINT_PRICE_USD      dollar price per whale — default 1
ETH_USD             the rate it is converted at; required off a dev chain
MINT_PRICE          explicit ETH amount, skips the conversion
HAUL_THRESHOLD      default 0.1
```

`deploy.js` calls `setTrench` and asserts the deployer role is zero afterwards.
That is the only privileged action in the system and it destroys itself.

### 3b. Verify the source on the explorer

```bash
npx hardhat run scripts/verify.js --network robinhood
```

Reads `deployments/robinhood.json` for the addresses and constructor arguments,
so it cannot disagree with what was actually deployed. Safe to re-run. The
per-whale accounts are not covered: the registry creates them on demand, so
verify one after the first delivery and the explorer matches the rest by
bytecode.

### 4. Check a token renders

Open `https://whalenft.fun/metadata/0001.json` in a browser: it should come back
as raw JSON, and the `image` URL inside it should load. Check a few across
decades — `0001`, `0100`, `1000` — since the id is padded to four digits. Then
call `tokenURI(1)` on the deployed contract and confirm it returns that same
URL.

Then open the collection on OpenSea and use **Refresh metadata**, which makes
their crawler re-read `tokenURI`, fetch the JSON, cache the images and compute
rarity from the attributes.

**Do not call `freezeMetadata()` yet** — see the caveat in step 2. It is only
correct once the base URI points at IPFS.

### 5. Point the Flap launch tax at the Trench

That is the entire integration.

### 6. Configure the site

Set these in Vercel (or wherever it's hosted) and **redeploy** — they are baked
in at build time, so setting them alone does nothing:

```
VITE_CHAIN_ID       4663
VITE_CHAIN_NAME     Robinhood Chain
VITE_RPC_URL        a paid endpoint, not the rate-limited public one
VITE_EXPLORER_URL   https://robinhoodchain.blockscout.com
VITE_IPFS_GATEWAY   yours if you have one — every whale image goes through it
VITE_WALLETCONNECT_ID   from cloud.reown.com — already set on the live site
VITE_WHALE_TOKEN  VITE_WHALES  VITE_TRENCH  VITE_REGISTRY   from the deploy
```

`VITE_WALLETCONNECT_ID` is what puts WalletConnect, Rainbow and Coinbase in the
wallet list. Without it the list is browser extensions only, so a visitor on a
phone opens the modal onto nothing. It is a public identifier, not a secret —
it ends up in the bundle either way. The Reown project's allowed-domains list
needs **both** `whalenft.fun` and `www.whalenft.fun`, because the site redirects
between them and WalletConnect refuses a domain that is not listed.

`VITE_IPFS_GATEWAY` is not optional in practice: `tokenURI` returns `ipfs://…`,
which a browser cannot fetch and an `<img src>` cannot load, so with a gateway
that is down or rate-limiting, every whale on the site is a blank tile. It
defaults to `https://ipfs.io/ipfs/`, which is fine to launch on and the first
thing to replace.

---

## Decisions someone has to make

**Mint policy — decided.** Public sale at **$1 a whale, 10 per transaction, no
per-wallet limit**. That is what `Whales.mint()` already does; no contract
change was needed, and `whales.test.js` now asserts the policy so a per-wallet
cap has to be added deliberately rather than drifting in. There is no allowlist
and no pause, so one address can take all 1000 across 100 transactions — that is
the accepted trade, not an oversight.

The $1 is fixed in native tokens at deployment (see step 3), so it drifts with
ETH afterwards. `Whales.mint()` is live and public from the block it deploys, so
if you intend to take any of the supply yourself, do it immediately — there is
no pause and no priority.

**Flap integration.** The Trench takes ETH from any sender, so integration is
just pointing the launch tax at its address. Confirm Flap's launch contract
actually allows an arbitrary tax recipient. That has never been verified
against Flap's real contract, only assumed.

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

**Gas at real scale — measured.** Run on the Hardhat EVM with all 1000 minted
and all 1000 activated:

| Call | Gas |
| --- | --- |
| `deliverMany(50)`, cold — creates 50 token-bound accounts | 6,242,772 |
| `deliverMany(50)`, warm — accounts already exist | 2,169,578 |
| `deliverable()` — `eth_call`, loops all 1000 | 7,468,245 |
| `staleWhales()` — `eth_call`, loops all 1000 | 5,726,263 |
| `whaleStates(100)` — the dashboard's chunk | 2,180,875 |

The keeper's batch of 50 is fine as it stands, and neither view call is near a
normal `eth_call` cap. Robinhood Chain is an Arbitrum Orbit chain, which prices
L1 calldata separately from EVM gas, so re-measure against the real RPC before
relying on the margin.
