import { useEffect, useMemo, useRef, useState } from "react";
import { PixelFish, PixelWhale, PixelWhaleling } from "./pixel/sprites.jsx";

/**
 * The life in the water.
 *
 * Whales are the characters. There are six species and they carry every plane —
 * a pod, not a mascot. Fish are scenery: they sit further out and closer in than
 * the whales do, and they exist to give the pod something to have depth against.
 *
 * The illusion is depth, and depth is four things agreeing at once: near things
 * are big, fast, out of focus and pass IN FRONT of the reader; far things are
 * small, slow, hazy and pass behind everything. Get those four to agree and a
 * flat gradient becomes a place you are standing in.
 *
 * Every plane is pure CSS transform on a wrapper — nothing here runs per-frame
 * in JavaScript, and nothing takes a pointer event.
 */

/**
 * True while the element is anywhere near the viewport.
 *
 * Everything here is CSS-animated, which means it keeps animating — and keeps
 * costing a compositor pass — while the reader is three screens further down
 * looking at something else. Parking the animations the moment a scene leaves
 * the viewport is the largest saving available, and costs nothing visually
 * because nobody is looking.
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
 * focal plane, and `beat` is seconds per tail stroke.
 *
 * Note the opacity climbing from far to near, not falling. Atmospheric
 * perspective washes out what is FAR away; a creature an arm's length from the
 * lens is the most saturated thing in the frame.
 */
const PLANES = {
  /* Small fish, hazy and slow, a long way out. */
  far: { n: 10, kind: "fish", slim: true, size: [9, 14], cross: [64, 92], y: [8, 86], blur: 0, opacity: 0.3, beat: [0.62, 0.92] },
  /* The pod. Mid-water, unhurried, and the reason anyone is looking. */
  pod: { n: 6, kind: "whale", size: [26, 46], cross: [46, 78], y: [12, 84], blur: 0.3, opacity: 0.92, beat: [1.4, 2.4] },
  /* A few reef fish threaded through the pod so it is not all one species. */
  mid: { n: 5, kind: "fish", size: [20, 30], cross: [36, 56], y: [10, 88], blur: 0.3, opacity: 0.8, beat: [0.42, 0.66] },
  /* The near plane is the whole trick. Its band is central on purpose — a
     foreground creature only earns its cost when it crosses the headline. Blur
     stays low: enough to sit off the focal plane, not enough to turn a sprite
     to mush, which reads as a fault rather than as depth of field. */
  /* Sized off the headline, not off the viewport. A whale is three times as
     long as it is deep, so 70px of height is already 220px of animal — twice
     that and it stops being a creature passing through the frame and becomes a
     wall moving across the words. */
  near: { n: 3, kind: "whale", size: [50, 74], cross: [30, 46], y: [8, 64], blur: 1.5, opacity: 0.85, beat: [1, 1.5] },
  /* Below the hero: life thins and slows as the page descends. */
  drift: { n: 4, kind: "whale", size: [22, 38], cross: [58, 88], y: [8, 86], blur: 0.7, opacity: 0.55, beat: [1.6, 2.6] },
  sparse: { n: 3, kind: "fish", size: [20, 34], cross: [70, 100], y: [12, 84], blur: 1, opacity: 0.6, beat: [0.7, 1.1] },
};

const POD_SPECIES = ["humpback", "orca", "beluga", "narwhal", "blue", "sperm"];

const SHOALS = {
  shallow: ["tang", "lemon", "reef", "coral", "mint", "tang", "lemon"],
  school: ["silver", "silver", "silver", "tang", "silver", "silver", "lemon", "silver", "mint"],
  abyss: ["abyssal"],
};

function school(plane, seed, shoal) {
  const spec = PLANES[plane];
  const r = rng(seed);
  const palette = spec.kind === "whale" ? POD_SPECIES : SHOALS[shoal] || SHOALS.shallow;

  return Array.from({ length: spec.n }, (_, i) => {
    const cross = pick(r, spec.cross);
    const rightward = r() > 0.55;
    /* Stratified rather than uniform: each creature gets its own horizontal
       band and jitters inside it. Uniform placement clumps — three near whales
       drawn independently will happily line up at the same height and blot out
       the same word for ten seconds, which looks like a bug, not a pod. */
    const [y0, y1] = spec.y;
    return {
      key: `${plane}-${i}`,
      species: palette[Math.floor(r() * palette.length)],
      whale: spec.kind === "whale",
      slim: spec.slim,
      size: pick(r, spec.size),
      y: y0 + ((i + r()) / spec.n) * (y1 - y0),
      cross,
      rightward,
      beat: pick(r, spec.beat),
      /* A negative delay means the water is already full on the very first
         frame, instead of filling up over the next minute. */
      delay: -r() * cross,
      bob: 3.4 + r() * 4.2,
      bobDelay: -r() * 8,
      phase: r() * 2,
    };
  });
}

function Swimmer({ fish, blur, opacity }) {
  const { size, y, cross, rightward, delay, bob, bobDelay, phase, species, slim, whale } = fish;
  /* Sprites are drawn facing right, so a leftward one is the same grid mirrored. */
  const lead = rightward ? "-22rem" : "calc(100vw + 22rem)";
  const trail = rightward ? "calc(100vw + 22rem)" : "-22rem";
  const Creature = whale ? PixelWhaleling : PixelFish;

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
        <Creature
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

export default function Marine({ plane = "pod", shoal = "shallow", seed = 1, leviathan = false }) {
  const spec = PLANES[plane];
  const fish = useMemo(() => school(plane, seed, shoal), [plane, seed, shoal]);

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
 * dropped into. Same pod, thinner and slower — the dive should feel emptier the
 * further down it goes.
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
