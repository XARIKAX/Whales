import { useState } from "react";
import { parseEther, maxUint256, isAddress, zeroAddress } from "viem";
import { publicClient, ADDRESSES, trenchAbi, whalesAbi, erc20Abi } from "../chain.js";
import { eth } from "../format.js";

/**
 * Every button here calls a function anyone can call. The haul button is the
 * same haul the keeper bot runs — press it and the 0.5% tip is yours.
 */
export default function Actions({ ocean, wallet, onDone }) {
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [tokenId, setTokenId] = useState("");
  const [stock, setStock] = useState("");

  async function run(label, build) {
    setBusy(label);
    setMessage(null);
    try {
      const client = await wallet.client();
      const hash = await build(client, client.account.address);
      setMessage({ kind: "info", text: `Sent ${hash}. Waiting for the block…` });
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

  const write = (client, account, address, abi, functionName, args, value) =>
    client.writeContract({ account, address, abi, functionName, args, value, chain: client.chain });

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
  const activate = () =>
    run("Activate", async (client, account) => {
      const id = BigInt(tokenId);
      const allowance = await publicClient.readContract({
        address: ADDRESSES.whaleToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, ADDRESSES.whales],
      });

      if (allowance < ocean.activationBurn) {
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

      return write(client, account, ADDRESSES.whales, whalesAbi, "activate", [id]);
    });

  const haul = () =>
    run("Haul", (client, account) =>
      write(client, account, ADDRESSES.trench, trenchAbi, "haul", [])
    );

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
      <p className="notice info">
        No browser wallet detected. The dashboard reads the chain without one — connect a wallet to
        mint, feed a whale, or haul the Trench yourself.
      </p>
    );
  }

  return (
    <div className="panel" style={{ display: "grid", gap: 20 }}>
      <div className="row">
        <button className="ghost" onClick={() => wallet.connect()} disabled={Boolean(wallet.account)}>
          {wallet.account ? `connected ${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}` : "connect wallet"}
        </button>
        <button className="gold" onClick={haul} disabled={busy || !ocean?.readyToHaul}>
          {ocean?.readyToHaul ? `haul the trench — tip ${eth(tip)} ETH` : "not ready to haul"}
        </button>
      </div>

      <div className="row">
        <div className="field" style={{ maxWidth: 130 }}>
          <label htmlFor="qty">quantity</label>
          <input
            id="qty"
            type="number"
            min="1"
            max="10"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          />
        </div>
        <button onClick={mint} disabled={busy || !ocean}>
          mint {quantity} · {ocean ? eth(ocean.mintPrice * BigInt(quantity)) : "—"} ETH
        </button>
      </div>

      <div className="row">
        <div className="field" style={{ maxWidth: 130 }}>
          <label htmlFor="token">whale #</label>
          <input
            id="token"
            inputMode="numeric"
            placeholder="1"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
          />
        </div>
        <button onClick={activate} disabled={busy || !validId}>
          feed — burn 1,000,000 $WHALE
        </button>
        <button className="ghost" onClick={deliver} disabled={busy || !validId}>
          deliver
        </button>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="stock">pay this whale in (token address, blank for ETH)</label>
          <input
            id="stock"
            placeholder="0x… tokenised equity"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
        <button className="ghost" onClick={elect} disabled={busy || !validId || !validStock}>
          elect
        </button>
      </div>

      {busy && <p className="notice info">{busy} — confirm in your wallet…</p>}
      {message && <p className={`notice ${message.kind}`}>{message.text}</p>}
      {wallet.error && <p className="notice error">{wallet.error}</p>}
    </div>
  );
}
