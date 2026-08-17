/**
 * Stand-in data for the two wallet pages until the contracts are deployed.
 *
 * It is deliberately obvious that it is a stand-in: every page that uses it
 * says so on the page, in the same panel as the numbers, rather than quietly
 * showing invented figures as if they were read from a chain. The shapes match
 * what `readWhales` and `readOcean` return, so swapping in the real reads is a
 * change of source and nothing else.
 */

/**
 * The twelve whose art is in the repository, so every showcase on the site
 * draws the real collection rather than a swimming sprite standing in for it.
 * Ids, names and tiers match the pieces in `public/whales`; the eight named in
 * the docs are the one-of-ones.
 */
const SPECIES = ["humpback", "orca", "beluga", "narwhal", "blue", "sperm"];

export const CAST = [
  ["0001", "The Firstborn", "Legendary"],
  ["0100", "The Don", "Legendary"],
  ["0200", "Old Ironside", "Legendary"],
  ["0400", "Deep King", "Legendary"],
  ["0500", "The Siren", "Legendary"],
  ["0600", "Goldback", "Legendary"],
  ["0700", "The Captain", "Legendary"],
  ["0900", "Laser Leviathan", "Legendary"],
  ["0042", "Blue", "Rare"],
  ["0137", "Ironjaw", "Uncommon"],
  ["0613", "Saltwake", "Uncommon"],
  ["0002", "Second", "Common"],
];

const BY_ID = new Map(CAST.map((row) => [row[0], row]));

/** A believable wallet: a couple of good ones, not eight one-of-ones. */
const WALLET = ["0100", "0042", "0700", "0137", "0613", "0002"];

/** Deterministic pseudo-random, so the sample never reshuffles between renders. */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sample(seed) {
  const r = rng(seed);
  return WALLET.map((wanted, i) => {
    const [id, name, tier] = BY_ID.get(wanted);
    /* Half and half: a page that only ever shows awake whales never shows what
       it is for. */
    const fed = i % 2 === 0;
    const days = Math.floor(r() * 220);
    /* Weight climbs with time held, capped at 3.33x, and a dormant whale
       carries none of it. Same rule the contract uses, so the sample never
       shows a combination the chain could not produce. */
    const weight = fed ? Math.min(33_300, 10_000 + days * 106) : 0;
    return {
      tokenId: Number(id),
      id,
      name,
      tier,
      art: `/whales/${id}.webp`,
      species: SPECIES[i % SPECIES.length],
      fed,
      weight,
      heldDays: days,
      /* Wei, as bigints, exactly as the chain would hand them over. */
      lifetimeEarned: BigInt(Math.floor(fed ? 0.2e18 + r() * 2.2e18 : 0)),
      unclaimed: BigInt(Math.floor(fed ? r() * 1.1e17 : 0)),
    };
  });
}

export const SAMPLE_WHALES = sample(41);

/** What a wallet with none of them sees. */
export const SAMPLE_EMPTY = [];

export const SAMPLE_MARKET = {
  floor: 0.184,
  floorChange: 0.062,
  volume24h: 11.4,
  listed: 37,
  supply: 1000,
  activated: 412,
  potEth: 3.812,
  hauledEth: 47.309,
  hauls: 22,
};

/** Recent hauls, newest first. `share` is this wallet's cut of each. */
export const SAMPLE_PAYOUTS = [
  { block: 21_904_118, ago: "2h", pot: 2.41, share: 0.0412, whales: 3 },
  { block: 21_898_552, ago: "9h", pot: 1.98, share: 0.0338, whales: 3 },
  { block: 21_890_701, ago: "1d", pot: 3.12, share: 0.0511, whales: 2 },
  { block: 21_876_330, ago: "2d", pot: 2.04, share: 0.0344, whales: 2 },
  { block: 21_861_009, ago: "4d", pot: 2.77, share: 0.0455, whales: 2 },
];

export const ACTIVATION_COST = 1_000_000;

const SPECIES_BY_TIER = {
  Legendary: "blue",
  Rare: "sperm",
  Uncommon: "narwhal",
  Common: "humpback",
};

/**
 * The chain's whale rows into the shape these two pages draw.
 *
 * `readWhales` returns what the contract stores: an activation timestamp, a
 * weight in basis points, lifetime earnings in wei. The pages want a species to
 * draw, a tier to label and a number of days held. This is the one place that
 * translation happens, so when the reads go live nothing downstream changes.
 */
export function fromChain(rows, now = Math.floor(Date.now() / 1000)) {
  return rows.map((row) => {
    const fed = row.activatedAt !== 0n;
    const tier = row.tier || "Common";
    return {
      tokenId: Number(row.tokenId),
      species: SPECIES_BY_TIER[tier] || "humpback",
      tier,
      fed,
      weight: Number(row.weight || 0),
      heldDays: fed ? Math.max(0, Math.floor((now - Number(row.activatedAt)) / 86_400)) : 0,
      lifetimeEarned: row.lifetimeEarned ?? 0n,
      unclaimed: row.unclaimed ?? 0n,
    };
  });
}


/** The mint, as designed, until there is a contract to read it from. */
export const MINT = {
  supply: 1000,
  minted: 0,
  /** One dollar a whale, quoted in wei so the panel reads the same either way. */
  price: 350_000_000_000_000n,
  priceLabel: "$1 a whale",
};
