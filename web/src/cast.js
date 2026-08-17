/**
 * The whales the site puts on show.
 *
 * The collection is a thousand pieces and all of them ship in `public/whales`,
 * which is far too many to put on a landing page: a wall of a thousand says
 * "supply", a handful says "cast". These are chosen for having the most going
 * on — crowns, cigars, laser eyes, a bubble pipe — and their names and tiers
 * come straight from the metadata that ships beside the art.
 */
export const CAST = [
  ["0100", "The Don", "Legendary"],
  ["0900", "Laser Leviathan", "Legendary"],
  ["0700", "The Captain", "Legendary"],
  ["0400", "Deep King", "Legendary"],
  ["0300", "The Ghost", "Legendary"],
  ["0800", "Trenchkeeper", "Legendary"],
  ["0088", "Crowned punk", "Uncommon"],
  ["0026", "Sailor cigar", "Uncommon"],
  ["0022", "Haloed laser", "Uncommon"],
  ["0136", "Shaded captain", "Uncommon"],
  ["0137", "Ironjaw", "Uncommon"],
  ["0101", "Kelp punk", "Uncommon"],
];

const BY_ID = new Map(CAST.map((row) => [row[0], row]));

/** Six for the landing page, eight for the mint, in the order they read best. */
export const MEET = ["0100", "0900", "0088", "0026", "0700", "0022"].map((id) => BY_ID.get(id));
export const GALLERY = ["0100", "0088", "0900", "0026", "0700", "0022", "0136", "0137"].map(
  (id) => BY_ID.get(id)
);

/** A believable wallet: a couple of good ones, not six one-of-ones. */
export const WALLET = ["0100", "0088", "0700", "0137", "0026", "0022"].map((id) => BY_ID.get(id));

/** Four digits, always, because that is how the files are named. */
export const pad = (tokenId) => String(tokenId).padStart(4, "0");

/**
 * Where a whale's picture is.
 *
 * Every one of the thousand exists as a PNG. The two dozen the site actually
 * shows also exist as WebP, which is eight times smaller for the same pixels,
 * so those are preferred and the rest fall back.
 */
const HAS_WEBP = new Set([
  ...CAST.map(([id]) => id),
  "0001",
  "0002",
  "0042",
  "0200",
  "0500",
  "0600",
  "0613",
  "0020",
  "0050",
  "0059",
  "0109",
]);

export function artFor(tokenId) {
  const id = pad(tokenId);
  return `/whales/${id}.${HAS_WEBP.has(id) ? "webp" : "png"}`;
}
