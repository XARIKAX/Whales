"""Generates the full 1000-piece collection.

    python3 generate.py [--cid bafy...] [--limit N]

Writes output/images/0001.png … 1000.png, output/metadata/0001.json …,
output/rarity.csv and output/sheets/. Reproducible from one seed.

Why quotas rather than rolling dice
-----------------------------------
The brief asks for the advertised weights to hold to ±1.5 percentage points.
Drawing each token independently cannot promise that: for a 22% trait over 990
tokens one standard deviation is already 1.3pp, so a straight sample fails the
tolerance about a quarter of the time. Instead each slot is allocated its exact
integer count (largest remainder, so the counts sum to 990), the lists are
shuffled with the seeded RNG, and tokens take one from each. The distribution
is then exact by construction and the seed still decides who gets what.

Cross-slot rules are applied afterwards as *swaps* between tokens, which
enforces them without disturbing a single column total.
"""
import argparse
import csv
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

from PIL import Image

import traits as T
from body import palette_for
from sprite import render

HERE = Path(__file__).parent
OUT = HERE / "output"
SEED = "WHALES-2026"
SUPPLY = 1000

# The ten one-of-ones, exempt from the weights and pinned to these ids.
LEGENDARY_IDS = [1, 100, 200, 300, 400, 500, 600, 700, 800, 900]


def rng_for(label):
    """A deterministic stream per purpose, so adding one later cannot reshuffle
    the others."""
    h = hashlib.sha256(f"{SEED}/{label}".encode()).digest()
    return random.Random(int.from_bytes(h[:8], "big"))


# --------------------------------------------------------------------------
# Legendaries
# --------------------------------------------------------------------------

def merge(*maps):
    out = {}
    for m in maps:
        out.update(m)
    return out


LEGENDARIES = {
    1:   ("The Firstborn",   "Maroon",    "Classic Navy",
          {"Headwear": "Halo", "Bling": ["Diamond Spout"]},
          lambda: merge(T.head_halo(), T.bling_spout_diamond())),
    100: ("The Don",         "Gold Dust", "Gilded",
          {"Headwear": "Crown", "Mouth": "Cigar", "Neck": "Cuban Chain"},
          lambda: merge(T.head_crown(), T.mouth_cigar(), T.neck_cuban())),
    200: ("Old Ironside",    "Slate",     "Steel",
          {"Headwear": "Captain's Hat", "Extra": "Scars"},
          lambda: merge(T.extra_scars(), T.head_captain())),
    300: ("The Ghost",       "Arctic Haze", "Arctic",
          {},
          lambda: {}),
    400: ("Deep King",       "Charcoal",  "Midnight Black",
          {"Headwear": "Crown", "Eyes": "Abyss Glow"},
          lambda: merge(T.head_crown(), T.eyes_abyss())),
    500: ("The Siren",       "Charcoal",  "Deep Sea",
          {"Eyes": "Abyss Glow", "Extra": "Bioluminescence"},
          lambda: merge(T.extra_biolume(), T.eyes_abyss())),
    600: ("Goldback",        "Gold Dust", "Gilded",
          {"Neck": "Diamond Chain", "Mouth": "Diamond Grill"},
          lambda: merge(T.neck_diamond(), T.mouth_grill())),
    700: ("The Captain",     "Slate",     "Classic Navy",
          {"Headwear": "Captain's Hat", "Mouth": "Bubble Pipe", "Eyes": "Gold Monocle"},
          lambda: merge(T.head_captain(), T.mouth_pipe(), T.eyes_monocle())),
    800: ("Trenchkeeper",    "Gold Dust", "Deep Sea",
          {"Neck": "Cuban Chain", "Extra": "Treasure Chest"},
          lambda: merge(T.extra_chest(), T.neck_cuban())),
    900: ("Laser Leviathan", "Charcoal",  "Midnight Black",
          {"Eyes": "Laser"},
          lambda: T.eyes_laser()),
}

# The Ghost gets a background that exists only for it.
EXTRA_BACKGROUNDS = {"Arctic Haze": (206, 214, 222)}


# --------------------------------------------------------------------------
# Quota allocation
# --------------------------------------------------------------------------

def quota(catalog, n):
    """Exact integer counts from weights, by largest remainder."""
    total = sum(w for _n, w, *_ in catalog)
    raw = [(name, n * w / total) for name, w, *_ in catalog]
    counts = {name: int(v) for name, v in raw}
    short = n - sum(counts.values())
    for name, v in sorted(raw, key=lambda kv: kv[1] - int(kv[1]), reverse=True)[:short]:
        counts[name] += 1
    return counts


def deal(catalog, n, label):
    """A shuffled list of exactly `n` values matching the catalog weights."""
    counts = quota(catalog, n)
    pool = [name for name, c in counts.items() for _ in range(c)]
    rng_for(label).shuffle(pool)
    return pool


# --------------------------------------------------------------------------
# Building the 990
# --------------------------------------------------------------------------

def build_regular(ids, reserved=()):
    n = len(ids)
    cols = {
        "Background": deal(T.BACKGROUNDS, n, "bg"),
        "Body": deal([(x[0], x[1]) for x in T.BODIES], n, "body"),
        "Eyes": deal([(x[0], x[1]) for x in T.EYES], n, "eyes"),
        "Mouth": deal([(x[0], x[1]) for x in T.MOUTHS], n, "mouth"),
        "Headwear": deal([(x[0], x[1]) for x in T.HEADWEAR], n, "head"),
        "Neck": deal([(x[0], x[1]) for x in T.NECK], n, "neck"),
    }
    tokens = [{k: cols[k][i] for k in cols} for i in range(n)]

    # --- Bling: each piece has its own exact count, nobody carries over two ---
    bling = [[] for _ in range(n)]
    for name, w, _fn in T.BLING:
        want = round(n * w / 100)
        order = list(range(n))
        rng_for(f"bling/{name}").shuffle(order)
        given = 0
        for i in order:
            if given >= want:
                break
            if len(bling[i]) < 2:
                bling[i].append(name)
                given += 1
    for i, b in enumerate(bling):
        tokens[i]["Bling"] = b

    _apply_gilded_rule(tokens)
    _apply_midnight_rule(tokens)
    _dedupe(tokens, reserved)
    return tokens


def _apply_gilded_rule(tokens):
    """Gilded bodies only ever appear on gold dust or charcoal.

    Enforced by swapping backgrounds with tokens that already hold one, so the
    background column totals do not move.
    """
    ok = {"Gold Dust", "Charcoal"}
    rng = rng_for("gilded")

    need = [i for i, t in enumerate(tokens) if t["Body"] == "Gilded" and t["Background"] not in ok]
    have = [i for i, t in enumerate(tokens) if t["Body"] != "Gilded" and t["Background"] in ok]
    rng.shuffle(have)

    for i in need:
        if not have:
            raise RuntimeError("no background left to trade to a Gilded whale")
        j = have.pop()
        tokens[i]["Background"], tokens[j]["Background"] = tokens[j]["Background"], tokens[i]["Background"]


def _apply_midnight_rule(tokens):
    """Midnight Black doubles the odds of the Abyss Glow eye.

    Again a swap, so the eye column totals are untouched: midnight whales trade
    their eyes with non-midnight whales who are holding an Abyss Glow.
    """
    rng = rng_for("midnight")
    base = dict(T.EYES).get if False else None  # noqa: F841  (kept explicit below)
    abyss_w = next(w for n, w, _ in T.EYES if n == "Abyss Glow")

    midnight = [i for i, t in enumerate(tokens) if t["Body"] == "Midnight Black"]
    target = round(len(midnight) * min(100.0, abyss_w * 2) / 100)

    has = [i for i in midnight if tokens[i]["Eyes"] == "Abyss Glow"]
    wants = [i for i in midnight if tokens[i]["Eyes"] != "Abyss Glow"]
    donors = [i for i, t in enumerate(tokens)
              if t["Body"] != "Midnight Black" and t["Eyes"] == "Abyss Glow"]
    rng.shuffle(wants); rng.shuffle(donors)

    while len(has) < target and wants and donors:
        i, j = wants.pop(), donors.pop()
        tokens[i]["Eyes"], tokens[j]["Eyes"] = tokens[j]["Eyes"], tokens[i]["Eyes"]
        has.append(i)


VISIBLE = ("Background", "Body", "Eyes", "Mouth", "Headwear", "Neck", "Bling")


def trait_hash(t):
    """Hashes the visible trait tuple only.

    `Extra` and `Legendary` are annotations on top of a roll, not a roll of
    their own — counting them would let a regular whale wear exactly the same
    set as a one-of-one and still be called unique.
    """
    return hashlib.sha256(json.dumps({
        k: (sorted(t[k]) if isinstance(t.get(k), list) else t.get(k)) for k in VISIBLE
    }, sort_keys=True).encode()).hexdigest()


def _dedupe(tokens, reserved=()):
    """No two whales share a trait tuple, and none matches a legendary.

    Collisions are broken by trading one slot with a random other token, which
    keeps every column total intact. Re-checked until the set is clean.
    """
    rng = rng_for("dedupe")
    slots = ["Background", "Eyes", "Mouth", "Headwear", "Neck", "Body"]

    for _ in range(400):
        seen = {h: -1 for h in reserved}
        clashes = []
        for i, t in enumerate(tokens):
            h = trait_hash(t)
            if h in seen:
                clashes.append(i)
            else:
                seen[h] = i
        if not clashes:
            return
        for i in clashes:
            slot = rng.choice(slots)
            j = rng.randrange(len(tokens))
            tokens[i][slot], tokens[j][slot] = tokens[j][slot], tokens[i][slot]

    raise RuntimeError("could not separate every whale after 200 passes")


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------

BG = {name: rgb for name, _w, rgb in T.BACKGROUNDS} | EXTRA_BACKGROUNDS
BODY = {name: (hue, s, v) for name, _w, hue, s, v in T.BODIES}
EYE_FN = {name: fn for name, _w, fn in T.EYES}
MOUTH_FN = {name: fn for name, _w, fn in T.MOUTHS}
HEAD_FN = {name: fn for name, _w, fn in T.HEADWEAR}
NECK_FN = {name: fn for name, _w, fn in T.NECK}
BLING_FN = {name: fn for name, _w, fn in T.BLING}


def overlay_for(t, legendary_fn=None):
    if legendary_fn:
        return legendary_fn()
    m = {}
    m.update(EYE_FN[t["Eyes"]]())
    m.update(MOUTH_FN[t["Mouth"]]())
    m.update(HEAD_FN[t["Headwear"]]())
    m.update(NECK_FN[t["Neck"]]())
    for b in t["Bling"]:
        m.update(BLING_FN[b]())
    return m


def render_token(token_id, t, legendary_fn=None):
    hue, s, v = BODY[t["Body"]]
    pal = palette_for(hue, s, v, gild_belly=(t["Body"] == "Gilded"))
    path = OUT / "images" / f"{token_id:04d}.png"
    render(BG[t["Background"]], overlay_for(t, legendary_fn), path, palette=pal)
    return path


# --------------------------------------------------------------------------
# Metadata and rarity
# --------------------------------------------------------------------------

WEIGHTS = {}
for cat, key in ((T.BACKGROUNDS, "Background"), (T.EYES, "Eyes"), (T.MOUTHS, "Mouth"),
                 (T.HEADWEAR, "Headwear"), (T.NECK, "Neck"), (T.BLING, "Bling")):
    for row in cat:
        WEIGHTS[(key, row[0])] = row[1]
for name, w, *_ in T.BODIES:
    WEIGHTS[("Body", name)] = w


def attributes(t, legend_name=None):
    out = []
    for key in ("Background", "Body", "Eyes", "Mouth", "Headwear", "Neck"):
        v = t.get(key)
        if v and v != "None":
            out.append({"trait_type": key, "value": v})
    for b in t.get("Bling", []):
        out.append({"trait_type": "Bling", "value": b})
    if t.get("Extra"):
        out.append({"trait_type": "Extra", "value": t["Extra"]})
    if legend_name:
        out.append({"trait_type": "Legendary", "value": legend_name})
    return out


def rarity_score(t):
    """Sum of 1/weight over every trait the whale actually carries."""
    score = 0.0
    for key in ("Background", "Body", "Eyes", "Mouth", "Headwear", "Neck"):
        v = t.get(key)
        if v and v != "None":
            w = WEIGHTS.get((key, v))
            if w:
                score += 100.0 / w
    for b in t.get("Bling", []):
        score += 100.0 / WEIGHTS[("Bling", b)]
    return round(score, 2)


# --------------------------------------------------------------------------
# QA
# --------------------------------------------------------------------------

def check_anchors():
    """Every accessory must land on the canvas, and the anchored ones must
    actually touch the anatomy they are supposed to sit on."""
    from sprite import M, rows, cols

    def solid(i, j):
        return 0 <= i < cols and 0 <= j < rows and M[j][i] != "."

    def touches(m, box):
        i0, i1, j0, j1 = box
        return any(i0 <= i <= i1 and j0 <= j <= j1 for (i, j) in m)

    every = []
    for cat in (T.EYES, T.MOUTHS, T.HEADWEAR, T.NECK, T.BLING):
        for name, _w, fn in cat:
            every.append((name, fn()))
    every += [("Scars", T.extra_scars()), ("Bioluminescence", T.extra_biolume()),
              ("Treasure Chest", T.extra_chest())]

    problems = []
    for name, m in every:
        for (i, j) in m:
            if not (0 <= i < cols and 0 <= j < rows):
                problems.append(f"{name}: cell ({i},{j}) is off the canvas")
                break

    # Eyewear must cover the eye ring; mouth pieces must root in the beak;
    # headwear must meet the dome; neck must cross the chest.
    anchors = {
        "Shades": (16, 24, 20, 24), "Gold Monocle": (18, 22, 20, 24),
        "Abyss Glow": (18, 22, 20, 24), "Laser": (19, 25, 21, 23),
        "Sleepy": (18, 22, 20, 24),
        "Cigar": (32, 34, 25, 28), "Punk Cigarette": (32, 34, 25, 27),
        "Gold Tooth": (28, 32, 25, 25), "Bubble Pipe": (32, 34, 25, 27),
        "Diamond Grill": (25, 33, 25, 25),
        "Sailor Cap": (16, 30, 7, 9), "Captain's Hat": (16, 30, 7, 9),
        "Beanie": (16, 30, 7, 9), "Kelp Wrap": (16, 30, 7, 12),
        "Crown": (16, 28, 7, 9),
        "Cuban Chain": (14, 30, 32, 38), "Silver Chain": (14, 30, 32, 38),
        "Pearl String": (14, 30, 32, 38), "Diamond Chain": (14, 30, 32, 38),
        "Gold Watch": (7, 13, 40, 45), "Pinky Ring": (5, 10, 44, 47),
        "Emerald Stud": (21, 24, 22, 25),
    }
    lookup = dict(every)
    for name, box in anchors.items():
        m = lookup.get(name)
        if m is None:
            problems.append(f"{name}: not in the catalog")
        elif not touches(m, box):
            problems.append(f"{name}: nothing inside its anchor box {box}")

    # The halo is the sanctioned floater; assert it really does float.
    halo = lookup["Halo"]
    if any(j >= 7 for (_i, j) in halo):
        problems.append("Halo: should float clear of the dome (row 7)")

    return problems


def check_distribution(tokens, tol=1.5):
    """Every advertised weight, held to `tol` percentage points."""
    n = len(tokens)
    problems = []
    for cat, key in ((T.BACKGROUNDS, "Background"), (T.BODIES, "Body"), (T.EYES, "Eyes"),
                     (T.MOUTHS, "Mouth"), (T.HEADWEAR, "Headwear"), (T.NECK, "Neck")):
        got = Counter(t[key] for t in tokens)
        for row in cat:
            name, want = row[0], row[1]
            pct = 100.0 * got.get(name, 0) / n
            if abs(pct - want) > tol:
                problems.append(f"{key}/{name}: {pct:.2f}% vs {want}% target")
    got = Counter(b for t in tokens for b in t["Bling"])
    for name, want, _fn in T.BLING:
        pct = 100.0 * got.get(name, 0) / n
        if abs(pct - want) > tol:
            problems.append(f"Bling/{name}: {pct:.2f}% vs {want}% target")
    return problems


def contact_sheets(ids):
    """One sheet per hundred, ten across."""
    tile = 128
    (OUT / "sheets").mkdir(parents=True, exist_ok=True)
    for start in range(0, len(ids), 100):
        chunk = ids[start:start + 100]
        sh = Image.new("RGB", (10 * tile, 10 * tile), (16, 18, 22))
        for n, tid in enumerate(chunk):
            im = Image.open(OUT / "images" / f"{tid:04d}.png").resize((tile, tile), Image.LANCZOS)
            sh.paste(im, ((n % 10) * tile, (n // 10) * tile))
        p = OUT / "sheets" / f"{chunk[0]:04d}-{chunk[-1]:04d}.png"
        sh.save(p)
        print("  sheet", p.name)


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cid", default="__REPLACE_WITH_CID__",
                    help="IPFS CID of the images directory, once pinned")
    ap.add_argument("--limit", type=int, default=SUPPLY)
    args = ap.parse_args()

    print("checking the art anchors")
    problems = check_anchors()
    if problems:
        for p in problems:
            print("  FAIL", p)
        raise SystemExit("anchor checks failed")
    print("  all accessories on canvas and on their anatomy")

    ids = list(range(1, SUPPLY + 1))
    regular_ids = [i for i in ids if i not in LEGENDARY_IDS]

    # The one-of-ones are fixed, so they are built first and their trait
    # tuples reserved — the 990 are then dealt around them.
    legendary_tokens = {}
    for tid, (_name, bg, body, extra, _fn) in LEGENDARIES.items():
        t = {"Background": bg, "Body": body, "Eyes": "Classic", "Mouth": "None",
             "Headwear": "None", "Neck": "None", "Bling": []}
        t.update({k: v for k, v in extra.items() if k != "Bling"})
        t["Bling"] = extra.get("Bling", [])
        legendary_tokens[tid] = t
    reserved = {trait_hash(t) for t in legendary_tokens.values()}

    print(f"allocating {len(regular_ids)} whales around {len(reserved)} reserved tuples")
    regular = build_regular(regular_ids, reserved)
    by_id = dict(zip(regular_ids, regular))

    print("checking the distribution")
    problems = check_distribution(regular)
    if problems:
        for p in problems:
            print("  FAIL", p)
        raise SystemExit("distribution outside tolerance")
    print("  every trait within 1.5pp of target")

    by_id.update(legendary_tokens)

    print("checking for duplicates across all 1000")
    hashes = {}
    for tid in ids:
        h = trait_hash(by_id[tid])
        if h in hashes:
            raise SystemExit(f"duplicate trait tuple: #{tid} and #{hashes[h]}")
        hashes[h] = tid
    print("  1000 unique trait tuples")

    (OUT / "images").mkdir(parents=True, exist_ok=True)
    (OUT / "metadata").mkdir(parents=True, exist_ok=True)

    print(f"rendering {min(args.limit, SUPPLY)}")
    rows_csv = []
    for n, tid in enumerate(ids[:args.limit], 1):
        t = by_id[tid]
        legend = LEGENDARIES.get(tid)
        render_token(tid, t, legend[4] if legend else None)

        meta = {
            "name": f"WHALES #{tid:04d}",
            "description": "1000 whales. Every fee in the ocean.",
            "image": f"ipfs://{args.cid}/{tid:04d}.png",
            "attributes": attributes(t, legend[0] if legend else None),
        }
        (OUT / "metadata" / f"{tid:04d}.json").write_text(json.dumps(meta, indent=1))

        rows_csv.append({
            "id": tid,
            "legendary": legend[0] if legend else "",
            "background": t["Background"], "body": t["Body"], "eyes": t["Eyes"],
            "mouth": t["Mouth"], "headwear": t["Headwear"], "neck": t["Neck"],
            "bling": "|".join(t["Bling"]),
            "rarity_score": rarity_score(t),
        })
        if n % 100 == 0:
            print(f"  {n}")

    with open(OUT / "rarity.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows_csv[0].keys()))
        w.writeheader()
        w.writerows(rows_csv)
    print("  rarity.csv")

    print("contact sheets")
    contact_sheets(ids[:args.limit])

    print(f"\ndone — {min(args.limit, SUPPLY)} whales in {OUT}")


if __name__ == "__main__":
    main()
