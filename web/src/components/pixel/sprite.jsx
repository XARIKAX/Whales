/**
 * The one renderer every creature on this page goes through.
 *
 * Two rules, and they are the whole reason anything here looks alive:
 *   1. Sprites face RIGHT. Swimming left is a scaleX(-1) on the wrapper, so a
 *      single grid serves both directions.
 *   2. The tail is a separate grid that pivots, and the two grids OVERLAP by a
 *      column at the peduncle with the pivot inside the overlap. Without that
 *      overlap the tail tears away from the body at the top of every stroke.
 */

/**
 * Collapses each row into runs of identical cells. A whale drops from ~380
 * rects to ~70 this way, which starts to matter once a pod of them is in the
 * water.
 */
function runs(grid, offsetX = 0) {
  const out = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w += 1;
      if (ch !== ".") out.push({ x: x + offsetX, y, w, ch });
      x += w;
    }
  });
  return out;
}

function Cells({ grid, palette, offsetX = 0 }) {
  return runs(grid, offsetX).map((cell, i) => (
    <rect
      key={i}
      x={cell.x}
      y={cell.y}
      width={cell.w}
      height={1}
      fill={palette[cell.ch] || "transparent"}
    />
  ));
}

/**
 * Tail first, body over the top: the body hides the overlap column.
 *
 * `beat` is seconds per tail stroke. Small creatures beat fast and whales beat
 * slowly, and that difference in cadence is most of what sells the difference
 * in size — more than the scale itself.
 */
export default function Sprite({
  tail,
  body,
  palette,
  join,
  beat = 0.6,
  phase = 0,
  className = "",
  style,
}) {
  const height = body.length;
  const width = join + body[0].length;

  return (
    <svg
      className={`sprite ${className}`.trim()}
      /* The ratio is stated explicitly so a caller can set either axis and get
         the other one back correctly. */
      style={{ aspectRatio: `${width} / ${height}`, ...style }}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <g
        className="sprite-tail"
        style={{
          transformOrigin: `${join + 1}px ${height / 2}px`,
          animationDuration: `${beat}s`,
          animationDelay: `${-phase}s`,
        }}
      >
        <Cells grid={tail} palette={palette} />
      </g>
      <g
        className="sprite-body"
        style={{
          transformOrigin: `${width / 2}px ${height / 2}px`,
          animationDuration: `${beat * 2}s`,
          animationDelay: `${-phase}s`,
        }}
      >
        <Cells grid={body} palette={palette} offsetX={join} />
      </g>
    </svg>
  );
}
