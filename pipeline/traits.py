"""The trait catalog: every accessory as an overlay cell-map in sprite
coordinates, drawn to the same bar as the five approved samples.

House rules, applied to every piece:
  * a 1-cell black `k` outline all the way round
  * tonal shading — base, dark, highlight — never a flat fill
  * anchored to anatomy, nothing floating (the halo is the one exception)
  * gold `g/d/h` is reserved for wealth traits

Anatomy, read off the master sprite:
  dome outline .... row 7 cols 19-25, widening to cols 14-32 by row 13
  blowhole ........ col 23, row 7
  eye ring ........ rows 21-23 cols 19-21, pupil (20, 22)
  mouth seam ...... row 26; beak occupies rows 24-25 cols 26-34
  chest ........... rows 27+ cols 17-26
  left fin ........ rows 38-47 cols 5-15
"""
from sprite import ACC, put


# --------------------------------------------------------------------------
# Eyes — one slot
# --------------------------------------------------------------------------

def eyes_classic():
    return {}


def eyes_sleepy():
    """Lid drawn shut over the ring, with a lash line and a sliver beneath."""
    m = {}
    put(m, 18, 20, "kkkkk")
    put(m, 18, 21, "kxxxk")     # the lid itself, in body shadow
    put(m, 18, 22, "kkkkk")     # lash line
    put(m, 19, 23, "mmm")       # the sliver still showing
    put(m, 18, 24, "kkkkk")
    return m


def eyes_laser():
    m = {}
    # glow around the socket, hottest at the pupil
    put(m, 19, 21, "zRz")
    put(m, 19, 22, "RhR")
    put(m, 19, 23, "zRz")
    # short beam leaving the eye
    put(m, 22, 22, "hRRz")
    m[(22, 21)] = ACC["z"]
    m[(22, 23)] = ACC["z"]
    return m


def eyes_abyss():
    """Cold ring lit from within — the deep-water eye."""
    m = {}
    put(m, 18, 20, ".CCC.")
    put(m, 18, 21, "CkkkC")
    put(m, 18, 22, "Ck.kC")     # '.' leaves the pupil showing
    put(m, 18, 23, "CkkkC")
    put(m, 18, 24, ".CCC.")
    m[(20, 22)] = ACC["c"]
    return m


def eyes_shades():
    """Approved design, unchanged."""
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


def eyes_monocle():
    """Gold ring covering the eye ring, on a chain down to the cheek."""
    m = {}
    rows_ = [
      ".kkk.",
      "kgdgk",
      "kg.gk",     # '.' keeps the pupil visible through the lens
      "kgdgk",
      ".kkk.",
    ]
    for dj, s in enumerate(rows_):
        put(m, 18, 20 + dj, s)
    m[(19, 21)] = ACC["h"]               # highlight on the rim
    for (i, j) in [(22, 25), (23, 26), (23, 27), (24, 28)]:
        m[(i, j)] = ACC["d"]
    m[(23, 26)] = ACC["g"]
    return m


# --------------------------------------------------------------------------
# Mouth — one slot. Everything roots at least two cells into the beak.
# --------------------------------------------------------------------------

def mouth_none():
    return {}


def mouth_cigar():
    """Approved design, unchanged."""
    m = {}
    put(m, 33, 25, ".kkkkkkkk")
    put(m, 32, 26, "nNNNgNNNOo")
    put(m, 32, 27, "nNNNgNNNOo")
    put(m, 33, 28, ".kkkkkkkk")
    m[(42, 26)] = ACC["o"]; m[(42, 27)] = ACC["O"]   # hot tip
    m[(43, 26)] = ACC["k"]; m[(43, 27)] = ACC["k"]
    for (i, j) in [(43, 22), (45, 19), (42, 16)]:
        put(m, i, j-1, ".mm.")
        put(m, i, j,   "mMMm")
        put(m, i, j+1, ".mm.")
    return m


def mouth_cigarette():
    """Thinner than the cigar, one row, cold blue ember."""
    m = {}
    put(m, 33, 25, ".kkkkkkk")
    put(m, 32, 26, "kMmMmMCk")
    put(m, 33, 27, ".kkkkkkk")
    m[(39, 26)] = ACC["c"]                # lit tip
    for (i, j) in [(40, 22), (42, 19)]:   # thin smoke
        put(m, i, j, "mm")
        m[(i, j - 1)] = ACC["M"]
    return m


def mouth_goldtooth():
    """Sits in the lip row, which already has an outline above and below."""
    m = {}
    put(m, 29, 25, "dgh")
    m[(28, 25)] = ACC["k"]
    m[(32, 25)] = ACC["k"]
    return m


def mouth_pipe():
    """Briar pipe: stem out of the beak, bowl rising, two bubbles off it."""
    m = {}
    put(m, 33, 25, ".kkkkkk")
    put(m, 32, 26, "kTtTtTk")
    put(m, 33, 27, ".kkkkkk")
    # bowl
    rows_ = [
      ".kk.",
      "kTTk",
      "kTtk",
      "kTtk",
      "kttk",
      ".kk.",
    ]
    for dj, s in enumerate(rows_):
        put(m, 38, 21 + dj, s)
    # bubbles leaving the bowl
    for (i, j) in [(40, 17), (42, 13)]:
        put(m, i, j - 1, ".kk.")
        put(m, i, j, "kCck")
        put(m, i, j + 1, ".kk.")
    return m


def mouth_grill():
    """A full row of stones across the lip."""
    m = {}
    put(m, 26, 25, "cCcCcCcC")
    m[(25, 25)] = ACC["k"]
    return m


# --------------------------------------------------------------------------
# Headwear — one slot. Every base overlaps the dome outline row.
# --------------------------------------------------------------------------

def head_none():
    return {}


def head_crown():
    """Approved design, unchanged."""
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


def head_sailor():
    """Soft white cap with a navy band, brim to the right."""
    m = {}
    rows_ = [
      "....kkkkkkk....",
      "..kkFFFFFFFkk..",
      ".kFFFFFFFFFFFk.",
      ".kFFFFFFFFFFFk.",
      ".kffFFFFFFFffk.",
      "kVVVVVVVVVVVVVk",
      "kkkkkkkkkkkkkkk",
    ]
    for dj, s in enumerate(rows_):
        put(m, 15, 2 + dj, s)
    m[(20, 6)] = ACC["v"]                 # band shadow
    put(m, 29, 7, "kk")                   # short brim over the dome edge
    return m


def head_captain():
    """Navy peaked cap, gold band and a gold badge."""
    m = {}
    rows_ = [
      "....kkkkkkk....",
      "..kkVVVVVVVkk..",
      ".kVVVVVVVVVVVk.",
      ".kVVVVVVVVVVVk.",
      ".kvVVVVVVVVVvk.",
      "kgggggggggggggk",
      "kkkkkkkkkkkkkkk",
    ]
    for dj, s in enumerate(rows_):
        put(m, 15, 2 + dj, s)
    # badge
    put(m, 20, 4, "kgk")
    put(m, 20, 5, "ghg")
    m[(21, 6)] = ACC["d"]
    put(m, 29, 8, "kkk")                  # peak
    put(m, 29, 7, "ddd")
    return m


def head_beanie():
    """Knit cap with a ribbed brim and a bobble."""
    m = {}
    rows_ = [
      "...kkkkkkkk...",
      "..kEEEEEEEEk..",
      ".kEeEeEeEeEEk.",
      ".kEEEEEEEEEEk.",
      ".keEeEeEeEeek.",
      "kEEEEEEEEEEEEk",
      "kkkkkkkkkkkkkk",
    ]
    for dj, s in enumerate(rows_):
        put(m, 16, 2 + dj, s)
    # bobble
    put(m, 21, 0, ".kk.")
    put(m, 21, 1, "kFFk")
    m[(22, 1)] = ACC["f"]
    return m


def head_kelp():
    """Bands of kelp wrapped right over the dome, with fronds trailing off
    both sides — it should read as tangled, not as a hat."""
    m = {}
    put(m, 18, 6, "kkkkkkkk")
    put(m, 17, 7, "kLLLLLLLLLk")
    put(m, 16, 8, "klLlLlLlLlLLk")
    put(m, 15, 9, "kLLlLlLlLlLlLLk")
    put(m, 15, 10, "klLLLLLLLLLLLlk")
    put(m, 14, 11, "kkllLlLlLlLlLkk")
    put(m, 14, 12, ".kkkkkkkkkkkkk.")
    # fronds trailing off both shoulders
    for (i, j) in [(13, 13), (12, 15), (12, 17)]:
        m[(i, j)] = ACC["L"]; m[(i, j + 1)] = ACC["l"]; m[(i - 1, j + 1)] = ACC["k"]
    for (i, j) in [(30, 13), (31, 15), (31, 17)]:
        m[(i, j)] = ACC["L"]; m[(i, j + 1)] = ACC["l"]; m[(i + 1, j + 1)] = ACC["k"]
    return m


def head_halo():
    """The one sanctioned exception to the no-float rule. A true ring: solid
    top arc, open sides, shaded bottom arc, floating clear of the dome."""
    m = {}
    put(m, 20, 1, "kkkkkk")
    put(m, 18, 2, "kgggggggggk")
    put(m, 17, 3, "kg.........gk")     # '.' is the hole you see through
    put(m, 18, 4, "kddddddddddk")
    put(m, 20, 5, "kkkkkk")
    m[(21, 2)] = ACC["h"]
    m[(24, 2)] = ACC["h"]
    return m


# --------------------------------------------------------------------------
# Neck — one slot. All variants follow the approved link path.
# --------------------------------------------------------------------------

_LINKS = [(14,32),(15,33),(16,34),(17,35),(19,36),(21,36),(23,36),(25,35),(27,34),(28,33),(29,32)]


def _chain(base, shade, medallion=None):
    m = {}
    for (i, j) in _LINKS:
        m[(i, j)] = ACC[base]; m[(i, j+1)] = ACC[shade]
    if medallion:
        for dj, s in enumerate(medallion):
            put(m, 19, 37 + dj, s)
    return m


def neck_none():
    return {}


def neck_cuban():
    """Approved design, unchanged."""
    m = _chain("g", "d", [".kkk.", "kgggk", "kghgk", "kgggk", ".kkk."])
    m[(21, 39)] = ACC["d"]
    return m


def neck_silver():
    return _chain("M", "x", [".kkk.", "kMMMk", "kMmMk", "kMMMk", ".kkk."])


def neck_pearl():
    """Round beads rather than links — no medallion."""
    m = {}
    for (i, j) in _LINKS:
        m[(i, j)] = ACC["P"]; m[(i, j+1)] = ACC["p"]
        m[(i, j-1)] = ACC["k"]
    return m


def neck_diamond():
    return _chain("C", "c", [".kkk.", "kCCCk", "kCcCk", "kCCCk", ".kkk."])


# --------------------------------------------------------------------------
# Bling — zero to two, rolled independently
# --------------------------------------------------------------------------

def bling_emerald():
    """Stud on the cheek, below the eye."""
    m = {}
    m[(22, 24)] = ACC["S"]; m[(23, 24)] = ACC["s"]
    m[(22, 23)] = ACC["k"]; m[(23, 23)] = ACC["k"]
    return m


def bling_watch():
    """Approved design — gold watch on the left fin."""
    m = {}
    rows_ = [".kkk.", "kghgk", "kghgk", ".kkk."]
    for dj, s in enumerate(rows_):
        put(m, 8, 41 + dj, s)
    return m


def bling_pinky():
    """Ring near the fin tip."""
    m = {}
    put(m, 6, 45, ".kk.")
    put(m, 6, 46, "kghk")
    put(m, 6, 47, ".kk.")
    return m


def bling_spout_diamond():
    """Approved design, redirected: the spout now rises up and back from the
    blowhole so it clears whatever is being worn on the dome."""
    m = {}
    for (i, j) in [(27, 5), (30, 3), (33, 1)]:
        m[(i, j-1)] = ACC["k"]
        m[(i-1, j)] = ACC["k"]; m[(i, j)] = ACC["c"]; m[(i+1, j)] = ACC["C"]; m[(i+2, j)] = ACC["k"]
        m[(i, j+1)] = ACC["k"]
    return m


def bling_spout_coin():
    """Same spout, struck in gold."""
    m = {}
    for (i, j) in [(27, 5), (30, 3), (33, 1)]:
        m[(i, j-1)] = ACC["k"]
        m[(i-1, j)] = ACC["k"]; m[(i, j)] = ACC["h"]; m[(i+1, j)] = ACC["g"]; m[(i+2, j)] = ACC["k"]
        m[(i, j+1)] = ACC["k"]
    return m


# --------------------------------------------------------------------------
# Legendary-only overlays
# --------------------------------------------------------------------------

def extra_scars():
    """Old Ironside: healed gouges across the flank."""
    m = {}
    for (i, j) in [(15, 17), (16, 18), (17, 19), (16, 30), (17, 31), (18, 32)]:
        m[(i, j)] = ACC["f"]; m[(i, j + 1)] = ACC["x"]
    return m


def extra_biolume():
    """The Siren: lit spots along the flank, each with a dark seat."""
    m = {}
    for (i, j) in [(15, 20), (16, 26), (14, 33), (17, 38), (29, 30), (30, 36), (28, 42)]:
        m[(i, j)] = ACC["C"]
        m[(i, j - 1)] = ACC["k"]
        m[(i + 1, j)] = ACC["c"]
    return m


def extra_chest():
    """Trenchkeeper: a small strongbox held against the fin."""
    m = {}
    rows_ = [
      ".kkkkk.",
      "kdgggdk",
      "kTTTTTk",
      "kTtgtTk",
      "kTTTTTk",
      ".kkkkk.",
    ]
    for dj, s in enumerate(rows_):
        put(m, 7, 40 + dj, s)
    return m


# --------------------------------------------------------------------------
# Catalog — name, weight, builder
# --------------------------------------------------------------------------

BACKGROUNDS = [
    ("Maroon",    22.0, (130, 63, 60)),
    ("Slate",     22.0, (99, 133, 150)),
    ("Sage",      18.0, (124, 138, 114)),
    ("Charcoal",  14.0, (56, 60, 68)),
    ("Mauve",     12.0, (126, 110, 130)),
    ("Sand",       8.0, (166, 148, 116)),
    ("Gold Dust",  4.0, (120, 100, 60)),
]

# (name, weight, hue|None, sat_scale, val_scale)
BODIES = [
    ("Classic Navy",   40.0, None,  1.00, 1.00),
    ("Ocean Blue",     20.0, 0.60,  1.20, 1.00),
    ("Steel",          15.0, None,  0.40, 1.00),
    ("Deep Sea",       12.0, None,  1.00, 0.65),
    ("Arctic",          8.0, None,  0.25, 1.25),
    ("Midnight Black",  3.5, None,  0.50, 0.35),
    ("Gilded",          1.5, 0.115, 1.30, 1.00),
]

EYES = [
    ("Classic",      55.0, eyes_classic),
    ("Sleepy",       12.0, eyes_sleepy),
    ("Shades",       12.0, eyes_shades),
    ("Abyss Glow",    8.0, eyes_abyss),
    ("Gold Monocle",  8.0, eyes_monocle),
    ("Laser",         5.0, eyes_laser),
]

MOUTHS = [
    ("None",             40.0, mouth_none),
    ("Cigar",            22.0, mouth_cigar),
    ("Punk Cigarette",   15.0, mouth_cigarette),
    ("Gold Tooth",       12.0, mouth_goldtooth),
    ("Bubble Pipe",       8.0, mouth_pipe),
    ("Diamond Grill",     3.0, mouth_grill),
]

HEADWEAR = [
    ("None",           42.0, head_none),
    ("Sailor Cap",     14.0, head_sailor),
    ("Captain's Hat",  13.0, head_captain),
    ("Beanie",         12.0, head_beanie),
    ("Kelp Wrap",       8.0, head_kelp),
    ("Halo",            7.0, head_halo),
    ("Crown",           4.0, head_crown),
]

NECK = [
    ("None",           55.0, neck_none),
    ("Cuban Chain",    20.0, neck_cuban),
    ("Silver Chain",   12.0, neck_silver),
    ("Pearl String",    9.0, neck_pearl),
    ("Diamond Chain",   4.0, neck_diamond),
]

BLING = [
    ("Emerald Stud",  10.0, bling_emerald),
    ("Gold Watch",    10.0, bling_watch),
    ("Pinky Ring",     6.0, bling_pinky),
    ("Diamond Spout",  6.0, bling_spout_diamond),
    ("Coin Spout",     3.0, bling_spout_coin),
]
