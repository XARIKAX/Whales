import { useEffect, useRef, useState } from "react";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Numbers arrive with mass rather than easing politely into place, but they
   arrive from below.
   This used to overshoot two percent before settling, which is a lovely motion
   for an open-ended figure and a lie for a capped one: on a counter reading
   "1,000 / 1,000" the overshoot renders 1,037 of 1,000 for a few frames, and a
   supply that goes over its own maximum is the one number on this page nobody
   would forgive. Fast out, slow in, and never past the value. */
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Counts a figure up when it first scrolls into view, then tracks the live
 * value directly. `format` receives a number and returns what to render, so
 * the animation works for ETH, dollars and plain counts alike.
 */
export default function CountUp({ value, format, duration = 800, className = "" }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(() => (reduced() ? value : 0));
  const played = useRef(reduced());

  useEffect(() => {
    // Once it has played, follow the chain rather than re-animating on poll.
    if (played.current) {
      setDisplay(value);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        played.current = true;

        const start = performance.now();
        const from = 0;
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          setDisplay(from + (value - from) * easeOut(t));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
