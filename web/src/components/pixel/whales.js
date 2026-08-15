/**
 * The pod.
 *
 * Whales are the characters on this page, so there is a family of them rather
 * than one. Each is rasterised from a profile — a back curve and a belly curve
 * sampled once per column — instead of being typed out as a grid.
 *
 * Two reasons. A grid you hand-plot at this length drifts, and the drift shows:
 * hold the full height a few columns too long and the eye stops reading a body
 * and starts reading a crate. And proportion is the whole game. A humpback is
 * over three times as long as it is deep, a blue whale nearly five; drawn at
 * the fish sprites' proportions they all render as the same fat oval with
 * different paint on it.
 *
 * What separates the species is entirely silhouette: where the mass sits, how
 * blunt the head is, how long the peduncle runs, and the four cues bolted on
 * afterwards — dorsal, pectoral, mouth crease and eye.
 */

/* --- Rasteriser --------------------------------------------------------- */

/**
 * @param len      columns, nose to peduncle
 * @param depth    rows at the thickest point
 * @param widest   0–1, where along the body the mass peaks
 * @param blunt    how much head is left at the snout — 0 is a point, 1 a wall
 * @param taper    0–1, the fraction of the body spent thinning to the tail
 * @param tailThin what is left of the depth at the peduncle
 */
function body({ len, depth, widest, blunt, taper, tailThin }) {
  const half = (depth - 1) / 2;
  const cy = half;
  const cols = [];

  for (let x = 0; x < len; x += 1) {
    const t = x / (len - 1);
    /* An ellipse whose far focus sits past the snout, so the head stays blunt
       instead of closing to a point the way the tail does. */
    const ell = Math.sqrt(Math.max(0, 1 - ((t - widest) / (1 - widest + blunt)) ** 2));
    const rear = tailThin + (1 - tailThin) * Math.min(1, t / taper);
    const r = ell * rear * half;
    cols.push([Math.round(cy - r), Math.round(cy + r)]);
  }
  return cols;
}

/**
 * Fills between the two profiles, shading against each column's own centre so
 * the tonal bands bend with the body instead of cutting across it.
 *
 * `pad` is headroom above and below the silhouette. Without it a dorsal fin is
 * drawn at a negative row and silently thrown away, which is why the orca spent
 * a draft with no fin at all.
 */
function fill(cols, depth) {
  const grid = Array.from({ length: depth }, () => Array(cols.length).fill("."));

  cols.forEach(([top, bot], x) => {
    if (bot - top < 1) return;
    const mid = (top + bot) / 2;
    for (let y = top; y <= bot; y += 1) {
      if (y === top || y === bot) grid[y][x] = "k";
      else if (y < mid - 0.3) grid[y][x] = "b";
      else if (y > mid + 0.9) grid[y][x] = "c";
      else grid[y][x] = "a";
    }
  });

  return grid;
}

const put = (grid, x, y, ch) => {
  if (grid[y] && grid[y][x] !== undefined) grid[y][x] = ch;
};

/** Only paints where there is nothing yet — for outlining a bolted-on fin. */
const putEmpty = (grid, x, y, ch) => {
  if (grid[y] && grid[y][x] === ".") grid[y][x] = ch;
};

/* --- Fluke -------------------------------------------------------------- */

/**
 * A notched fluke on a long thin peduncle. The peduncle is the tell: a fish's
 * tail springs straight off the body, a whale's runs out on a stalk first.
 */
function fluke(depth, span, lobe, cy) {
  const width = span;
  const grid = Array.from({ length: depth }, () => Array(width).fill("."));
  const reach = Math.min(lobe, cy - 1, depth - cy - 2);

  /* The stalk. Two rows of body running back to meet the body's last column,
     capped above and below — this is the part that says whale rather than fish,
     so it is worth the width it takes. */
  for (let x = reach; x < width; x += 1) {
    put(grid, x, cy - 1, "b");
    put(grid, x, cy, "a");
    put(grid, x, cy - 2, "k");
    put(grid, x, cy + 1, "k");
  }

  /* Two lobes opening off the end of it: one cell out and one cell up per step,
     which draws a clean V rather than a scatter. */
  for (let i = 0; i <= reach; i += 1) {
    const x = reach - i;
    for (const dir of [-1, 1]) {
      const y = cy + (dir < 0 ? -1 : 0) + dir * i;
      put(grid, x, y, "b");
      putEmpty(grid, x, y + dir, "k");
      putEmpty(grid, x - 1, y, "k");
    }
  }

  return grid;
}

/* --- Species ------------------------------------------------------------ */

/**
 * Each entry is a silhouette plus the cues bolted onto it. `dorsal` is [x, rows]
 * measured from the back; `pectoral` is [x, run] sweeping down and back.
 */
const SPECIES = {
  /* The classic. Blunt head, long pale pectoral, small late dorsal. */
  humpback: {
    shape: { len: 26, depth: 13, widest: 0.56, blunt: 0.16, taper: 0.3, tailThin: 0.16 },
    fluke: [7, 5],
    ridge: [12, 5],
    pectoral: [16, 4],
    mouth: 0.74,
    eye: 0.8,
  },
  /* Sleek, and the only one with a fin tall enough to read at this size. */
  orca: {
    shape: { len: 25, depth: 12, widest: 0.5, blunt: 0.14, taper: 0.28, tailThin: 0.15 },
    fluke: [7, 5],
    dorsal: [12, 5],
    pectoral: [15, 3],
    mouth: 0.76,
    eye: 0.82,
    patch: true,
  },
  /* Round-headed and finless — the silhouette is the whole character. */
  beluga: {
    shape: { len: 23, depth: 12, widest: 0.58, blunt: 0.3, taper: 0.32, tailThin: 0.17 },
    fluke: [6, 5],
    ridge: [11, 6],
    pectoral: [14, 3],
    mouth: 0.78,
    eye: 0.82,
  },
  /* Slender, with the tusk doing all the work. */
  narwhal: {
    shape: { len: 24, depth: 10, widest: 0.54, blunt: 0.12, taper: 0.3, tailThin: 0.15 },
    fluke: [6, 4],
    ridge: [11, 5],
    pectoral: [14, 2],
    eye: 0.84,
    tusk: 6,
  },
  /* The longest and the least fussy: mass forward, tiny fin far back. */
  blue: {
    shape: { len: 30, depth: 11, widest: 0.48, blunt: 0.1, taper: 0.26, tailThin: 0.13 },
    fluke: [7, 4],
    ridge: [7, 6],
    pectoral: [18, 4],
    mouth: 0.74,
    eye: 0.82,
  },
  /* Square head, no dorsal, a knuckled ridge instead. */
  sperm: {
    shape: { len: 26, depth: 12, widest: 0.68, blunt: 0.5, taper: 0.3, tailThin: 0.15 },
    fluke: [7, 5],
    ridge: [8, 6],
    pectoral: [17, 3],
    mouth: 0.7,
    eye: 0.8,
  },
};

/** Builds one species into a { body, fluke, join } sprite pair. */
function build(name) {
  const spec = SPECIES[name];
  const { len, depth } = spec.shape;
  const padTop = (spec.dorsal ? spec.dorsal[1] : 0) + 1;
  const padBot = (spec.pectoral ? spec.pectoral[1] : 0) + 1;
  const H = depth + padTop + padBot;
  const cols = body(spec.shape).map(([t, b]) => [t + padTop, b + padTop]);
  const grid = fill(cols, H);
  /* Body and fluke must agree on where the spine is, or the tail joins at an angle. */
  const cy = padTop + Math.floor((depth - 1) / 2);

  /* Dorsal: a raked fin standing off the back. It leans back a cell for every
     two it climbs, which is what stops a tall one reading as an aerial. */
  if (spec.dorsal) {
    const [x, rows] = spec.dorsal;
    for (let i = 1; i <= rows; i += 1) {
      const lean = Math.floor(i / 2);
      const w = Math.max(1, rows - i + 1);
      const y = cols[x][0] - i;
      for (let d = 0; d < w; d += 1) put(grid, x - lean + d, y, "b");
      putEmpty(grid, x - lean - 1, y, "k");
      putEmpty(grid, x - lean + w, y, "k");
    }
    const capY = cols[x][0] - rows - 1;
    for (let d = -1; d <= 1; d += 1) putEmpty(grid, x - Math.floor(rows / 2) + d, capY, "k");
  }

  /* Ridge: knuckles along the back, for the species with no fin at all. */
  if (spec.ridge) {
    const [x, run] = spec.ridge;
    for (let i = 0; i < run; i += 1) {
      if (i % 2 === 0) put(grid, x + i, cols[x + i][0], "b");
    }
  }

  /* Pectoral: a blade hanging clear of the belly line, sweeping down and back.
     Drawn below the silhouette rather than inside it — a fin painted onto the
     belly is just a stripe. */
  if (spec.pectoral) {
    const [x, run] = spec.pectoral;
    for (let i = 0; i < run; i += 1) {
      const px = x - i;
      const py = cols[Math.min(px, len - 1)][1] + i;
      put(grid, px, py, "f");
      put(grid, px - 1, py, "f");
      putEmpty(grid, px - 2, py, "k");
      putEmpty(grid, px + 1, py, "k");
      putEmpty(grid, px, py + 1, "k");
      putEmpty(grid, px - 1, py + 1, "k");
    }
  }

  /* Mouth crease. Kept short — run it the whole length of the head and it stops
     being a crease and becomes a stripe down the side. */
  if (spec.mouth) {
    const from = Math.round(len * spec.mouth);
    for (let x = from; x < len - 1; x += 1) {
      const [top, bot] = cols[x];
      const y = Math.round(top + (bot - top) * 0.74);
      if (y > top && y < bot) put(grid, x, y, "k");
    }
  }

  /* Eye, low and forward, at the corner of the mouth. */
  if (spec.eye) {
    const x = Math.round(len * spec.eye);
    const [top, bot] = cols[x];
    const y = Math.round(top + (bot - top) * 0.45);
    put(grid, x, y, "w");
    put(grid, x + 1, y, "p");
  }

  /* The orca's saddle patch, the one marking worth a pixel at this size. */
  if (spec.patch) {
    const x = Math.round(len * 0.74);
    const [top] = cols[x];
    for (let i = 0; i < 3; i += 1) put(grid, x - i, top + 2, "c");
  }

  /* The tusk. Nothing else says narwhal, so it gets to break the silhouette. */
  if (spec.tusk) {
    const [top, bot] = cols[len - 1];
    const y = Math.round(top + (bot - top) * 0.62);
    const tail = fluke(H, spec.fluke[0], spec.fluke[1], cy);
    const rows = grid.map((row, i) => [...row, ...Array(spec.tusk).fill(i === y ? "f" : ".")]);
    rows[y][len] = "f";
    return {
      body: rows.map((r) => r.join("")),
      fluke: tail.map((r) => r.join("")),
      join: spec.fluke[0] + 1,
    };
  }

  return {
    body: grid.map((r) => r.join("")),
    fluke: fluke(H, spec.fluke[0], spec.fluke[1], cy).map((r) => r.join("")),
    join: spec.fluke[0] + 1,
  };
}

export const WHALES = Object.fromEntries(Object.keys(SPECIES).map((n) => [n, build(n)]));

/* --- Palettes ----------------------------------------------------------- */

/**
 * k outline, b back, a flank, c belly, f fins and tusk, w eye, p pupil.
 * Real whales are mostly grey, which at 40 pixels long is mud — so these are
 * pushed toward the water they swim in and kept clearly apart from each other.
 */
export const POD = {
  humpback: { k: "#08182a", b: "#1d4f74", a: "#2a6b93", c: "#bcd9e6", f: "#e8f4fa", w: "#fdfdfd", p: "#08182a" },
  orca: { k: "#050d16", b: "#0d1b28", a: "#152738", c: "#f2f8fc", f: "#f2f8fc", w: "#fdfdfd", p: "#050d16" },
  beluga: { k: "#25384a", b: "#b9d2e0", a: "#d6e8f2", c: "#f4fbfe", f: "#ffffff", w: "#25384a", p: "#0a1620" },
  narwhal: { k: "#1b2436", b: "#4a5a75", a: "#6b7d97", c: "#cdd7e4", f: "#f6f2e4", w: "#fdfdfd", p: "#1b2436" },
  blue: { k: "#0a1e33", b: "#2f6ea8", a: "#3f86c4", c: "#a9d4ec", f: "#dff0fa", w: "#fdfdfd", p: "#0a1e33" },
  sperm: { k: "#1a1410", b: "#3d3a37", a: "#4f4b46", c: "#8f8a82", f: "#cfc9be", w: "#fdfdfd", p: "#1a1410" },
  /* Down in the trench nothing keeps its colour — only what glows. */
  abyssal: { k: "#020a14", b: "#0a2438", a: "#123047", c: "#1b4055", f: "#7ff0d8", w: "#7ff0d8", p: "#020a14" },
};
