"""Upright punk-bust whale — exact sprite, cigar stripped for swappable traits,
premium redrawn accessories, organic finish. Five iterations."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import random as _rnd

grid = np.load("/home/claude/whales/grid3_raw.npy")
bgc = np.load("/home/claude/whales/bgc3.npy")
rows, cols = grid.shape[:2]

def cls(c):
    d_bg = np.linalg.norm(c - bgc); lum = c.mean(); r, g, b = c
    if d_bg < 40: return "."
    if lum < 45: return "K"
    if r > b + 30 and r > 120: return "O"
    if abs(r-g) < 16 and abs(g-b) < 16 and lum < 150: return "Q"
    if b > r + 15 and lum < 80: return "D"
    if b > r + 15 and lum < 130: return "B"
    if lum > 195: return "W"
    if lum > 130: return "G"
    return "B"

M = [[cls(grid[j, i]) for i in range(cols)] for j in range(rows)]

# ---- strip the baked-in cigar ----
cig = {(i, j) for j in range(rows) for i in range(cols) if M[j][i] in ("Q", "O")}
halo = set()
for (i, j) in cig:
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            ii, jj = i + di, j + dj
            if 0 <= ii < cols and 0 <= jj < rows and M[jj][ii] == "K" and ii >= 33:
                halo.add((ii, jj))
for (i, j) in cig | halo:
    M[j][i] = "."
# close the beak: rightmost body cell per affected row gets an outline cap
for j in range(24, 30):
    last = None
    for i in range(cols):
        if M[j][i] in ("D", "B", "G", "W"): last = i
    if last is not None and last >= 28:
        if M[j][last + 1] == ".": M[j][last + 1] = "K"

def rep(ch, fallback, q=70):
    pts = np.array([grid[j, i] for j in range(rows) for i in range(cols) if M[j][i] == ch])
    if not len(pts): return fallback
    lum = pts.mean(axis=1)
    k = pts[lum >= np.percentile(lum, q)]
    c = np.median(k, axis=0)
    c = (c - c.mean()) * 1.10 + c.mean() * 1.05
    return tuple(int(v) for v in np.clip(c, 0, 255))

PAL = {
    "K": (12, 12, 14),
    "D": rep("D", (52, 76, 110), q=55),
    "B": rep("B", (96, 126, 168)),
    "G": rep("G", (188, 196, 206)),
    "W": (246, 247, 249),
}
print("palette", PAL)

U = 26
Wf = Hf = cols * U   # 48*26 = 1248, bust bleeds bottom like the reference

ACC = {
 "k": (12, 12, 14),
 "g": (246, 201, 70), "d": (186, 132, 30), "h": (255, 236, 158),
 "R": (212, 54, 68), "S": (74, 196, 112), "s": (36, 130, 70),
 "C": (138, 212, 240), "c": (222, 246, 253),
 "N": (96, 66, 44), "n": (64, 42, 28),
 "O": (238, 120, 32), "o": (250, 190, 60),
 "M": (172, 176, 182), "m": (216, 218, 222),
 "X": (26, 26, 30), "x": (76, 80, 90),
}

def put(m, i0, j, s):
    for k2, ch in enumerate(s):
        if ch != ".": m[(i0 + k2, j)] = ACC[ch]

# ---------------- premium traits ----------------
def cigar():
    m = {}
    # stick sits ON the mouth seam (row 26-27), rooted 2 cells into the beak
    put(m, 33, 25, ".kkkkkkkk")
    put(m, 32, 26, "nNNNgNNNOo")
    put(m, 32, 27, "nNNNgNNNOo")
    put(m, 33, 28, ".kkkkkkkk")
    m[(42, 26)] = ACC["o"]; m[(42, 27)] = ACC["O"]   # hot tip
    m[(43, 26)] = ACC["k"]; m[(43, 27)] = ACC["k"]
    # smoke rising off the tip
    for (i, j) in [(43, 22), (45, 19), (42, 16)]:
        put(m, i, j-1, ".mm.")
        put(m, i, j,   "mMMm")
        put(m, i, j+1, ".mm.")
    return m

def crown():
    m = {}
    rows_ = [
      ".kkk.kkk.kkk.",
      ".kgk.kgk.kgk.",
      ".kgk.kgk.kgk.",
      "kkgkkkgkkkgkk",
      "kgggggghggggk",
      "kgRRgghhggSSk",
      "kdddddddddddk",
      ".kkkkkkkkkkk.",
    ]
    for dj, s in enumerate(rows_):
        put(m, 16, 1 + dj, s)
    return m

def chain():
    m = {}
    links = [(14,32),(15,33),(16,34),(17,35),(19,36),(21,36),(23,36),(25,35),(27,34),(28,33),(29,32)]
    for (i, j) in links:
        m[(i, j)] = ACC["g"]; m[(i, j+1)] = ACC["d"]
    rows_ = [".kkk.", "kgggk", "kghgk", "kgggk", ".kkk."]
    for dj, s in enumerate(rows_):
        put(m, 19, 37 + dj, s)
    m[(21, 39)] = ACC["d"]
    return m

def shades():
    m = {}
    rows_ = [
      "kkkkkkkkk",
      "kXXXXXXXk",
      "kXxXXXXXk",
      "kXXXXXXXk",
      ".kkkkkkk.",
    ]
    for dj, s in enumerate(rows_):
        put(m, 16, 20 + dj, s)
    m[(18, 21)] = ACC["m"]              # glint
    put(m, 14, 21, "gg")                 # gold arm to the head edge
    return m

def mogul():
    m = {}
    # gold tooth on the lip
    m[(30, 25)] = ACC["g"]; m[(31, 25)] = ACC["h"]
    # emerald stud below the eye
    m[(22, 24)] = ACC["S"]; m[(23, 24)] = ACC["s"]
    # gold watch on the left fin
    rows_ = [".kkk.", "kghgk", "kghgk", ".kkk."]
    for dj, s in enumerate(rows_):
        put(m, 8, 41 + dj, s)
    # diamond spout above the blowhole
    for (i, j) in [(24, 5), (21, 3), (26, 1)]:
        m[(i, j-1)] = ACC["k"]
        m[(i-1, j)] = ACC["k"]; m[(i, j)] = ACC["c"]; m[(i+1, j)] = ACC["C"]; m[(i+2, j)] = ACC["k"]
        m[(i, j+1)] = ACC["k"]
    return m

# ---------------- render with organic finish ----------------
def render(bgcol, acc_map, name):
    img = Image.new("RGB", (Wf, Hf), bgcol)
    d = ImageDraw.Draw(img)
    cellmap = {}
    for j in range(rows):
        for i in range(cols):
            ch = M[j][i]
            if ch != ".": cellmap[(i, j)] = PAL[ch]
    for (i, j), colr in acc_map.items():
        cellmap[(i, j)] = colr
    def is_dark(c): return sum(c) < 90
    ao = set()
    for (i, j), c in cellmap.items():
        if is_dark(c): continue
        for (di, dj) in ((1, 0), (0, 1)):
            n = cellmap.get((i + di, j + dj))
            if n and is_dark(n): ao.add((i, j)); break
    for (i, j), base in cellmap.items():
        rng = _rnd.Random(i * 131 + j * 977)
        f = 1.0 + rng.uniform(-0.028, 0.028)
        c = [min(max(int(v * f), 0), 255) for v in base]
        if (i, j) in ao: c = [int(v * 0.93) for v in c]
        x, y = i * U, j * U
        top = tuple(min(int(v * 1.02), 255) for v in c)
        bot = tuple(int(v * 0.98) for v in c)
        h3 = U // 3
        d.rectangle([x, y, x + U - 1, y + h3 - 1], fill=top)
        d.rectangle([x, y + h3, x + U - 1, y + 2 * h3 - 1], fill=tuple(c))
        d.rectangle([x, y + 2 * h3, x + U - 1, y + U - 1], fill=bot)
    img = img.filter(ImageFilter.GaussianBlur(1.3))
    img = img.filter(ImageFilter.UnsharpMask(radius=3, percent=42, threshold=2))
    img.save(f"/home/claude/whales/q-{name}.png")
    print("saved", name)

MAROON = tuple(int(v) for v in bgc)
BGS = {"charcoal": (56,60,68), "sage": (124,138,114), "slate": (99,133,150), "sand": (166,148,116)}

render(MAROON,          cigar(),  "01-cigar")
render(BGS["charcoal"], crown(),  "02-crown")
render(BGS["sage"],     chain(),  "03-chain")
render(BGS["slate"],    {**shades(), **cigar()}, "04-shades")
render(BGS["sand"],     mogul(),  "05-mogul")
