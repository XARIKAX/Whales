# Whales — art pipeline

Extends the approved `gen9.py` renderer into a full collection generator.

**The renderer and its finish parameters are untouched.** `sprite.py` carries
`render()` across verbatim — per-cell jitter, ambient occlusion, blur 1.3,
unsharp 3/42/2 — because that is the approved look. Everything new sits on top
as overlay cell-maps in sprite coordinates, exactly like the five samples.

## Files

| File | What it is |
| --- | --- |
| `gen9.py` | The original, as supplied. Left alone for reference. |
| `sprite.py` | Master grid, classification, palette, and the approved `render()`. |
| `traits.py` | The trait catalog — every accessory, drawn cell by cell. |
| `body.py` | Body colourways as an HSV remap that preserves luminance. |
| `preview.py` | Renders proof sheets of every trait for sign-off. |
| `preview/` | The output of `preview.py` — **look here**. |

## Looking at the art

```bash
pip install pillow numpy
python3 preview.py
```

Contact sheets, each also available as full-size individual PNGs:

- `preview/sheet-bodies.png` — all seven colourways, no accessories
- `preview/sheet-eyes.png` — all six eyes
- `preview/sheet-mouths.png` — all six mouths
- `preview/sheet-headwear.png` — all seven headwear
- `preview/sheet-neck.png` — all five chains
- `preview/sheet-bling.png` — all five bling
- `preview/sheet-legendaries.png` — the ten one-of-ones
- `preview/sheet-combos.png` — stacked combinations, to check traits coexist

## Anatomy the accessories anchor to

Read off the master sprite rather than assumed:

```
dome outline    row 7 cols 19-25, widening to cols 14-32 by row 13
blowhole        col 23, row 7
eye ring        rows 21-23 cols 19-21, pupil (20, 22)
mouth seam      row 26; beak rows 24-25 cols 26-34
chest           rows 27+ cols 17-26
left fin        rows 38-47 cols 5-15
```

## Two things changed from the brief, and why

**The spout now rises up and back** rather than straight up. As specified it
collided with anything worn on the dome — The Firstborn is halo *and* diamond
spout, and the two were drawn on top of each other. Angling it back off the
blowhole clears every hat and keeps the trait combinable.

**The halo is drawn as a ring with an open middle**, not a band. Drawn solid it
read as a gold bar floating over the head.

## Still to come

The generator itself — weighted selection, exclusions, dedupe, the 1000
renders, metadata, `rarity.csv` and contact sheets per 100. The art wants
signing off first.
