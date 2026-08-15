import { WHALES, POD } from "./whales.js";

/**
 * Pixel life.
 *
 * Every creature on this page is drawn on a whole-number grid and painted one
 * <rect> per run of identical cells — the same discipline as the on-chain whale
 * art, so the hero and the collection look like they came from one hand.
 *
 * Three rules:
 *   1. Sprites face RIGHT. Swimming left is a scaleX(-1) on the wrapper, so one
 *      grid serves both directions.
 *   2. The tail is a separate grid that pivots. That single split is what turns
 *      a static sprite into something that swims.
 *   3. The two grids OVERLAP by one column at the peduncle, and the pivot sits
 *      inside the overlap. Without it the tail tears away from the body at the
 *      top of every stroke.
 *
 * In the grids below `.` is transparent and every other character indexes the
 * species palette: k outline, b back, a flank, c belly, f fins, w eye, p pupil.
 */

/* --- Grids ------------------------------------------------------------- */

/** A deep-bodied reef fish. 16 x 12, its peduncle open at x = 0 for the tail. */
const REEF_BODY = [
  "........kkk.....",
  "......kkfffk....",
  "....kkkfffbbkk..",
  "...kkbbbbbbbbbk.",
  ".kkkbbbbbbbbbbbk",
  ".bbbbbbbbbbwpbbk",
  ".aaaaaaaaaawpaak",
  ".kkkaaaaaaaaaaak",
  "...kkcccccccccck",
  "....kkcccffcckk.",
  "......kkfffk....",
  "........kkk.....",
];

/** Its fanned tail. 5 x 12 — the last column is the peduncle, and it slides
    under the body so the join never opens up mid-stroke. */
const REEF_TAIL = [
  ".....",
  "k....",
  "kk...",
  "kfk..",
  "kffkk",
  "kfffb",
  "kfffa",
  "kffkk",
  "kfk..",
  "kk...",
  "k....",
  ".....",
];

/** A darting schooling fish — half the height, twice the nerve. 12 x 8. */
const SLIM_BODY = [
  ".....kkkk...",
  "..kkbbbbbkk.",
  ".kbbbbbbbbbk",
  ".bbbbbbwpbbk",
  ".aaaaaawpaak",
  ".kaaaaaaaaak",
  "..kkccccckk.",
  "....kkkkk...",
];

const SLIM_TAIL = ["....", "k...", "kfkk", "kffb", "kffa", "kfkk", "k...", "...."];

/**
 * The leviathan.
 *
 * This one is described as a profile — the first and last row each column
 * fills — rather than as forty-six character strings. Two reasons, both learned
 * the hard way. A grid you type by hand at this length drifts, and the drift
 * shows: hold the full height for twenty columns and the eye stops reading a
 * body and starts reading a box. And proportion is the whole game here. A
 * humpback is better than three times as long as it is deep; drawn at the fish
 * sprites' 1.75:1 it renders as a crate with flukes, no matter how carefully
 * the head and mouth are detailed.
 *
 * Read the two arrays as the back and the belly, tail on the left.
 */
const WHALE_TOP = [
  6, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6,
];

const WHALE_BOT = [
  8, 8, 8, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13, 13,
  13, 13, 13, 13, 13, 13, 13, 12, 12, 12, 12, 12, 11, 11, 11, 10, 10, 9, 9, 8,
];

const WHALE_H = 17;

/**
 * Fills between the two profiles, then adds the four cues that separate a whale
 * from a very large fish: a small late dorsal, a long pale pectoral sweeping
 * down and back, a mouth crease running from the snout, and an eye set low and
 * forward at the corner of it.
 */
function buildWhale() {
  const W = WHALE_TOP.length;
  const grid = Array.from({ length: WHALE_H }, () => Array(W).fill("."));
  const put = (x, y, ch) => {
    if (x >= 0 && x < W && y >= 0 && y < WHALE_H) grid[y][x] = ch;
  };

  /* Shading follows each column's own centre line, so the tonal bands bend with
     the body instead of cutting across it in flat horizontal stripes. */
  for (let x = 0; x < W; x += 1) {
    const top = WHALE_TOP[x];
    const bot = WHALE_BOT[x];
    const mid = (top + bot) / 2;
    for (let y = top; y <= bot; y += 1) {
      if (y === top || y === bot) put(x, y, "k");
      else if (y < mid - 0.4) put(x, y, "b");
      else if (y > mid + 1.1) put(x, y, "c");
      else put(x, y, "a");
    }
  }

  /* Dorsal: small, and set well back of the widest point. */
  [16, 17, 18].forEach((x) => put(x, 1, "b"));
  [15, 19].forEach((x) => put(x, 1, "k"));
  [16, 17, 18].forEach((x) => put(x, 0, "k"));

  /* Mouth crease, running back from the snout. */
  for (let x = 36; x < W; x += 1) put(x, 9, "k");

  /* Eye, low and forward, at the corner of the mouth. */
  put(41, 7, "w");
  put(42, 7, "p");

  /* Pectoral: down and back from behind the head, in the pale tone. */
  const fin = [
    [27, 12],
    [26, 13],
    [27, 13],
    [25, 14],
    [26, 14],
    [24, 15],
    [25, 15],
    [24, 16],
  ];
  fin.forEach(([x, y]) => put(x, y, "f"));
  [[28, 12], [28, 13], [27, 14], [26, 15], [25, 16], [23, 15], [23, 16], [24, 14]].forEach(
    ([x, y]) => {
      if (grid[y][x] === ".") put(x, y, "k");
    }
  );

  return grid.map((row) => row.join(""));
}

const WHALE_BODY = buildWhale();

/**
 * Its fluke: a long thin peduncle flaring into two swept lobes. The length of
 * that peduncle is the difference between a whale's tail and a fish's. 12 x 17.
 */
const WHALE_FLUKE = [
  "kk..........",
  "kbbk........",
  ".kbbk.......",
  "..kbbk......",
  "...kbbk.....",
  "....kkkkkkkk",
  ".....kbbbbbb",
  ".....kbaaaaa",
  ".....kbbbbbb",
  "....kkkkkkkk",
  "...kbbk.....",
  "..kbbk......",
  ".kbbk.......",
  "kbbk........",
  "kk..........",
  "............",
  "............",
];

/* --- Species ------------------------------------------------------------ */

/**
 * Palettes, ordered the way the water orders them: the hot ones live in the lit
 * shallows, the cold ones further out. `silver` is the schooling colour — low
 * chroma, so a crowd of them reads as one shoal rather than as confetti.
 */
export const SPECIES = {
  reef: { k: "#122032", b: "#e0651c", a: "#ff9243", c: "#ffd9a8", f: "#fff1dd", w: "#fdfdfd", p: "#101820" },
  tang: { k: "#08182c", b: "#1c58ad", a: "#3286e6", c: "#9adcf5", f: "#ffd23f", w: "#fdfdfd", p: "#101820" },
  lemon: { k: "#2a2410", b: "#e0a413", a: "#ffd23f", c: "#fff3bd", f: "#ff8a3d", w: "#fdfdfd", p: "#101820" },
  mint: { k: "#08251f", b: "#12977a", a: "#2fd4a8", c: "#c8f7e9", f: "#f5fbfe", w: "#fdfdfd", p: "#101820" },
  coral: { k: "#2b0f1c", b: "#c92e64", a: "#ff5f8f", c: "#ffcada", f: "#ffe66d", w: "#fdfdfd", p: "#101820" },
  silver: { k: "#12263a", b: "#7fa8c4", a: "#bcd9ec", c: "#eaf5fc", f: "#f5fbfe", w: "#fdfdfd", p: "#12263a" },
  /* Down in the trench nothing keeps its colour — only the lure does. */
  abyssal: { k: "#020a14", b: "#0a2438", a: "#123047", c: "#1b4055", f: "#7ff0d8", w: "#7ff0d8", p: "#020a14" },
};

/** Near enough to make out. */
const WHALE_PALETTE = {
  k: "#04101c",
  b: "#0d3151",
  a: "#164a72",
  c: "#2a6389",
  f: "#a8cfe4",
  w: "#e9f6ff",
  p: "#04101c",
};

/**
 * The same whale a hundred metres out. Every tone collapses into a narrow dark
 * band — but they do NOT collapse into one flat colour, which is the mistake
 * that turns a distant whale into a rectangle. Keeping three steps of value is
 * what still models a back, a flank and a belly once the blur has taken the
 * pixel edges off.
 */
const DEEP_WHALE = {
  k: "#062036",
  b: "#0a3153",
  a: "#0e3c63",
  c: "#134a75",
  f: "#1d5f8f",
  w: "#1d5f8f",
  p: "#062036",
};

/* --- Painting ----------------------------------------------------------- */

/**
 * Collapses each row into runs of identical cells. A fish drops from ~190 rects
 * to ~55 this way, which starts to matter once twenty of them are in the water.
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

/** Kept for the fish only — see ./sprite.jsx for the shared renderer. */
function Sprite({ tail, body, palette, join, beat, phase = 0, className = "", style }) {
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

/* --- Creatures ---------------------------------------------------------- */

/**
 * One fish. `beat` is seconds per tail stroke — small fish beat fast, and that
 * difference in cadence is most of what sells the difference in size.
 */
export function PixelFish({ species = "tang", slim = false, beat = 0.5, phase = 0, ...rest }) {
  return (
    <Sprite
      tail={slim ? SLIM_TAIL : REEF_TAIL}
      body={slim ? SLIM_BODY : REEF_BODY}
      join={slim ? 3 : 4}
      palette={SPECIES[species] || SPECIES.tang}
      beat={beat}
      phase={phase}
      {...rest}
    />
  );
}

/** The one in the deep background. Same machinery, forty times the mass. */
export function PixelWhale({ beat = 7, deep = false, ...rest }) {
  return (
    <Sprite
      tail={WHALE_FLUKE}
      body={WHALE_BODY}
      join={11}
      palette={deep ? DEEP_WHALE : WHALE_PALETTE}
      beat={beat}
      {...rest}
    />
  );
}

/* --- The pod ------------------------------------------------------------ */

/**
 * A little whale. These are the characters on this page; the fish above are
 * scenery. Six species, told apart entirely by silhouette and palette — see
 * ./whales.js for how each one is built.
 */
export function PixelWhaleling({ species = "humpback", beat = 1.5, ...rest }) {
  const sprite = WHALES[species] || WHALES.humpback;
  return (
    <Sprite
      tail={sprite.fluke}
      body={sprite.body}
      join={sprite.join}
      palette={POD[species] || POD.humpback}
      beat={beat}
      {...rest}
    />
  );
}

export const POD_SPECIES = Object.keys(WHALES);
