import { useState } from "react";
import { formatEther } from "viem";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import { Link } from "../router.jsx";
import { publicClient, ADDRESSES, whalesAbi } from "../chain.js";
import { MINT } from "../placeholder.js";
import { GALLERY, artFor } from "../cast.js";
import { usd } from "../format.js";
import { LINKS } from "../config.js";

const MAX_PER_TX = 10;

/* --- What a whale is ------------------------------------------------------ */

const GETS = [
  ["A seat on the payroll", "Activate it and it takes a share of the tax on every trade, forever."],
  ["Its own wallet", "ERC-6551. Earnings land in the whale's wallet, not ours, not a claim queue."],
  ["A number that only falls", "1000 exist. The contract has no mint-more path and no owner to add one."],
];

/* --- Page ----------------------------------------------------------------- */

export default function Mint({ ocean, wallet, price, live, onDone }) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const account = wallet?.account;

  /* Before the contracts land, the panel shows the collection as designed
     rather than pretending to read a chain that is not there. */
  const supply = live && ocean ? Number(ocean.maxSupply) : MINT.supply;
  const minted = live && ocean ? Number(ocean.minted) : MINT.minted;
  const unit = live && ocean ? ocean.mintPrice : MINT.price;
  const left = Math.max(0, supply - minted);
  const soldOut = left === 0;
  const total = unit * BigInt(quantity);
  const pct = supply ? minted / supply : 0;

  async function mint() {
    if (!live) return;
    setBusy(true);
    setNote(null);
    try {
      const client = await wallet.client();
      const hash = await client.writeContract({
        account: client.account.address,
        address: ADDRESSES.whales,
        abi: whalesAbi,
        functionName: "mint",
        args: [BigInt(quantity)],
        value: total,
        chain: client.chain,
      });
      setNote({ kind: "info", text: `Sent ${hash.slice(0, 14)}… waiting for the block.` });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      setNote({ kind: "ok", text: `Minted in block ${receipt.blockNumber}.` });
      onDone?.();
    } catch (e) {
      setNote({ kind: "error", text: e.shortMessage || e.message });
    } finally {
      setBusy(false);
    }
  }

  const step = (by) => setQuantity((q) => Math.min(MAX_PER_TX, Math.max(1, q + by)));

  return (
    <main className="sheet" id="top">
      {/* --- The offer ----------------------------------------------------- */}
      <section className="deep sheet-head sheet-tight">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">The mint</p>
            <h1 className="display sheet-title">
              A thousand whales. <span className="tide on-dark">Then never again.</span>
            </h1>
            <p className="lede on-dark sheet-lede">
              One dollar each, ten to a transaction, no allowlist and no wallet cap. Every whale is
              born with its own on-chain wallet and a place in line for every fee the ocean ever
              collects.
            </p>
          </Reveal>

          {/* The counter. One number, at the size the number deserves. */}
          <Reveal className="counter" stagger step={60}>
            <div className="counter-figure">
              <b className="display">{minted.toLocaleString()}</b>
              <span className="counter-of display">/ {supply.toLocaleString()}</span>
            </div>

            <div className="counter-bar">
              <span className="counter-fill" style={{ "--v": pct }} />
            </div>

            <div className="counter-legs mono">
              <span>{(pct * 100).toFixed(1)}% minted</span>
              <span>{left.toLocaleString()} left</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- The gallery --------------------------------------------------- */}
      <section className="deep sheet-tight">
        <div className="wrap">
          <Reveal className="showcase-head" stagger>
            <h2 className="display">
              What is <span className="tide on-dark">down there.</span>
            </h2>
            <span className="tag mono">Traits are cosmetic. Every whale earns the same.</span>
          </Reveal>

          <Reveal className="showcase" stagger step={40}>
            {GALLERY.map(([id, name, tier]) => (
              <figure className="tile awake" key={id}>
                <div className="tile-art">
                  <div className="portrait">
                    <img
                      src={artFor(id)}
                      alt={`Whale #${id}, ${name}`}
                      width="360"
                      height="360"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
                <figcaption className="tile-body">
                  <header className="tile-head">
                    <b className="display">#{id}</b>
                    <span className="tile-tier mono">{tier}</span>
                  </header>
                  <span className="tile-note mono">{name}</span>
                </figcaption>
              </figure>
            ))}
          </Reveal>
        </div>
      </section>

      {/* --- The machine --------------------------------------------------- */}
      <section className="deep sheet-tight" id="mint">
        <div className="wrap">
          <Reveal className="minter" stagger step={70}>
            <div className="minter-face">
              <div className="minter-body">
                <span className="console-label mono">
                  {soldOut ? "Minted out" : `Mint · ${MAX_PER_TX} a transaction`}
                </span>

                <p className="minter-price figure">
                  {Number(formatEther(unit)).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                  <span className="unit">ETH each</span>
                </p>

                <p className="minter-note">
                  {soldOut
                    ? "All 1000 are out. Every one of them trades on secondary, and a whale bought there activates exactly like a whale minted here."
                    : "No allowlist, no wallet cap, no reveal delay. Your whale and its wallet exist in the same transaction."}
                </p>
              </div>

              {/* The dial. */}
              <div className="minter-dial">
                <div className="qty">
                  <button
                    type="button"
                    className="qty-step"
                    onClick={() => step(-1)}
                    disabled={quantity <= 1 || soldOut}
                    aria-label="One fewer"
                  >
                    <span aria-hidden="true">&minus;</span>
                  </button>
                  <b className="qty-value display">{quantity}</b>
                  <button
                    type="button"
                    className="qty-step"
                    onClick={() => step(1)}
                    disabled={quantity >= MAX_PER_TX || soldOut}
                    aria-label="One more"
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                </div>

                <p className="qty-total mono">
                  {Number(formatEther(total)).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}{" "}
                  ETH
                  {usd(total, price) ? ` · ${usd(total, price)}` : ""}
                </p>

                {soldOut ? (
                  <a
                    className="btn btn-foam btn-wide"
                    href={LINKS.opensea || "#"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buy one on secondary
                  </a>
                ) : !account ? (
                  <button className="btn btn-foam btn-wide" onClick={() => wallet.connect()}>
                    Connect wallet
                  </button>
                ) : (
                  <button className="btn btn-foam btn-wide" onClick={mint} disabled={busy || !live}>
                    {!live
                      ? "Not deployed yet"
                      : busy
                        ? "Confirm in your wallet"
                        : `Mint ${quantity}`}
                  </button>
                )}

                {note && <p className={`notice ${note.kind}`}>{note.text}</p>}
              </div>
            </div>

            <div className="minter-legs mono">
              <span>Price {MINT.priceLabel}</span>
              <span>Supply {supply.toLocaleString()} · fixed forever</span>
              <span>Wallet built into every whale</span>
            </div>
          </Reveal>

          <Lane plane="drift" shoal="school" seed={9} />

          {/* --- What you are actually buying ---------------------------- */}
          <Reveal stagger>
            <p className="eyebrow on-dark">What a whale is</p>
            <h2 className="display">
              A collectible that <span className="tide on-dark">draws a wage.</span>
            </h2>
          </Reveal>

          <Reveal className="ticks ticks-tall" stagger step={50}>
            {GETS.map(([title, note], i) => (
              <div className="tick" key={title}>
                <span className="tick-n mono">{String(i + 1).padStart(2, "0")}</span>
                <b>{title}</b>
                <span>{note}</span>
              </div>
            ))}
          </Reveal>

          <div className="minter-onward">
            <Link className="btn btn-ghost on-dark" to="/activate">
              Then wake it
            </Link>
            <Link className="btn btn-ghost on-dark" to="/docs">
              Read how it pays
            </Link>
          </div>

          <p className="trust">
            Minting is the only time a whale is created. The contract has no mint-more path, no owner
            and no upgrade. Nothing here is a promise of return: yield comes only from trading
            activity that may never happen.
          </p>
        </div>
      </section>
    </main>
  );
}
