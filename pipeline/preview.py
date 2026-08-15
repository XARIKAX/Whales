"""Renders a proof sheet of every trait in the catalog, plus the legendaries,
so the art can be signed off before the full 1000 are generated.

    python3 preview.py

Writes preview/*.png at full size (1248) and preview/sheet-*.png contact sheets.
"""
from pathlib import Path

from PIL import Image

import traits as T
from body import palette_for
from sprite import render, MAROON

OUT = Path(__file__).parent / "preview"
SLATE = (99, 133, 150)
CHARCOAL = (56, 60, 68)
SAND = (166, 148, 116)
GOLDDUST = (120, 100, 60)


def merge(*maps):
    out = {}
    for m in maps:
        out.update(m)
    return out


def body(name):
    for n, _w, hue, s, v in T.BODIES:
        if n == name:
            return palette_for(hue, s, v, gild_belly=(n == "Gilded"))
    raise KeyError(name)


def sheet(paths, path, cols=4):
    """Contact sheet at 312px a tile."""
    tile = 312
    rowsn = (len(paths) + cols - 1) // cols
    sh = Image.new("RGB", (cols * tile, rowsn * tile), (18, 20, 24))
    for n, p in enumerate(paths):
        im = Image.open(p).resize((tile, tile), Image.LANCZOS)
        sh.paste(im, ((n % cols) * tile, (n // cols) * tile))
    sh.save(path)
    print("sheet", path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []

    def shot(name, bg, acc, pal=None):
        p = OUT / f"{name}.png"
        render(bg, acc, p, palette=pal)
        made.append(p)
        print("  ", name)
        return p

    # --- every body colourway, no accessories, so the remap can be judged ---
    print("bodies")
    bodies = []
    for n, _w, hue, s, v in T.BODIES:
        pal = palette_for(hue, s, v, gild_belly=(n == "Gilded"))
        bg = GOLDDUST if n == "Gilded" else SLATE
        bodies.append(shot(f"body-{n.lower().replace(' ', '-')}", bg, {}, pal))
    sheet(bodies, OUT / "sheet-bodies.png")

    # --- every eye ---
    print("eyes")
    eyes = [shot(f"eye-{n.lower().replace(' ', '-')}", MAROON, fn()) for n, _w, fn in T.EYES]
    sheet(eyes, OUT / "sheet-eyes.png", cols=3)

    # --- every mouth ---
    print("mouths")
    mouths = [shot(f"mouth-{n.lower().replace(' ', '-')}", SLATE, fn()) for n, _w, fn in T.MOUTHS]
    sheet(mouths, OUT / "sheet-mouths.png", cols=3)

    # --- every headwear ---
    print("headwear")
    heads = [shot(f"head-{n.lower().replace(chr(39), '').replace(' ', '-')}", CHARCOAL, fn())
             for n, _w, fn in T.HEADWEAR]
    sheet(heads, OUT / "sheet-headwear.png", cols=4)

    # --- every neck ---
    print("neck")
    necks = [shot(f"neck-{n.lower().replace(' ', '-')}", SAND, fn()) for n, _w, fn in T.NECK]
    sheet(necks, OUT / "sheet-neck.png", cols=3)

    # --- every bling ---
    print("bling")
    blings = [shot(f"bling-{n.lower().replace(' ', '-')}", SLATE, fn()) for n, _w, fn in T.BLING]
    sheet(blings, OUT / "sheet-bling.png", cols=3)

    # --- the ten legendaries ---
    print("legendaries")
    L = []
    L.append(("legend-the-firstborn", MAROON, merge(T.head_halo(), T.bling_spout_diamond()), body("Classic Navy")))
    L.append(("legend-the-don", GOLDDUST, merge(T.head_crown(), T.mouth_cigar(), T.neck_cuban()), body("Gilded")))
    L.append(("legend-old-ironside", SLATE, merge(T.extra_scars(), T.head_captain()), body("Steel")))
    L.append(("legend-the-ghost", (206, 214, 222), {}, body("Arctic")))
    L.append(("legend-deep-king", CHARCOAL, merge(T.head_crown(), T.eyes_abyss()), body("Midnight Black")))
    L.append(("legend-the-siren", CHARCOAL, merge(T.extra_biolume(), T.eyes_abyss()), body("Deep Sea")))
    L.append(("legend-goldback", GOLDDUST, merge(T.neck_diamond(), T.mouth_grill()), body("Gilded")))
    L.append(("legend-the-captain", SLATE, merge(T.head_captain(), T.mouth_pipe(), T.eyes_monocle()), body("Classic Navy")))
    L.append(("legend-trenchkeeper", (120, 100, 60), merge(T.extra_chest(), T.neck_cuban()), body("Deep Sea")))
    L.append(("legend-laser-leviathan", CHARCOAL, T.eyes_laser(), body("Midnight Black")))
    legends = [shot(n, bg, acc, pal) for n, bg, acc, pal in L]
    sheet(legends, OUT / "sheet-legendaries.png", cols=4)

    # --- a few stacked combinations, to check traits coexist ---
    print("combinations")
    combos = [
        ("combo-1", SLATE, merge(T.head_sailor(), T.mouth_cigarette(), T.neck_silver(), T.bling_watch()), body("Ocean Blue")),
        ("combo-2", (126, 110, 130), merge(T.head_beanie(), T.eyes_shades(), T.neck_pearl()), body("Steel")),
        ("combo-3", CHARCOAL, merge(T.head_kelp(), T.mouth_pipe(), T.bling_emerald()), body("Deep Sea")),
        ("combo-4", SAND, merge(T.eyes_monocle(), T.mouth_goldtooth(), T.neck_cuban(), T.bling_spout_coin()), body("Classic Navy")),
    ]
    combo_paths = [shot(n, bg, acc, pal) for n, bg, acc, pal in combos]
    sheet(combo_paths, OUT / "sheet-combos.png", cols=4)

    print(f"\n{len(made)} previews in {OUT}")


if __name__ == "__main__":
    main()
