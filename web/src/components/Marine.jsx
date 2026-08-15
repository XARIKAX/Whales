import { useEffect, useMemo, useRef, useState } from "react";
import Creature from "./pixel/creature.jsx";
import Whale from "./Whale.jsx";

/**
 * The life in the water.
 *
 * Whales are the characters. There are six species and they carry every plane —
 * a pod, not a mascot. Fish are scenery: they sit further out and closer in than
 * the whales do, and they exist to give the pod something to have depth against.
 *
 * The illusion is depth, and depth is three things agreeing at once: near
 * things are big, fast and pass IN FRONT of the reader; far things are small,
 * slow, faint and pass behind everything.
 *
 * Every plane owns an exclusive horizontal band, and within a plane each
 * creature owns an exclusive lane inside that band. Nothing can therefore swim
 * over anything else — two animals crossing is not depth, it is a collision,
 * and it reads as one. The bands also keep the water quiet where the words are:
 * fish sit above the headline, the pod sits below the buttons, and exactly one
 * whale is allowed through the middle.
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
 *
 * Coming back is immediate; leaving waits. Parked in both directions, a reader
 * sitting on the boundary and nudging the wheel pauses and resumes seventy-one
 * animations several times a second, which is the exact scroll-up stutter this
 * was supposed to prevent. Asymmetry costs a few hundred milliseconds of
 * animation nobody can see and removes the failure mode entirely.
 */
export function useOnScreen(ref, margin = "300px") {
  const [near, setNear] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        clearTimeout(timer);
        if (visible) setNear(true);
        else timer = setTimeout(() => setNear(false), 500);
      },
      { rootMargin: margin }
    );

    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
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
 * traverse the viewport, and `beat` is seconds per tail stroke. `y` is the
 * band, and no two bands overlap.
 *
 * There is no blur on any of these. Depth is carried by size, speed and opacity
 * alone: a CSS blur on a moving element is re-rasterised every frame, and twenty
 * of them was half the reason this page could not hold a frame rate.
 */
/*
 * `y` is now a share of the band the plane is dropped into rather than of the
 * whole hero, and `cap` is the tallest a sprite may be as a share of that band.
 * On a short laptop the water below the message is a hundred pixels; three
 * forty-pixel whales in a hundred pixels is a pile, not a pod, so they shrink
 * to fit the water they have instead of climbing out of it.
 */
const PLANES = {
  /* The pod, in the open water above the message. It gets the upper band
     because the upper band is the one with room: measured across every window
     size, the water above the headline runs 110px to 270px and the water below
     the readout runs 55px to 115px, most of which is wave. Whales near the
     surface is also simply where whales are. */
  pod: { n: 3, kind: "whale", size: [26, 42], cross: [50, 82], y: [0, 96], cap: 24, opacity: 0.85, beat: [1.4, 2.4] },
  /* Reef fish in the kelp at the foot of the hero. Scenery, not cast, but close
     enough now to have colour: at the top of the scene they were nine grey
     pixels at a quarter opacity, which is not detail, it is dust. */
  reef: { n: 4, kind: "fish", size: [11, 18], cross: [58, 88], y: [0, 96], cap: 20, opacity: 0.44, beat: [0.6, 0.95] },
  /* Below the hero: life thins and slows as the page descends. */
  drift: { n: 3, kind: "whale", size: [22, 36], cross: [62, 92], y: [10, 84], opacity: 0.5, beat: [1.6, 2.6] },
  sparse: { n: 2, kind: "fish", size: [20, 32], cross: [74, 104], y: [14, 80], opacity: 0.55, beat: [0.7, 1.1] },
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
    /* One lane each, with the jitter kept inside it. Placed independently they
       clump: creatures drawn at random heights line up, cross, and blot each
       other out, which reads as a rendering fault rather than as a pod.
       A sprite hangs below its anchor, so on a capped plane the jitter has to
       stop a whole sprite short of the next lane. Jittering across the full
       lane made lanes stop being lanes the moment the band got short, which is
       exactly when the collisions actually happen. */
    const [y0, y1] = spec.y;
    const lane = (y1 - y0) / spec.n;
    const slack = spec.cap ? Math.max(0, lane - spec.cap) : lane * 0.7;
    return {
      key: `${plane}-${i}`,
      species: palette[Math.floor(r() * palette.length)],
      kind: spec.kind,
      /* A length, not a number: where a plane declares a cap, the sprite takes
         whichever is smaller, its own size or that share of its band. */
      size: spec.cap
        ? `min(${Math.round(pick(r, spec.size))}px, ${spec.cap}cqh)`
        : `${Math.round(pick(r, spec.size))}px`,
      y: y0 + lane * i + (spec.cap ? 0 : lane * 0.15) + r() * slack,
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

function Swimmer({ fish, opacity }) {
  const { size, y, cross, rightward, delay, bob, bobDelay, phase, species, kind } = fish;
  /* Sprites are drawn facing right, so a leftward one is the same grid mirrored. */
  const lead = rightward ? "-22rem" : "calc(100vw + 22rem)";
  const trail = rightward ? "calc(100vw + 22rem)" : "-22rem";
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
      }}
    >
      <span
        className="swimmer-bob"
        style={{ animationDuration: `${bob}s`, animationDelay: `${bobDelay}s` }}
      >
        <Creature
          kind={kind}
          species={species}
          beat={fish.beat}
          phase={phase}
          height={size}
          mirrored={!rightward}
        />
      </span>
    </span>
  );
}

/**
 * The leviathan. One of them, crossing the deep background on a slow arc — big
 * enough to be unmistakable, faint enough that you are never quite sure you saw
 * it. It is the whole promise of the project, moving in the dark.
 *
 * A silhouette rather than a sprite, and the only creature on the page that is
 * not pixel art. At six hundred pixels wide a pixel grid has cells the size of
 * a fingernail; upscaled at six percent opacity that does not read as distance,
 * it reads as a broken image.
 *
 * It is also the only thing allowed to cross behind the message, because at
 * that scale and that opacity it stops being an animal in the way and becomes
 * weather.
 */
export function Leviathan() {
  return (
    <span className="swimmer leviathan" style={{ "--from": "calc(100vw + 34rem)", "--to": "-38rem" }}>
      <span className="swimmer-bob leviathan-bob">
        {/* Mirrored, because it travels right to left. The silhouette is drawn
            nose-right like every sprite on this page, and unmirrored it swam
            the whole hero backwards. */}
        <Whale className="leviathan-art mirror" />
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
        <Swimmer key={f.key} fish={f} opacity={spec.opacity} />
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
