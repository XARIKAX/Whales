import { outline } from "./pixel/whales.js";

/**
 * A humpback in profile, as a silhouette — the whale you see through a hundred
 * metres of water, in the hero's deep background and behind the Trench.
 *
 * It is deliberately NOT pixel art, and it is deliberately not hand-drawn
 * either. It samples the same body profile the pixel sprites are rasterised
 * from, so the whale in the haze is anatomically the same animal as the whales
 * in the pod. Hand-authoring a second set of bezier curves gets you a different
 * animal that happens to also be grey — the first attempt at this came out a
 * blimp with a fish tail bolted on.
 */
const ART = outline();

/* The flip lives on the inner group rather than on a CSS class, because every
   place this silhouette is used already animates `transform` on the element
   itself and a class would simply be overwritten. Inside the SVG it is baked
   into the geometry: rasterised once, free thereafter. */
const WIDTH = Number(ART.viewBox.split(" ")[2]);
const FLIP = `translate(${WIDTH} 0) scale(-1 1)`;

export default function Whale({ className = "", style, mirrored = false }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox={ART.viewBox}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <g fill="currentColor" transform={mirrored ? FLIP : undefined}>
        {ART.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
