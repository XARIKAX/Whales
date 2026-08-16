import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { copy } from "./reading.js";

/* --- Toast ---------------------------------------------------------------- */

/**
 * One line of confirmation, shared by everything that copies something.
 *
 * A module-level emitter rather than context: the things that raise a toast —
 * heading anchors, the terminal block, address rows — sit at every depth of the
 * page, and threading a callback to all of them would put a prop on components
 * that otherwise have nothing to do with each other.
 */
const toasters = new Set();

export function toast(message) {
  for (const t of toasters) t(message);
}

export function Toast() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let timer = 0;
    const show = (next) => {
      setMessage(next);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 2000);
    };
    toasters.add(show);
    return () => {
      toasters.delete(show);
      clearTimeout(timer);
    };
  }, []);

  return (
    /* Polite, not assertive: a copy confirmation must never interrupt what a
       screen reader is in the middle of saying. */
    <div className="toast-rail" role="status" aria-live="polite">
      {message && <span className="toast">{message}</span>}
    </div>
  );
}

/* --- Reading progress ----------------------------------------------------- */

/**
 * A hairline of gold across the top of the viewport.
 *
 * It reads `--read`, which the single scroll reader writes straight onto the
 * root element — so a scroll repaints this bar without rendering a component.
 * `scaleX` rather than width, so the repaint is a composite.
 */
export function ProgressLine() {
  return (
    <div className="readbar" aria-hidden="true">
      <span className="readbar-fill" />
    </div>
  );
}

/* --- Contents rail -------------------------------------------------------- */

/**
 * The rail, with a marker that travels.
 *
 * The marker is one element that moves between rows rather than a border that
 * lights up on whichever row is active. That difference is the whole point: a
 * colour swap tells you where you are, a marker that slides tells you which way
 * you are going and how far apart the sections are.
 *
 * Its position is measured from the rows themselves, so it stays correct when a
 * label wraps to two lines at a narrow width.
 */
export function Contents({ sections, active }) {
  const listRef = useRef(null);
  const [mark, setMark] = useState({ top: 0, height: 0 });

  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.children[active];
    if (!row) return;

    const place = () => setMark({ top: row.offsetTop, height: row.offsetHeight });
    place();

    /* The rows change height when the font lands and when the column narrows.
       Watching the list is cheaper and more reliable than guessing at both. */
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

  return (
    <aside className="toc" aria-label="Contents">
      <p className="toc-head mono">Contents</p>
      <div className="toc-body">
        <span
          className="toc-mark"
          aria-hidden="true"
          style={{ "--top": `${mark.top}px`, "--h": `${mark.height}px` }}
        />
        <ol ref={listRef}>
          {sections.map(([id, label], i) => (
            <li key={id}>
              <a
                className={`toc-link${active === i ? " on" : ""}`}
                href={`#${id}`}
                aria-current={active === i ? "true" : undefined}
              >
                <span className="toc-n mono">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

/* --- Mini-header ---------------------------------------------------------- */

/**
 * Where you are, in the nav pill, once the title has gone.
 *
 * Portalled into a slot the nav renders rather than passed down through the
 * shell: the shell draws the chrome for every page and has no business knowing
 * that one of them has sections.
 */
export function MiniHeader({ sections, active, show }) {
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    setSlot(document.getElementById("nav-trail"));
  }, []);

  if (!slot || !show) return null;

  return createPortal(
    <span className="trail">
      <span className="trail-sep" aria-hidden="true">
        /
      </span>
      <span className="trail-now">{sections[active][1]}</span>
      <span className="trail-meter" aria-hidden="true">
        <span className="trail-meter-fill" />
      </span>
    </span>,
    slot
  );
}

/* --- Heading anchors ------------------------------------------------------ */

/**
 * The `#` beside a heading.
 *
 * It is a real link, so it can be opened in a tab and dragged to a bookmark,
 * and the click is intercepted only to put the absolute URL on the clipboard —
 * which is what somebody reaching for it actually wants. Hidden until the
 * heading is hovered or the link itself is focused, so it never sits in the
 * margin as decoration.
 */
export function Anchor({ id }) {
  return (
    <a
      className="anchor mono"
      href={`#${id}`}
      aria-label="Copy a link to this section"
      onClick={async (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const url = `${window.location.origin}${window.location.pathname}#${id}`;
        window.history.replaceState({}, "", `#${id}`);
        toast((await copy(url)) ? "Link copied" : "Link updated");
      }}
    >
      #
    </a>
  );
}

/* --- Prev / next ---------------------------------------------------------- */

const GUIDES = ["plain", "crown", "cigar", "monocle"];

/** A whale rides each link, picked from the id so it is stable per section. */
function guideFor(id) {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return GUIDES[sum % GUIDES.length];
}

export function PrevNext({ sections, active }) {
  const prev = active > 0 ? sections[active - 1] : null;
  const next = active < sections.length - 1 ? sections[active + 1] : null;

  return (
    <nav className="stepnav" aria-label="Section">
      {prev ? (
        <a className="stepnav-link back" href={`#${prev[0]}`}>
          <img src={`/whales/guide/${guideFor(prev[0])}.webp`} alt="" width="176" height="176" loading="lazy" />
          <span>
            <span className="stepnav-dir mono">Back</span>
            <span className="stepnav-name">{prev[1]}</span>
          </span>
        </a>
      ) : (
        <span />
      )}

      {next && (
        <a className="stepnav-link on" href={`#${next[0]}`}>
          <span>
            <span className="stepnav-dir mono">Next</span>
            <span className="stepnav-name">{next[1]}</span>
          </span>
          <img src={`/whales/guide/${guideFor(next[0])}.webp`} alt="" width="176" height="176" loading="lazy" />
        </a>
      )}
    </nav>
  );
}
