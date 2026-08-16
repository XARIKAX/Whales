import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Anchor } from "./Chrome.jsx";

/* --- Margin notes --------------------------------------------------------- */

/**
 * Pushes each note in a section clear of the one above it.
 *
 * Two terms a line apart — which is exactly what happens in the paragraph about
 * the provenance hash and freezing — put two notes at almost the same offset,
 * one drawn over the other. The margin is a single column, so the only fix is
 * to treat it as one: walk the notes in reading order and give each the larger
 * of its own position and the bottom of the last one.
 *
 * Batched to a frame, because every note in a section calls this when it
 * measures and the work is the same each time.
 */
let pending = 0;

function stack(section) {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    let floor = -Infinity;
    section.querySelectorAll(".note-body").forEach((note) => {
      note.style.setProperty("--push", "0px");
      const wanted = note.offsetTop;
      const push = Math.max(0, floor - wanted);
      note.style.setProperty("--push", `${push}px`);
      floor = wanted + push + note.offsetHeight + 16;
    });
  });
}

/**
 * A definition in the margin, not in the sentence.
 *
 * The three terms this page cannot avoid — provenance hash, freezing, keeper —
 * each cost a clause to define inline, and defining them inline is how a
 * paragraph turns into a glossary. Out in the margin they are there for the
 * reader who needs them and invisible to the reader who does not, and the
 * sentence keeps its shape either way.
 *
 * The note's vertical position is measured rather than guessed. A term can land
 * anywhere in a paragraph, the line it lands on moves when the column narrows
 * or the webfont arrives, and a note pinned to a fixed offset is a note that is
 * beside the wrong line on half of all viewports.
 *
 * Under the breakpoint there is no margin to put anything in, so the note
 * becomes a disclosure the term opens under itself.
 */
export function Note({ term, children }) {
  const ref = useRef(null);
  const [top, setTop] = useState(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const mark = ref.current;
    const host = mark?.closest(".doc-section");
    if (!mark || !host) return;

    const place = () => {
      setTop(mark.offsetTop);
      stack(host);
    };
    place();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(place);
      observer.observe(host);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  return (
    <span className={`note${open ? " open" : ""}`}>
      <button
        type="button"
        className="note-term"
        ref={ref}
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        {term}
      </button>
      <span
        className="note-body mono"
        style={top === null ? undefined : { "--top": `${top}px` }}
        role="note"
      >
        {children}
      </span>
    </span>
  );
}

/* --- The guide ------------------------------------------------------------ */

/**
 * The whale that walks the reader down the page.
 *
 * It wears the trait the section is about — a crown where weight is the
 * subject, a cigar where the money is being counted, a monocle where the art is
 * being inspected, nothing at all where the subject is what nobody can do. Four
 * of the ten sections carry one, which is the most the page can hold before it
 * stops being a signal and starts being wallpaper.
 *
 * It lives in the same margin as the notes and is `aria-hidden`: it is a mood,
 * and a screen reader announcing "image, whale wearing a crown" at four chapter
 * breaks is four interruptions that carry nothing.
 */
export function Guide({ trait }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || seen || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setSeen(true);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);

  return (
    <span className={`guide${seen ? " seen" : ""}`} ref={ref} aria-hidden="true">
      <img src={`/whales/guide/${trait}.webp`} alt="" width="176" height="176" loading="lazy" decoding="async" />
    </span>
  );
}

/* --- Live values ---------------------------------------------------------- */

/**
 * A number that came from the chain, or an honest placeholder where one will.
 *
 * Before the contracts are deployed this is a labelled chip with a sonar sweep
 * across it, not a dash and not a zero. A dash reads as broken and a zero reads
 * as a fact — the chip is the only one of the three that says what is actually
 * true, which is that the answer exists and is not here yet.
 *
 * When it is live the figure carries the block it was read at, because a number
 * on a page with no timestamp is a number of unknown age.
 */
export function Live({ value, unit, block, label }) {
  const [pulse, setPulse] = useState(0);
  const previous = useRef(value);

  useEffect(() => {
    if (value === undefined || value === previous.current) return;
    previous.current = value;
    setPulse((n) => n + 1);
  }, [value]);

  if (value === undefined || value === null) {
    return (
      <span className="chip mono" role="status">
        <span className="chip-sweep" aria-hidden="true" />
        Awaiting deployment
      </span>
    );
  }

  return (
    <span
      className="live figure"
      key={pulse}
      title={block ? `Read at block ${block}` : undefined}
      aria-label={label}
    >
      {value}
      {unit && <span className="unit">{unit}</span>}
    </span>
  );
}

/* --- Section heading ------------------------------------------------------ */

/**
 * A section heading, its ghosted numeral, and its anchor.
 *
 * The numeral is the section number at display size behind the title at four
 * per cent — texture that happens to be information, so a reader skimming for
 * "section 7" has something to skim for. It is `aria-hidden` because the
 * number is already in the contents and in the anchor, and a screen reader
 * reading "zero seven" before every heading is a stutter.
 */
export function Heading({ id, n, children }) {
  return (
    <div className="doc-head">
      <span className="doc-ghost display" aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      <p className="doc-n mono">{String(n).padStart(2, "0")}</p>
      <h2 className="display">
        {children}
        <Anchor id={id} />
      </h2>
    </div>
  );
}

/* --- Questions ------------------------------------------------------------ */

/**
 * The questions, as an accordion.
 *
 * Height is animated with `grid-template-rows: 0fr → 1fr`, which is the only
 * way to get a real transition to a height nobody measured — `max-height` with
 * a guessed ceiling either clips a long answer or eases against dead space at
 * the end of a short one.
 *
 * Each panel is addressable: landing on `#q-03` opens it and scrolls to it, so
 * a link to one answer is a link to that answer rather than to a list it is
 * somewhere inside.
 */
export function Questions({ items }) {
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const fromHash = () => {
      const match = /^#q-(\d+)$/.exec(window.location.hash);
      if (!match) return;
      const i = Number(match[1]) - 1;
      if (i >= 0 && i < items.length) {
        setOpen(i);
        document.getElementById(`q-${match[1]}`)?.scrollIntoView({ block: "center" });
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [items.length]);

  return (
    <div className="qa">
      {items.map(([q, a, verified], i) => {
        const n = String(i + 1).padStart(2, "0");
        const isOpen = open === i;

        return (
          <div className={`q${isOpen ? " open" : ""}`} key={q} id={`q-${n}`}>
            <h3>
              <button
                type="button"
                className="q-btn"
                aria-expanded={isOpen}
                aria-controls={`q-${n}-body`}
                onClick={() => {
                  setOpen(isOpen ? null : i);
                  window.history.replaceState({}, "", isOpen ? "#questions" : `#q-${n}`);
                }}
              >
                <span className="q-n mono">Q.{n}</span>
                <span className="q-text">{q}</span>
                {verified && (
                  <span className="q-verified mono" title="This answer is a property of the contracts">
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                      <path
                        d="M1 6l3.2 3.2L11 2.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    On chain
                  </span>
                )}
                <span className="q-chev" aria-hidden="true" />
              </button>
            </h3>
            {/* Not `hidden`: a hidden panel has no height to animate from, so
                the row stays in the grid at 0fr and is made `inert` instead —
                collapsed, unfocusable, and still able to open smoothly. */}
            <div className="q-panel" id={`q-${n}-body`} role="region" inert={!isOpen}>
              <div className="q-panel-in">
                <p>{a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
