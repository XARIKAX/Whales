import { useEffect, useState } from "react";
import { onDive } from "../../dive.js";

/**
 * Where the reader is, measured once per frame for the whole page.
 *
 * Three things on this page want to know how far down the article you are: the
 * progress line at the top of the viewport, the sliding marker on the contents
 * rail, and the title in the mini-header. Given three components that is three
 * scroll listeners, three `getBoundingClientRect` sweeps per frame, and a
 * forced layout in each of them — the exact fault `dive.js` was written to fix
 * for the landing page. So this subscribes to that same single rAF instead of
 * opening a fourth.
 *
 * Two rules keep it cheap:
 *
 *   1. **Nothing measures layout on a scroll frame.** Section offsets are read
 *      once on mount, again on resize, and again when the webfont lands (which
 *      is the one thing that reflows the article after first paint). Between
 *      those they are just numbers.
 *   2. **Progress does not go through React.** It is written straight to a CSS
 *      variable on the root element, so a scroll paints without rendering a
 *      single component. Only the active section — which changes a handful of
 *      times per read, not sixty times a second — is state.
 */
export function useReading(ids) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    let tops = [];
    let start = 0;
    let span = 1;
    let last = -1;

    const measure = () => {
      const nodes = ids.map((id) => document.getElementById(id));
      if (nodes.some((n) => !n)) return;

      const y = window.scrollY;
      tops = nodes.map((n) => n.getBoundingClientRect().top + y);
      start = tops[0];

      // The article ends where its last section ends, not where the document
      // does — the footer is not part of the read, and counting it would leave
      // the bar short of full at the last word.
      const lastNode = nodes[nodes.length - 1];
      const end = lastNode.getBoundingClientRect().bottom + y;
      span = Math.max(1, end - start - window.innerHeight * 0.5);
    };

    const read = () => {
      if (tops.length === 0) return;

      const y = window.scrollY;
      root.style.setProperty("--read", String(Math.min(1, Math.max(0, (y - start) / span))));

      // The section you are reading is the last heading to have crossed a third
      // of the way down the window — where the eye actually sits, not the top
      // edge, where a heading is still arriving.
      const line = y + window.innerHeight / 3;
      let next = 0;
      for (let i = 0; i < tops.length; i += 1) if (tops[i] <= line) next = i;
      if (next !== last) {
        last = next;
        setActive(next);
      }
    };

    measure();
    const stop = onDive(read);
    const onResize = () => {
      measure();
      read();
    };

    window.addEventListener("resize", onResize);
    // Anton and Space Grotesk both change the height of the article when they
    // land. Re-measuring on that promise is the difference between a rail that
    // is right and one that is a section behind until you resize the window.
    if (document.fonts?.ready) document.fonts.ready.then(onResize);

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      root.style.removeProperty("--read");
    };
  }, [ids]);

  return active;
}

/**
 * Copies text and reports whether it landed, for the anchor links and the
 * address rows. `navigator.clipboard` is missing on http origins and inside
 * some in-app browsers, so there is a fallback rather than a dead button.
 */
export async function copy(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }

  try {
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.cssText = "position:fixed;top:-100vh;opacity:0";
    document.body.appendChild(scratch);
    scratch.select();
    const ok = document.execCommand("copy");
    scratch.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * True once the element has been near the viewport, and stays true.
 *
 * The widgets and the loop animation are mounted but inert until this flips, so
 * nothing below the fold costs anything to scroll past. `rootMargin` fires it
 * before arrival so a widget is ready by the time it is looked at rather than
 * assembling itself under the reader.
 */
export function useNear(ref, rootMargin = "200px") {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setNear(true);
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, near, rootMargin]);

  return near;
}

/** Whether the reader has asked for less movement. Live, not read once. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}
