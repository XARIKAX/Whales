/**
 * One scroll subscription for the entire page.
 *
 * There were three, and one of them was the reason the site felt heavy no
 * matter how much was cut from the scene. `useDepth` ran `setState` on every
 * scroll event, which re-rendered the whole application sixty times a second,
 * and it read `document.body.scrollHeight` each time — a forced synchronous
 * layout of the document, per event. Measured over a 120-frame scroll, the page
 * was doing 218 forced layouts: nearly two per frame, before painting anything.
 *
 * So: one listener, one requestAnimationFrame, one computation, many consumers.
 * The document height is measured on load and on resize and cached in between,
 * because it cannot change from scrolling. Nothing in here reads layout on a
 * scroll frame, and nothing in here touches React state.
 */

let span = 1;
let progress = 0;
let frame = 0;
const listeners = new Set();

function measure() {
  span = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

function tick() {
  frame = 0;
  const next = Math.min(1, Math.max(0, window.scrollY / span));
  if (next === progress) return;
  progress = next;
  for (const listener of listeners) listener(progress);
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function onResize() {
  measure();
  schedule();
}

/**
 * Calls `listener(progress)` with 0 at the top of the document and 1 at the
 * bottom, at most once per frame. Returns an unsubscribe function.
 */
export function onDive(listener) {
  if (listeners.size === 0) {
    measure();
    progress = Math.min(1, Math.max(0, window.scrollY / span));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
  }

  listeners.add(listener);
  listener(progress);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

/** How deep the dive goes, in metres, for anything that displays a reading. */
export const FLOOR = 3700;
