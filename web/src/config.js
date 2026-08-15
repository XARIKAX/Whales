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

export const ADDRESSES = {
  whaleToken: env.VITE_WHALE_TOKEN,
  whales: env.VITE_WHALES,
  trench: env.VITE_TRENCH,
  registry: env.VITE_REGISTRY,
};

/** Whether the dashboard has enough configuration to read the chain. */
export const CONFIGURED = Object.values(ADDRESSES).every((a) => /^0x[0-9a-fA-F]{40}$/.test(a || ""));

/** Poll interval for the live pot, in milliseconds. */
export const POLL_MS = Number(env.VITE_POLL_MS || 12_000);

/**
 * Price feed for the dollar figures. Any endpoint returning JSON works — set
 * VITE_PRICE_PATH to the dotted path of the number inside the response. When
 * unset, or when the request fails, the dashboard shows ETH only rather than
 * inventing a number.
 */
export const PRICE_URL = env.VITE_PRICE_URL || "";
export const PRICE_PATH = env.VITE_PRICE_PATH || "ethereum.usd";

/** Outbound links. Anything unset is simply not rendered, never a dead link. */
export const LINKS = {
  x: env.VITE_X_URL || "",
  opensea: env.VITE_OPENSEA_URL || "",
  docs: env.VITE_DOCS_URL || "",
};

/** "Read the docs" falls back to the on-page explainer so it is never dead. */
export const DOCS_URL = LINKS.docs || "#how";

export const explorerUrl = (kind, value) =>
  CHAIN.blockExplorers?.default?.url ? `${CHAIN.blockExplorers.default.url}/${kind}/${value}` : null;
