# Whales — art pipeline

Generates the 1000-piece collection. Deterministic: same seed, same 1000
whales, every time.

```bash
pip install pillow numpy
python3 generate.py --cid bafy…      # the pinned image CID; omit for a placeholder
python3 generate.py --limit 20       # a quick sample while iterating
```

Writes into `output/`:

| | |
| --- | --- |
| `images/0001.png … 1000.png` | the art |
| `metadata/0001.json … 1000.json` | ERC-721 metadata, `image` pointing at `--cid` |
| `rarity.csv` | every token's traits and rarity score, one row each |
| `sheets/0001-0100.png …` | ten contact sheets, 100 whales each |
| `provenance.json` | written by `contracts/scripts/provenance.js`, not by this |

`--cid` is baked into every `image` field, so **regenerate after pinning the
images** and pin the metadata second. See step 2 of `../HANDOVER.md`.

## Files

| File | What it is |
| --- | --- |
| `sprite.py` | Master grid, classification, palette, and the approved `render()` |
| `traits.py` | The trait catalog — every accessory, drawn cell by cell |
| `body.py` | Body colourways, as an HSV remap that preserves luminance |
| `generate.py` | Allocation, rules, dedupe, the 1000 renders, metadata, sheets |
| `preview.py` | Proof sheets of every trait, for sign-off → `preview/` |
| `gen9.py` | The original renderer, as supplied. Left alone for reference. |

**The renderer and its finish parameters are untouched.** `sprite.py` carries
`render()` across from `gen9.py` verbatim — per-cell jitter, ambient occlusion,
blur 1.3, unsharp 3/42/2. Everything new sits on top as overlay cell-maps in
sprite coordinates.

## How the 1000 are dealt

**Ten legendaries first**, pinned to ids 1, 100, 200 … 900, exempt from the
weights. Their trait tuples are reserved so no regular whale can accidentally
become a near-twin of a one-of-one.

**The other 990 by quota, not by dice.** The brief asks the advertised weights
to hold within ±1.5pp. Rolling each token independently can't promise that —
for a 22% trait over 990 tokens one standard deviation is already 1.3pp, so a
straight sample misses the tolerance about a quarter of the time. Instead each
slot gets its exact integer count (largest remainder, so counts sum to 990),
the lists are shuffled with the seeded RNG, and tokens take one from each. The
distribution is exact by construction; the seed still decides who gets what.

**Cross-slot rules as swaps.** Rules like "gilded bodies never wear a plain
cap" are applied afterwards by swapping traits *between* tokens, which enforces
them without disturbing a single column total.

`generate.py` refuses to finish if the anchors, the distribution or the dedupe
check fail. It is safe to trust its exit code.

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

**The spout rises up and back** rather than straight up. As specified it
collided with anything worn on the dome — The Firstborn is halo *and* diamond
spout, and the two were drawn on top of each other. Angling it back off the
blowhole clears every hat and keeps the trait combinable.

**The halo is a ring with an open middle**, not a band. Drawn solid it read as
a gold bar floating over the head.

One approved trait was also corrected: the cigar had a cell at column 48 on a
0–47 grid. It was moved one column left rather than weakening the anchor check.
