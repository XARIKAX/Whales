// Everything the dashboard needs to talk to a deployment. Point these at your
// own chain with a .env file (see .env.example) — nothing is hard-coded to a
// particular network.
import { defineChain } from "viem";

const env = import.meta.env;

export const CHAIN = defineChain({
  id: Number(env.VITE_CHAIN_ID || 31337),
  name: env.VITE_CHAIN_NAME || "Hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [env.VITE_RPC_URL || "http://127.0.0.1:8545"] } },
  blockExplorers: env.VITE_EXPLORER_URL
    ? { default: { name: "Explorer", url: env.VITE_EXPLORER_URL } }
    : undefined,
});

/**
 * The three contracts this repository deploys.
 *
 * $WHALE is deliberately absent: it is launched on Flap and wired into the
 * Whales contract afterwards, so the site reads the address off the chain
 * instead of being told it. That removes the one env var that could disagree
 * with what activation actually burns.
 */
export const ADDRESSES = {
  whales: env.VITE_WHALES,
  trench: env.VITE_TRENCH,
  registry: env.VITE_REGISTRY,
};

/**
 * $WHALE's address, for display only. Nothing that moves money trusts this:
 * activation burns whatever token the Whales contract has wired in on chain,
 * and the hero prefers that same chain-read address the moment a read lands.
 * The constant exists so the CA is on the page before the first RPC round
 * trip — and still there when the RPC is down, which is exactly when people
 * double-check addresses.
 */
export const WHALE_TOKEN =
  env.VITE_WHALE_TOKEN || "0xce4e84e0775539382ba39de0b9ca6840a13d7777";

/** Whether the dashboard has enough configuration to read the chain. */
export const CONFIGURED = Object.values(ADDRESSES).every((a) => /^0x[0-9a-fA-F]{40}$/.test(a || ""));

/** Poll interval for the live pot, in milliseconds. */
export const POLL_MS = Number(env.VITE_POLL_MS || 12_000);

/**
 * `tokenURI` returns `ipfs://<cid>/0042.json`, which a browser cannot fetch and
 * an `<img src>` cannot load. Every such URI — the metadata document and the
 * `image` inside it — goes through this gateway on the way to the page.
 *
 * It is configurable because a gateway is the one part of the art path that is
 * somebody else's server: the CID is fixed and verifiable, the route to it is
 * not. Point it at your own and the site stops depending on a public one.
 */
const GATEWAY = env.VITE_IPFS_GATEWAY || "https://ipfs.io/ipfs/";
export const IPFS_GATEWAY = GATEWAY.endsWith("/") ? GATEWAY : `${GATEWAY}/`;

/** An ipfs:// URI as something the browser can actually request. */
export function resolveUri(uri) {
  if (!uri) return "";
  if (!uri.startsWith("ipfs://")) return uri;
  // Some pinning services hand back `ipfs://ipfs/<cid>`; the gateway already
  // supplies that segment, so carrying it through doubles it.
  return IPFS_GATEWAY + uri.slice(7).replace(/^ipfs\//, "");
}

/**
 * How far back to look for `Hauled` logs. Robinhood Chain makes a block every
 * 100ms, so an unbounded `getLogs` is both enormous and refused by most nodes:
 * the ledger shows a recent window rather than all history, and the all-time
 * totals beside it come from the contract, which keeps them as counters.
 */
export const LOG_LOOKBACK = BigInt(env.VITE_LOG_LOOKBACK || 500_000);

/**
 * Price feed for the dollar figures. Any endpoint returning JSON works: set
 * VITE_PRICE_PATH to the dotted path of the number inside the response.
 *
 * The default is the endpoint the default path was always written for. Leaving
 * the URL empty meant every dollar figure on the site was silently switched
 * off unless somebody remembered to set an environment variable, which is a
 * poor way to lose the headline reading on the stats panel. It still degrades
 * the same way it always did: an unreachable or malformed feed shows ETH only,
 * never an invented number.
 */
export const PRICE_URL =
  env.VITE_PRICE_URL ||
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
export const PRICE_PATH = env.VITE_PRICE_PATH || "ethereum.usd";

/**
 * Outbound links. Anything unset is simply not rendered, never a dead link.
 *
 * X and Telegram carry real defaults rather than sitting empty until somebody
 * sets an environment variable: they are this project's own accounts, not
 * deployment configuration, and a launch where the community links depend on a
 * Vercel setting being remembered is a launch with no community links. The env
 * vars stay so a fork can point them somewhere else.
 */
export const LINKS = {
  x: env.VITE_X_URL || "https://x.com/WhaleNftDotFun",
  telegram: env.VITE_TELEGRAM_URL || "https://t.me/WhaleNftDotFun",
  opensea: env.VITE_OPENSEA_URL || "https://opensea.io/collection/whalescollective",
  docs: env.VITE_DOCS_URL || "",
};

/**
 * Where "Read the docs" goes. The site carries its own docs page, so the
 * default is internal and can never be dead; VITE_DOCS_URL only exists for a
 * deployment that keeps its documentation somewhere else entirely.
 */
export const DOCS_URL = LINKS.docs || "/docs";

export const explorerUrl = (kind, value) =>
  CHAIN.blockExplorers?.default?.url ? `${CHAIN.blockExplorers.default.url}/${kind}/${value}` : null;
