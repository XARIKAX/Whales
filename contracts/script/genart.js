// Generates the packed bitmap constants embedded in contracts/WhaleArt.sol.
//
// The whale lives on a 24x16 grid. Each layer is packed one row per uint24,
// row 0 in the high bits, column 0 (leftmost) in the high bit of each row.
// Run: node script/genart.js

const W = 24;
const H = 16;

// . empty   B body   L belly   F fin   E eye   S spout
// The flukes (cols 22-23) meet the body only at row 8, the peduncle, so the
// tail reads as a tail rather than as more whale.
const ART = [
  "......SS.S..............",
  ".....S..S.S.............",
  "......SS.S..............",
  "......BBBBBBBB..........",
  "....BBBBBBBBBBBBB.....BB",
  "..BBBBBBBBBBBBBBBBB...BB",
  ".BBBBBBBBBBBBBBBBBBB..BB",
  "BBEBBBBBBBBBBBBBBBBBB.BB",
  "BBBBBBBBBBBBBBBBBBBBBBBB",
  "BLLLLLLLLLLLLLLLLLLLL.LL",
  ".LLLLLLLFFFFLLLLLLLL..LL",
  "..LLLLLLFFFFLLLLLLL...LL",
  "....LLLLLFFFLLLLL.....LL",
  "......LLLLLLLL..........",
  "........................",
  "........................",
];

const LAYERS = { BODY: "B", BELLY: "L", FIN: "F", EYE: "E", SPOUT: "S" };

function pack(char) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      if (ART[y][x] === char) row |= 1 << (W - 1 - x);
    }
    rows.push(row);
  }
  return rows;
}

function toWord(rows) {
  // 16 rows x 24 bits = 384 bits -> two uint256 words (8 rows each).
  const words = [];
  for (let w = 0; w < 2; w++) {
    let acc = 0n;
    for (let i = 0; i < 8; i++) {
      acc = (acc << 24n) | BigInt(rows[w * 8 + i]);
    }
    words.push(acc);
  }
  return words;
}

for (const [name, char] of Object.entries(LAYERS)) {
  const rows = pack(char);
  if (rows.every((r) => r === 0)) throw new Error(`layer ${name} is empty`);
  const [hi, lo] = toWord(rows);
  console.log(
    `    uint256 internal constant ${name}_HI = 0x${hi.toString(16).padStart(48, "0")};`
  );
  console.log(
    `    uint256 internal constant ${name}_LO = 0x${lo.toString(16).padStart(48, "0")};`
  );
}

// Sanity: every painted pixel belongs to exactly one layer.
for (let y = 0; y < H; y++) {
  if (ART[y].length !== W) throw new Error(`row ${y} is ${ART[y].length} wide, expected ${W}`);
  for (const c of ART[y]) {
    if (c !== "." && !Object.values(LAYERS).includes(c)) {
      throw new Error(`unknown pixel '${c}' on row ${y}`);
    }
  }
}
console.error("ok: 24x16 grid, layers " + Object.keys(LAYERS).join(", "));
