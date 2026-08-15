/**
 * The fish.
 *
 * Scenery, not characters — they sit further out and closer in than the pod
 * does, and exist to give the whales something to be big against. Small enough
 * to be worth hand-drawing, unlike the whales: at sixteen columns you can see
 * the whole animal in the source, and the grid does not drift the way a
 * forty-column one does.
 *
 * `.` is transparent; every other character indexes the palette: k outline,
 * b back, a flank, c belly, f fins, w eye, p pupil. Sprites face RIGHT.
 *
 * The tail is a separate grid and the two OVERLAP by a column at the peduncle,
 * so the join never opens up at the top of a stroke.
 */

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

const REEF = { body: REEF_BODY, fluke: REEF_TAIL, join: 4 };
const SLIM = { body: SLIM_BODY, fluke: SLIM_TAIL, join: 3 };

/**
 * Palettes, ordered the way the water orders them: the hot ones live in the lit
 * shallows, the cold ones further out. `silver` is the schooling colour — low
 * chroma, so a crowd of them reads as one shoal rather than as confetti.
 */
export const SHOALS = {
  reef: { k: "#122032", b: "#e0651c", a: "#ff9243", c: "#ffd9a8", f: "#fff1dd", w: "#fdfdfd", p: "#101820" },
  tang: { k: "#08182c", b: "#1c58ad", a: "#3286e6", c: "#9adcf5", f: "#ffd23f", w: "#fdfdfd", p: "#101820" },
  lemon: { k: "#2a2410", b: "#e0a413", a: "#ffd23f", c: "#fff3bd", f: "#ff8a3d", w: "#fdfdfd", p: "#101820" },
  mint: { k: "#08251f", b: "#12977a", a: "#2fd4a8", c: "#c8f7e9", f: "#f5fbfe", w: "#fdfdfd", p: "#101820" },
  coral: { k: "#2b0f1c", b: "#c92e64", a: "#ff5f8f", c: "#ffcada", f: "#ffe66d", w: "#fdfdfd", p: "#101820" },
  silver: { k: "#12263a", b: "#7fa8c4", a: "#bcd9ec", c: "#eaf5fc", f: "#f5fbfe", w: "#fdfdfd", p: "#12263a" },
  /* Down in the trench nothing keeps its colour — only the lure does. */
  abyssal: { k: "#020a14", b: "#0a2438", a: "#123047", c: "#1b4055", f: "#7ff0d8", w: "#7ff0d8", p: "#020a14" },
};

/** Which body each shoal wears. The schooling species get the slim one. */
export const FISH = Object.fromEntries(
  Object.keys(SHOALS).map((name) => [
    name,
    { grids: name === "silver" || name === "tang" ? SLIM : REEF },
  ])
);
