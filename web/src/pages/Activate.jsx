import { useState } from "react";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import Creature from "../components/pixel/creature.jsx";
import { Link } from "../router.jsx";
import { SAMPLE_WHALES, ACTIVATION_COST } from "../placeholder.js";
import { eth, multiplier } from "../format.js";

/* --- The three things that have to be true ------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Hold the burn",
    body: `${ACTIVATION_COST.toLocaleString()} $WHALE, in the same wallet as the whale. Activation destroys it. It does not go to us and it does not come back.`,
  },
  {
    n: "02",
    title: "Connect that wallet",
    body: "The whale and the tokens have to be in one place. The page reads both and tells you what is missing before you sign anything.",
  },
  {
    n: "03",
    title: "Approve, then activate",
    body: "Two transactions. The first lets the contract take the burn, the second wakes the whale. From that block it is on the payroll.",
  },
];

/* --- What changes the moment it wakes ------------------------------------ */

const EFFECTS = [
  ["Weight", "0", "1.00x", "and climbing to 3.33x"],
  ["Share of every haul", "none", "by weight", "paid in ETH"],
  ["Loyalty clock", "stopped", "running", "starts at this block"],
  ["On sale", "nothing to lose", "sleeps again", "the new owner burns to wake it"],
];

/* --- One whale in the picker --------------------------------------------- */

function WhaleRow({ whale, selected, onSelect, disabled }) {
  return (
    <button
      type="button"
      className={`pick${selected ? " on" : ""}${whale.fed ? " fed" : ""}`}
      onClick={() => !whale.fed && onSelect(whale.tokenId)}
      disabled={disabled || whale.fed}
      aria-pressed={selected}
    >
      <span className="pick-art">
        <Creature kind="whale" species={whale.species} height={34} beat={2.1} />
      </span>

      <span className="pick-id">
        <b className="mono">#{whale.tokenId}</b>
        <span className="pick-tier mono">{whale.tier}</span>
      </span>

      <span className="pick-state mono">
        <span className={`pick-dot${whale.fed ? " on" : ""}`} aria-hidden="true" />
        {whale.fed ? `Awake · ${multiplier(whale.weight)}` : "Dormant"}
      </span>

      <span className="pick-go mono">{whale.fed ? "On the payroll" : "Select"}</span>
    </button>
  );
}

/* --- Page ---------------------------------------------------------------- */

export default function Activate({ wallet, whales, live }) {
  const account = wallet?.account;
  const pod = live && whales?.length ? whales : SAMPLE_WHALES;
  const dormant = pod.filter((w) => !w.fed);
  const [picked, setPicked] = useState(null);

  /* Placeholder until there is a chain to read: a wallet that holds enough to
     wake one whale, so the page can be seen in its working state. */
  const balance = live ? 0 : 2_400_000;
  const enough = balance >= ACTIVATION_COST;
  const ready = Boolean(account) && enough && picked !== null;

  return (
    <main className="sheet" id="top">
      <section className="deep sheet-head">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">Activate</p>
            <h1 className="display sheet-title">
              Wake your <span className="tide on-dark">whale.</span>
            </h1>
            <p className="lede on-dark">
              A whale earns nothing until it is fed. Burn {ACTIVATION_COST.toLocaleString()} $WHALE
              and it joins the payroll for every haul from that block on, paid in ETH into its own
              wallet.
            </p>
          </Reveal>

          <Lane plane="drift" shoal="school" seed={7} tall />

          <Reveal className="steps" stagger>
            {STEPS.map((step) => (
              <div className="step" key={step.n}>
                <div className="step-num">{step.n}</div>
                <h3 className="display">{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* --- The console ------------------------------------------------- */}
      <section className="deep" id="console">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">The console</p>
            <h2 className="display">
              Pick one, and <span className="tide on-dark">switch it on.</span>
            </h2>
          </Reveal>

          <Reveal className="console" stagger step={70}>
            {/* Wallet and balance, as an instrument rather than a form. */}
            <div className="console-rail">
              <div className="console-cell">
                <span className="console-label mono">Wallet</span>
                <span className="console-value mono">
                  <span className={`pick-dot${account ? " on" : ""}`} aria-hidden="true" />
                  {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Not connected"}
                </span>
                {!account && (
                  <button className="btn btn-navy btn-sm" onClick={() => wallet.connect()}>
                    Connect wallet
                  </button>
                )}
              </div>

              <div className="console-cell">
                <span className="console-label mono">$WHALE balance</span>
                <span className="console-value figure">
                  {balance.toLocaleString()}
                  <span className="unit">$WHALE</span>
                </span>
                <div className="strip-meter">
                  <span
                    className="strip-meter-fill"
                    style={{ "--v": Math.min(1, balance / ACTIVATION_COST) }}
                  />
                </div>
                <span className="console-note mono">
                  {enough
                    ? `Enough for ${Math.floor(balance / ACTIVATION_COST)} activation${
                        Math.floor(balance / ACTIVATION_COST) === 1 ? "" : "s"
                      }`
                    : `${(ACTIVATION_COST - balance).toLocaleString()} short`}
                </span>
              </div>

              <div className="console-cell">
                <span className="console-label mono">Dormant whales</span>
                <span className="console-value figure">
                  {dormant.length}
                  <span className="unit">of {pod.length}</span>
                </span>
                <span className="console-note mono">
                  {dormant.length ? "Waiting on a burn" : "All awake"}
                </span>
              </div>
            </div>

            {/* The picker. */}
            <div className="picker">
              <div className="picker-head">
                <span className="mono">Your whales</span>
                {!live && <span className="tag mono">Sample data</span>}
              </div>

              {pod.map((whale) => (
                <WhaleRow
                  key={whale.tokenId}
                  whale={whale}
                  selected={picked === whale.tokenId}
                  onSelect={setPicked}
                  disabled={!account}
                />
              ))}

              {pod.length === 0 && (
                <p className="picker-empty">
                  Nothing in this wallet yet. All 1000 are minted, so the way in is secondary.
                </p>
              )}
            </div>

            {/* The commit. */}
            <div className="commit">
              <div className="commit-body">
                <span className="console-label mono">To activate</span>
                <p className="commit-line figure">
                  {ACTIVATION_COST.toLocaleString()}
                  <span className="unit">$WHALE burned</span>
                </p>
                <p className="commit-note">
                  {picked !== null ? (
                    <>
                      Whale <b className="mono">#{picked}</b> joins the payroll at the next haul. The
                      burn is permanent and cannot be undone.
                    </>
                  ) : (
                    "Select a dormant whale above. Nothing is signed until you press the button."
                  )}
                </p>
              </div>

              <div className="commit-actions">
                <button className="btn btn-foam" disabled={!ready}>
                  {ready ? `Approve and activate #${picked}` : "Activate"}
                </button>
                <Link className="btn btn-ghost on-dark" to="/portfolio">
                  See your position
                </Link>
              </div>
            </div>
          </Reveal>

          <Lane plane="sparse" shoal="school" seed={23} />

          {/* What changes. */}
          <Reveal stagger>
            <h2 className="display">
              What changes at <span className="tide on-dark">that block.</span>
            </h2>
          </Reveal>

          <Reveal className="effects" stagger step={60}>
            {EFFECTS.map(([label, before, after, note]) => (
              <div className="effect" key={label}>
                <span className="console-label mono">{label}</span>
                <p className="effect-swap">
                  <span className="effect-before mono">{before}</span>
                  <span className="effect-arrow" aria-hidden="true" />
                  <span className="effect-after">{after}</span>
                </p>
                <span className="console-note mono">{note}</span>
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

export { eth };
