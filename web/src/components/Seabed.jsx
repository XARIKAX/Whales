/**
 * The floor. The page has spent three thousand seven hundred metres descending
 * and it should arrive somewhere, so the footer sits on rock.
 *
 * Two ridges of stone in silhouette, a scatter of boulders, and two beds of
 * cold weed rooted along the crest and leaning on a long swell. Everything is
 * one path per shape and the only thing that moves is a shear on the beds, at a
 * period nobody can time. No filters, no blend modes.
 *
 * The vertical scale is shared: both drawings use a 200-unit box and the rock
 * crest sits around 120, so the weed can be rooted just below it at 176 and be
 * certain to rise clear of the stone rather than be buried inside it.
 */

function noise(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** A ridge line: a run of hills with a flat floor beneath. */
function ridge({ points, base, relief, seed }) {
  const rnd = noise(seed);
  let d = `M0 ${base}`;
  let x = 0;
  for (let i = 0; i < points; i += 1) {
    const span = 90 + rnd() * 150;
    const peak = base - (10 + rnd() * relief);
    d += ` Q${x + span / 2} ${peak}, ${x + span} ${base - rnd() * 8}`;
    x += span;
  }
  return `${d} L${x} 200 L0 200 Z`;
}

const FAR = ridge({ points: 12, base: 116, relief: 58, seed: 7 });
const NEAR = ridge({ points: 9, base: 152, relief: 46, seed: 91 });

/** Boulders, resting on the near ridge. */
const ROCKS = [
  { x: 8, w: 70, h: 26 },
  { x: 21, w: 38, h: 15 },
  { x: 39, w: 104, h: 36 },
  { x: 57, w: 28, h: 13 },
  { x: 69, w: 82, h: 29 },
  { x: 88, w: 50, h: 20 },
];

/**
 * A bed of weed: blades rooted along one line, each a closed sliver that tapers
 * to a point. They are drawn narrow in the horizontal because the drawing is
 * stretched fourteen times across the window; anything thicker comes out a leaf.
 */
function bed({ count, seed, root, min, span }) {
  const rnd = noise(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: (i / count) * 102 - 1 + rnd() * 1.6,
    h: min + rnd() * span,
    lean: (rnd() - 0.5) * 5.5,
    w: 0.45 + rnd() * 0.8,
    root,
  }));
}

const WEED_BACK = bed({ count: 34, seed: 3, root: 170, min: 44, span: 96 });
const WEED_FRONT = bed({ count: 22, seed: 55, root: 182, min: 34, span: 78 });

function Weed({ blades, className }) {
  return (
    <g className={className}>
      {blades.map((b, i) => {
        const tipX = b.x + b.lean;
        const tipY = b.root - b.h;
        return (
          <path
            key={i}
            d={
              `M${b.x - b.w} ${b.root} ` +
              `C${b.x - b.w * 0.8} ${b.root - b.h * 0.5}, ${tipX - b.w * 0.4} ${
                b.root - b.h * 0.78
              }, ${tipX} ${tipY} ` +
              `C${tipX + b.w * 0.4} ${b.root - b.h * 0.76}, ${b.x + b.w * 0.9} ${
                b.root - b.h * 0.48
              }, ${b.x + b.w} ${b.root} Z`
            }
          />
        );
      })}
    </g>
  );
}

export default function Seabed() {
  return (
    <div className="seabed" aria-hidden="true">
      {/* The rock. Two ridges, the far one paler, so the floor has distance in
          it rather than being one flat cutout. */}
      <svg
        className="seabed-rock"
        viewBox="0 0 1600 200"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="silt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12384f" />
            <stop offset="1" stopColor="#061422" />
          </linearGradient>
        </defs>
        <path className="ridge-far" d={FAR} />
        <path className="ridge-near" d={NEAR} fill="url(#silt)" />
        <path className="ridge-rim" d={NEAR} />
        {ROCKS.map((r, i) => (
          <ellipse
            key={i}
            className="boulder"
            cx={(r.x / 100) * 1600}
            cy={186 - r.h * 0.25}
            rx={r.w}
            ry={r.h}
          />
        ))}
      </svg>

      {/* The weed, in a box of its own so the blades keep their proportions
          however wide the window gets. */}
      <svg
        className="seabed-weed"
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
        focusable="false"
      >
        <Weed blades={WEED_BACK} className="weed-back" />
        <Weed blades={WEED_FRONT} className="weed-front" />
      </svg>
    </div>
  );
}
