import { createPublicClient, http } from "viem";
import { CHAIN, ADDRESSES, PRICE_URL, PRICE_PATH, LOG_LOOKBACK, resolveUri } from "./config.js";
import { trenchAbi, whalesAbi, erc20Abi, whaleAccountAbi, registryAbi } from "./abi.js";

const ZERO = "0x0000000000000000000000000000000000000000";

export const publicClient = createPublicClient({ chain: CHAIN, transport: http() });

/**
 * A signer for the connected wallet.
 *
 * Everything that writes goes through here, and it stays a plain async function
 * rather than a hook because half its callers are event handlers rather than
 * components.
 *
 * wagmi is imported *here*, inside the call, and that import is load-bearing
 * rather than stylistic. This module is reached from `hooks.js` on every page,
 * so a top-level `import` of wagmi put the whole wallet stack — connectors,
 * WalletConnect's core, all of it — into the first chunk of a documentation
 * page that never signs anything. Deferring it to the one function that
 * actually needs a signer is what keeps the reading pages light.
 *
 * The chain switch is not optional. A wallet left on another network will
 * happily sign against addresses that do not exist there, and it surfaces as an
 * unexplained revert rather than "you are on the wrong network" — cheaper to
 * move the wallet than to explain afterwards.
 */
export async function getWalletClient() {
  const [core, { wagmiConfig }] = await Promise.all([import("@wagmi/core"), import("./wagmi.js")]);

  const { address, chainId } = core.getAccount(wagmiConfig);
  if (!address) throw new Error("Connect a wallet to sign.");

  if (chainId !== CHAIN.id) {
    try {
      await core.switchChain(wagmiConfig, { chainId: CHAIN.id });
    } catch {
      throw new Error(`Switch your wallet to ${CHAIN.name} (chain ${CHAIN.id}) to sign.`);
    }
  }

  const client = await core.getWalletClient(wagmiConfig, { chainId: CHAIN.id });
  if (!client) throw new Error(`This wallet cannot sign on ${CHAIN.name}.`);
  return client;
}

/** Header numbers: pot, threshold, all-time totals. One call. */
export async function readOcean() {
  const [block, ocean, minted, activated, burned, maxSupply, mintPrice, whaleToken] =
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
      publicClient.readContract({ address: ADDRESSES.whales, abi: whalesAbi, functionName: "whaleToken" }),
    ]);

  // Null until Flap has launched and the token has been wired in. Everything
  // except activation works in that window, so the pages check rather than
  // assume.
  const live = whaleToken && whaleToken !== ZERO;
  const supply = live
    ? await publicClient.readContract({ address: whaleToken, abi: erc20Abi, functionName: "totalSupply" })
    : null;

  return {
    ...ocean,
    minted,
    activated,
    burned,
    maxSupply,
    mintPrice,
    whaleToken: live ? whaleToken : null,
    supply,
    now: Number(block.timestamp),
    block: block.number,
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

/**
 * A metadata document, wherever `tokenURI` says it lives.
 *
 * The collection is pinned to IPFS, so in practice this is one gateway fetch.
 * `data:` is handled too because a chain read should not care how the URI was
 * built, and an on-chain deployment of the same contracts would return one.
 */
async function readMetadata(uri) {
  if (uri.startsWith("data:")) {
    const encoded = uri.slice(uri.indexOf(",") + 1);
    return JSON.parse(uri.slice(0, uri.indexOf(",")).includes(";base64") ? atob(encoded) : decodeURIComponent(encoded));
  }

  const response = await fetch(resolveUri(uri));
  if (!response.ok) throw new Error(`metadata ${response.status} for ${uri}`);
  return response.json();
}

/** The whale's own art and traits, from the URI the contract serves. */
export async function readArt(tokenId) {
  const uri = await publicClient.readContract({
    address: ADDRESSES.whales,
    abi: whalesAbi,
    functionName: "tokenURI",
    args: [tokenId],
  });

  const json = await readMetadata(uri);
  // The `image` inside is itself an ipfs:// URI, and it is going into an
  // <img src> that has no idea what that scheme is.
  return { image: resolveUri(json.image), attributes: json.attributes || [] };
}

/** A wallet's $WHALE, for the burn the activate page has to check against. */
export async function readWhaleBalance(account, whaleToken) {
  if (!whaleToken) return null;
  return publicClient.readContract({
    address: whaleToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
}

/**
 * Recent hauls, newest first, read from the contract's own logs.
 *
 * Bounded to a window rather than all history — see LOG_LOOKBACK. Returns an
 * empty list rather than throwing when a node refuses the range, because the
 * ledger is a supporting detail and the page's real numbers come from `ocean`.
 */
export async function readHauls(limit = 8) {
  try {
    const head = await publicClient.getBlockNumber();
    const fromBlock = head > LOG_LOOKBACK ? head - LOG_LOOKBACK : 0n;

    const logs = await publicClient.getLogs({
      address: ADDRESSES.trench,
      event: trenchAbi.find((entry) => entry.type === "event" && entry.name === "Hauled"),
      fromBlock,
      toBlock: head,
    });

    return logs
      .slice(-limit)
      .reverse()
      .map((log) => ({
        block: log.blockNumber,
        keeper: log.args.keeper,
        pot: log.args.pot,
        distributed: log.args.distributed,
        tip: log.args.tip,
        totalWeight: log.args.totalWeight,
      }));
  } catch {
    return [];
  }
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

/** Where a whale's wallet is, and whether it exists yet. */
export async function readAccount(tokenId) {
  const address = await publicClient.readContract({
    address: ADDRESSES.registry,
    abi: registryAbi,
    functionName: "accountOf",
    args: [BigInt(tokenId)],
  });
  const [balance, code] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.getBytecode({ address }),
  ]);
  return { address, balance, deployed: Boolean(code && code !== "0x") };
}

/**
 * Move a whale's ETH out of its own wallet and into the holder's.
 *
 * `execute` is restricted on chain to `ownerOf(tokenId)`, so this is a call
 * only the holder can make — the dashboard is not being trusted with anything.
 *
 * Two transactions the first time: a whale's wallet address is fixed from the
 * moment the token exists, and ETH can arrive there before any code does, so
 * the account has to be created before it can be spent from. After that it is
 * one. `createAccount` is permissionless and idempotent.
 */
export async function withdrawFromWhale({ client, holder, tokenId, whaleAccount, deployed, amount, onStep }) {
  if (!deployed) {
    onStep?.("Creating the whale's wallet. Confirm the first of two.");
    const created = await client.writeContract({
      account: holder,
      address: ADDRESSES.registry,
      abi: registryAbi,
      functionName: "createAccount",
      args: [BigInt(tokenId)],
      chain: client.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: created });
  }

  return client.writeContract({
    account: holder,
    address: whaleAccount,
    abi: whaleAccountAbi,
    functionName: "execute",
    args: [holder, amount, "0x"],
    chain: client.chain,
  });
}

export { ADDRESSES, trenchAbi, whalesAbi, erc20Abi, whaleAccountAbi, registryAbi };
