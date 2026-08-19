import { useRef } from "react";
import { formatEther } from "viem";
import CountUp from "./CountUp.jsx";
import Reveal from "./Reveal.jsx";
import { useOnScreen } from "./Marine.jsx";
import { Link } from "../router.jsx";
import { CHAIN } from "../config.js";
import { usd, whale, percent, ago, plural } from "../format.js";

/**
 * The ocean, live.
 *
 * This was a thin band of four figures, which is a fair summary and a poor
 * argument. Everything below is already on chain and was simply not being
 * asked for: what has ever landed in the Trench, what has been split, what has
 * actually arrived in the whales' own wallets, what the haulers were paid for
 * doing it, how much of a billion tokens has been destroyed to switch whales
 * on, and how much weight is currently drawing a wage.
 *
 * One reading leads, because a page that shouts eleven numbers shouts nothing:
 * the money that has reached holders, in dollars, at the size of the claim.
 * The rest support it.
 *
 * It is drawn as an instrument panel rather than a table, because that is the
 * difference between reporting a number and reading one off a live feed. Four
 * pressure gauges with needles that sweep up to their reading as the panel
 * comes into view, a sonar dish that keeps turning next to the headline, and a
 * light that walks the length of the bottom rail once a minute. Every one of
 * those is a transform on a small element, and all of them stop when the
 * section leaves the screen.
 *
 * Every figure here comes from a contract call. There is no marketplace floor
 * and no 24h volume, because those would have to be fetched from somewhere that
 * can be wrong or absent, and this section would rather show fewer numbers than
 * one it cannot stand behind.
 */

const TOKEN_SUPPLY = 1_000_000_000n * 10n ** 18n;

const num = (n, d = 3) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const eth = (wei, d = 4) => num(Number(formatEther(wei ?? 0n)), d);

/* --- The dish ------------------------------------------------------------- */

/*
 * Contacts on the sonar, at a bearing and a range. The sweep turns clockwise
 * from twelve o'clock and takes one `--tempo-2` to come round, so a contact at
 * bearing A lights when the sweep line reaches it, at A/360 of the way through,
 * and fades behind it. That is the whole trick: the delays are the geometry.
 */
const CONTACTS = [
  [26, 0.64],
  [88, 0.33],
  [147, 0.79],
  [201, 0.47],
  [268, 0.7],
  [327, 0.4],
].map(([bearing, range]) => {
  const t = ((bearing - 90) * Math.PI) / 180;
  return {
    left: `${(50 + Math.cos(t) * range * 50).toFixed(2)}%`,
    top: `${(50 + Math.sin(t) * range * 50).toFixed(2)}%`,
    "--wait": (bearing / 360).toFixed(3),
  };
});

/** Eight bolts round the rim, because a porthole has bolts. */
const BOLTS = Array.from({ length: 8 }, (_, i) => {
  const t = ((i * 45 - 90) * Math.PI) / 180;
  return {
    left: `${(50 + Math.cos(t) * 46.5).toFixed(2)}%`,
    top: `${(50 + Math.sin(t) * 46.5).toFixed(2)}%`,
  };
});

function Sonar({ on }) {
  return (
    <div className={`dish${on ? " on" : ""}`} aria-hidden="true">
      <div className="dish-glass">
        <span className="dish-ring" />
        <span className="dish-ring" />
        <span className="dish-ring" />
        <span className="dish-cross" />
        <span className="dish-sweep" />
        {CONTACTS.map((style, i) => (
          <span className="dish-blip" key={i} style={style} />
        ))}
      </div>
      {BOLTS.map((style, i) => (
        <span className="dish-bolt" key={i} style={style} />
      ))}
      <span className="dish-stamp mono">{on ? "SWEEPING" : "STANDBY"}</span>
    </div>
  );
}

/* --- The gauges ----------------------------------------------------------- */

/*
 * A semicircular face on a 100x54 grid: centre (50,50), arc radius 42. Eleven
 * marks, every fifth one long, drawn once at module scope because they never
 * change and four cards would otherwise recompute the same trigonometry on
 * every render.
 *
 * The pointer rides the rim rather than swinging from a hub in the middle,
 * which is the only reason the reading fits inside the face: a needle through
 * the centre would cross the number at every value near half.
 */
const MARKS = Array.from({ length: 11 }, (_, i) => {
  const t = Math.PI - (i * Math.PI) / 10;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const inner = i % 5 === 0 ? 30.5 : 34.5;
  return {
    x1: (50 + c * 39.5).toFixed(2),
    y1: (50 - s * 39.5).toFixed(2),
    x2: (50 + c * inner).toFixed(2),
    y2: (50 - s * inner).toFixed(2),
    major: i % 5 === 0,
  };
});

/**
 * A pressure gauge with the reading printed in its mouth.
 *
 * The needle rests at zero and only swings to the value once the grid it lives
 * in has been revealed, so four needles sweep up together the first time the
 * panel is looked at. It is a transition rather than a loop: it happens once,
 * it costs nothing afterwards, and it cannot desynchronise from the numbers
 * counting up beside it.
 */
function Gauge({ value, children }) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));

  return (
    <div className="ometer" style={{ "--v": v }}>
      <svg className="ometer-face" viewBox="0 0 100 54" aria-hidden="true">
        <path className="ometer-track" d="M8 50A42 42 0 0 1 92 50" />
        <path className="ometer-fill" d="M8 50A42 42 0 0 1 92 50" pathLength="100" />
        <g className="ometer-marks">
          {MARKS.map((m, i) => (
            <line
              key={i}
              x1={m.x1}
              y1={m.y1}
              x2={m.x2}
              y2={m.y2}
              className={m.major ? "major" : ""}
            />
          ))}
        </g>
        <g className="ometer-hand">
          <circle className="ometer-bead" cx="50" cy="8" r="2.2" />
          <path className="ometer-point" d="M50 10.9 53.6 18.6 46.4 18.6Z" />
        </g>
      </svg>

      <div className="ometer-read">{children}</div>
    </div>
  );
}

/* --- One big reading ------------------------------------------------------ */

function Stat({ label, value, unit, meter, foot, body }) {
  return (
    <article className="stat">
      <p className="stat-label mono">{label}</p>

      <Gauge value={meter}>
        <b className="ometer-value display">{value}</b>
        {unit && <span className="ometer-unit mono">{unit}</span>}
      </Gauge>

      {body && <p className="stat-body">{body}</p>}
      {foot && <p className="stat-foot mono">{foot}</p>}
    </article>
  );
}

/* --- One small reading ---------------------------------------------------- */

function Line({ label, value, unit, foot }) {
  return (
    <div className="oline">
      <span className="oline-label mono">{label}</span>
      <span className="oline-value figure">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      {foot && <span className="oline-foot mono">{foot}</span>}
    </div>
  );
}

/* --- Ambient -------------------------------------------------------------- */

/* Five bubbles crossing the whole band, none of them in a hurry. Small enough
   that the fill cost is nothing and slow enough that nobody catches one
   starting, which is the rule the rest of the page already keeps. */
const BUBBLES = [
  { left: "7%", "--d": "7px", "--rise": "760px", "--dur": "34s", "--wait": "0s" },
  { left: "23%", "--d": "4px", "--rise": "900px", "--dur": "44s", "--wait": "-11s" },
  { left: "58%", "--d": "9px", "--rise": "700px", "--dur": "29s", "--wait": "-19s" },
  { left: "76%", "--d": "5px", "--rise": "860px", "--dur": "38s", "--wait": "-6s" },
  { left: "91%", "--d": "6px", "--rise": "820px", "--dur": "41s", "--wait": "-26s" },
];

/* --- Section -------------------------------------------------------------- */

export default function Ocean({ ocean, price, live }) {
  const stage = useRef(null);
  const near = useOnScreen(stage);
  const on = Boolean(live && ocean);

  /* Before there is a chain to read, every one of these is honestly zero. That
     is a reading, so the panel shows it as one rather than as a row of empty
     placeholder boxes, which on a dark band are invisible and read as a page
     that failed rather than a page waiting to start. */
  const o = ocean || {};
  const distributed = o.totalDistributed ?? 0n;
  const received = o.totalReceived ?? 0n;
  const delivered = o.totalDelivered ?? 0n;
  const tipped = o.totalTipped ?? 0n;
  const pot = o.pot ?? 0n;
  const burned = o.burned ?? 0n;
  const minted = Number(o.minted ?? 0);
  const activated = Number(o.activated ?? 0);
  const maxSupply = Number(o.maxSupply ?? 1000);
  const weight = Number(o.totalWeight ?? 0) / 10_000;
  const hauls = Number(o.haulCount ?? 0);

  const paidUsd = usd(distributed, price);
  const paidEth = Number(formatEther(distributed));
  const burnedShare = percent(burned, TOKEN_SUPPLY);
  const toHaul = o.haulThreshold ? percent(pot, o.haulThreshold) : 0;
  const mintedShare = maxSupply ? minted / maxSupply : 0;
  const awakeShare = maxSupply ? activated / maxSupply : 0;

  return (
    <section className={`ocean${near ? "" : " parked"}`} id="stats" ref={stage}>
      {/* Everything that moves and means nothing lives here, out of the
          reading order. The light is painted into the band itself: it was two
          more moving layers once, and it was both the least visible thing in
          the section and the most expensive. */}
      <div className="ocean-deep" aria-hidden="true">
        {BUBBLES.map((style, i) => (
          <span className="obub" key={i} style={style} />
        ))}
      </div>

      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow on-dark">
            The ocean
            <span className={`live-pill mono${on ? " on" : ""}`}>
              <span className="strip-ping" aria-hidden="true" />
              {on ? `Live on ${CHAIN.name}` : "Standby"}
            </span>
          </p>
          <h2 className="display">
            Read straight off <span className="tide on-dark">the water</span>.
          </h2>
        </Reveal>

        {/* The claim, at the size of the claim. */}
        <Reveal className="headline-stat" stagger step={60}>
          <div className="headline-read">
            <p className="stat-label mono">Paid to whales, all time</p>

            <p className="headline-figure">
              {paidUsd ? (
                <b className="display">{paidUsd}</b>
              ) : (
                <>
                  <b className="display">
                    <CountUp value={paidEth} format={(n) => num(n, 4)} />
                  </b>
                  <span className="headline-unit display">ETH</span>
                </>
              )}
            </p>

            <p className="headline-note">
              {paidUsd ? (
                <>
                  <b>{eth(distributed)} ETH</b> split across {plural(hauls, "haul")} and delivered
                  into each whale's own on-chain wallet. Nobody claims anything, and nobody can take
                  it out on the way.
                </>
              ) : (
                <>
                  Split across {plural(hauls, "haul")} and delivered into each whale's own on-chain
                  wallet. Nobody claims anything, and nobody can take it out on the way.
                </>
              )}
            </p>
          </div>

          <Sonar on={on} />
        </Reveal>

        {/* The four that describe the collection. */}
        <Reveal className="stat-grid" stagger step={60}>
          <Stat
            label="Whales minted"
            value={<CountUp value={minted} format={(n) => Math.round(n).toLocaleString()} />}
            unit={`of ${maxSupply.toLocaleString()}`}
            meter={mintedShare}
            body="Minting is the only time a whale is created. The contract has no mint-more path, no owner and no upgrade, so this number can only ever stop."
            foot={`${(mintedShare * 100).toFixed(1)}% minted`}
          />

          <Stat
            label="On the payroll"
            value={<CountUp value={activated} format={(n) => Math.round(n).toLocaleString()} />}
            unit={`of ${minted.toLocaleString() || maxSupply.toLocaleString()}`}
            meter={awakeShare}
            body="Every one of these burned a million $WHALE to wake up. Each takes a share of the tax on every trade, weighted by how long it has stayed awake."
            foot={`${weight.toFixed(2)}x total weight`}
          />

          {/* The share leads, not the token count. "144.0M" only means
              something to somebody holding the supply figure in their head;
              "14.4% of supply" is the same fact already argued. The count
              keeps its place underneath, where the exact number belongs. */}
          <Stat
            label="$WHALE burned"
            value={<CountUp value={burnedShare} format={(n) => `${n.toFixed(1)}%`} />}
            unit="of supply"
            meter={burnedShare / 100}
            body="Destroyed to switch whales on, out of a billion. It does not go to us and it does not come back, so supply only ever falls."
            foot={`${whale(burned)} $WHALE gone for good`}
          />

          <Stat
            label="In the Trench now"
            value={<CountUp value={Number(formatEther(pot))} format={(n) => num(n, 4)} />}
            unit="ETH"
            meter={toHaul / 100}
            body="Waiting on the threshold. When it is reached anyone can trigger the haul, and whoever does keeps the tip for the gas."
            foot={
              usd(pot, price)
                ? `${usd(pot, price)} · ${toHaul.toFixed(0)}% to the next haul`
                : `${toHaul.toFixed(0)}% to the next haul`
            }
          />
        </Reveal>

        {/* The five that describe the money, once. */}
        <Reveal className="orail" stagger step={40}>
          <Line
            label="Everything that has landed"
            value={eth(received)}
            unit="ETH"
            foot={usd(received, price) || "into one contract"}
          />
          <Line
            label="Delivered into whale wallets"
            value={eth(delivered)}
            unit="ETH"
            foot={usd(delivered, price) || "ERC-6551, per whale"}
          />
          <Line
            label="Paid to haulers"
            value={eth(tipped)}
            unit="ETH"
            foot={`0.5% tip across ${plural(hauls, "haul")}`}
          />
          <Line
            label="Hauls"
            value={hauls.toLocaleString()}
            foot={o.lastHaulAt ? `last ${ago(Number(o.lastHaulAt), o.now)}` : "none yet"}
          />
          <Line
            label="$WHALE circulating"
            value={o.supply ? whale(o.supply) : "not wired"}
            foot={o.supply ? `of 1B at launch` : "waiting on the token"}
          />
        </Reveal>

        <div className="ocean-foot">
          <p className="mono">
            {on
              ? `Read straight from the contract${o.block ? ` at block ${o.block.toLocaleString()}` : ""}.`
              : "These read from the contract the moment it is deployed."}
          </p>
          <div className="ocean-onward">
            <Link className="btn btn-foam btn-sm" to="/mint">
              Mint a whale
            </Link>
            <Link className="btn btn-ghost on-dark btn-sm" to="/portfolio">
              See your position
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
