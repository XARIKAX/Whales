import { useEffect, useMemo, useRef, useState } from "react";
import { PixelFish, PixelWhale } from "./pixel/sprites.jsx";

/**
 * The life in the water.
 *
 * The whole illusion is depth, and depth is four things moving at once: things
 * that are near are big, fast, out of focus and pass IN FRONT of the reader;
 * things that are far are small, slow, hazy and pass behind everything. Get
 * those four to agree and a flat gradient becomes a place you are standing in.
 *
 * Every plane is pure CSS transform on a wrapper — nothing here runs per-frame
 * in JavaScript, and nothing takes a pointer event.
 */

/**
 * True while the element is anywhere near the viewport.
 *
 * Everything on this page is CSS-animated, which means it keeps animating —
 * and keeps costing a compositor pass — while the reader is three screens
 * further down looking at something else. Parking the animations the moment a
 * scene leaves the viewport is the single largest saving available here, and
 * costs nothing visually because nobody is looking.
 */
export function useOnScreen(ref, margin = "300px") {
  const [near, setNear] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => setNear(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: margin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, margin]);

  return near;
}

/** Deterministic pseudo-random, so React never reshuffles the ocean. */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = (r, [lo, hi]) => lo + r() * (hi - lo);

/**
 * Plane definitions. `size` is sprite height in px, `cross` is seconds to
 * traverse the viewport, `blur` is the depth-of-field cost of being off the
 * focal plane, and `beat` is seconds per tail stroke — small fish beat fast.
 */
const PLANES = {
  /* No blur on this plane. Twelve sprites whose tails beat every frame, each
     one its own blurred layer, is twelve re-rasterisations a frame for haze
     that size and opacity already sell on their own. */
  far: { n: 12, slim: true, size: [10, 16], cross: [58, 84], y: [10, 84], blur: 0, opacity: 0.34, beat: [0.62, 0.92] },
  mid: { n: 8, slim: false, size: [24, 40], cross: [32, 50], y: [12, 86], blur: 0.35, opacity: 0.95, beat: [0.42, 0.66] },
  /* The near plane is the whole trick, so it is the one worth tuning hardest.
     Its band is deliberately central — a foreground fish only earns its cost
     when it crosses the headline, and one drifting along the floor is just an
     expensive smudge. Blur stays low: enough to sit off the focal plane, not
     enough to turn the sprite to mush, which reads as a fault rather than as
     depth of field. */
  /* Note the opacity climbing across these three, not falling. Atmospheric
     perspective washes out what is FAR away; a fish an arm's length from the
     lens is the most saturated thing in the frame. Depth on this plane is
     carried by blur and speed alone. */
  near: { n: 4, slim: false, size: [56, 92], cross: [21, 33], y: [11, 68], blur: 1.6, opacity: 0.88, beat: [0.3, 0.44] },
  /* For the sections below the hero. Life thins and slows as the page
     descends — by the trench there should be almost nothing left, and what is
     left should be the wrong colour for daylight. */
  drift: { n: 5, slim: false, size: [18, 30], cross: [46, 72], y: [8, 88], blur: 0.9, opacity: 0.5, beat: [0.5, 0.82] },
  sparse: { n: 3, slim: false, size: [20, 34], cross: [64, 96], y: [12, 84], blur: 1.1, opacity: 0.62, beat: [0.7, 1.1] },
};

/** Hot colours belong in the lit shallows; the deep only keeps its lure. */
const SHOALS = {
  shallow: ["tang", "lemon", "reef", "coral", "mint", "tang", "lemon"],
  /* The near plane skips `reef` and `silver`. Both go muddy once they are
     blurred, and a foreground fish that reads as a beige smear is worse than
     no foreground fish at all. */
  vivid: ["tang", "coral", "lemon", "mint", "tang", "coral"],
  school: ["silver", "silver", "silver", "tang", "silver", "silver", "lemon", "silver", "silver", "mint"],
  abyss: ["abyssal"],
};

function school(plane, seed, palette) {
  const spec = PLANES[plane];
  const r = rng(seed);

  return Array.from({ length: spec.n }, (_, i) => {
    const cross = pick(r, spec.cross);
    const rightward = r() > 0.55;
    /* Stratified rather than uniform: each fish gets its own horizontal band
       and jitters inside it. Uniform placement clumps — four near fish drawn
       independently will happily line up at the same height and blot out the
       same word for ten seconds, which looks like a bug rather than a shoal. */
    const [y0, y1] = spec.y;
    return {
      key: `${plane}-${i}`,
      species: palette[Math.floor(r() * palette.length)],
      slim: spec.slim,
      size: pick(r, spec.size),
      y: y0 + ((i + r()) / spec.n) * (y1 - y0),
      cross,
      rightward,
      beat: pick(r, spec.beat),
      /* A negative delay means the water is already full of fish on the very
         first frame, instead of filling up over the next minute. */
      delay: -r() * cross,
      bob: 2.4 + r() * 3.4,
      bobDelay: -r() * 6,
      phase: r() * 2,
    };
  });
}

function Swimmer({ fish, blur, opacity }) {
  const { size, y, cross, rightward, delay, bob, bobDelay, phase, species, slim } = fish;
  /* Sprites are drawn facing right, so a leftward fish is the same grid mirrored. */
  const lead = rightward ? "-18rem" : "calc(100vw + 18rem)";
  const trail = rightward ? "calc(100vw + 18rem)" : "-18rem";

  return (
    <span
      className="swimmer"
      style={{
        top: `${y}%`,
        "--from": lead,
        "--to": trail,
        animationDuration: `${cross}s`,
        animationDelay: `${delay}s`,
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
      }}
    >
      <span
        className="swimmer-bob"
        style={{ animationDuration: `${bob}s`, animationDelay: `${bobDelay}s` }}
      >
        <PixelFish
          species={species}
          slim={slim}
          beat={fish.beat}
          phase={phase}
          className={rightward ? "" : "mirror"}
          style={{ height: `${size}px` }}
        />
      </span>
    </span>
  );
}

/**
 * The leviathan. One of them, crossing the deep background on a slow arc — big
 * enough to be unmistakable, faint enough that you are never quite sure you saw
 * it. It is the whole promise of the project, moving in the dark.
 */
function Leviathan() {
  return (
    <span className="swimmer leviathan" style={{ "--from": "calc(100vw + 30rem)", "--to": "-34rem" }}>
      <span className="swimmer-bob leviathan-bob">
        <PixelWhale deep className="mirror" style={{ width: "min(46vw, 660px)" }} />
      </span>
    </span>
  );
}

/**
 * @param plane  which depth this layer sits at — `near` renders over the type,
 *               the rest render behind it.
 * @param shoal  which palette the water is cold enough for.
 */
export default function Marine({ plane = "mid", shoal = "shallow", seed = 1, leviathan = false }) {
  const spec = PLANES[plane];
  const fish = useMemo(() => school(plane, seed, SHOALS[shoal]), [plane, seed, shoal]);

  return (
    <div className={`marine marine-${plane} shoal-${shoal}`} aria-hidden="true">
      {leviathan && <Leviathan />}
      {fish.map((f) => (
        <Swimmer key={f.key} fish={f} blur={spec.blur} opacity={spec.opacity} />
      ))}
    </div>
  );
}

/**
 * Life for the sections below the hero, clipped to whatever section it is
 * dropped into. Same shoals, thinner and slower — the dive is supposed to feel
 * emptier the further down it goes.
 */
export function SectionLife({ plane = "drift", shoal = "school", seed = 1 }) {
  const ref = useRef(null);
  const near = useOnScreen(ref);

  return (
    <div className={`section-life${near ? "" : " parked"}`} ref={ref} aria-hidden="true">
      <Marine plane={plane} shoal={shoal} seed={seed} />
    </div>
  );
}
