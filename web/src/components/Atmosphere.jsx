/**
 * The water itself.
 *
 * There used to be a fixed, full-viewport element holding seven stacked layers:
 * a sun glow, caustics, three parallax mote planes, a vignette and grain. It was
 * the single most expensive thing on the page and not for the reason it looked
 * like. Deleting any one layer changed nothing. Emptying the container of every
 * layer changed nothing. Hiding the container itself was worth ten frames a
 * second on its own — because a translucent fixed layer sitting between two
 * scrolling layers has to be recomposited over the whole viewport on every
 * frame, whether it draws anything or not.
 *
 * So there is no fixed layer any more. The grain and the edge darkening are
 * painted into the water gradient, which already spans the document and already
 * scrolls. The sunlight and the caustics are anchored to the top of the page,
 * where they are the only place they were ever visible. The motes are one plane
 * instead of three, drifting on the quantised scroll variable rather than a
 * transform written every frame.
 *
 * Everything here scrolls with the page, so the whole document is one composite.
 */

/** Deterministic motes: one plane, three apparent distances carried by size and
    opacity rather than by three separate layers. */
const MOTES = Array.from({ length: 44 }, (_, i) => {
  const seed = (i * 104729 + 7919) % 10007;
  const tier = i % 3;
  return {
    left: (seed % 100) + (seed % 7) / 10,
    top: ((seed >> 3) % 100) + (seed % 5) / 10,
    size: [1.4, 2.2, 3.2][tier],
    opacity: [0.5, 0.3, 0.16][tier],
    sway: ((seed >> 7) % 40) - 20,
    duration: 28 + ((seed >> 9) % 40),
    delay: -((seed >> 11) % 30),
  };
});

export default function Atmosphere({ lit = true }) {
  return (
    <>
      {/* Sunlight and caustics live in the top two screens of the page and
          nowhere else, so that is all the height they get. Held at full
          viewport they were two more surfaces being blended over every section
          below them at an opacity of zero. */}
      {lit && (
        <div className="shallows">
          <div className="sun-glow" />
          <div className="caustics" />
        </div>
      )}

      {/* Suspended matter, over the whole column. */}
      <div className="motes" aria-hidden="true">
        {MOTES.map((mote, i) => (
          <span
            key={i}
            style={{
              left: `${mote.left}%`,
              top: `${mote.top}%`,
              width: mote.size,
              height: mote.size,
              opacity: mote.opacity,
              "--sway": `${mote.sway}px`,
              animationDuration: `${mote.duration}s`,
              animationDelay: `${mote.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

/** Kept as an export because the page mounts it; there is nothing left to
    define. The caustics and the grain were live `feTurbulence` filters and are
    now baked, tiling background images: a filter on a moving element is re-run
    every frame, and those two cost more than every creature on the page. */
export function AtmosphereDefs() {
  return null;
}
