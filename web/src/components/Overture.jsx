import { useEffect, useState } from "react";

const KEY = "whales:overture";
const DURATION = 1500;

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The opening: deep water, light blooming from above, the surface rising past
 * the camera. 1.5s, skippable by any input, and once per session — nobody
 * should sit through it twice. Reduced motion gets none of it.
 *
 * Returns `playing` so the hero knows to hold its reveal until the water has
 * cleared.
 */
export function useOverture() {
  const [playing, setPlaying] = useState(() => {
    if (typeof window === "undefined") return false;
    if (reduced()) return false;
    try {
      return sessionStorage.getItem(KEY) !== "seen";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!playing) return;

    try {
      sessionStorage.setItem(KEY, "seen");
    } catch {
      /* private mode — it will simply play again next load */
    }

    const done = () => setPlaying(false);
    const timer = setTimeout(done, DURATION);

    // Any deliberate input skips the rest of it.
    window.addEventListener("pointerdown", done, { once: true });
    window.addEventListener("keydown", done, { once: true });
    window.addEventListener("wheel", done, { once: true, passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", done);
      window.removeEventListener("keydown", done);
      window.removeEventListener("wheel", done);
    };
  }, [playing]);

  // Lock the page while it runs, so a scroll during the bloom does not fight it.
  useEffect(() => {
    if (!playing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [playing]);

  return playing;
}

export default function Overture({ playing }) {
  if (!playing) return null;

  return (
    <div className="overture" aria-hidden="true">
      <div className="overture-deep" />
      <div className="overture-bloom" />
      <div className="overture-surface" />
    </div>
  );
}
