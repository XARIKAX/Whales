"""Publishes the collection into the website, to be served from our own domain.

    python3 publish.py                       # https://whalenft.fun
    python3 publish.py --base-url https://…  # somewhere else
    python3 publish.py --size 728            # smaller, if the deploy is tight

Writes two directories into `web/public/`:

    whales/0001.png … 1000.png      the art
    metadata/0001.json … 1000.json  ERC-721 metadata pointing at it

The names are not a choice. `Whales.tokenURI(42)` returns
`<baseURI>0042.json` — zero-padded to four digits, with the extension — so the
files are named to match the contract rather than the contract being changed to
match the files. That also means the JSON is served as a real `.json`, which
every host already sends as `application/json`; extensionless files need a
`Content-Type` override on every host, and that override is a thing that can be
forgotten or lost in a config migration.

On size
-------
The masters are 1248px, and 1000 of them is 122 MB. Vercel's Hobby plan caps a
deployment's source files at 100 MB, so shipping the masters would simply fail.
832px is 72 MB, which fits with room to spare and is still comfortably above the
~600px OpenSea renders at. The masters stay in `output/images/`, regenerable
from the seed, so nothing is lost — this is the display copy.
"""
import argparse
import json
import shutil
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
SRC = HERE / "output"
SITE = HERE.parent / "web" / "public"
SUPPLY = 1000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="https://whalenft.fun",
                    help="where the site is served from, no trailing slash")
    ap.add_argument("--size", type=int, default=832,
                    help="width of the published PNGs; see the note on size")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    images_in = SRC / "images"
    meta_in = SRC / "metadata"
    for d in (images_in, meta_in):
        if not d.is_dir():
            raise SystemExit(f"missing {d} — run `python3 generate.py` first")

    images_out = SITE / "whales"
    meta_out = SITE / "metadata"
    images_out.mkdir(parents=True, exist_ok=True)
    # Rebuilt from scratch: a stale file from a previous run is a whale that
    # renders the wrong art and nothing anywhere would flag it.
    if meta_out.exists():
        shutil.rmtree(meta_out)
    meta_out.mkdir(parents=True)

    total = 0
    for token in range(1, SUPPLY + 1):
        name = f"{token:04d}"

        im = Image.open(images_in / f"{name}.png").convert("RGB")
        if im.width != args.size:
            im = im.resize((args.size, args.size), Image.LANCZOS)
        out = images_out / f"{name}.png"
        im.save(out, format="PNG", optimize=True, compress_level=9)
        total += out.stat().st_size

        # The traits are whatever `generate.py` decided; only the image URL
        # changes, from an ipfs:// placeholder to this domain.
        meta = json.loads((meta_in / f"{name}.json").read_text())
        meta["image"] = f"{base}/whales/{name}.png"
        meta["external_url"] = f"{base}/portfolio"
        (meta_out / f"{name}.json").write_text(json.dumps(meta, indent=1))

        if token % 200 == 0:
            print(f"  {token}/{SUPPLY}")

    print(f"\n{SUPPLY} images  {total / 1024 / 1024:.1f} MB at {args.size}px")
    print(f"{SUPPLY} metadata files pointing at {base}/whales/")
    print(f"\nbaseURI for setBaseURI():  {base}/metadata/")
    print("Recompute provenance over the published metadata before deploying:")
    print("  cd ../contracts && node scripts/provenance.js ../web/public/metadata")


if __name__ == "__main__":
    main()
