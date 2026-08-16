import { useState } from "react";
import { maxUint256 } from "viem";
import {
  publicClient,
  ADDRESSES,
  trenchAbi,
  whalesAbi,
  erc20Abi,
  readAccount,
  withdrawFromWhale,
} from "../chain.js";
import { eth } from "../format.js";

const ACTIVATION_BURN = 1_000_000n * 10n ** 18n;

/**
 * Every button here calls a function anyone can call. The haul button is the
 * same haul the keeper bot runs — press it and the 0.5% tip is yours.
 */
export default function Actions({ ocean, wallet, onDone }) {
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [tokenId, setTokenId] = useState("");
  const [quantity, setQuantity] = useState("1");

  async function run(label, build) {
    setBusy(label);
    setMessage(null);
    try {
      const client = await wallet.client();
      const hash = await build(client, client.account.address);
      setMessage({ kind: "info", text: `Sent ${hash.slice(0, 14)}… waiting for the block.` });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      setMessage({ kind: "ok", text: `${label} confirmed in block ${receipt.blockNumber}.` });
      onDone?.();
    } catch (e) {
      setMessage({ kind: "error", text: e.shortMessage || e.message });
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setConnecting(true);
    try {
      await wallet.connect();
    } catch {
      /* the hook surfaces the reason */
    } finally {
      setConnecting(false);
    }
  }

  const write = (client, account, address, abi, functionName, args, value) =>
    client.writeContract({ account, address, abi, functionName, args, value, chain: client.chain });

  const haul = () =>
    run("Haul", (client, account) => write(client, account, ADDRESSES.trench, trenchAbi, "haul", []));

  /** Ten a transaction, no per-wallet limit — send it again for more. */
  const mint = () =>
    run("Mint", (client, account) =>
      write(
        client,
        account,
        ADDRESSES.whales,
        whalesAbi,
        "mint",
        [BigInt(quantity)],
        ocean.mintPrice * BigInt(quantity)
      )
    );

  /** Activation burns $WHALE, so it needs an allowance first. */
  const feed = () =>
    run("Feed", async (client, account) => {
      const allowance = await publicClient.readContract({
        address: ADDRESSES.whaleToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, ADDRESSES.whales],
      });

      if (allowance < ACTIVATION_BURN) {
        const approval = await write(
          client,
          account,
          ADDRESSES.whaleToken,
          erc20Abi,
          "approve",
          [ADDRESSES.whales, maxUint256]
        );
        await publicClient.waitForTransactionReceipt({ hash: approval });
      }

      return write(client, account, ADDRESSES.whales, whalesAbi, "activate", [BigInt(tokenId)]);
    });

  const deliver = () =>
    run("Deliver", (client, account) =>
      write(client, account, ADDRESSES.trench, trenchAbi, "deliver", [BigInt(tokenId)])
    );

  /* Deliver moves a whale's share into the whale's own wallet. This is the step
     after: the holder moving it out of that wallet and into their own. Only
     `ownerOf` can do it, on chain — the button is a convenience, not a key. */
  const withdraw = () =>
    run("Withdraw", async (client, account) => {
      const whaleAccount = await readAccount(tokenId);
      if (whaleAccount.balance === 0n) {
        throw new Error(`Whale #${tokenId}'s wallet is empty. Deliver first, or it is already out.`);
      }
      return withdrawFromWhale({
        client,
        holder: account,
        tokenId,
        whaleAccount: whaleAccount.address,
        deployed: whaleAccount.deployed,
        amount: whaleAccount.balance,
        onStep: (text) => setMessage({ kind: "info", text }),
      });
    });

  const tip = ocean ? (ocean.pot * 50n) / 10_000n : 0n;
  const validId = /^\d+$/.test(tokenId) && BigInt(tokenId) > 0n;

  const validQuantity = /^\d+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= 10;
  const soldOut = ocean ? ocean.minted >= ocean.maxSupply : false;
  const cost = ocean && validQuantity ? ocean.mintPrice * BigInt(quantity) : 0n;

  if (!wallet.available) {
    return (
      <p className="notice">
        No browser wallet detected. Everything above is read straight from the chain without one.
        Connect a wallet to mint a whale, feed it, haul the Trench, or withdraw a whale’s ETH.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, borderTop: "1px solid var(--rule-dark)", paddingTop: 26 }}>
      <div className="row">
        <button
          className={`btn btn-ghost on-dark${connecting ? " connecting" : ""}`}
          onClick={connect}
          disabled={Boolean(wallet.account) || connecting}
        >
          {wallet.account ? (
            <>
              <span className="status-dot" />
              {`${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}`}
            </>
          ) : connecting ? (
            "Connecting…"
          ) : (
            "Connect wallet"
          )}
        </button>
        <button className="btn btn-primary" onClick={haul} disabled={Boolean(busy) || !ocean?.readyToHaul}>
          {ocean?.readyToHaul ? (
            <>
              Haul the Trench, keep <span className="tip num">{eth(tip)} ETH</span>
            </>
          ) : (
            "Net not full yet"
          )}
        </button>
      </div>

      <div className="row">
        <div className="field" style={{ maxWidth: 140 }}>
          <label htmlFor="quantity">How many (max 10)</label>
          <input
            id="quantity"
            inputMode="numeric"
            placeholder="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={mint}
          disabled={Boolean(busy) || !validQuantity || soldOut || !ocean}
        >
          {soldOut ? (
            "All 1000 minted"
          ) : (
            <>
              Mint · <span className="num">{eth(cost)} ETH</span>
            </>
          )}
        </button>
      </div>

      <div className="row">
        <div className="field" style={{ maxWidth: 140 }}>
          <label htmlFor="token">Whale #</label>
          <input
            id="token"
            inputMode="numeric"
            placeholder="1"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
        </div>
        <button className="btn btn-navy" onClick={feed} disabled={Boolean(busy) || !validId}>
          Feed · burn 1,000,000 $WHALE
        </button>
        <button className="btn btn-ghost on-dark" onClick={deliver} disabled={Boolean(busy) || !validId}>
          Deliver
        </button>
        <button className="btn btn-ghost on-dark" onClick={withdraw} disabled={Boolean(busy) || !validId}>
          Withdraw to my wallet
        </button>
      </div>

      {busy && <p className="notice">{busy}, confirm in your wallet…</p>}
      {message && <p className={`notice ${message.kind}`}>{message.text}</p>}
      {wallet.error && <p className="notice error">{wallet.error}</p>}
    </div>
  );
}
