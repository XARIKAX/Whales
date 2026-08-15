/**
 * The proscenium.
 *
 * The reference this hero is answering frames its scene with trees at the left
 * and right edges — near, dark, out of focus — so the reader is standing inside
 * the place rather than looking at a picture of it. Underwater the same job
 * falls to kelp and a reef ledge.
 *
 * These are silhouettes on purpose. Foreground objects this close to the lens
 * carry no detail and almost no colour, which is exactly what keeps the eye
 * where it belongs: on the headline in the clearing between them.
 */

const W = 240;
const H = 520;

/**
 * One blade: a ribbon leaving the floor at `x`, leaning `bend` across as it
 * climbs `h`, and rounding off at the tip.
 *
 * Kelp holds nearly its full width until close to the top — the taper belongs
 * in the last quarter. Run it from the base and the blade turns into a spike,
 * which reads as a rock or a fin, not as something growing.
 */
function blade({ x, h, bend, w }) {
  const tipX = x + bend;
  const tipY = H - h;
  const shoulderY = tipY + h * 0.22;
  const shoulderX = x + bend * 0.82;
  const midX = x + bend * 0.3;
  const midY = H - h * 0.52;

  return [
    `M${x - w} ${H}`,
    /* up the leading edge, still nearly full width at the shoulder */
    `C${midX - w * 0.95} ${midY}, ${shoulderX - w * 0.86} ${shoulderY}, ${tipX - w * 0.3} ${tipY}`,
    /* over a rounded tip */
    `Q${tipX} ${tipY - w * 0.5}, ${tipX + w * 0.34} ${tipY}`,
    /* and back down the trailing edge */
    `C${shoulderX + w * 0.9} ${shoulderY}, ${midX + w} ${midY + 8}, ${x + w} ${H}`,
    "Z",
  ].join(" ");
}

/** Tall at the outer edge, shorter toward the middle, so the frame opens up on
    the clearing where the headline stands. */
const BLADES = [
  { x: 22, h: 424, bend: 30, w: 15, sway: 11, dur: 15 },
  { x: 58, h: 352, bend: -22, w: 12, sway: -9, dur: 18.5 },
  { x: 94, h: 392, bend: 34, w: 13, sway: 13, dur: 13.5 },
  { x: 130, h: 286, bend: -18, w: 10, sway: -8, dur: 20 },
  { x: 166, h: 322, bend: 26, w: 11, sway: 10, dur: 16.5 },
  { x: 206, h: 232, bend: -20, w: 9, sway: -12, dur: 22 },
];

/** A rock shelf the kelp grows out of — it stops the blades floating in space. */
const LEDGE =
  `M0 ${H} L0 ${H - 96} C26 ${H - 122}, 52 ${H - 86}, 84 ${H - 100} ` +
  `C116 ${H - 114}, 140 ${H - 62}, 172 ${H - 70} ` +
  `C204 ${H - 78}, 224 ${H - 44}, ${W} ${H - 52} L${W} ${H} Z`;

export default function Kelp({ side = "left" }) {
  return (
    <div className={`kelp kelp-${side}`} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={side === "left" ? "xMinYMax meet" : "xMaxYMax meet"}>
        <g className="kelp-bed">
          {BLADES.map((b, i) => (
            <path
              key={i}
              d={blade(b)}
              className="kelp-blade"
              style={{
                transformOrigin: `${b.x}px ${H}px`,
                "--sway": `${b.sway}deg`,
                animationDuration: `${b.dur}s`,
                animationDelay: `${-i * 2.3}s`,
              }}
            />
          ))}
        </g>
        <path d={LEDGE} className="kelp-ledge" />
      </svg>
    </div>
  );
}
