#!/usr/bin/env node
//
// The keeper presses the buttons. It has no special powers: every call it
// makes is one anyone can make, and it is paid the same 0.5% tip any other
// caller would earn. If it dies, the ocean keeps working -- someone else takes
// the tip instead.
//
//   RPC_URL=... PRIVATE_KEY=... DEPLOYMENT=../contracts/deployments/robinhood.json node keeper.js
//
// On a host that has the repo checked out, the deployment file is the source of
// the addresses. On one that does not -- Railway, Fly, a container, anything
// building from a clone -- the file is absent, because `deployments/*.json` is
// gitignored. So TRENCH and WHALES may be given directly instead:
//
//   RPC_URL=... PRIVATE_KEY=... TRENCH=0x... WHALES=0x... node keeper.js
//
// Nothing here is secret except the key. The addresses are public and on the
// explorer; keeping them out of git is about not stamping a specific
// deployment into the source, not about hiding them.
//
// Flags:
//   --once      run a single pass and exit (for cron)
//   --dry-run   report what it would do, send nothing

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const TRENCH_ABI = [
  "function pot() view returns (uint256)",
  "function haulThreshold() view returns (uint256)",
  "function readyToHaul() view returns (bool)",
  "function totalWeight() view returns (uint256)",
  "function haul() returns (uint256,uint256)",
  "function deliverable() view returns (uint256[])",
  "function deliverMany(uint256[]) returns (uint256)",
];
const WHALES_ABI = [
  "function staleWhales() view returns (uint256[])",
  "function syncWeights(uint256[])",
];

const INTERVAL_MS = Number(process.env.INTERVAL_MS || 60_000);
const DELIVER_BATCH = Number(process.env.DELIVER_BATCH || 50);
const ONCE = process.argv.includes("--once");
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Where the addresses come from: the environment first, then the deployment
 * file. Explicit addresses win, so a host can be pointed at a different
 * deployment without editing anything on disk.
 *
 * Both are validated here rather than at the first call. A typo'd address
 * otherwise surfaces as an empty `deliverable()` and a keeper that looks
 * healthy while doing nothing at all, which is the worst way for this to fail.
 */
function loadDeployment() {
  const { TRENCH, WHALES } = process.env;

  if (TRENCH || WHALES) {
    for (const [name, value] of [["TRENCH", TRENCH], ["WHALES", WHALES]]) {
      if (!value) throw new Error(`${name} is missing; set both TRENCH and WHALES, or neither`);
      if (!ethers.isAddress(value)) throw new Error(`${name} is not an address: ${value}`);
    }
    return {
      chainId: Number(process.env.CHAIN_ID || 0) || "unknown",
      contracts: { trench: ethers.getAddress(TRENCH), whales: ethers.getAddress(WHALES) },
    };
  }

  const file = process.env.DEPLOYMENT
    ? path.resolve(process.env.DEPLOYMENT)
    : path.join(__dirname, "..", "contracts", "deployments", "robinhood.json");
  if (!fs.existsSync(file)) {
    throw new Error(
      `no deployment at ${file}. Set DEPLOYMENT to point at one, or give TRENCH and\n` +
      "  WHALES directly — the file is gitignored, so a fresh clone will not have it."
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function pass({ trench, whales, signer }) {
  // 1. Promote whales that have earned a higher tier. Anyone may do this and it
  //    can only ever raise a whale's weight, so it is safe to run blind.
  const stale = await whales.staleWhales();
  if (stale.length) {
    log(`syncing ${stale.length} whale(s) to the tier they have earned`);
    if (!DRY_RUN) {
      for (const batch of chunk([...stale], DELIVER_BATCH)) {
        const tx = await whales.connect(signer).syncWeights(batch);
        await tx.wait();
      }
    }
  }

  // 2. Haul, if the net is full enough. The tip lands in the caller's wallet.
  const [pot, threshold, ready] = await Promise.all([
    trench.pot(),
    trench.haulThreshold(),
    trench.readyToHaul(),
  ]);
  log(`pot ${ethers.formatEther(pot)} / ${ethers.formatEther(threshold)} ETH${ready ? " — ready" : ""}`);

  if (ready) {
    if (DRY_RUN) {
      log(`would haul, tip ≈ ${ethers.formatEther((pot * 50n) / 10_000n)} ETH`);
    } else {
      const tx = await trench.connect(signer).haul();
      const receipt = await tx.wait();
      log(`hauled in ${receipt.hash}`);
    }
  }

  // 3. Push settled shares into each whale's own wallet.
  const owed = await trench.deliverable();
  if (owed.length) {
    log(`delivering to ${owed.length} whale(s)`);
    if (!DRY_RUN) {
      for (const batch of chunk([...owed], DELIVER_BATCH)) {
        const tx = await trench.connect(signer).deliverMany(batch);
        await tx.wait();
        log(`delivered ${batch.length} in ${tx.hash}`);
      }
    }
  }
}

async function main() {
  const deployment = loadDeployment();
  const rpc = process.env.RPC_URL;
  if (!rpc) throw new Error("set RPC_URL");

  const provider = new ethers.JsonRpcProvider(rpc);

  /* Checked once, at boot, against the chain the RPC actually serves. A keeper
     pointed at the wrong network reads zero everywhere and reports a healthy
     `pot 0.0 / 0.1` forever -- it looks like a quiet ocean rather than a
     misconfiguration, and nobody finds out until a distribution is missed. */
  const chainId = Number((await provider.getNetwork()).chainId);
  if (typeof deployment.chainId === "number" && chainId !== deployment.chainId) {
    throw new Error(
      `RPC_URL serves chain ${chainId}, deployment is chain ${deployment.chainId}`
    );
  }

  /* Same reasoning: no code at an address means the addresses are wrong, or
     the RPC is. Either way there is nothing to keep. */
  for (const [name, address] of Object.entries(deployment.contracts)) {
    if (!address) continue;
    if ((await provider.getCode(address)) === "0x") {
      throw new Error(`no contract at ${name} ${address} on chain ${chainId}`);
    }
  }

  let signer = null;
  if (!DRY_RUN) {
    if (!process.env.PRIVATE_KEY) throw new Error("set PRIVATE_KEY (or pass --dry-run)");
    // A pass sends several transactions back to back. NonceManager assigns them
    // in sequence rather than asking the node for a pending count each time,
    // which lags and hands out the same nonce twice.
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    signer = new ethers.NonceManager(wallet);
    const balance = await provider.getBalance(wallet.address);
    log(`keeper ${wallet.address} on chain ${chainId}, ${ethers.formatEther(balance)} ETH`);
    /* Gas is the one thing this cannot earn its way out of: with an empty
       wallet every pass fails, and the tips that would refill it are exactly
       what it can no longer collect. */
    if (balance === 0n) log("WARNING: no ETH for gas — every pass will fail until this is funded");
  } else {
    log("dry run — nothing will be sent");
  }

  const ctx = {
    trench: new ethers.Contract(deployment.contracts.trench, TRENCH_ABI, provider),
    whales: new ethers.Contract(deployment.contracts.whales, WHALES_ABI, provider),
    signer,
  };

  for (;;) {
    try {
      await pass(ctx);
    } catch (e) {
      // A failed pass is not fatal: the next one retries, and in the meantime
      // anyone else can do the same work for the same tip. Resync the nonce in
      // case the pass died with transactions in flight.
      log("pass failed:", e.shortMessage || e.message);
      if (signer) signer.reset();
    }
    if (ONCE) return;
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
