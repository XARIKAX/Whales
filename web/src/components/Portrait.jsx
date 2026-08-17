import Creature from "./pixel/creature.jsx";
import { artFor } from "../cast.js";

/**
 * A whale's actual picture.
 *
 * All thousand pieces ship with the site, so the picture is a path rather than
 * an `eth_call`: nothing here waits on a chain, and a page that shows a pod
 * shows it before a wallet is connected. The swimming sprite only stands in for
 * an id outside the collection, where it is honest about being a placeholder
 * because it is visibly not a portrait.
 *
 * These pages are about the collection, so the picture is the subject and the
 * numbers are the caption. Everywhere else on the site the animals are scenery
 * and the numbers are the subject; this is the one place that inverts.
 */
export default function Portrait({ whale, size = 240, className = "" }) {
  const id = Number(whale.tokenId);
  const src = whale.art || (id >= 1 && id <= 1000 ? artFor(id) : null);

  return (
    <div className={`portrait ${className}`.trim()}>
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
          <Creature
            kind="whale"
            species={whale.species || "humpback"}
            height={size * 0.42}
            beat={2.2}
          />
        </span>
      )}
    </div>
  );
}
