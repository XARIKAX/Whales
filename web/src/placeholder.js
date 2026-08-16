/**
 * A sample pod, shown on the two wallet pages when no wallet is connected —
 * and nowhere else. Everything a connected wallet sees is read from the chain.
 *
 * It is deliberately obvious that it is a stand-in: the pages that use it say
 * so on the page, in the same panel as the numbers, rather than quietly showing
 * invented figures as if they came from a contract. The shape matches what
 * `fromChain` produces, so the two paths draw through identical components.
 */

const TIERS = ["Common", "Common", "Uncommon", "Uncommon", "Rare", "Legendary"];
const SPECIES = ["humpback", "orca", "beluga", "narwhal", "blue", "sperm"];

/** Deterministic, so the sample never reshuffles between renders. */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sample(count, seed) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    /* Half and half: a page that only ever shows awake whales never shows what
       it is for. */
    const fed = i % 2 === 0;
    const days = Math.floor(r() * 220);
    /* Weight climbs with time held, capped at 3.33x, and a dormant whale
       carries none of it. Same rule the contract uses, so the sample never
       shows a combination the chain could not produce. */
    const weight = fed ? Math.min(33_300, 10_000 + days * 106) : 0;
    return {
      tokenId: 1 + Math.floor(r() * 999),
      species: SPECIES[Math.floor(r() * SPECIES.length)],
      tier: TIERS[Math.floor(r() * TIERS.length)],
      fed,
      weight,
      heldDays: days,
      /* Wei, as bigints, exactly as the chain would hand them over. */
      lifetimeEarned: BigInt(Math.floor(fed ? r() * 2.4e18 : 0)),
      unclaimed: BigInt(Math.floor(fed ? r() * 1.1e17 : 0)),
    };
  }).sort((a, b) => Number(b.lifetimeEarned - a.lifetimeEarned));
}

export const SAMPLE_WHALES = sample(6, 41);

export const ACTIVATION_COST = 1_000_000;
