#!/usr/bin/env node
//
// The keeper presses the buttons. It has no special powers: every call it
// makes is one anyone can make, and it is paid the same 0.5% tip any other
// caller would earn. If it dies, the ocean keeps working -- someone else takes
// the tip instead.
//
//   RPC_URL=... PRIVATE_KEY=... DEPLOYMENT=../contracts/deployments/robinhood.json node keeper.js
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

function loadDeployment() {
  const file = process.env.DEPLOYMENT
    ? path.resolve(process.env.DEPLOYMENT)
    : path.join(__dirname, "..", "contracts", "deployments", "robinhood.json");
  if (!fs.existsSync(file)) throw new Error(`no deployment at ${file}; set DEPLOYMENT`);
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
  let signer = null;
  if (!DRY_RUN) {
    if (!process.env.PRIVATE_KEY) throw new Error("set PRIVATE_KEY (or pass --dry-run)");
    // A pass sends several transactions back to back. NonceManager assigns them
    // in sequence rather than asking the node for a pending count each time,
    // which lags and hands out the same nonce twice.
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    signer = new ethers.NonceManager(wallet);
    log(`keeper ${wallet.address} on chain ${deployment.chainId}`);
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
