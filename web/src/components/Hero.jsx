import { useEffect, useMemo, useRef } from "react";
import WhaleArt from "./WhaleArt.jsx";
import Marine, { useOnScreen } from "./Marine.jsx";
import Kelp from "./Kelp.jsx";
import { PixelFish } from "./pixel/sprites.jsx";
import { eth, usd, multiplier } from "../format.js";
import { DOCS_URL } from "../config.js";
import Reveal from "./Reveal.jsx";

/* --- Bubbles ------------------------------------------------------------ */

/** Deterministic, so React never reshuffles the field. Two tiers: a far one
    that stays small and crisp, and a near one that is big, out of focus and
    rises faster — the same depth contract the fish are under. */
const BUBBLES = Array.from({ length: 44 }, (_, i) => {
  const seed = (i * 2654435761) % 1013;
  const near = i % 4 === 0;
  return {
    left: `${(seed % 97) + 1}%`,
    size: near ? 16 + (seed % 20) : 4 + (seed % 12),
    duration: (near ? 11 : 17) + (seed % 14),
    delay: -((seed % 19) + i * 0.42),
    drift: `${((seed % 80) - 40) | 0}px`,
    near,
  };
});

/* --- Parallax ----------------------------------------------------------- */

const clamp = (n) => Math.max(-1, Math.min(1, n));

/**
 * Pointer and scroll, written straight to CSS variables inside one rAF. The
 * planes read those variables and move by different amounts, which is the
 * cheapest convincing parallax there is — and it never triggers a React render.
 */
function useParallax(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let mx = 0;
    let my = 0;
    let sy = 0;

    const write = () => {
      frame = 0;
      node.style.setProperty("--mx", mx.toFixed(4));
      node.style.setProperty("--my", my.toFixed(4));
      node.style.setProperty("--sy", sy.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    const onMove = (event) => {
      const box = node.getBoundingClientRect();
      mx = clamp((event.clientX - box.width / 2) / (box.width / 2));
      my = clamp((event.clientY - box.top - box.height / 2) / (box.height / 2));
      schedule();
    };

    const onScroll = () => {
      const box = node.getBoundingClientRect();
      sy = Math.max(0, Math.min(1, -box.top / Math.max(1, box.height)));
      schedule();
    };

    onScroll();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
}

/* --- Waves -------------------------------------------------------------- */

/**
 * A horizontally periodic wave band, drawn twice as wide as it is shown.
 * Because the period divides that width exactly, sliding the band left by half
 * of itself lands on an identical phase — so the loop never shows a seam. Every
 * moving water edge on this page is built from this one function.
 */
function band({ periods, period, base, lift, drop, floor }) {
  let d = `M0 ${base}`;
  for (let i = 0; i < periods; i += 1) {
    const x = i * period;
    d += ` C${x + period / 3} ${lift}, ${x + (period * 2) / 3} ${drop}, ${x + period} ${base}`;
  }
  return `${d} L${periods * period} ${floor} L0 ${floor} Z`;
}

/* --- The surface, seen from underneath ---------------------------------- */

/** The lobes of light where the air is. Two bands at two speeds: the slow one
    behind reads as swell, the quick one in front as chop. */
function Ceiling() {
  const swell = band({ periods: 8, period: 360, base: 74, lift: 24, drop: 118, floor: 0 });
  const chop = band({ periods: 8, period: 360, base: 94, lift: 56, drop: 120, floor: 0 });

  return (
    <div className="ceiling" aria-hidden="true">
      <svg viewBox="0 0 2880 130" preserveAspectRatio="none" className="ceiling-a">
        <path d={swell} />
      </svg>
      <svg viewBox="0 0 2880 130" preserveAspectRatio="none" className="ceiling-b">
        <path d={chop} />
      </svg>
      <div className="ceiling-glare" />
    </div>
  );
}

/* --- God rays ----------------------------------------------------------- */

/**
 * Shafts from the surface. They all lean the same way because they all come
 * from the same sun, and they sway on different clocks so the water is never a
 * still image. This is the single cheapest thing that says "underwater".
 */
const RAYS = [
  { x: "6%", w: "8vw", tilt: -13, dur: 21, delay: 0, o: 0.5 },
  { x: "21%", w: "4.5vw", tilt: -10, dur: 27, delay: -6, o: 0.32 },
  { x: "40%", w: "10vw", tilt: -16, dur: 24, delay: -12, o: 0.42 },
  { x: "57%", w: "5vw", tilt: -11, dur: 31, delay: -3, o: 0.28 },
  { x: "71%", w: "12vw", tilt: -18, dur: 23, delay: -9, o: 0.46 },
  { x: "88%", w: "6vw", tilt: -12, dur: 28, delay: -16, o: 0.34 },
];

function Rays() {
  return (
    <div className="hero-rays" aria-hidden="true">
      {RAYS.map((ray, i) => (
        <span
          key={i}
          style={{
            left: ray.x,
            width: ray.w,
            "--tilt": `${ray.tilt}deg`,
            "--o": ray.o,
            animationDuration: `${ray.dur}s`,
            animationDelay: `${ray.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* --- The wave that breaks under the hero -------------------------------- */

/** Three bands at three speeds. One wave is a decoration; three moving against
    each other is water. */
function WaveEdge() {
  const crest = band({ periods: 4, period: 720, base: 62, lift: 10, drop: 106, floor: 140 });
  const swell = band({ periods: 4, period: 720, base: 84, lift: 40, drop: 120, floor: 140 });
  const trough = band({ periods: 4, period: 720, base: 106, lift: 76, drop: 130, floor: 140 });

  return (
    <div className="wave-edge" aria-hidden="true">
      <svg viewBox="0 0 2880 140" preserveAspectRatio="none" className="wave-a">
        <path d={crest} />
      </svg>
      <svg viewBox="0 0 2880 140" preserveAspectRatio="none" className="wave-b">
        <path d={swell} />
      </svg>
      <svg viewBox="0 0 2880 140" preserveAspectRatio="none" className="wave-c">
        <path d={trough} />
      </svg>
    </div>
  );
}

/* --- Readout ------------------------------------------------------------ */

const COLLECTION = [
  ["Whales", "1000, never more"],
  ["To activate", "burn 1,000,000 $WHALE"],
  ["Loyalty weight", "1.00x → 3.33x"],
  ["Tax to whales", "100%"],
];

/**
 * The instrument rail under the CTA. Before the contracts are live it carries
 * the shape of the collection; once there is a chain to read, the top earner
 * takes the first cell and the facts close ranks behind it.
 */
function Readout({ featured, price, live }) {
  const fed = featured && featured.activatedAt !== 0n;
  const facts = live && featured ? COLLECTION.slice(0, 3) : COLLECTION;

  return (
    <div className="hero-readout">
      {live && featured && (
        <div className="readout-cell readout-specimen">
          <WhaleArt
            tokenId={featured.tokenId}
            className="specimen-art"
            alt={`Whale #${featured.tokenId}, the top earner`}
          />
          <div className="specimen-body">
            <span className="readout-label">Top earner</span>
            <span className="readout-value">
              {usd(featured.lifetimeEarned, price) || `${eth(featured.lifetimeEarned)} ETH`}
            </span>
            <span className="readout-note mono">
              #{String(featured.tokenId)} · {fed ? multiplier(featured.weight) : "dormant"}
            </span>
          </div>
        </div>
      )}

      {facts.map(([label, value]) => (
        <div className="readout-cell" key={label}>
          <span className="readout-label">{label}</span>
          <span className="readout-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

/* --- Hero --------------------------------------------------------------- */

export default function Hero({ featured, price, wallet, live }) {
  const stage = useRef(null);
  const bubbles = useMemo(() => BUBBLES, []);
  /* Scrolled past the hero, the whole scene parks. Nothing below it is worth
     paying twenty-six fish and six light shafts a frame for. */
  const near = useOnScreen(stage, "200px");
  useParallax(stage);

  return (
    <section className={`hero${near ? "" : " parked"}`} id="top" ref={stage}>
      {/* --- The place. Everything back here is scenery and takes no input. */}
      <div className="hero-scene" aria-hidden="true">
        <div className="hero-water" />
        <Ceiling />

        {/* Deepest first: the leviathan and the far shoal barely move with the
            pointer, which is what makes them read as distant. */}
        <div className="plane plane-deep">
          <Marine plane="far" seed={3} leviathan />
        </div>

        {/* The rays sit between the far and mid shoals, so distant fish are lit
            through them and nearer ones are silhouetted against them. */}
        <Rays />

        <div className="plane plane-mid">
          <Marine plane="mid" seed={11} />
        </div>

        <Kelp side="left" />
        <Kelp side="right" />

        <div className="hero-bubbles">
          {bubbles.map((b, i) => (
            <span
              key={i}
              className={`bubble${b.near ? " bubble-near" : ""}`}
              style={{
                left: b.left,
                width: b.size,
                height: b.size,
                animationDuration: `${b.duration}s`,
                animationDelay: `${b.delay}s`,
                "--drift": b.drift,
              }}
            />
          ))}
        </div>

        {/* A bloom of light under the headline, so dark type survives a busy
            scene without a box drawn around it. */}
        <div className="hero-scrim" />

        {/* The swell: one band of surface light crossing the whole hero. It is
            timed to the headline's glint, so they read as the same wave. */}
        <div className="hero-swell" />
      </div>

      {/* --- The message. */}
      <div className="wrap hero-inner">
        <Reveal stagger step={95}>
          <p className="hero-badge">
            <span className="badge-shoal" aria-hidden="true">
              <PixelFish species="tang" beat={0.5} style={{ height: 15 }} />
              <PixelFish species="lemon" beat={0.42} phase={0.3} style={{ height: 15 }} />
              <PixelFish species="coral" beat={0.56} phase={0.7} style={{ height: 15 }} />
            </span>
            <span>
              $WHALE on Robinhood Chain — <b>1000 whales</b>, never more
            </span>
          </p>

          <div className="title-stack">
            <h1 className="display hero-title">
              Every trade
              <br />
              feeds the <span className="tide">pod.</span>
            </h1>
            {/* A second copy of the same words, painted only where the swell is
                crossing them. Nothing to read here, so it is hidden. */}
            <div className="display hero-title title-glint" aria-hidden="true">
              Every trade
              <br />
              feeds the pod.
            </div>
          </div>

          <p className="hero-sub">
            2% buy / 3% sell on every trade — all of it flows to activated whales. In ETH, tracked in
            dollars.
          </p>

          <div className="hero-cta">
            <button
              className="btn btn-navy"
              onClick={() => wallet.connect()}
              disabled={Boolean(wallet.account)}
            >
              {wallet.account
                ? `${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}`
                : "Connect wallet"}
            </button>
            <a className="btn btn-ghost" href={DOCS_URL}>
              Read the docs
            </a>
          </div>

          <Readout featured={featured} price={price} live={live} />
        </Reveal>
      </div>

      {/* --- The near field. It renders after the message, so these fish swim
          between the reader and the headline — the single move that stops the
          scene being a backdrop. */}
      <div className="plane plane-near" aria-hidden="true">
        <Marine plane="near" shoal="vivid" seed={47} />
      </div>

      <WaveEdge />
    </section>
  );
}
