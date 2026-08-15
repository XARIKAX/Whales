import { useEffect, useRef, useState } from "react";

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

/**
 * Depth markers ticking down the left margin. Each one is anchored to a
 * section, so the number you see is the depth of whatever you are reading.
 * The scroll becomes a descent, which is the whole idea of the page.
 */
const MARKS = [
  { depth: "−200m", section: "trench" },
  { depth: "−1,000m", section: "pod" },
  { depth: "−2,400m", section: "dashboard" },
  { depth: "−3,700m", section: "abyss" },
];

export function DepthMarkers() {
  const [active, setActive] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const targets = MARKS.map((m) => document.getElementById(m.section)).filter(Boolean);
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  // Nothing to mark until the reader is actually under water.
  const visible = active !== null;

  return (
    <div className={`depth-rail${visible ? " visible" : ""}`} ref={ref} aria-hidden="true">
      {MARKS.map((mark) => (
        <span
          key={mark.section}
          className={`depth-mark mono${active === mark.section ? " on" : ""}`}
        >
          {mark.depth}
        </span>
      ))}
    </div>
  );
}
