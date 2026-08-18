#!/usr/bin/env node
//
// The town crier. It watches the chain and tells the Telegram group what just
// happened: a whale woke up (and what it burned to do it), a haul split the
// pot, ETH landed in whale wallets. It has no keys and sends no transactions —
// read the chain, post the news, remember where it got to.
//
//   RPC_URL=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node bot.js
//
// Addresses come from ../contracts/deployments/robinhood.json when it exists,
// or from WHALES_ADDRESS / TRENCH_ADDRESS in the environment.
//
// Flags:
//   --once      one poll and exit (for cron)
//   --dry-run   print what it would post, send nothing
//   --from N    start from block N instead of the saved cursor / chain head

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const WHALES_ABI = [
  "event Activated(uint256 indexed tokenId, address indexed holder, uint256 burned)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "function totalActivated() view returns (uint256)",
  "function totalBurnedForActivation() view returns (uint256)",
];

/**
 * Seaport's receipt, for telling a sale from a wallet shuffle.
 *
 * Every OpenSea sale settles through Seaport, which emits OrderFulfilled with
 * the items and the money in one log. A plain transfer has no such log. So:
 * a Transfer of one of our whales whose transaction also carries an
 * OrderFulfilled is a sale, priced by the currency items in that order — and
 * a Transfer without one is somebody moving a whale between their own
 * wallets, which is nobody's news.
 *
 * Matched by event shape rather than by contract address, so it keeps working
 * whichever Seaport version OpenSea points this chain at.
 */
const seaport = new ethers.Interface([
  "event OrderFulfilled(bytes32 orderHash, address indexed offerer, address indexed zone, address recipient, (uint8 itemType, address token, uint256 identifier, uint256 amount)[] offer, (uint8 itemType, address token, uint256 identifier, uint256 amount, address recipient)[] consideration)",
]);
const ORDER_FULFILLED = seaport.getEvent("OrderFulfilled").topicHash;

/** ETH (or 18-decimal wrapped ETH) paid in one fulfilled order. */
function orderPayment(order) {
  const currency = (items) =>
    items.reduce(
      (sum, item) => sum + (item.itemType === 0n || item.itemType === 1n ? item.amount : 0n),
      0n
    );
  // A listing carries the money in the consideration; an accepted offer
  // carries it in the offer — but its consideration still carries the *fees*,
  // so "whichever side is non-zero" under-reports an accepted offer. The
  // full price is always the larger currency side.
  const offered = currency(order.offer);
  const considered = currency(order.consideration);
  return offered > considered ? offered : considered;
}
const TRENCH_ABI = [
  "event Hauled(address indexed keeper, uint256 pot, uint256 distributed, uint256 tip, uint256 totalWeight)",
  "event Delivered(uint256 indexed tokenId, address indexed account, uint256 amount)",
  "function ocean() view returns (tuple(uint256 pot, uint256 haulThreshold, bool readyToHaul, uint256 totalWeight, uint256 activeWhales, uint256 totalReceived, uint256 totalDistributed, uint256 totalDelivered, uint256 totalTipped, uint256 haulCount, uint256 lastHaulAt, uint256 reserved))",
];

const SUPPLY = 1_000_000_000; // $WHALE at launch, for the burn percentage
const POLL_MS = Number(process.env.POLL_MS || 15_000);
const MAX_RANGE = Number(process.env.MAX_RANGE || 5_000); // blocks per getLogs
const STATE_FILE = path.join(__dirname, "state.json");
const SITE = process.env.SITE_URL || "https://whalenft.fun";
const EXPLORER = process.env.EXPLORER_URL || "https://robinhoodchain.blockscout.com";
const OPENSEA = process.env.OPENSEA_URL || "https://opensea.io/collection/whalescollective";
/* The per-item page, when the URL shape for this chain is known — set it to
   everything before the token id (e.g. https://opensea.io/item/<chain>/<contract>)
   and the id is appended. Unset, sale links go to the collection, which is
   always right even when it is not precise. */
const OPENSEA_ITEM = (process.env.OPENSEA_ITEM_BASE || "").replace(/\/$/, "");

const ONCE = process.argv.includes("--once");
const DRY_RUN = process.argv.includes("--dry-run");
const FROM = (() => {
  const i = process.argv.indexOf("--from");
  return i === -1 ? null : Number(process.argv[i + 1]);
})();

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* --- Where the addresses come from --------------------------------------- */

function loadAddresses() {
  const file = process.env.DEPLOYMENT
    ? path.resolve(process.env.DEPLOYMENT)
    : path.join(__dirname, "..", "contracts", "deployments", "robinhood.json");
  if (fs.existsSync(file)) {
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    return { whales: d.contracts.whales, trench: d.contracts.trench };
  }
  const { WHALES_ADDRESS, TRENCH_ADDRESS } = process.env;
  if (!WHALES_ADDRESS || !TRENCH_ADDRESS) {
    throw new Error(
      "No deployments/robinhood.json found. Set WHALES_ADDRESS and TRENCH_ADDRESS."
    );
  }
  return { whales: WHALES_ADDRESS, trench: TRENCH_ADDRESS };
}

/* --- The cursor ----------------------------------------------------------- */
/* Persisted so a restart resumes where it left off instead of reposting
   everything since launch, or silently skipping what happened while it was
   down. */

function loadCursor() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")).lastBlock;
  } catch {
    return null;
  }
}

function saveCursor(lastBlock) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastBlock }));
}

/* --- Telegram ------------------------------------------------------------- */

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

async function send({ text, photo }) {
  if (DRY_RUN) {
    log("would post:" + (photo ? ` [photo ${photo}]` : "") + "\n" + text);
    return;
  }
  const method = photo ? "sendPhoto" : "sendMessage";
  const payload = photo
    ? { chat_id: TG_CHAT, photo, caption: text, parse_mode: "HTML" }
    : {
        chat_id: TG_CHAT,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      };
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!body.ok) {
    // A picture Telegram cannot fetch must not cost the announcement: fall
    // back to the same message as plain text.
    if (photo) return send({ text });
    throw new Error(`telegram: ${body.description}`);
  }
}

/* Telegram allows ~20 messages a minute into one group. A burst of
   activations — a whale-waking spree is the good scenario — goes out as a
   queue with a gap, not a hail of 429s. */
const queue = [];
let draining = false;

async function post(text, photo) {
  queue.push({ text, photo });
  if (draining) return;
  draining = true;
  while (queue.length) {
    try {
      await send(queue.shift());
    } catch (e) {
      log("post failed:", e.message);
    }
    if (queue.length) await new Promise((r) => setTimeout(r, 3_500));
  }
  draining = false;
}

/* --- Formatting ----------------------------------------------------------- */

const fmt = (n, d = 4) =>
  Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
const eth = (wei, d = 4) => fmt(ethers.formatEther(wei), d);
const pad = (id) => String(id).padStart(4, "0");
const tx = (hash) => `<a href="${EXPLORER}/tx/${hash}">tx</a>`;

async function usd(wei) {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    const price = (await res.json())?.ethereum?.usd;
    if (!price) return "";
    return ` ($${fmt(Number(ethers.formatEther(wei)) * price, 0)})`;
  } catch {
    return ""; // ETH alone is the truth; dollars are a courtesy
  }
}

/* --- One poll ------------------------------------------------------------- */

async function pass(ctx) {
  const head = await ctx.provider.getBlockNumber();
  if (ctx.cursor === null) {
    // First run with no saved state: start from now. Replaying history into
    // a live group is noise, not news.
    ctx.cursor = head;
    saveCursor(head);
    log(`starting fresh at block ${head}`);
    return;
  }
  if (head <= ctx.cursor) return;

  for (let from = ctx.cursor + 1; from <= head; from += MAX_RANGE) {
    const to = Math.min(from + MAX_RANGE - 1, head);

    const [activations, hauls, deliveries, transfers] = await Promise.all([
      ctx.whales.queryFilter(ctx.whales.filters.Activated(), from, to),
      ctx.trench.queryFilter(ctx.trench.filters.Hauled(), from, to),
      ctx.trench.queryFilter(ctx.trench.filters.Delivered(), from, to),
      ctx.whales.queryFilter(ctx.whales.filters.Transfer(), from, to),
    ]);

    for (const ev of activations) {
      // Totals read at the current head rather than carried in the event —
      // close enough for a group message, and always self-consistent.
      const [active, burned] = await Promise.all([
        ctx.whales.totalActivated(),
        ctx.whales.totalBurnedForActivation(),
      ]);
      const burnedM = Number(ethers.formatEther(burned)) / 1e6;
      const pct = fmt((Number(ethers.formatEther(burned)) / SUPPLY) * 100, 2);
      await post(
        `⚡🐋 <b>Whale #${pad(ev.args.tokenId)} is awake!</b>\n` +
          `🔥 1,000,000 $WHALE burned forever\n\n` +
          `On the payroll: <b>${active} / 1000</b>\n` +
          `Total burned: <b>${fmt(burnedM, 0)}M $WHALE</b> — ${pct}% of supply, gone for good\n\n` +
          `${tx(ev.transactionHash)} · <a href="${SITE}/activate">wake yours</a>`
      );
    }

    for (const ev of hauls) {
      const dollars = await usd(ev.args.distributed);
      const ocean = await ctx.trench.ocean();
      await post(
        `🌊💰 <b>Haul #${ocean.haulCount}!</b>\n\n` +
          `<b>${eth(ev.args.distributed)} ETH</b>${dollars} split across the pod, by weight\n` +
          `Keeper's tip: ${eth(ev.args.tip)} ETH\n\n` +
          `All time: <b>${eth(ocean.totalDistributed)} ETH</b> paid to whales\n\n` +
          `${tx(ev.transactionHash)} · <a href="${SITE}">whalenft.fun</a>`
      );
    }

    // Deliveries arrive in batches of up to 50 — one message per wallet would
    // drown the group. One line per transaction tells the same story.
    const byTx = new Map();
    for (const ev of deliveries) {
      const entry = byTx.get(ev.transactionHash) || { count: 0, total: 0n };
      entry.count += 1;
      entry.total += ev.args.amount;
      byTx.set(ev.transactionHash, entry);
    }
    for (const [hash, { count, total }] of byTx) {
      const dollars = await usd(total);
      await post(
        `📬 <b>${eth(total)} ETH</b>${dollars} delivered into <b>${count}</b> whale wallet${count === 1 ? "" : "s"}\n` +
          `Straight to each whale's own on-chain wallet. Nobody claimed anything.\n\n` +
          `${tx(hash)}`
      );
    }

    // Sales: transfers grouped by transaction, then checked for a Seaport
    // receipt. Mints come from the zero address and are skipped; a sweep of
    // several whales in one order becomes one message rather than one each.
    const moved = new Map();
    for (const ev of transfers) {
      if (ev.args.from === ethers.ZeroAddress) continue;
      const entry = moved.get(ev.transactionHash) || { ids: [], buyer: ev.args.to };
      entry.ids.push(ev.args.tokenId);
      moved.set(ev.transactionHash, entry);
    }
    for (const [hash, { ids, buyer }] of moved) {
      const receipt = await ctx.provider.getTransactionReceipt(hash).catch(() => null);
      const orders = (receipt?.logs || []).filter((l) => l.topics[0] === ORDER_FULFILLED);
      if (orders.length === 0) continue; // a wallet shuffle, not a sale

      let paid = 0n;
      for (const l of orders) paid += orderPayment(seaport.parseLog(l).args);
      const dollars = await usd(paid);
      const captain = `${buyer.slice(0, 6)}…${buyer.slice(-4)}`;
      const shop = OPENSEA_ITEM ? `${OPENSEA_ITEM}/${ids[0]}` : OPENSEA;
      const links = `${tx(hash)} · <a href="${shop}">OpenSea</a> · <a href="${SITE}">whalenft.fun</a>`;

      // The sold whale's own art rides along — the collection is self-hosted,
      // so the picture is one predictable URL away. A sweep shows its first
      // whale rather than a collage nobody is going to build.
      const portrait = `${SITE}/whales/${pad(ids[0])}.png`;

      await post(
        ids.length === 1
          ? `💸🐋 <b>Whale #${pad(ids[0])} just sold for ${eth(paid)} ETH</b>${dollars}!\n` +
              `New captain: <code>${captain}</code>\n\n${links}`
          : `💸🐋 <b>${ids.length} whales swept for ${eth(paid)} ETH</b>${dollars}!\n` +
              `${ids.map((id) => `#${pad(id)}`).join(", ")} → <code>${captain}</code>\n\n${links}`,
        portrait
      );
    }

    ctx.cursor = to;
    saveCursor(to);
  }
}

/* --- Main ----------------------------------------------------------------- */

async function main() {
  if (!process.env.RPC_URL) throw new Error("set RPC_URL");
  if (!DRY_RUN && (!TG_TOKEN || !TG_CHAT)) {
    throw new Error("set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or pass --dry-run)");
  }

  const addresses = loadAddresses();
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const ctx = {
    provider,
    whales: new ethers.Contract(addresses.whales, WHALES_ABI, provider),
    trench: new ethers.Contract(addresses.trench, TRENCH_ABI, provider),
    cursor: FROM !== null ? FROM - 1 : loadCursor(),
  };

  log(`watching whales=${addresses.whales} trench=${addresses.trench}`);

  for (;;) {
    try {
      await pass(ctx);
    } catch (e) {
      // A failed poll is not fatal — the cursor did not advance past anything
      // unposted, so the next pass picks up exactly where this one broke.
      log("pass failed:", e.shortMessage || e.message);
    }
    if (ONCE) return;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
