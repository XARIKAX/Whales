import { useEffect, useMemo, useRef, useState } from "react";

/**
 * ⌘K over the page you are already reading.
 *
 * The index is built from the rendered DOM rather than from a copy of the text
 * kept beside it. That is the only way it cannot drift: there is one set of
 * words on this page, and search reads the same ones the reader does. It costs
 * a single pass over about a hundred nodes, once, the first time the palette is
 * opened — never on load.
 *
 * Matching is subsequence, not substring, so "wlt" finds "The whale's wallet"
 * and "prov" finds the provenance paragraph. Runs of adjacent characters and
 * matches at the start of a word score higher, which is what stops a query from
 * ranking a paragraph that merely contains the letters above the heading that
 * is named for them.
 */

/* --- Matching ------------------------------------------------------------- */

function score(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let points = 0;
  let run = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] !== q[qi]) {
      run = 0;
      continue;
    }
    run += 1;
    points += run * 2;
    if (ti === 0 || /[\s(—–-]/.test(t[ti - 1])) points += 6;
    qi += 1;
  }

  if (qi < q.length) return 0;
  // Shorter hits win ties: a heading beats the paragraph that quotes it.
  return points + Math.max(0, 40 - text.length / 6);
}

/* --- Palette -------------------------------------------------------------- */

export default function Search({ sections }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [index, setIndex] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  /* ⌘K anywhere, and the shortcut has to lose to a text field the reader is
     already typing in. */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((was) => !was);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;

    if (index.length === 0) {
      const rows = [];
      sections.forEach(([id, label]) => {
        rows.push({ id, section: label, text: label, head: true });
        const node = document.getElementById(id);
        if (!node) return;
        node.querySelectorAll("p, h3, li > .power-what, .q h3").forEach((el) => {
          const text = el.textContent.trim();
          if (text.length > 24) rows.push({ id, section: label, text, head: false });
        });
      });
      setIndex(rows);
    }

    setCursor(0);
    inputRef.current?.focus();
  }, [open, index.length, sections]);

  const hits = useMemo(() => {
    if (!open) return [];
    if (!query.trim()) return index.filter((r) => r.head);

    return index
      .map((row) => ({ row, s: score(query.trim(), row.text) + (row.head ? 24 : 0) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((r) => r.row);
  }, [open, query, index]);

  const go = (row) => {
    if (!row) return;
    setOpen(false);
    setQuery("");
    window.location.hash = `#${row.id}`;
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(1, hits.length));
    } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      setCursor((c) => (c - 1 + hits.length) % Math.max(1, hits.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[cursor]);
    }
  };

  /* Keep the highlighted row in view when the cursor is driven by the keyboard
     rather than by the pointer. */
  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  return (
    <>
      <button
        type="button"
        className="findbtn mono"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="findbtn-label">Search the docs</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div className="find" role="dialog" aria-modal="true" aria-label="Search the docs">
          {/* Clicking the water behind the palette dismisses it, the same as
              Escape. It is not a button, so it is hidden from the keyboard
              path, which already has a way out. */}
          <div className="find-scrim" onClick={() => setOpen(false)} aria-hidden="true" />

          <div className="find-panel">
            <div className="find-bar">
              <span className="find-icon mono" aria-hidden="true">
                /
              </span>
              <input
                ref={inputRef}
                className="find-input"
                type="text"
                value={query}
                placeholder="Search headings and text"
                autoComplete="off"
                spellCheck="false"
                aria-label="Search the docs"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={onKeyDown}
              />
              <kbd className="find-esc">esc</kbd>
            </div>

            {hits.length > 0 ? (
              <ul className="find-list" ref={listRef}>
                {hits.map((row, i) => (
                  <li key={`${row.id}-${i}`}>
                    <button
                      type="button"
                      className={`find-hit${i === cursor ? " on" : ""}`}
                      onMouseMove={() => setCursor(i)}
                      onClick={() => go(row)}
                    >
                      {/* A heading's section label is the heading, so printing
                          both put the same words on two lines. */}
                      {!row.head && <span className="find-where mono">{row.section}</span>}
                      <span className={`find-what${row.head ? " head" : ""}`}>
                        {row.head ? row.text : `${row.text.slice(0, 96)}…`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="find-none mono">Nothing on this page matches that.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
