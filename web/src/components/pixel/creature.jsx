import { FRAMES, sheet } from "./sheet.js";
import { WHALES, POD } from "./whales.js";
import { FISH, SHOALS } from "./fish.js";

/**
 * One creature: a single element with a baked sprite sheet behind it.
 *
 * No SVG, no child nodes, nothing animating that the compositor cannot move on
 * its own. `beat` is seconds per tail stroke — small creatures beat fast and
 * whales beat slowly, and that difference in cadence is most of what sells the
 * difference in size, more than the scale itself.
 *
 * `height` takes a number of pixels or any CSS length, so a caller can hand it
 * a `min()` against the band it is swimming in rather than a fixed size.
 */
export default function Creature({
  kind = "whale",
  species,
  beat = 1.5,
  phase = 0,
  height,
  mirrored = false,
  className = "",
  style,
}) {
  const key = `${kind}:${species}`;
  const art = sheet(key, () =>
    kind === "whale"
      ? { ...(WHALES[species] || WHALES.humpback), palette: POD[species] || POD.humpback }
      : { ...(FISH[species]?.grids || FISH.reef.grids), palette: SHOALS[species] || SHOALS.reef }
  );

  return (
    <i
      className={`creature${mirrored ? " mirror" : ""} ${className}`.trim()}
      aria-hidden="true"
      style={{
        backgroundImage: art.url,
        aspectRatio: `${art.width} / ${art.height}`,
        height: typeof height === "number" ? `${height}px` : height,
        animationDuration: `${beat}s`,
        animationDelay: `${-phase}s`,
        ...style,
      }}
    />
  );
}

export { FRAMES };
