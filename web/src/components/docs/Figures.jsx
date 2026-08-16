/**
 * The figures.
 *
 * They share one drawing language, and it is worth stating because consistency
 * is the only thing that makes a page of diagrams read as a system rather than
 * as six illustrations by six people:
 *
 *   - a faint pixel grid behind every figure, the same 8px module as the loop
 *   - entities are flat plates with a dark outline and one cut corner, drawn
 *     the way the sprites are drawn
 *   - connections are 1px rules with a mono label sitting on them
 *   - **gold is value in motion, and nothing else** — a box is never gold, an
 *     arrow carrying money always is
 *
 * Medium follows the same rule it always did: geometry is SVG, boxes-and-arrows
 * are HTML. A layout inside a viewBox cannot reflow, and every one of these has
 * to survive a 390px screen without shrinking its own labels.
 */

/* --- Frame ---------------------------------------------------------------- */

export function Figure({ n, title, children }) {
  return (
    <figure className="fig">
      <div className="fig-body">{children}</div>
      <figcaption className="fig-cap">
        <span className="fig-n mono">Fig. {n}</span>
        <span>{title}</span>
      </figcaption>
    </figure>
  );
}

/* --- The loop's four stages ----------------------------------------------- */

/** Shared with `Loop.jsx`, which animates them, and with its static fallback. */
export const STAGES = [
  {
    k: "Trade",
    v: "2% / 3%",
    body: "Someone buys or sells $WHALE. The Flap launch tax takes its cut in ETH.",
  },
  {
    k: "The Trench",
    v: "No exit",
    body: "The tax lands in one contract. It has no withdraw function, so the only way out is the haul.",
  },
  {
    k: "The haul",
    v: "0.5%",
    body: "Pot hits the threshold and anybody can press the button. Whoever does keeps half a percent.",
  },
  {
    k: "The pod",
    v: "By weight",
    body: "The rest splits across every activated whale and lands in each whale's own wallet.",
  },
];

/* --- 2. Activation state -------------------------------------------------- */

export function StateFigure() {
  return (
    <div className="statefig">
      <div className="node state">
        <span className="state-tag mono">Dormant</span>
        <p className="state-w figure">
          0.00<span className="unit">weight</span>
        </p>
        <p className="state-note">
          Owns nothing, earns nothing. Every whale starts here, and every whale returns here the
          moment it changes hands.
        </p>
      </div>

      <div className="state-arrows" aria-hidden="true">
        <span className="state-arrow to">
          <span className="mono">burn 1,000,000 $WHALE</span>
        </span>
        <span className="state-arrow back">
          <span className="mono">sell or transfer it</span>
        </span>
      </div>

      <div className="node state on">
        <span className="state-tag mono">Awake</span>
        <p className="state-w figure">
          1.00<span className="unit">→ 3.33x</span>
        </p>
        <p className="state-note">
          On the payroll from that block. Takes a share of every haul, and the share grows the longer
          it stays awake.
        </p>
      </div>
    </div>
  );
}

/* --- 3. The loyalty curve ------------------------------------------------- */

const TIERS = [
  ["Day 0", 1.0],
  ["7d", 1.25],
  ["14d", 1.5],
  ["30d", 1.8],
  ["60d", 2.15],
  ["90d", 2.5],
  ["180d", 2.9],
  ["365d", 3.33],
];

const PLOT = { x0: 74, x1: 872, y0: 62, y1: 300 };

const xAt = (i) => PLOT.x0 + (i * (PLOT.x1 - PLOT.x0)) / (TIERS.length - 1);
const yAt = (w) => PLOT.y1 - ((w - 1) / (3.33 - 1)) * (PLOT.y1 - PLOT.y0);

export function CurveFigure() {
  /* A step, not a slope. Weight does not creep up daily — it holds flat and
     jumps the moment a threshold is crossed, and drawing it as a smooth line
     would promise a payout curve the contract does not have. */
  const steps = [];
  TIERS.forEach(([, w], i) => {
    if (i === 0) steps.push(`M ${xAt(0)} ${yAt(w)}`);
    else steps.push(`L ${xAt(i)} ${yAt(TIERS[i - 1][1])}`, `L ${xAt(i)} ${yAt(w)}`);
  });
  const line = steps.join(" ");
  const area = `${line} L ${PLOT.x1} ${PLOT.y1} L ${PLOT.x0} ${PLOT.y1} Z`;

  return (
    <svg className="chart" viewBox="0 0 920 360" role="img" aria-labelledby="curve-t">
      <title id="curve-t">
        Loyalty weight rises in eight steps from 1.00x on the day a whale is activated to 3.33x after
        365 days.
      </title>

      <defs>
        <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[1, 1.5, 2, 2.5, 3, 3.33].map((w) => (
        <g key={w}>
          <line
            x1={PLOT.x0}
            x2={PLOT.x1}
            y1={yAt(w)}
            y2={yAt(w)}
            stroke="rgba(190,231,245,0.13)"
            strokeDasharray={w === 3.33 ? "3 5" : undefined}
          />
          <text className="chart-tick" x={PLOT.x0 - 14} y={yAt(w) + 4} textAnchor="end">
            {w.toFixed(2)}x
          </text>
        </g>
      ))}

      <path d={area} fill="url(#curve-fill)" />
      <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinejoin="round" />

      {TIERS.map(([label, w], i) => (
        <g key={label}>
          <circle cx={xAt(i)} cy={yAt(w)} r="4.5" fill="var(--gold)" />
          <circle cx={xAt(i)} cy={yAt(w)} r="9" fill="var(--gold)" opacity="0.16" />
          <text className="chart-tick" x={xAt(i)} y={PLOT.y1 + 26} textAnchor="middle">
            {label}
          </text>
          {/* The first point sits on the 1.00x gridline, whose own tick already
              reads 1.00x — two identical labels a few pixels apart read as a
              rendering fault, so that one is left to the axis. */}
          {i > 0 && (
            <text className="chart-val" x={xAt(i)} y={yAt(w) - 16} textAnchor="middle">
              {w.toFixed(2)}x
            </text>
          )}
        </g>
      ))}

      <text className="chart-axis" x={PLOT.x0} y={PLOT.y1 + 52}>
        Time fed — the stops are the tiers, evenly spaced, not a linear calendar
      </text>
    </svg>
  );
}

/**
 * The same eight tiers, laid out for a phone. A stepped curve needs width; at
 * 360px the labels collapse into each other, and making the figure scroll
 * sideways hides half the data behind a gesture nothing on the page advertises.
 */
export function CurveBars() {
  return (
    <ul className="tiers">
      {TIERS.map(([label, w]) => (
        <li key={label}>
          <span className="tier-when mono">{label}</span>
          <span className="tier-track">
            <span className="tier-fill" style={{ "--v": (w - 1) / (3.33 - 1) }} />
          </span>
          <span className="tier-w mono">{w.toFixed(2)}x</span>
        </li>
      ))}
    </ul>
  );
}

/* --- 4. The split --------------------------------------------------------- */

const POT = 10;
const TIP = POT * 0.005;
const SHARES = [
  ["#0042", "365 days fed", 3.33],
  ["#0311", "14 days fed", 1.5],
  ["#0876", "activated today", 1.0],
];
const TOTAL_WEIGHT = SHARES.reduce((t, [, , w]) => t + w, 0);

export function SplitFigure() {
  const pool = POT - TIP;
  const rows = SHARES.map(([id, note, w]) => [id, note, w, (w / TOTAL_WEIGHT) * pool]);

  return (
    <div className="split">
      <div className="split-pot">
        <div className="split-bar" role="img" aria-label="The pot: 99.5% to the pod, 0.5% tip">
          <span className="split-bar-pool" style={{ "--v": pool / POT }} />
          <span className="split-bar-tip" style={{ "--v": TIP / POT }} />
        </div>
        <div className="split-legend mono">
          <span>
            <b>{POT.toFixed(2)} ETH</b> in the pot
          </span>
          <span className="split-tip-key">
            <i aria-hidden="true" /> {TIP.toFixed(3)} to whoever hauled
          </span>
        </div>
      </div>

      <ul className="split-rows">
        {rows.map(([id, note, w, cut]) => (
          <li key={id}>
            <span className="split-id mono">{id}</span>
            <span className="split-weight mono">{w.toFixed(2)}x</span>
            <span className="split-track">
              <span className="split-fill" style={{ "--v": w / 3.33 }} />
            </span>
            <span className="split-cut figure">
              {cut.toFixed(3)}
              <span className="unit">ETH</span>
            </span>
            <span className="split-note mono">{note}</span>
          </li>
        ))}
      </ul>

      <p className="split-sum mono">
        Same pot, same block. The oldest whale takes {((3.33 / TOTAL_WEIGHT) * 100).toFixed(0)}% and
        the newest {((1 / TOTAL_WEIGHT) * 100).toFixed(0)}% — the only difference between them is how
        long each has been fed.
      </p>
    </div>
  );
}

/* --- 5. The ownership chain ----------------------------------------------- */

/**
 * Redrawn in the shared language. The change that matters is not the plates:
 * it is the gold rule coming in from underneath, because the old drawing showed
 * who owns what and left where the money enters to the paragraph. Ownership
 * runs left to right in foam; value arrives from the Trench in gold. One look
 * now answers both questions.
 */
export function WalletFigure() {
  return (
    <div className="chain">
      <div className="node chain-node">
        <span className="chain-tag mono">You</span>
        <p className="chain-title mono">0x7a3f…9c21</p>
        <p className="chain-note">Your everyday wallet. It holds the NFT.</p>
      </div>

      <span className="wire" aria-hidden="true">
        <span className="mono">holds</span>
      </span>

      <div className="node chain-node accent">
        <span className="chain-tag mono">The whale</span>
        <p className="chain-title mono">WHALES #0042</p>
        <p className="chain-note">An ordinary ERC-721. Sell it anywhere you would sell any NFT.</p>
      </div>

      <span className="wire" aria-hidden="true">
        <span className="mono">owns</span>
      </span>

      <div className="node chain-node gold">
        <span className="chain-tag mono">Its wallet</span>
        <p className="chain-title mono">0x4d1e…88b0</p>
        <p className="chain-note">
          Where the whale's earnings land. Its address is fixed by the token id and can never be
          reassigned.
        </p>
        <span className="feed" aria-hidden="true">
          <span className="mono">every haul</span>
        </span>
      </div>
    </div>
  );
}

/* --- 6. Stock election ---------------------------------------------------- */

/**
 * The one part of the system with a branch in it, which is exactly why it was
 * the hardest paragraph on the page to hold in your head. Drawn, the guarantee
 * is the shape rather than a sentence: every path out of the split ends in the
 * whale's wallet, including the one where the swap fails.
 */
export function StockFigure() {
  return (
    <div className="branch">
      <div className="node branch-in">
        <span className="chain-tag mono">Your share</span>
        <p className="chain-title mono">at the haul</p>
      </div>

      <span className="wire wire-down" aria-hidden="true">
        <span className="mono">elected a token?</span>
      </span>

      <div className="branch-legs">
        <div className="branch-leg">
          <span className="leg-tag mono">No election</span>
          <span className="wire wire-down gold-wire" aria-hidden="true" />
          <div className="node leg-end">
            <p className="chain-title mono">ETH</p>
          </div>
        </div>

        <div className="branch-leg">
          <span className="leg-tag mono">Swap succeeds</span>
          <span className="wire wire-down gold-wire" aria-hidden="true" />
          <div className="node leg-end">
            <p className="chain-title mono">$TOKEN</p>
          </div>
        </div>

        <div className="branch-leg">
          <span className="leg-tag mono">Swap fails, or runs long</span>
          <span className="wire wire-down gold-wire" aria-hidden="true" />
          <div className="node leg-end">
            <p className="chain-title mono">ETH</p>
          </div>
        </div>
      </div>

      <span className="wire wire-down" aria-hidden="true">
        <span className="mono">always</span>
      </span>

      <div className="node branch-out">
        <span className="chain-tag mono">Into the whale's wallet</span>
      </div>
    </div>
  );
}
