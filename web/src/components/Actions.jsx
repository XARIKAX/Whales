import { useState } from "react";
import { maxUint256, isAddress, zeroAddress } from "viem";
import { publicClient, ADDRESSES, trenchAbi, whalesAbi, erc20Abi } from "../chain.js";
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
  const [stock, setStock] = useState("");

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

  const elect = () =>
    run("Elect", (client, account) =>
      write(client, account, ADDRESSES.trench, trenchAbi, "electStock", [
        BigInt(tokenId),
        stock.trim() === "" ? zeroAddress : stock.trim(),
      ])
    );

  const tip = ocean ? (ocean.pot * 50n) / 10_000n : 0n;
  const validId = /^\d+$/.test(tokenId) && BigInt(tokenId) > 0n;
  const validStock = stock.trim() === "" || isAddress(stock.trim());

  if (!wallet.available) {
    return (
      <p className="notice">
        No browser wallet detected. Everything above is read straight from the chain without one —
        connect a wallet to feed a whale, haul the Trench, or elect a stock.
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
              Haul the Trench — keep <span className="tip num">{eth(tip)} ETH</span>
            </>
          ) : (
            "Net not full yet"
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
          Feed — burn 1,000,000 $WHALE
        </button>
        <button className="btn btn-ghost on-dark" onClick={deliver} disabled={Boolean(busy) || !validId}>
          Deliver
        </button>
      </div>

      <div className="row">
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="stock">Pay this whale in (token address, blank for ETH)</label>
          <input
            id="stock"
            placeholder="0x… tokenised equity"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
        <button
          className="btn btn-ghost on-dark"
          onClick={elect}
          disabled={Boolean(busy) || !validId || !validStock}
        >
          Elect
        </button>
      </div>

      {busy && <p className="notice">{busy} — confirm in your wallet…</p>}
      {message && <p className={`notice ${message.kind}`}>{message.text}</p>}
      {wallet.error && <p className="notice error">{wallet.error}</p>}
    </div>
  );
}
