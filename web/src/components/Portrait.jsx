import { useWhaleArt } from "./WhaleArt.jsx";
import Creature from "./pixel/creature.jsx";
import { CONFIGURED } from "../config.js";

/**
 * A whale's actual picture.
 *
 * Three sources, in order of how true they are. A sample row carries the path to
 * a piece that ships with the site. A live row has its art on chain and reads it
 * lazily, one call, only once the tile is near the viewport. If neither exists
 * yet the swimming sprite stands in, which is honest about being a placeholder
 * because it is visibly not a portrait.
 *
 * These pages are about the collection, so the picture is the subject and the
 * numbers are the caption. Everywhere else on the site the animals are scenery
 * and the numbers are the subject; this is the one place that inverts.
 */
export default function Portrait({ whale, size = 240, className = "" }) {
  const { ref, art } = useWhaleArt(whale.tokenId, {
    skip: Boolean(whale.art) || !CONFIGURED,
  });
  const src = whale.art || art?.image;

  return (
    <div ref={ref} className={`portrait ${className}`.trim()}>
      {src ? (
        <img
          src={src}
          alt={whale.name ? `Whale #${whale.tokenId}, ${whale.name}` : `Whale #${whale.tokenId}`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="portrait-stand-in">
          <Creature kind="whale" species={whale.species || "humpback"} height={size * 0.42} beat={2.2} />
        </span>
      )}
    </div>
  );
}
