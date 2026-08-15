import { createPublicClient, createWalletClient, custom, http } from "viem";
import { CHAIN, ADDRESSES, PRICE_URL, PRICE_PATH } from "./config.js";
import { trenchAbi, whalesAbi, erc20Abi } from "./abi.js";

export const publicClient = createPublicClient({ chain: CHAIN, transport: http() });

export async function getWalletClient() {
  if (!window.ethereum) throw new Error("No wallet found. Install a browser wallet to sign.");
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });

  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(current, 16) !== CHAIN.id) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN.id.toString(16)}` }],
      });
    } catch {
      throw new Error(`Switch your wallet to ${CHAIN.name} (chain ${CHAIN.id}) to sign.`);
    }
  }

  return createWalletClient({ account, chain: CHAIN, transport: custom(window.ethereum) });
}

/** Header numbers: pot, threshold, all-time totals. One call. */
export async function readOcean() {
  const [block, ocean, minted, activated, burned, maxSupply, mintPrice, supply] =
    await Promise.all([
      // Ages are measured against the chain's clock, not the browser's — the
      // two drift, and on a test chain that has been time-travelled they drift
      // by weeks.
      publicClient.getBlock(),
      publicClient.readContract({ address: ADDRESSES.trench, abi: trenchAbi, functionName: "ocean" }),
      publicClient.readContract({ address: ADDRESSES.whales, abi: whalesAbi, functionName: "totalMinted" }),
      publicClient.readContract({ address: ADDRESSES.whales, abi: whalesAbi, functionName: "totalActivated" }),
      publicClient.readContract({ address: ADDRESSES.whales, abi: whalesAbi, functionName: "totalBurnedForActivation" }),
      publicClient.readContract({ address: ADDRESSES.whales, abi: whalesAbi, functionName: "MAX_SUPPLY" }),
      publicClient.readContract({ address: ADDRESSES.whales, abi: whalesAbi, functionName: "mintPrice" }),
      publicClient.readContract({ address: ADDRESSES.whaleToken, abi: erc20Abi, functionName: "totalSupply" }),
    ]);

  return {
    ...ocean,
    minted,
    activated,
    burned,
    maxSupply,
    mintPrice,
    supply,
    now: Number(block.timestamp),
  };
}

/**
 * Per-whale rows for the pod.
 *
 * Asking for all 1000 in one call exceeds the gas an `eth_call` is willing to
 * spend — every row reads the NFT, the registry and four Trench slots. Chunked,
 * each call is comfortably within budget and the chunks run concurrently.
 */
const WHALE_CHUNK = 100;

export async function readWhales(tokenIds) {
  if (tokenIds.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < tokenIds.length; i += WHALE_CHUNK) {
    chunks.push(tokenIds.slice(i, i + WHALE_CHUNK));
  }

  const results = await Promise.all(
    chunks.map((ids) =>
      publicClient.readContract({
        address: ADDRESSES.trench,
        abi: trenchAbi,
        functionName: "whaleStates",
        args: [ids],
      })
    )
  );

  return results.flat();
}

/** The whale's own art, straight off the chain. */
export async function readArt(tokenId) {
  const uri = await publicClient.readContract({
    address: ADDRESSES.whales,
    abi: whalesAbi,
    functionName: "tokenURI",
    args: [tokenId],
  });
  const json = JSON.parse(atob(uri.split(",")[1]));
  return { image: json.image, attributes: json.attributes || [] };
}

export async function readNextTierAt(tokenId) {
  return publicClient.readContract({
    address: ADDRESSES.whales,
    abi: whalesAbi,
    functionName: "nextTierAt",
    args: [tokenId],
  });
}

/**
 * ETH price in dollars, or null when no feed is configured or it is
 * unreachable. The dashboard shows ETH alone rather than a made-up number.
 */
export async function readEthPrice() {
  if (!PRICE_URL) return null;
  try {
    const response = await fetch(PRICE_URL);
    if (!response.ok) return null;
    const body = await response.json();
    const value = PRICE_PATH.split(".").reduce((node, key) => node?.[key], body);
    return typeof value === "number" && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export { ADDRESSES, trenchAbi, whalesAbi, erc20Abi };
