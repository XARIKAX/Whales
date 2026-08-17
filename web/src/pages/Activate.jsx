import { useState } from "react";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import Portrait from "../components/Portrait.jsx";
import { Link } from "../router.jsx";
import { SAMPLE_WHALES, ACTIVATION_COST } from "../placeholder.js";
import { multiplier } from "../format.js";
import { formatEther } from "viem";

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

/* --- The steps, small, at the bottom, where they belong ------------------ */

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

        {/* Only dormant whales have anything to press, so only they get the
            hover state that says so. */}
        {!awake && <span className="tile-hover mono">Select to activate</span>}
      </button>

      <div className="tile-body">
        <header className="tile-head">
          <b className="display">#{whale.id || whale.tokenId}</b>
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

export default function Activate({ wallet, whales, live }) {
  const account = wallet?.account;
  const pod = live && whales?.length ? whales : SAMPLE_WHALES;
  const dormant = pod.filter((w) => !w.fed);
  const awake = pod.length - dormant.length;
  const [picked, setPicked] = useState(null);
  const chosen = pod.find((w) => w.tokenId === picked) || null;

  /* Placeholder until there is a chain to read. */
  const balance = live ? 0 : 2_400_000;
  const enough = balance >= ACTIVATION_COST;
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

          {/* The state of play, on one line rather than three panels. */}
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
      <section className="deep sheet-tight" id="pod">
        <div className="wrap">
          <Reveal className="showcase-head" stagger>
            <h2 className="display">
              Your pod.{" "}
              <span className="tide on-dark">
                {dormant.length} asleep.
              </span>
            </h2>
            {!live && <span className="tag mono">Sample data</span>}
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
              Nothing in this wallet yet. All 1000 are minted, so the way in is secondary.
            </p>
          )}

          {/* --- The commit ------------------------------------------------ */}
          {/* Docked under the showcase and only ever about one whale, because
              this is the single irreversible action on the site and a form that
              could mean any of eight things is not one anybody should sign. */}
          <Reveal className={`dock${chosen ? " open" : ""}`}>
            <div className="dock-face">
              {chosen ? (
                <Portrait whale={chosen} size={128} className="dock-art" />
              ) : (
                <span className="dock-blank" aria-hidden="true" />
              )}

              <div className="dock-body">
                <span className="console-label mono">
                  {chosen ? `Activating #${chosen.id || chosen.tokenId}` : "Nothing selected"}
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

              {/* The two transactions, as the rail they actually are. */}
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
                <button className="btn btn-foam" disabled={!chosen || !account || !enough}>
                  {!live
                    ? "$WHALE is not live yet"
                    : chosen
                      ? `Approve and activate #${chosen.id || chosen.tokenId}`
                      : "Activate"}
                </button>
                <Link className="btn btn-ghost on-dark" to="/portfolio">
                  See your position
                </Link>
              </div>
            </div>
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

          {/* The steps, compact, at the bottom. They were three tall cards at
              the top of this page, which is a lot of room to spend on
              instructions for a button nobody had reached yet. */}
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
