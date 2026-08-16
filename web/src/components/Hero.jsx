import { useEffect, useMemo, useRef } from "react";
import WhaleArt from "./WhaleArt.jsx";
import Marine, { Leviathan, useOnScreen } from "./Marine.jsx";
import Kelp from "./Kelp.jsx";
import { eth, usd, multiplier } from "../format.js";
import { DOCS_URL } from "../config.js";
import Reveal from "./Reveal.jsx";
import { onDive } from "../dive.js";

/* --- Bubbles ------------------------------------------------------------ */

/** Deterministic, so React never reshuffles the field. Two tiers: a far one
    that stays small and crisp, and a near one that is big, out of focus and
    rises faster — the same depth contract the fish are under. */
const BUBBLES = Array.from({ length: 34 }, (_, i) => {
  const seed = (i * 2654435761) % 1013;
  const near = i % 3 === 0;
  return {
    left: `${(seed % 97) + 1}%`,
    size: near ? 20 + (seed % 26) : 5 + (seed % 13),
    duration: (near ? 11 : 17) + (seed % 14),
    delay: -((seed % 19) + i * 0.42),
    drift: `${((seed % 80) - 40) | 0}px`,
    near,
  };
});

/* --- Drift -------------------------------------------------------------- */

/**
 * How far the hero has scrolled past, plus where the message actually sits.
 *
 * Both are CSS variables the scene reads. The hero's geometry is measured on
 * mount, on resize and once the display face has loaded, and cached in between.
 * The previous version called `getBoundingClientRect()` inside the scroll
 * handler, which forces a synchronous layout of the document on every frame you
 * scroll — and it was one of three places doing that.
 *
 * There is deliberately no pointer term either. Tying the scene to the cursor
 * made every plane twitch under the smallest mouse movement.
 */
function useDrift(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let top = 0;
    let height = 1;

    const measure = () => {
      top = node.offsetTop;
      height = node.offsetHeight || 1;
    };

    measure();
    window.addEventListener("resize", measure);

    let stop;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stop = onDive(() => {
        const sy = Math.max(0, Math.min(1, (window.scrollY - top) / height));
        node.style.setProperty("--sy", sy.toFixed(4));
      });
    }

    return () => {
      window.removeEventListener("resize", measure);
      stop?.();
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
            {/* The page's figure rule: value in Anton, unit in mono at 40% on
                the same baseline. */}
            <span className="readout-value figure">
              {usd(featured.lifetimeEarned, price) || (
                <>
                  {eth(featured.lifetimeEarned)}
                  <span className="unit">ETH</span>
                </>
              )}
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
  useDrift(stage);

  return (
    <section className={`hero${near ? "" : " parked"}`} id="top" ref={stage}>
      {/* --- The place. Everything back here is scenery and takes no input. */}
      <div className="hero-scene" aria-hidden="true">
        <div className="hero-water" />
        <Ceiling />

        {/* Deepest first. The leviathan gets the whole hero because it is the
            one thing big enough to pass behind the words without reading as a
            collision: at that scale and that opacity it is weather, not an
            animal in the way. */}
        <div className="plane plane-deep">
          <Leviathan />
          <Marine plane="far" seed={41} />
        </div>

        {/* The rays sit between the far and mid shoals, so distant fish are lit
            through them and nearer ones are silhouetted against them. */}
        <Rays />

        {/* Five bands from the surface to the sea floor, each on its own
            parallax. They cover the whole scene, message included: all of this
            paints behind the words, and keeping it out of the middle of the
            frame simply left the middle of the frame empty. */}
        <div className="plane plane-high">
          <Marine plane="high" seed={11} />
        </div>

        <div className="plane plane-mid">
          <Marine plane="mid" seed={5} />
        </div>

        <div className="plane plane-low">
          <Marine plane="low" seed={19} />
        </div>

        <div className="plane plane-reef">
          <Marine plane="reef" seed={3} />
        </div>

        <Kelp side="left" />
        <Kelp side="right" />

        <div className="hero-bubbles hero-bubbles-back">
          {bubbles.slice(0, 18).map((b, i) => (
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
          {/* Both layers carry the same line wrappers so the headline sets in
              behind its mask and its glint twin arrives on exactly the same
              frames. Any difference between the two shows up as ghosting. */}
          <div className="title-stack">
            <h1 className="display hero-title">
              <span className="line">
                <span>Every trade</span>
              </span>
              <span className="line">
                <span>
                  feeds the <span className="tide">pod.</span>
                </span>
              </span>
            </h1>
            {/* A second copy of the same words, painted only where the swell is
                crossing them. Nothing to read here, so it is hidden. */}
            <div className="display hero-title title-glint" aria-hidden="true">
              <span className="line">
                <span>Every trade</span>
              </span>
              <span className="line">
                <span>feeds the pod.</span>
              </span>
            </div>
          </div>

          <p className="hero-sub">
            2% buy, 3% sell. Every last bit of it goes to activated whales, in ETH.
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

      {/* Nothing swims in front of the message. The near plane used to render
          after the content so a whale crossed the headline; it was the best
          trick in the scene and it was also a whale sitting on the only line
          anybody reads. Bubbles are allowed in front. Animals are not. */}

      {/* The near bubbles rise in FRONT of the message. Water is between the
          reader and the page, not just behind it — this is the layer that says
          so, and it is why the field is split in two rather than doubled. */}
      <div className="hero-bubbles hero-bubbles-front" aria-hidden="true">
        {bubbles.slice(18).map((b, i) => (
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

      <WaveEdge />
    </section>
  );
}
