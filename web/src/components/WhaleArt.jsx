import { useEffect, useRef, useState } from "react";
import { readArt } from "../chain.js";

/** Art is immutable once revealed, so it is worth caching for the session. */
const cache = new Map();
const inflight = new Map();

// Art reads are one eth_call each and return a whole base64 SVG. Cap how many
// are in the air at once so a wall of whales does not stampede the RPC.
const MAX_CONCURRENT = 6;
let active = 0;
const queue = [];

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    active++;
    job().finally(() => {
      active--;
      pump();
    });
  }
}

function fetchArt(tokenId) {
  const key = String(tokenId);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const promise = new Promise((resolve, reject) => {
    queue.push(() =>
      readArt(BigInt(tokenId))
        .then((art) => {
          cache.set(key, art);
          inflight.delete(key);
          resolve(art);
        })
        .catch((e) => {
          inflight.delete(key);
          reject(e);
        })
    );
    pump();
  });

  inflight.set(key, promise);
  return promise;
}

/**
 * A whale's art and traits, read straight off the chain — but only once the
 * element is about to be seen. With 1000 whales, fetching every tokenURI up
 * front would be 1000 eth_calls before the page could paint.
 *
 * Returns state rather than reading the cache during render, so a tile that
 * mounts before its art arrives still updates when it does.
 */
export function useWhaleArt(tokenId, { eager = false } = {}) {
  const [art, setArt] = useState(() => cache.get(String(tokenId)) || null);
  const ref = useRef(null);

  useEffect(() => {
    const cached = cache.get(String(tokenId));
    if (cached) {
      setArt(cached);
      return;
    }

    let live = true;
    const load = () => {
      fetchArt(tokenId)
        .then((value) => live && setArt(value))
        .catch(() => {});
    };

    const node = ref.current;
    // `eager` exists for the carousel: its tiles are moved by a CSS marquee,
    // and IntersectionObserver does not reliably re-fire for animated
    // transforms, so tiles that scroll into view would never load.
    if (eager || !node || typeof IntersectionObserver === "undefined") {
      load();
      return () => {
        live = false;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);

    return () => {
      live = false;
      observer.disconnect();
    };
  }, [tokenId, eager]);

  const tier = art?.attributes?.find((a) => a.trait_type === "Tier")?.value || null;
  return { ref, art, tier };
}

export default function WhaleArt({ tokenId, alt, className = "" }) {
  const { ref, art } = useWhaleArt(tokenId);

  return (
    <div ref={ref} className={className}>
      {art && <img src={art.image} alt={alt || `Whale #${tokenId}`} loading="lazy" />}
    </div>
  );
}
