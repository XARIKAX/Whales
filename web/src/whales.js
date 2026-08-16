/**
 * The chain's whale rows into the shape the pages draw.
 *
 * `whaleStates` returns what the contracts store: a holder, an activation
 * timestamp, a weight in basis points, wei figures. The pages want days held, a
 * creature to draw and a tier to label. This is the one place that translation
 * happens.
 */

const SPECIES_BY_TIER = {
  Legendary: "blue",
  Rare: "sperm",
  Uncommon: "narwhal",
  Common: "humpback",
};

/** Which creature stands in for a whale until its own art has loaded. */
export const speciesFor = (tier) => SPECIES_BY_TIER[tier] || "humpback";

export function fromChain(rows, now = Math.floor(Date.now() / 1000)) {
  return rows.map((row) => {
    const fed = row.activatedAt !== 0n;
    return {
      tokenId: Number(row.tokenId),
      holder: row.holder,
      account: row.account,
      // Already delivered and sitting in the whale's own wallet, waiting for
      // the holder to move it out.
      accountBalance: row.accountBalance ?? 0n,
      accountDeployed: Boolean(row.accountDeployed),
      fed,
      weight: Number(row.weight || 0),
      heldDays: fed ? Math.max(0, Math.floor((now - Number(row.activatedAt)) / 86_400)) : 0,
      lifetimeEarned: row.lifetimeEarned ?? 0n,
      // The contract calls this `claimable`. The pages call it what a holder
      // would: money that is theirs and has not landed yet.
      unclaimed: row.claimable ?? 0n,
      // Tier is a metadata trait, which is a gateway fetch away rather than a
      // contract read, so the tiles fill it in as their art arrives.
      tier: null,
      species: "humpback",
    };
  });
}

/** The subset of a pod one wallet holds. Empty when no wallet is connected. */
export function heldBy(rows, account) {
  if (!account) return [];
  const owner = account.toLowerCase();
  return rows.filter((row) => row.holder?.toLowerCase() === owner);
}
