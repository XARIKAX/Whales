import { useMemo } from "react";
import { useWhaleArt } from "./WhaleArt.jsx";
import Reveal from "./Reveal.jsx";
import { multiplier } from "../format.js";

const TIERS = [
  ["Surface Swimmers", "the shallows, 57.5%"],
  ["Reef Cruisers", "30%"],
  ["Twilight Divers", "10%"],
  ["Abyss Dwellers", "2.4%"],
  ["The Leviathan", "1 of 1000"],
];

function Tile({ whale }) {
  const fed = whale.activatedAt !== 0n;
  const { ref, art, tier } = useWhaleArt(whale.tokenId, { eager: true });
  // One in a thousand. Gold is reserved for yield, fed whales, and this.
  const leviathan = tier === "Leviathan";

  return (
    <div className={`whale-tile ${fed ? "fed" : "dormant"}${leviathan ? " leviathan" : ""}`}>
      <div ref={ref} className="tile-art">
        {art && <img src={art.image} alt={`Whale #${whale.tokenId}`} loading="lazy" />}
      </div>
      <div className="tile-body">
        <div className="tile-id">
          #{String(whale.tokenId)}
          {fed && <span className="tile-mult num">{multiplier(whale.weight)}</span>}
        </div>
        <div className="tile-tier">{tier || (fed ? "Fed" : "Dormant")}</div>
      </div>
    </div>
  );
}

/**
 * A full-width strip of pixel whales. Shows a sample rather than all 1000 —
 * fed whales first so the gold glow leads, with dormant ones mixed in behind.
 */
export default function Carousel({ whales }) {
  const sample = useMemo(() => {
    const fed = whales.filter((w) => w.activatedAt !== 0n);
    const dormant = whales.filter((w) => w.activatedAt === 0n);

    // Interleave so the strip alternates gold and grey-blue rather than
    // showing one long block of each.
    const picked = [];
    for (let i = 0; i < 20; i++) {
      if (fed[i]) picked.push(fed[i]);
      if (dormant[i * 7]) picked.push(dormant[i * 7]);
    }
    return picked.slice(0, 24);
  }, [whales]);

  if (sample.length === 0) return null;

  return (
    <section className="deep" id="pod">
      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow on-dark">The pod</p>
          <h2 className="display">Surface swimmers to the leviathan.</h2>
        </Reveal>
      </div>

      <div className="carousel" style={{ marginTop: 40 }}>
        {/* Doubled so the marquee can loop seamlessly at -50%. */}
        <div className="carousel-track">
          {[...sample, ...sample].map((whale, i) => (
            <Tile key={`${whale.tokenId}-${i}`} whale={whale} />
          ))}
        </div>
      </div>

      <div className="wrap">
        <Reveal className="tier-legend" stagger step={40}>
          {TIERS.map(([name, note]) => (
            <span key={name}>
              <b>{name}</b> — {note}
            </span>
          ))}
        </Reveal>
        <p className="lede on-dark" style={{ marginTop: 18 }}>
          Rarer whales don't earn more. They just flex harder — weight comes from loyalty alone.
          Activated whales glow gold; dormant ones sit grey-blue in the dark.
        </p>
      </div>
    </section>
  );
}
