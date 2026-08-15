import { useEffect, useRef } from "react";

/**
 * The water itself. Everything here is fixed to the viewport and driven by one
 * scroll value, so the whole column of water responds together as the reader
 * descends: light dies, particles thicken, the edges close in.
 *
 * Nothing in here loops fast enough to notice. The slowest drift is 90s.
 */

/** Deterministic motes — three parallax planes, thickening and blurring with depth. */
const PLANES = [
  { count: 16, speed: 0.16, size: [1, 2], blur: 0, opacity: 0.5 },
  { count: 22, speed: 0.34, size: [1, 3], blur: 0.7, opacity: 0.38 },
  { count: 26, speed: 0.6, size: [2, 4], blur: 1.8, opacity: 0.26 },
];

const MOTES = PLANES.map((plane, planeIndex) =>
  Array.from({ length: plane.count }, (_, i) => {
    const seed = ((planeIndex + 1) * 7919 + i * 104729) % 10007;
    const [min, max] = plane.size;
    return {
      left: (seed % 100) + (seed % 7) / 10,
      top: ((seed >> 3) % 100) + (seed % 5) / 10,
      size: min + ((seed >> 5) % 100) / 100 * (max - min),
      sway: ((seed >> 7) % 40) - 20,
      duration: 28 + ((seed >> 9) % 40),
      delay: -((seed >> 11) % 30),
    };
  })
);

export default function Atmosphere() {
  const ref = useRef(null);

  // Parallax is written straight to CSS variables inside a rAF, so scrolling
  // never triggers a React render.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        node.style.setProperty("--p1", `${y * -PLANES[0].speed}px`);
        node.style.setProperty("--p2", `${y * -PLANES[1].speed}px`);
        node.style.setProperty("--p3", `${y * -PLANES[2].speed}px`);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="atmosphere" ref={ref} aria-hidden="true">
      {/* The sun, above the surface, seen from below. */}
      <div className="sun-glow" />

      {/* The god rays that used to live here have moved into the hero, which is
          the only place sunlight ever reached anyway — they faded to nothing
          below the thermocline. Keeping both sets meant paying for four blurred,
          soft-light, viewport-tall elements to draw a second, fainter copy of
          rays the hero was already drawing better. */}

      {/* Caustics: the shifting mesh of light under a moving surface. */}
      <div className="caustics" />

      {/* Suspended matter, three planes deep. */}
      {MOTES.map((plane, i) => (
        <div className={`motes motes-${i + 1}`} key={i}>
          {plane.map((mote, j) => (
            <span
              key={j}
              style={{
                left: `${mote.left}%`,
                top: `${mote.top}%`,
                width: mote.size,
                height: mote.size,
                "--sway": `${mote.sway}px`,
                animationDuration: `${mote.duration}s`,
                animationDelay: `${mote.delay}s`,
              }}
            />
          ))}
        </div>
      ))}

      {/* Water closing in at the edges, only once it is dark enough to feel it. */}
      <div className="vignette" />

      {/* Grain. The single cheapest fix for a flat digital surface. */}
      <div className="grain" />
    </div>
  );
}

/** SVG filters the CSS layers reference. Rendered once, never visible itself. */
export function AtmosphereDefs() {
  return (
    <svg className="defs" aria-hidden="true" focusable="false">
      <defs>
        {/* The caustics used to live here as an animated `feTurbulence`. They
            are now a baked, tiling background image in the stylesheet: a live
            filter on a moving element is re-run every frame, and on this page
            that one effect cost more than every fish, bubble and light shaft
            put together. The grain stays — it never moves, so it rasterises
            once and is free thereafter. */}
        <filter id="grain-filter" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}
