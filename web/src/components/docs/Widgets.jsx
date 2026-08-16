import { useEffect, useMemo, useRef, useState } from "react";
import { copy, useNear } from "./reading.js";
import { Live } from "./Bits.jsx";

/**
 * The three things a reader is asked to take on faith, made touchable.
 *
 * Everything here computes from the same constants the contracts use, in the
 * browser, with no network call — so the answer a reader gets by dragging a
 * slider is the answer the chain gives, not a number typed into a mock. Each
 * one degrades to something readable: before it is near the viewport, and with
 * JavaScript off entirely, the card still states its own conclusion.
 */

const TIP_BPS = 50; // 0.5%, from Trench.sol
const CAP = 3.33;

/** The loyalty schedule out of `Whales.sol`, shared with Fig. 3. */
export const TIERS = [
  ["Day 0", 0, 1.0],
  ["7d", 7, 1.25],
  ["14d", 14, 1.5],
  ["30d", 30, 1.8],
  ["60d", 60, 2.15],
  ["90d", 90, 2.5],
  ["180d", 180, 2.9],
  ["365d", 365, 3.33],
];

export function weightAt(days) {
  let w = 1;
  for (const [, at, weight] of TIERS) if (days >= at) w = weight;
  return w;
}

/* --- Shared chrome -------------------------------------------------------- */

/**
 * The frame every widget sits in.
 *
 * `INTERACTIVE` is the promise the eyebrow makes, so it only appears once the
 * thing under it actually is — a card that says interactive while it is still a
 * paragraph is worse than one that says nothing.
 */
function Widget({ title, hint, children, fallback }) {
  const ref = useRef(null);
  const near = useNear(ref);

  return (
    <section className="widget" ref={ref}>
      <header className="widget-head">
        <span className="widget-tag mono">{near ? "Interactive" : "Loading"}</span>
        <h4 className="widget-title">{title}</h4>
        {hint && <p className="widget-hint mono">{hint}</p>}
      </header>
      <div className="widget-body">{near ? children : fallback}</div>
    </section>
  );
}

/** One labelled control. The value is repeated in mono so it reads as a gauge. */
function Dial({ label, value, display, min, max, step = 1, onChange, id }) {
  return (
    <div className="dial">
      <label className="dial-label mono" htmlFor={id}>
        {label}
      </label>
      <output className="dial-value figure" htmlFor={id}>
        {display}
      </output>
      <input
        className="dial-range"
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

const eth = (n) => (n < 0.001 ? n.toFixed(6) : n < 1 ? n.toFixed(4) : n.toFixed(3));

/* --- 1. The haul simulator ------------------------------------------------ */

/**
 * What one haul pays.
 *
 * The pod is modelled as everybody else at 1.00x and you at whichever weight is
 * being compared, which is the honest worst case for the 3.33x figure: if the
 * rest of the pod has also been loyal, the gap between the two rows closes. The
 * assumption is stated on the card rather than buried here.
 */
function HaulSim({ ocean }) {
  const [pot, setPot] = useState(10);
  const [pod, setPod] = useState(120);
  const [touched, setTouched] = useState(false);

  /* Seeded from the chain the first time a real pot arrives, and never again —
     a dial that keeps snapping back to a polled value while somebody is
     dragging it is a dial that is fighting them. */
  const livePot = ocean ? Number(ocean.pot) / 1e18 : null;
  useEffect(() => {
    if (!touched && livePot !== null) setPot(Math.min(100, Math.max(0.1, Number(livePot.toFixed(1)))));
  }, [livePot, touched]);

  const take = (setter) => (v) => {
    setTouched(true);
    setter(v);
  };

  const { tip, pool, base, loyal, lead } = useMemo(() => {
    const tipCut = (pot * TIP_BPS) / 10_000;
    const share = pot - tipCut;
    const others = Math.max(0, pod - 1);
    const one = share / Math.max(1, others + 1);
    const max = (share * CAP) / (others + CAP);
    return { tip: tipCut, pool: share, base: one, loyal: max, lead: max / one };
  }, [pot, pod]);

  return (
    <div className="sim">
      {/* The one number on this page that comes off the chain. Before there is
          a chain it says so rather than showing a zero. */}
      <p className="sim-live mono">
        <span>Pot in the Trench right now</span>
        <Live
          value={livePot === null ? undefined : eth(livePot)}
          unit="ETH"
          block={ocean?.block?.toString()}
          label="The pot currently in the Trench"
        />
      </p>

      <div className="sim-dials">
        <Dial
          id="sim-pot"
          label="Pot at the haul"
          value={pot}
          display={
            <>
              {pot.toFixed(2)}
              <span className="unit">ETH</span>
            </>
          }
          min={0.1}
          max={100}
          step={0.1}
          onChange={take(setPot)}
        />
        <Dial
          id="sim-pod"
          label="Activated whales"
          value={pod}
          display={
            <>
              {pod}
              <span className="unit">of 1000</span>
            </>
          }
          min={1}
          max={1000}
          onChange={take(setPod)}
        />
      </div>

      <div className="sim-out">
        <div className="sim-row">
          <span className="sim-k mono">Your cut at 1.00x</span>
          <span className="sim-v figure">
            {eth(base)}
            <span className="unit">ETH</span>
          </span>
        </div>
        <div className="sim-row gold">
          <span className="sim-k mono">Your cut at 3.33x</span>
          <span className="sim-v figure">
            {eth(loyal)}
            <span className="unit">ETH</span>
          </span>
        </div>
        <div className="sim-row quiet">
          <span className="sim-k mono">To whoever hauled</span>
          <span className="sim-v figure">
            {eth(tip)}
            <span className="unit">ETH</span>
          </span>
        </div>
        <div className="sim-row quiet">
          <span className="sim-k mono">Split across the pod</span>
          <span className="sim-v figure">
            {eth(pool)}
            <span className="unit">ETH</span>
          </span>
        </div>
      </div>

      <p className="sim-note mono">
        {lead.toFixed(2)}× the same pot, for the same whale, on the strength of time fed alone.
        Modelled with the rest of the pod at 1.00x.
      </p>
    </div>
  );
}

/* --- 2. The loyalty scrubber ---------------------------------------------- */

/* The plot stops well short of the viewBox: the last 130 units are the
   whale's lane. Sharing the space put a glowing sprite on top of the one
   part of the figure the widget exists to show. */
const CURVE = { x0: 36, x1: 500, y0: 24, y1: 150 };
const cx = (d) => CURVE.x0 + (d / 365) * (CURVE.x1 - CURVE.x0);
const cy = (w) => CURVE.y1 - ((w - 1) / (CAP - 1)) * (CURVE.y1 - CURVE.y0);

/**
 * The weight curve with a handle on it.
 *
 * Plotted against real days rather than evenly spaced tiers, because the point
 * of dragging is to feel how long the last stretch is — the jump from 2.90x to
 * the cap takes longer than every earlier tier put together, and an evenly
 * spaced axis hides exactly that.
 *
 * The handle is a real range input under the plot rather than a drag handler on
 * the SVG. That is the whole keyboard story, the whole touch story and the
 * whole screen-reader story for free, and it cannot get stuck mid-drag.
 */
function Scrubber() {
  const [days, setDays] = useState(96);
  const w = weightAt(days);
  const glow = (w - 1) / (CAP - 1);

  const path = useMemo(() => {
    const d = [`M ${cx(0)} ${cy(1)}`];
    TIERS.slice(1).forEach(([, at, weight], i) => {
      d.push(`L ${cx(at)} ${cy(TIERS[i][2])}`, `L ${cx(at)} ${cy(weight)}`);
    });
    d.push(`L ${cx(365)} ${cy(CAP)}`);
    return d.join(" ");
  }, []);

  return (
    <div className="scrub">
      <div className="scrub-plot">
        <svg viewBox="0 0 640 176" className="scrub-svg" aria-hidden="true">
          <line
            x1={CURVE.x0}
            x2={CURVE.x1}
            y1={cy(CAP)}
            y2={cy(CAP)}
            stroke="rgba(190,231,245,0.16)"
            strokeDasharray="3 5"
          />
          <line
            x1={CURVE.x0}
            x2={CURVE.x1}
            y1={cy(1)}
            y2={cy(1)}
            stroke="rgba(190,231,245,0.16)"
          />
          <path d={`${path} L ${cx(365)} ${cy(1)} Z`} fill="rgba(244,197,66,0.1)" />
          <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2" />

          {/* Where the handle is. The rule is drawn full height so the reading
              is unambiguous at any weight. */}
          <line
            className="scrub-rule"
            x1={cx(days)}
            x2={cx(days)}
            y1={CURVE.y0 - 8}
            y2={CURVE.y1}
          />
          <circle className="scrub-dot" cx={cx(days)} cy={cy(w)} r="6" />
        </svg>

        {/* The whale takes the light as the weight climbs. It is the only thing
            on the page that puts a feeling on a number. */}
        <img
          className="scrub-whale"
          src="/whales/guide/plain.webp"
          alt=""
          width="176"
          height="176"
          loading="lazy"
          decoding="async"
          style={{ "--glow": glow }}
        />
      </div>

      <div className="scrub-read">
        <span className="scrub-days mono">
          Day {days}
          {days === 365 ? "+" : ""}
        </span>
        <span className="scrub-w figure">
          {w.toFixed(2)}
          <span className="unit">weight</span>
        </span>
      </div>

      <label className="sr-only" htmlFor="scrub">
        Days a whale has been fed
      </label>
      <input
        className="dial-range"
        id="scrub"
        type="range"
        min="0"
        max="365"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        aria-valuetext={`Day ${days}, weight ${w.toFixed(2)}x`}
      />
    </div>
  );
}

/* --- 3. The provenance verifier ------------------------------------------- */

const PROVENANCE = "0x7f1908587224fd9d204fc67ef385aeccdb808c959fe19876fa167c949f36d709";

const VERIFY = `git clone https://github.com/XARIKAX/Whales && cd Whales
cd pipeline && pip install pillow numpy && python3 generate.py
cd ../contracts && node scripts/provenance.js ../pipeline/output/metadata`;

/**
 * The one claim on the page a reader can settle themselves in a single paste.
 *
 * The hash shown is the one over the committed metadata. It moves when the CID
 * moves, because the CID is inside the files the hash covers — so the card says
 * which hash this is rather than implying there is only ever one.
 */
function Verifier() {
  const [copied, setCopied] = useState(false);

  const take = async () => {
    if (await copy(VERIFY)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="verify">
      <div className="term">
        <div className="term-bar">
          <span className="term-dots" aria-hidden="true">
            <i /> <i /> <i />
          </span>
          <span className="term-name mono">regenerate the collection</span>
          <button type="button" className="term-copy mono" onClick={take}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="term-body">
          <code>
            {VERIFY.split("\n").map((line) => (
              <span className="term-line" key={line}>
                <span className="term-prompt" aria-hidden="true">
                  $
                </span>
                {line}
              </span>
            ))}
          </code>
        </pre>
      </div>

      <dl className="verify-out">
        <dt className="mono">Expected, for the committed metadata</dt>
        <dd className="mono">{PROVENANCE}</dd>
      </dl>
    </div>
  );
}

/* --- Exports -------------------------------------------------------------- */

export function HaulWidget({ ocean }) {
  return (
    <Widget
      title="Work out a haul"
      hint="Drag either dial. Nothing is signed and nothing is sent"
      fallback={
        <p className="widget-fallback">
          A 10 ETH pot across 120 activated whales pays 0.0829 ETH to a whale at 1.00x and 0.2740 ETH
          to one at 3.33x, after the hauler's 0.05 ETH tip.
        </p>
      }
    >
      <HaulSim ocean={ocean} />
    </Widget>
  );
}

export function LoyaltyWidget() {
  return (
    <Widget
      title="Drag a whale through its first year"
      hint="Arrow keys work too"
      fallback={
        <p className="widget-fallback">
          Weight climbs in eight steps from 1.00x on the day a whale is fed to 3.33x after 365 days.
        </p>
      }
    >
      <Scrubber />
    </Widget>
  );
}

export function ProvenanceWidget() {
  return (
    <Widget
      title="Check the art yourself"
      hint="Three commands, no wallet, no trust required"
      fallback={
        <p className="widget-fallback">
          Regenerating the collection from the WHALES-2026 seed and re-running{" "}
          <code>scripts/provenance.js</code> reproduces the hash the contract was deployed with.
        </p>
      }
    >
      <Verifier />
    </Widget>
  );
}
