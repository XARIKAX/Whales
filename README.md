# WHALES — $WHALE

**1000 pixel whales. Every fee in the ocean flows to them.**

$WHALE launches on Flap with a 2% buy / 3% sell tax. The tax lands in one
contract that nobody can withdraw from, and anyone can press the button that
splits it across activated whale NFTs — paid in ETH on Robinhood Chain.

```
trades taxed  →  tax lands in the Trench  →  anyone hauls
                                                 ↓
     ETH arrives in the       ←   split by loyalty weight
     whale's own wallet            across every fed whale
```

| Path | What it is |
| --- | --- |
| `contracts/` | Five contracts, 56 tests, deploy scripts |
| `pipeline/` | The Python generator that produced the 1000 PNGs and their metadata |
| `keeper/` | A bot that presses the buttons anyone can press |
| `web/` | The dashboard: live pot, haul countdown, per-whale earnings |

Status: **complete and tested locally, never deployed, never audited.**
See [`HANDOVER.md`](HANDOVER.md) for what a developer must do before mainnet.

---

## The contracts

No owner, no upgrade path, no pause, no admin key.

### `$WHALE` — launched on Flap, not here

**This repository does not deploy a token.** $WHALE is launched on Flap, which
happens after these contracts go out, so its address cannot be a constructor
argument. `Whales` takes it afterwards, in a one-shot `setWhaleToken` call, and
can never be pointed at a different one.

Activation therefore assumes nothing about it beyond ERC20. `burnFrom` is an
OpenZeppelin extension rather than part of the standard, so the burn is a
`safeTransferFrom` to `0x…dEaD` — an address nobody holds the key to. That works
against any launchpad token, where a `burnFrom` that turned out not to exist
would have left activation permanently broken on a contract with no owner.

`totalSupply` therefore holds steady and *circulating* supply is what falls:
`totalSupply() - balanceOf(0x…dEaD)`.

### `Whales` — the NFTs

1000 whales, fixed supply. Traits are cosmetic: **rarer whales earn exactly
the same.** Weight comes from loyalty alone.

**Burn to activate.** A whale doesn't earn until it's fed:

- Activating burns **1,000,000 $WHALE** (0.1% of supply) and starts it at 1.00x.
- Dormant whales carry zero weight — automatically, not by anyone's decision.
- Selling a whale deactivates it in the same transaction, via the ERC-721
  transfer hook. The new owner activates again, burning another million.

### `Trench` — where every fee lands

Accepts ETH from anyone, any time. **Nobody can withdraw — there is no
withdraw function.** Money leaves one way, the haul:

```solidity
function haul()    external returns (uint256 distributed, uint256 tip);
function deliver(uint256 tokenId)         external returns (uint256);
function deliverMany(uint256[] calldata)  external returns (uint256);
```

All three are callable by anybody. There is no `withdraw`, `rescue`, `owner`
or `upgradeTo`, and a test asserts the ABI does not contain them.

### `WhaleAccount` + `WhaleAccountRegistry` — a wallet per whale

Every whale owns an on-chain wallet, ERC-6551 style. Its identity is baked
into its bytecode, so it can never be reassigned, and ownership follows the
NFT — sell the whale and the wallet goes with it, contents and all.

The address is a pure function of the token id, so ETH sent before the account
exists is not lost; it is waiting when the account is created.

Getting it out is `execute(to, value, data)`, restricted on chain to
`ownerOf(tokenId)`. The dashboard offers it as a **Withdraw** button on each
card in `/portfolio` and in the actions console — a convenience over a call only
the holder can make. The first withdraw for a whale is two transactions, because
the wallet has to be created before it can be spent from; after that it is one.

---

## How the haul works

When the pot hits the threshold, anyone can haul it. The whole pot splits
across every activated whale **in one transaction**, and whoever pressed the
button keeps 0.5%.

That works at 1000 whales because the split is an accumulator, not a loop:
`haul` adds to a cumulative ETH-per-unit-of-weight figure, crediting every fed
whale at once in O(1). `deliver` is the separate, batchable step that moves a
whale's share into its wallet. Until then the share is safe in the contract.

So ETH makes three stops, and the dashboard shows the balance at each:

```
Trench  ──haul + deliver──▶  the whale's own wallet  ──withdraw──▶  you
 anyone can press these two                    only the holder can press this
```

**Loyalty weighting.** Every activated whale starts at 1x and climbs to a
3.33x cap by staying active:

| Fed for | 0–7d | 7d | 14d | 30d | 60d | 90d | 180d | 365d |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Weight | 1.00x | 1.25x | 1.50x | 1.80x | 2.15x | 2.50x | 2.90x | **3.33x** |

Promotion is permissionless — anyone can promote any whale to the tier it has
already earned, and the call can only ever *raise* a weight. A whale nobody
syncs simply keeps earning at its old rate.

**A keeper bot presses the buttons, but has no special powers** — whoever
hauls earns the tip. If the bot dies, any wallet does its job.

---

## The art

The 1000 whales are PNGs generated by `pipeline/` and **served from this site's
own domain**. `tokenURI(42)` returns `https://whalenft.fun/metadata/0042.json`,
and the `image` inside points at `https://whalenft.fun/whales/0042.png`.

Self-hosted rather than IPFS, for now, because it is one deploy instead of two
pinning rounds and it makes OpenSea work today. The cost is stated plainly
below. `python3 pipeline/publish.py` builds both directories into
`web/public/`; the masters stay in `pipeline/output/images/` at 1248px and the
published copies are 728px, because 1000 masters is 122 MB against Vercel's
100 MB deployment ceiling.

Every whale carries a `Tier` trait — 10 Legendary, 50 Rare, 190 Uncommon, 750
Common, banded by rarity score over the finished collection. It is a label and
nothing more: **a Legendary earns exactly what a Common earns.** It lives in the
metadata rather than being derived in the browser because the metadata is what
provenance commits to, and a tier computed client-side is one anybody can change.

**Provenance.** The contract stores an immutable keccak hash of every metadata
file in token order, fixed at deployment. The collection is reproducible from
the `WHALES-2026` seed, so anyone can regenerate it, re-run
`scripts/provenance.js`, and check the hash matches. The per-file hashes are
published at `/provenance.json`.

**What self-hosting costs, stated plainly.** Provenance makes a change to the
*metadata* detectable — it does not make it impossible. The images sit behind a
URL on a domain we control, so they can be replaced, and if the domain lapses
they are gone. `freezeMetadata()` would lock the base URI but not the files
behind it, which is why **it should not be called while the base URI is a
domain**. The end state is IPFS plus a freeze; this is the step before it, and
the honest description of it is "verifiable, not yet immutable".

Current provenance, over the metadata published to the site:

```
0xbe5d0cdd294722826d3f314623f29a168a5cfd3e762f2aa1f34915adcb2881e6
```

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

It exists only because `Whales` and `Trench` reference each other and one has
to be deployed first. `deploy.js` refuses to report success unless `deployer`
is zero afterwards. After that, no address in the system has any power a random
wallet doesn't also have.

(The curator role on `Whales` is separate and also self-destructing — see
`freezeMetadata()` above. It cannot touch money.)

---

## Running it

### Contracts

```bash
cd contracts
npm install
npx hardhat test        # 56 tests
```

`solc` is pinned in `devDependencies` rather than fetched at build time, so
bytecode is a function of the lockfile alone and CI runners without egress to
`binaries.soliditylang.org` still work. `evmVersion` is pinned to `cancun` —
see HANDOVER blocker 2.

### The art pipeline

```bash
cd pipeline
pip install pillow numpy
python3 generate.py                 # 1000 PNGs + metadata into output/
python3 publish.py                  # 728px copies + metadata into web/public/
```

Deterministic from the `WHALES-2026` seed — same input, same 1000 whales.
Details in [`pipeline/README.md`](pipeline/README.md).

The 1000 renders are 133MB at 1248×1248, so they are regenerated rather than
committed. What *is* committed is the evidence: the 1000 metadata files, and ten
contact sheets under `output/sheets/`. A fresh `python3 generate.py` reproduces
all ten sheets byte for byte and the same `PROVENANCE` hash, which is what makes
"regenerate it yourself and check" a real claim rather than a hopeful one.

### Deploying

```bash
cd contracts
node scripts/provenance.js ../pipeline/output/metadata   # prints PROVENANCE=0x…

ROBINHOOD_RPC_URL=https://…  \
PRIVATE_KEY=0x…              \
PROVENANCE=0x…               \
BASE_URI=ipfs://bafy…/       \
MINT_PRICE_USD=1             \
ETH_USD=1880                 \
npx hardhat run scripts/deploy.js --network robinhood
```

**The mint is $1 a whale, ten a transaction, no per-wallet limit.** The price is
stored on chain as an immutable native-token amount, so `deploy.js` converts it
once from `MINT_PRICE_USD` at the `ETH_USD` rate you name and prints both in the
deploy log — $1 at $1880/ETH is `0.000531914893617021 ETH`. Off a dev chain it
refuses to guess: set `ETH_USD`, or `MINT_PRICE` for an explicit ETH amount.
Because the amount is fixed at deployment, the dollar price drifts with ETH from
that block onward.

`HAUL_THRESHOLD` (0.1) has a default.

**Everything is ETH, end to end.** The Flap tax arrives as ETH and leaves as
ETH, into each whale's own wallet. The Trench holds no router, calls no AMM and
offers no way to be paid in anything else, so a delivery has one outcome and no
dependency outside this repo. A test asserts the ABI cannot grow one.

Addresses are written to `contracts/deployments/<network>.json`, which the
keeper and dashboard both read — and which is gitignored, so back it up. Then
publish the source, which reads that same file rather than asking you to retype
four addresses and their constructor arguments:

```bash
npx hardhat run scripts/verify.js --network robinhood
```

Check a token renders, then call `freezeMetadata()`.

**Then point the Flap launch tax recipient at the Trench address.** That is the
entire integration.

### Locally, end to end

```bash
cd contracts
npx hardhat node                                            # terminal 1

PROVENANCE=0xbe5d0cdd294722826d3f314623f29a168a5cfd3e762f2aa1f34915adcb2881e6 \
npx hardhat run scripts/deploy.js     --network localhost   # terminal 2
npx hardhat run scripts/seed-local.js --network localhost

cd ../keeper && npm install
RPC_URL=http://127.0.0.1:8545 \
DEPLOYMENT=../contracts/deployments/localhost.json \
PRIVATE_KEY=0x… node keeper.js --once

cd ../web && npm install
cp .env.example .env                                        # addresses from the deploy
npm run dev
```

`seed-local.js` mints out, points the base URI at the metadata, then feeds forty
whales in waves and rewinds the chain clock between them, so the whole loyalty
curve is visible on the site rather than a wall of 1.00x.

To see the real art locally, serve `pipeline/output` over HTTP with CORS
enabled and point both ends at it — an `ipfs://` base URI resolves to nothing
until the collection is pinned, which is exactly the case the dashboard most
needs exercising against:

```bash
SEED_BASE_URI=http://127.0.0.1:8899/metadata/ \
npx hardhat run scripts/seed-local.js --network localhost
# and in web/.env
VITE_IPFS_GATEWAY=http://127.0.0.1:8899/
```

### The keeper

```bash
cd keeper
RPC_URL=… PRIVATE_KEY=… npm start   # loop
npm run once                        # single pass, for cron
npm run dry-run                     # report only, sends nothing
```

Each pass syncs stale tiers, hauls if the pot is full, then delivers. A failed
pass isn't fatal — the next one retries, and anyone else can do the same work
for the same tip.

### The website

```bash
cd web
cp .env.example .env    # fill in from contracts/deployments/<network>.json
npm run dev             # npm run build for dist/
```

Wallets go through **RainbowKit** — browser extensions, WalletConnect's QR code,
Rainbow and Coinbase. Set `VITE_WALLETCONNECT_ID` from
[cloud.reown.com](https://cloud.reown.com) or the list is extensions only, which
on a phone is an empty modal.

The whole wallet stack (wagmi, RainbowKit, WalletConnect) is ~320 kB gzipped and
is **loaded on demand**, not on page load: it arrives when the pointer touches
the Connect pill, when the route is `/activate` or `/portfolio`, or when a
previous session is still connected. A reader who opens the docs and never
connects downloads none of it — 184 kB against 500+ kB for the naive wiring.

Env vars are baked in at build time. Changing them requires a rebuild/redeploy.

Three pages — `/` (the dive), `/activate`, `/portfolio` — routed by
`src/router.jsx`, which is `pushState` and a `popstate` listener rather than a
routing library. They are real paths, not hashes, because the nav already uses
hashes to jump to sections. **The host must serve `index.html` for unknown
paths** or a cold load of `/activate` 404s.

All three read the chain. `/activate` and `/portfolio` show the connected
wallet's own whales — filtered out of the pod by holder, which costs no extra
reads because `whaleStates` already returns one — and fall back to a labelled
sample only when no wallet is connected. `/activate` runs the approve-then-burn
pair itself. The portfolio's collection figures come from the contracts; there
is no floor price or 24h volume, because there is nowhere on chain to read one
and the page would rather show fewer numbers than a number it cannot stand
behind. Its ledger reads `Hauled` logs over a bounded window
(`VITE_LOG_LOOKBACK`), with the all-time totals beside it coming from the
contract's own counters.

Fonts are self-hosted, so the site pulls nothing from a third party at runtime.
Whale art comes from `tokenURI`, loaded lazily and capped at six concurrent
reads so a wall of whales doesn't stampede the RPC. Dollar figures come from
whatever price feed `.env` names; with none configured the site shows ETH only
rather than inventing a number.

Deploy config for both hosts is in the repo: `vercel.json` for Vercel,
`web/public/.htaccess` for Apache/LiteSpeed shared hosting. Keep them in step.

---

## Tests

```
contracts/test/
  token.test.js       supply is minted once and only ever falls
  whales.test.js      minting, tokenURI, provenance, the metadata freeze
  activation.test.js  the burn, and selling dropping a whale off the payroll
  loyalty.test.js     the weight curve, and permissionless syncing
  trench.test.js      haul maths, the tip, delivery, conservation
  account.test.js     token-bound wallets and who controls them
```

The one worth reading is the conservation invariant in `trench.test.js`: across
five hauls with three whales at drifting weights and interleaved deliveries,
`paid into whale wallets + keeper tips + what is left in the Trench` equals
exactly what went in. Nothing appears and nothing vanishes.
