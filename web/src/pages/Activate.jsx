import { useState } from "react";
import { formatEther, maxUint256 } from "viem";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import Portrait from "../components/Portrait.jsx";
import { pad } from "../cast.js";
import { Link } from "../router.jsx";
import { SAMPLE_WHALES, ACTIVATION_COST } from "../placeholder.js";
import { publicClient, ADDRESSES, whalesAbi, erc20Abi } from "../chain.js";
import { useWhaleBalance } from "../hooks.js";
import { multiplier } from "../format.js";

const eth = (wei, d = 4) =>
  Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: d });

/* --- What activation actually switches on -------------------------------- */

/** The revenue path, as four links in a chain rather than a paragraph. */
const CHAIN = [
  ["Every trade", "2% buy, 3% sell"],
  ["Lands in the Trench", "one contract, no withdraw"],
  ["Split by weight", "across every awake whale"],
  ["Into its own wallet", "as ETH, per whale"],
];

/* --- The steps, small, at the bottom, where they belong ------------------- */

/* They were three tall cards at the top of this page: the whole first screen
   spent on instructions for a button nobody had reached yet. */
const STEPS = [
  [`Hold ${ACTIVATION_COST.toLocaleString()} $WHALE`, "in the same wallet as the whale"],
  ["Approve", "lets the contract take the burn"],
  ["Activate", "wakes it, from that block on"],
];

/* --- One whale in the showcase ------------------------------------------- */

function Tile({ whale, selected, onSelect, disabled }) {
  const awake = whale.fed;

  return (
    <article className={`tile${awake ? " awake" : ""}${selected ? " on" : ""}`}>
      <button
        type="button"
        className="tile-art"
        onClick={() => !awake && onSelect(whale.tokenId)}
        disabled={disabled || awake}
        aria-pressed={selected}
        aria-label={awake ? `Whale ${whale.tokenId}, awake` : `Select whale ${whale.tokenId}`}
      >
        <Portrait whale={whale} size={300} />

        <span className={`tile-chip mono${awake ? " on" : ""}`}>
          <span className={`pick-dot${awake ? " on" : ""}`} aria-hidden="true" />
          {awake ? multiplier(whale.weight) : "Dormant"}
        </span>

        {/* Only a tile you can act on says so, and only while you are on it. */}
        {!awake && <span className="tile-hover mono">Select to activate</span>}
      </button>

      <div className="tile-body">
        <header className="tile-head">
          <b className="display">#{pad(whale.tokenId)}</b>
          <span className="tile-tier mono">{whale.tier}</span>
        </header>

        {awake ? (
          <>
            {/* Weight against the 3.33x cap: the one number that moves on its
                own once the whale is on, so it is the one that gets a meter. */}
            <div className="strip-meter">
              <span
                className="strip-meter-fill"
                style={{ "--v": Math.min(1, whale.weight / 33_300) }}
              />
            </div>
            <dl className="tile-rows">
              <div>
                <dt className="mono">Earned</dt>
                <dd className="mono">{eth(whale.lifetimeEarned)} ETH</dd>
              </div>
              <div>
                <dt className="mono">Waiting</dt>
                <dd className="mono">{eth(whale.unclaimed)} ETH</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="tile-note mono">Earning nothing. Burn to switch it on.</p>
        )}
      </div>
    </article>
  );
}

/* --- Page ---------------------------------------------------------------- */

export default function Activate({ wallet, whales, ocean, live, onDone }) {
  const account = wallet?.account;
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  /* Connected means real, even when the honest answer is "none". The sample
     only stands in for a visitor who has not connected yet, so the page can be
     read before it can be used — never on top of a wallet's actual position. */
  const connected = Boolean(account) && live;
  const pod = connected ? whales : SAMPLE_WHALES;
  const dormant = pod.filter((w) => !w.fed);

  const tokenLive = Boolean(ocean?.whaleToken);
  const balanceWei = useWhaleBalance(account, ocean?.whaleToken, whales.length);
  const balance = connected ? Math.floor(Number(formatEther(balanceWei ?? 0n))) : 2_400_000;
  const enough = balance >= ACTIVATION_COST;
  const ready = connected && tokenLive && enough && picked !== null && !busy;

  /* Two transactions: the allowance the burn needs, then the burn. The first is
     skipped when the wallet has already given one. */
  async function activate() {
    setBusy(true);
    setMessage(null);
    try {
      const client = await wallet.client();
      const owner = client.account.address;
      const write = (address, abi, functionName, args) =>
        client.writeContract({ account: owner, address, abi, functionName, args, chain: client.chain });

      const [allowance, burn] = await Promise.all([
        publicClient.readContract({
          address: ocean.whaleToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner, ADDRESSES.whales],
        }),
        publicClient.readContract({
          address: ADDRESSES.whales,
          abi: whalesAbi,
          functionName: "ACTIVATION_BURN",
        }),
      ]);

      if (allowance < burn) {
        setMessage({ kind: "info", text: "Approving the burn — confirm the first of two." });
        const approval = await write(ocean.whaleToken, erc20Abi, "approve", [
          ADDRESSES.whales,
          maxUint256,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: approval });
      }

      const hash = await write(ADDRESSES.whales, whalesAbi, "activate", [BigInt(picked)]);
      setMessage({ kind: "info", text: `Sent ${hash.slice(0, 14)}… waiting for the block.` });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");

      setMessage({ kind: "ok", text: `Whale #${picked} is awake, from block ${receipt.blockNumber}.` });
      setPicked(null);
      onDone?.();
    } catch (e) {
      setMessage({ kind: "error", text: e.shortMessage || e.message });
    } finally {
      setBusy(false);
    }
  }

  const awake = pod.length - dormant.length;
  const chosen = pod.find((w) => w.tokenId === picked) || null;
  const earned = pod.reduce((sum, w) => sum + Number(formatEther(w.lifetimeEarned)), 0);

  return (
    <main className="sheet" id="top">
      <section className="deep sheet-head sheet-tight">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">Activate</p>
            <h1 className="display sheet-title">
              A sleeping whale <span className="tide on-dark">earns nothing.</span>
            </h1>
            <p className="lede on-dark sheet-lede">
              Burn {ACTIVATION_COST.toLocaleString()} $WHALE and yours joins the payroll. From that
              block it takes a share of the tax on every trade, in ETH, paid into its own wallet.
            </p>
          </Reveal>

          {/* The state of play on one line, rather than three panels of it. */}
          <Reveal className="tally" stagger step={50}>
            <button
              className={`tally-cell tally-wallet${account ? " on" : ""}`}
              onClick={() => !account && wallet.connect()}
              type="button"
            >
              <span className="tally-label mono">Wallet</span>
              <span className="tally-value mono">
                <span className={`pick-dot${account ? " on" : ""}`} aria-hidden="true" />
                {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Connect"}
              </span>
            </button>

            <div className="tally-cell">
              <span className="tally-label mono">$WHALE</span>
              <span className="tally-value figure">{balance.toLocaleString()}</span>
            </div>

            <div className="tally-cell">
              <span className="tally-label mono">Awake</span>
              <span className="tally-value figure">
                {awake}
                <span className="unit">/ {pod.length}</span>
              </span>
            </div>

            <div className="tally-cell">
              <span className="tally-label mono">Earned</span>
              <span className="tally-value figure">
                {earned.toFixed(3)}
                <span className="unit">ETH</span>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- The showcase -------------------------------------------------- */}
      <section className="deep sheet-tight" id="console">
        <div className="wrap">
          <Reveal className="showcase-head" stagger>
            <h2 className="display">
              Your pod. <span className="tide on-dark">{dormant.length} asleep.</span>
            </h2>
            {!connected && <span className="tag mono">Sample data</span>}
          </Reveal>

          <Reveal className="showcase" stagger step={50}>
            {pod.map((whale) => (
              <Tile
                key={whale.tokenId}
                whale={whale}
                selected={picked === whale.tokenId}
                onSelect={setPicked}
                disabled={false}
              />
            ))}
          </Reveal>

          {pod.length === 0 && (
            <p className="picker-empty">
              No whales in this wallet. Mint one for a dollar, ten a transaction, or pick one up on
              secondary.
            </p>
          )}

          {/* --- The commit ------------------------------------------------ */}
          {/* Docked under the showcase and only ever about one whale, because
              this is the single irreversible action on the site and a form that
              could mean any of six things is not one anybody should sign. */}
          <Reveal className={`dock${chosen ? " open" : ""}`}>
            <div className="dock-face">
              {chosen ? (
                <Portrait whale={chosen} size={128} className="dock-art" />
              ) : (
                <span className="dock-blank" aria-hidden="true" />
              )}

              <div className="dock-body">
                <span className="console-label mono">
                  {chosen ? `Activating #${pad(chosen.tokenId)}` : "Nothing selected"}
                </span>
                <p className="dock-line figure">
                  {ACTIVATION_COST.toLocaleString()}
                  <span className="unit">$WHALE burned</span>
                </p>
                <p className="dock-note">
                  {chosen
                    ? "Two transactions: approve the burn, then activate. The burn is permanent and it does not come to us."
                    : "Pick a dormant whale above. Nothing is signed until you press the button."}
                </p>
              </div>

              {/* The two transactions, drawn as the rail they are. */}
              <ol className="dock-steps mono">
                <li className={chosen ? "ready" : ""}>
                  <b>1</b> Approve
                </li>
                <li className={chosen ? "ready" : ""}>
                  <b>2</b> Activate
                </li>
                <li>
                  <b>3</b> On the payroll
                </li>
              </ol>

              <div className="dock-actions">
                <button className="btn btn-foam" disabled={!ready} onClick={activate}>
                  {!tokenLive
                    ? "$WHALE is not live yet"
                    : busy
                      ? "Confirm in your wallet…"
                      : ready
                        ? `Approve and activate #${pad(picked)}`
                        : "Activate"}
                </button>
                <Link className="btn btn-ghost on-dark" to="/portfolio">
                  See your position
                </Link>
              </div>
            </div>

            {message && <p className={`notice ${message.kind} dock-message`}>{message.text}</p>}
            {wallet.error && <p className="notice error dock-message">{wallet.error}</p>}
          </Reveal>
        </div>
      </section>

      {/* --- What it switches on ------------------------------------------- */}
      <section className="deep sheet-tight">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">What you switch on</p>
            <h2 className="display">
              Every trade, all the way <span className="tide on-dark">to your whale.</span>
            </h2>
          </Reveal>

          <Reveal className="flowchain" stagger step={60}>
            {CHAIN.map(([step, note], i) => (
              <div className="flowlink" key={step}>
                <span className="flowlink-n mono">{String(i + 1).padStart(2, "0")}</span>
                <b>{step}</b>
                <span className="mono">{note}</span>
              </div>
            ))}
          </Reveal>

          <Lane plane="sparse" shoal="school" seed={23} />

          <Reveal className="ticks" stagger step={40}>
            {STEPS.map(([title, note], i) => (
              <div className="tick" key={title}>
                <span className="tick-n mono">{String(i + 1).padStart(2, "0")}</span>
                <b>{title}</b>
                <span>{note}</span>
              </div>
            ))}
          </Reveal>

          <p className="trust">
            Activation burns {ACTIVATION_COST.toLocaleString()} $WHALE permanently. Selling or
            transferring the whale takes it off the payroll in the same transaction, and the loyalty
            clock starts over for whoever wakes it next.
          </p>
        </div>
      </section>
    </main>
  );
}
