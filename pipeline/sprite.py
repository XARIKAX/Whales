"""Master sprite, palette and renderer — lifted from gen9.py unchanged.

The render function and its finish parameters (per-cell jitter, AO, blur 1.3,
unsharp 3/42/2) are the approved look and are not touched. Everything the
collection generator adds sits on top as overlay cell-maps in sprite
coordinates, exactly like the five approved traits.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import random as _rnd

HERE = Path(__file__).parent

grid = np.load(HERE / "grid3_raw.npy")
bgc = np.load(HERE / "bgc3.npy")
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
_cig = {(i, j) for j in range(rows) for i in range(cols) if M[j][i] in ("Q", "O")}
_halo = set()
for (i, j) in _cig:
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            ii, jj = i + di, j + dj
            if 0 <= ii < cols and 0 <= jj < rows and M[jj][ii] == "K" and ii >= 33:
                _halo.add((ii, jj))
for (i, j) in _cig | _halo:
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

 # --- added for the wider catalog; same tonal discipline as above:
 #     a base, a dark and a highlight per material.
 "F": (238, 241, 246), "f": (196, 202, 212),   # cap white / shade
 "V": (34, 54, 96),   "v": (20, 34, 62),       # navy fabric
 "E": (170, 56, 60),  "e": (118, 34, 38),      # red band
 "L": (92, 126, 64),  "l": (58, 84, 40),       # kelp
 "T": (116, 92, 64),  "t": (80, 60, 42),       # rope / briar
 "P": (236, 232, 224), "p": (188, 182, 172),   # pearl
 "z": (150, 40, 46),                            # laser falloff
}


def put(m, i0, j, s):
    """Stamp a string of ACC keys starting at column i0 on row j. '.' skips."""
    for k2, ch in enumerate(s):
        if ch != ".":
            m[(i0 + k2, j)] = ACC[ch]


def render(bgcol, acc_map, path, palette=None):
    """The approved renderer. `palette` optionally swaps the body classes."""
    pal = palette or PAL
    img = Image.new("RGB", (Wf, Hf), bgcol)
    d = ImageDraw.Draw(img)
    cellmap = {}
    for j in range(rows):
        for i in range(cols):
            ch = M[j][i]
            if ch != ".": cellmap[(i, j)] = pal[ch]
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
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    return img


MAROON = tuple(int(v) for v in bgc)
