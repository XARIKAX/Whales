/**
 * Sprite sheets.
 *
 * Every creature used to be a live <svg> with two nested <g> elements animating
 * their transforms. That is the wrong shape for this page and it was measurably
 * the wrong shape: twenty-odd creatures meant seventy animated SVG groups, and
 * an animated transform on an SVG child is not composited — it repaints the
 * whole <svg> every frame. Two thousand <rect> elements were being re-rasterised
 * sixty times a second to wag some tails.
 *
 * So the tails are baked instead. Each creature is rendered once, at four points
 * in its stroke, into a single wide SVG encoded as a data URI and used as a
 * background-image. The animation is four discrete background-position stops, so
 * a creature repaints about three times a second instead of sixty, carries three
 * DOM nodes instead of sixty, and the compositor moves it for free.
 *
 * The tail poses are a vertical shear rather than a rotation: shifting each
 * column of the fluke by a whole number of cells keeps the pixel grid intact,
 * where rotating it would resample the art into mush.
 */

export const FRAMES = 4;

/** The stroke, in whole cells of tip travel. Neutral, up, neutral, down. */
const STROKE = [0, -2, 0, 2];

/**
 * A blank cell either side of every frame.
 *
 * The four frames sit in one image and are shown by sliding the background, so
 * a frame boundary lands wherever the element's width puts it. Upscaled to a
 * non-integer multiple of the grid, the sampler reaches a fraction of a pixel
 * past the edge and picks up the next frame's tail, which shows as a stray bar
 * floating beside the animal. A cell of transparency on each side means that
 * overreach can only ever find nothing.
 */
const GUTTER = 1;

/** Collapses each row into runs of identical cells — far fewer rects to encode. */
function runs(grid, offsetX = 0, offsetY = 0) {
  const out = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w += 1;
      if (ch !== ".") out.push({ x: x + offsetX, y: y + offsetY, w, ch });
      x += w;
    }
  });
  return out;
}

/**
 * Shears the fluke vertically: nothing at the peduncle, the full stroke at the
 * tip, whole cells throughout. The pivot is the right-hand edge, where the tail
 * meets the body, which is what keeps the join from tearing open.
 */
function shear(grid, amount) {
  const width = grid[0].length;
  const height = grid.length;
  const out = Array.from({ length: height }, () => Array(width).fill("."));

  for (let x = 0; x < width; x += 1) {
    /* 1 at the tip, 0 at the peduncle. */
    const reach = 1 - x / Math.max(1, width - 1);
    const shift = Math.round(amount * reach);
    for (let y = 0; y < height; y += 1) {
      const from = y - shift;
      if (from >= 0 && from < height && grid[from][x] !== ".") out[y][x] = grid[from][x];
    }
  }
  return out;
}

const ESCAPE = { "<": "%3C", ">": "%3E", "#": "%23", '"': "%22", "&": "%26" };

/**
 * One data URI holding all four frames side by side.
 *
 * `shape-rendering="crispEdges"` and integer coordinates throughout: the whole
 * point of pixel art is that it is never resampled, and a half-pixel rect edge
 * undoes that at every scale.
 */
export function buildSheet({ body, fluke, join, palette }) {
  const height = body.length;
  const width = join + body[0].length + GUTTER * 2;
  let rects = "";

  for (let f = 0; f < FRAMES; f += 1) {
    const offsetX = f * width + GUTTER;
    const tail = shear(fluke, STROKE[f]);
    for (const c of [...runs(tail, offsetX), ...runs(body, offsetX + join)]) {
      const fill = palette[c.ch];
      if (!fill) continue;
      rects += `<rect x='${c.x}' y='${c.y}' width='${c.w}' height='1' fill='${fill}'/>`;
    }
  }

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${width * FRAMES}' height='${height}' ` +
    `viewBox='0 0 ${width * FRAMES} ${height}' shape-rendering='crispEdges'>${rects}</svg>`;

  const encoded = svg.replace(/[<>#"&]/g, (ch) => ESCAPE[ch]);
  return { url: `url("data:image/svg+xml,${encoded}")`, width, height };
}

/** Sheets are pure functions of their inputs, so they are built once per key. */
const cache = new Map();

export function sheet(key, make) {
  let hit = cache.get(key);
  if (!hit) {
    hit = buildSheet(make());
    cache.set(key, hit);
  }
  return hit;
}
