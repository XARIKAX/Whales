import { useEffect, useRef, useState } from "react";

const fine = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A soft ripple ring trailing the pointer, and one expanding ring per click.
 * Desktop only — it never mounts on touch, so phones carry none of the cost.
 */
export default function Cursor() {
  const ring = useRef(null);
  const [rings, setRings] = useState([]);
  const [enabled] = useState(fine);

  useEffect(() => {
    if (!enabled) return;

    // The ring lags the pointer by ~80ms, which is what makes it feel like it
    // is moving through water rather than pinned to the cursor.
    let target = { x: -100, y: -100 };
    let at = { x: -100, y: -100 };
    let frame = 0;
    let id = 0;

    const onMove = (e) => {
      target = { x: e.clientX, y: e.clientY };
    };

    const onDown = (e) => {
      const key = id++;
      setRings((list) => [...list, { key, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setRings((list) => list.filter((r) => r.key !== key)), 650);
    };

    const tick = () => {
      at.x += (target.x - at.x) * 0.18;
      at.y += (target.y - at.y) * 0.18;
      if (ring.current) {
        ring.current.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      }
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div className="cursor-ring" ref={ring} aria-hidden="true" />
      {rings.map((r) => (
        <span
          key={r.key}
          className="cursor-click"
          style={{ transform: `translate3d(${r.x}px, ${r.y}px, 0)` }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

/**
 * Cards lean toward the pointer. One delegated listener for the whole page
 * rather than one per card, writing CSS variables the stylesheet reads.
 */
export function useCardTilt() {
  useEffect(() => {
    if (!fine()) return;

    let frame = 0;
    let pending = null;

    const apply = () => {
      frame = 0;
      if (!pending) return;
      const { card, x, y } = pending;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--tx", ((x - r.left) / r.width - 0.5).toFixed(3));
      card.style.setProperty("--ty", ((y - r.top) / r.height - 0.5).toFixed(3));
    };

    const onMove = (e) => {
      const card = e.target.closest?.(".fact, .step, .whale-tile");
      if (!card) return;
      pending = { card, x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = (e) => {
      const card = e.target.closest?.(".fact, .step, .whale-tile");
      if (!card) return;
      card.style.removeProperty("--tx");
      card.style.removeProperty("--ty");
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}
