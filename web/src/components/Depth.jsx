import { useEffect, useRef } from "react";
import { onDive, FLOOR } from "../dive.js";

/**
 * The waterline: a thin undulating rule at the boundary between the lit water
 * and everything below it, labelled as the surface. Sits at the seam the
 * stat strip already makes, so it reads as the moment you go under.
 */
export function Waterline() {
  return (
    <div className="waterline" aria-hidden="true">
      <svg viewBox="0 0 1200 24" preserveAspectRatio="none">
        <path d="M0 13 C120 5, 220 21, 340 13 C460 5, 560 21, 680 13 C800 5, 900 21, 1020 13 C1110 7, 1160 15, 1200 12" />
        <path d="M0 13 C120 5, 220 21, 340 13 C460 5, 560 21, 680 13 C800 5, 900 21, 1020 13 C1110 7, 1160 15, 1200 12" />
      </svg>
      <span className="waterline-label mono">Surface · 0m</span>
    </div>
  );
}

/* --- The dive gauge ----------------------------------------------------- */

/**
 * The zones of the water column, as the ocean actually divides it. The gauge
 * reads its label off the same scale it draws its needle on, so the two can
 * never disagree.
 */
const ZONES = [
  { to: 200, name: "Sunlight" },
  { to: 1000, name: "Twilight" },
  { to: 3000, name: "Midnight" },
  { to: FLOOR, name: "Abyss" },
];

/** A tick every 100m, a long one every 500m, a figure every 1000m. */
const TICKS = Array.from({ length: FLOOR / 100 + 1 }, (_, i) => i * 100);

const metres = (n) => n.toLocaleString("en-US");

function zoneAt(depth) {
  for (const zone of ZONES) if (depth <= zone.to) return zone.name;
  return ZONES[ZONES.length - 1].name;
}

/**
 * A sounding gauge down the left margin.
 *
 * It used to be four fixed strings that lit up as their sections passed, so the
 * reading jumped from −200m to −1,000m with nothing in between: a label, not an
 * instrument. This one is continuous. The scale is drawn once; the needle, the
 * filled line behind it and the figure all track the scroll on the page's one
 * shared subscription.
 *
 * Nothing here re-renders. The needle moves on a compositor-only transform, the
 * fill scales rather than resizes, and the figure is written into a text node
 * only when the rounded reading actually changes — which is roughly every tenth
 * of a screen, not every frame. The track is measured on mount and on resize
 * and cached in between, so no scroll frame ever reads layout.
 */
export function DiveGauge() {
  const root = useRef(null);
  const track = useRef(null);
  const needle = useRef(null);
  const fill = useRef(null);
  const figure = useRef(null);
  const zone = useRef(null);

  useEffect(() => {
    const rootNode = root.current;
    const trackNode = track.current;
    const needleNode = needle.current;
    const fillNode = fill.current;
    const figureNode = figure.current;
    const zoneNode = zone.current;
    if (!rootNode || !trackNode) return;

    let height = 0;
    const measure = () => {
      height = trackNode.clientHeight;
    };

    measure();
    window.addEventListener("resize", measure);

    let lastDepth = -1;
    let lastZone = "";
    let lastUnder = null;

    const stop = onDive((progress) => {
      needleNode.style.transform = `translate3d(0, ${(progress * height).toFixed(1)}px, 0)`;
      fillNode.style.transform = `scaleY(${progress.toFixed(4)})`;

      /* Rounded to the nearest five metres: below that the figure flickers
         faster than it can be read, and every change is a text write. */
      const depth = Math.round((progress * FLOOR) / 5) * 5;
      if (depth !== lastDepth) {
        lastDepth = depth;
        figureNode.textContent = metres(depth);

        const name = zoneAt(depth);
        if (name !== lastZone) {
          lastZone = name;
          zoneNode.textContent = name;
        }
      }

      /* The gauge arrives exactly when the sunlight leaves. The hero has to
         stay uncluttered, and the instrument is drawn in foam on black: over
         bright surface water it is both unreadable and out of place. `--sun`
         reaches zero at 0.15, so that is where the gauge comes in. */
      const under = progress > 0.15;
      if (under !== lastUnder) {
        lastUnder = under;
        rootNode.classList.toggle("under", under);
      }
    });

    return () => {
      window.removeEventListener("resize", measure);
      stop();
    };
  }, []);

  return (
    <aside className="sounder" ref={root} aria-hidden="true">
      <span className="sounder-cap mono">Depth</span>

      <div className="sounder-track" ref={track}>
        {/* The water in the column, darkening the whole way down. */}
        <span className="sounder-column" />
        {/* Where you have been, drawn behind the ticks. Scaled, never resized. */}
        <span className="sounder-fill" ref={fill} />

        {TICKS.map((m) => (
          <span
            key={m}
            className={`sounder-tick${m % 500 === 0 ? " major" : ""}`}
            style={{ top: `${((m / FLOOR) * 100).toFixed(3)}%` }}
          >
            {m % 1000 === 0 && <i className="sounder-figure mono">{metres(m)}</i>}
          </span>
        ))}

        {/* The floor, which is not on a round thousand and says so. */}
        <span className="sounder-tick major sounder-floor" style={{ top: "100%" }}>
          <i className="sounder-figure mono">{metres(FLOOR)}</i>
        </span>

        <span className="sounder-needle" ref={needle}>
          <span className="sounder-pointer" />
          <span className="sounder-read mono">
            <b ref={figure}>0</b>
            <em>m</em>
          </span>
        </span>
      </div>

      <span className="sounder-zone mono" ref={zone}>
        Sunlight
      </span>
    </aside>
  );
}
