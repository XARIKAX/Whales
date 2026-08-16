import { useEffect, useRef, useState } from "react";
import { useNear, useReducedMotion } from "./reading.js";

/**
 * The loop, running.
 *
 * The four stages used to be four cards, which is a description of a mechanism
 * rather than the mechanism. This is the same four stages with the money
 * actually moving through them: coins fall out of a trade, run into a vessel
 * that visibly fills, a button lights when the level reaches the line, and the
 * pot leaves in three streams of visibly different thickness.
 *
 * Three decisions hold it together:
 *
 * **One clock.** Every element animates over the same `--cycle`, at different
 * percentages of it. That is the only reason the button lights at the moment
 * the vessel is full and the streams leave at the moment the button fires —
 * phase-locking six independent animations by hand does not survive a change to
 * the duration.
 *
 * **Transform and opacity only.** The vessel fills by scaling a rect from its
 * bottom edge, the streams arrive by scaling from their left edge, the coins
 * translate. Nothing animates a geometry attribute, a dash offset or a filter,
 * so the whole scene is composited and the main thread stays free for reading.
 *
 * **No words inside the picture.** Labels live in the legend underneath, which
 * means the drawing can shrink to a phone without shrinking any type — and the
 * legend is where the copy already was. Hovering either half lights the other,
 * so the two are one object rather than a diagram with a caption.
 */

/* --- The scene ------------------------------------------------------------ */

/* Coins leaving the trade. Each is the same 3-second flight at a different
   offset into it, so the stream is continuous without six sets of keyframes. */
const COINS = [0, 0.42, 0.84, 1.26, 1.68, 2.1, 2.52];

/* The three whales the pot lands in, at the weights Fig. 4 uses. The stream
   feeding each is drawn at its weight, so thickness is data. */
const PAYEES = [
  { y: 60, weight: 3.33, bar: 44 },
  { y: 108, weight: 1.5, bar: 20 },
  { y: 156, weight: 1.0, bar: 13 },
];

const STAGE_LABEL = ["Trade", "Trench", "Haul", "Pod"];

function Scene({ stage, onStage }) {
  /* Each zone is a hit area over its part of the drawing. They are `<g>` rather
     than buttons because the keyboard path is the legend below — these exist
     for the pointer, and a duplicate tab stop over a picture with no text in it
     would be noise for a screen reader. */
  const zone = (i, x, w) => ({
    className: `loop-zone${stage === i ? " on" : ""}${stage !== null && stage !== i ? " off" : ""}`,
    onMouseEnter: () => onStage(i),
    onMouseLeave: () => onStage(null),
    "data-hit": `${x},${w}`,
  });

  return (
    <svg
      className="loop-svg"
      viewBox="0 0 960 216"
      shapeRendering="crispEdges"
      role="img"
      aria-labelledby="loop-title"
    >
      <title id="loop-title">
        Tax from a trade falls into the Trench, which fills until anyone hauls it; the pot then
        splits into three streams of different thickness and lands in three whale wallets.
      </title>

      <defs>
        {/* The backdrop the whole diagram language sits on: an 8-unit pixel
            grid, faint enough to read as paper rather than as content. */}
        <pattern id="loop-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="rgba(190,231,245,0.07)" strokeWidth="1" />
        </pattern>
        {/* Everything below the vessel's rim is clipped, so the fill can scale
            past it without drawing outside the vessel. */}
        <clipPath id="loop-vessel">
          <rect x="272" y="44" width="124" height="112" />
        </clipPath>
      </defs>

      <rect x="0" y="0" width="960" height="216" fill="url(#loop-grid)" />

      {/* --- 01 Trade -------------------------------------------------- */}
      <g {...zone(0, 16, 200)}>
        <rect className="loop-hit" x="16" y="16" width="200" height="184" />

        {/* A market, as five bars. The two that fall are the sells. */}
        {[
          [48, 118, 44],
          [72, 96, 66],
          [96, 128, 34],
          [120, 78, 84],
          [144, 104, 58],
        ].map(([x, y, h], i) => (
          <rect
            key={x}
            className={`loop-candle${i % 2 ? " down" : ""}`}
            x={x}
            y={y}
            width="12"
            height={h}
            style={{ "--i": i }}
          />
        ))}
        <rect className="loop-base" x="40" y="162" width="120" height="2" />
      </g>

      {/* --- The tax, in flight ---------------------------------------- */}
      <g className="loop-coins">
        {COINS.map((delay) => (
          <g className="loop-coin" key={delay} style={{ "--delay": `${-delay}s` }}>
            <rect x="168" y="86" width="10" height="10" />
            <rect className="loop-coin-lit" x="170" y="88" width="3" height="3" />
          </g>
        ))}
      </g>

      {/* --- 02 The Trench --------------------------------------------- */}
      <g {...zone(1, 240, 196)}>
        <rect className="loop-hit" x="240" y="16" width="196" height="184" />

        <g clipPath="url(#loop-vessel)">
          {/* Scaled from the bottom edge, so a filling vessel is a transform
              rather than a changing height. */}
          <rect className="loop-fill" x="272" y="44" width="124" height="112" />
          <rect className="loop-fill-lip" x="272" y="44" width="124" height="112" />
        </g>

        {/* The vessel itself, drawn over the fill so the fill has an edge. */}
        <path
          className="loop-vessel"
          d="M268 40 V160 H400 V40"
          fill="none"
          stroke="rgba(190,231,245,0.55)"
          strokeWidth="3"
        />
        {/* The threshold. Nothing leaves until the level reaches this. */}
        <line
          className="loop-threshold"
          x1="262"
          x2="406"
          y1="58"
          y2="58"
          strokeDasharray="5 5"
          strokeWidth="2"
        />
      </g>

      {/* --- 03 The haul ------------------------------------------------ */}
      <g {...zone(2, 460, 160)}>
        <rect className="loop-hit" x="460" y="16" width="160" height="184" />

        <rect className="loop-btn-glow" x="484" y="74" width="112" height="48" />
        <rect className="loop-btn-well" x="492" y="86" width="96" height="32" />
        <rect className="loop-btn" x="492" y="80" width="96" height="32" />
        <rect className="loop-btn-face" x="492" y="80" width="96" height="3" />
        {/* The cap that travels when it is pressed, so the button is a button
            rather than a rectangle that changes colour. */}
        <rect className="loop-btn-cap" x="510" y="90" width="60" height="12" />
        {/* The tip. It is the only thing on the page drawn leaving sideways,
            because it is the only thing that does not go to the pod. */}
        <rect className="loop-tip" x="534" y="128" width="12" height="12" />
      </g>

      {/* --- 04 The pod -------------------------------------------------- */}
      <g {...zone(3, 640, 304)}>
        <rect className="loop-hit" x="640" y="16" width="304" height="184" />

        {PAYEES.map(({ y, weight, bar }, i) => (
          <g key={weight}>
            {/* Thickness is the weight. Scaled from the left edge so the pot
                visibly travels rather than appearing. */}
            <rect
              className="loop-stream"
              x="600"
              y={y + 14 - weight}
              width="112"
              height={Math.max(3, weight * 2)}
              style={{ "--i": i }}
            />

            {/* A whale in five rects. The flukes and the narrow peduncle are
                what stop it reading as a pipe pointing right. */}
            <g className="loop-whale">
              <rect x="700" y={y + 1} width="8" height="8" />
              <rect x="700" y={y + 17} width="8" height="8" />
              <rect x="706" y={y + 9} width="8" height="8" />
              <rect x="712" y={y + 3} width="28" height="20" />
              <rect x="740" y={y + 8} width="10" height="12" />
              <rect className="loop-whale-eye" x="732" y={y + 9} width="3" height="3" />
            </g>

            {/* Its wallet, filling by weight. */}
            <rect className="loop-wallet" x="770" y={y - 4} width="120" height="34" />
            <rect
              className="loop-wallet-fill"
              x="774"
              y={y + 22}
              width={bar * 2}
              height="6"
              style={{ "--i": i }}
            />
          </g>
        ))}
      </g>

      {/* Labels ride the drawing on a wide screen and hand off to the legend on
          a narrow one, where they would be four points tall. */}
      {[
        [116, "01 Trade"],
        [338, "02 The Trench"],
        [540, "03 The haul"],
        [792, "04 The pod"],
      ].map(([x, text], i) => (
        <text
          key={text}
          className={`loop-label${stage === i ? " on" : ""}`}
          x={x}
          y="196"
          textAnchor="middle"
        >
          {text}
        </text>
      ))}
    </svg>
  );
}

/* --- The static fallback -------------------------------------------------- */

/**
 * What a reader who has asked for less movement gets, and what is in the HTML
 * before the diagram is anywhere near the viewport. Same four stages, same
 * words, no clock.
 */
function StaticFlow({ stages, stage, onStage }) {
  return (
    <div className="flow flow-4">
      {stages.map((s, i) => (
        <div
          className={`flow-node${stage === i ? " on" : ""}`}
          key={s.k}
          onMouseEnter={() => onStage(i)}
          onMouseLeave={() => onStage(null)}
        >
          <span className="flow-step mono">{String(i + 1).padStart(2, "0")}</span>
          <h4 className="display">{s.k}</h4>
          <span className="flow-value mono">{s.v}</span>
          <p>{s.body}</p>
        </div>
      ))}
    </div>
  );
}

/* --- Together ------------------------------------------------------------- */

export default function Loop({ stages }) {
  const ref = useRef(null);
  const near = useNear(ref);
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(null);
  const [idling, setIdling] = useState(false);

  /* One cycle at full strength on arrival, then it settles back. A diagram that
     keeps demanding attention while you are reading the paragraph underneath it
     is a diagram you end up scrolling past. */
  useEffect(() => {
    if (!near || reduced) return;
    const timer = setTimeout(() => setIdling(true), 12_000);
    return () => clearTimeout(timer);
  }, [near, reduced]);

  const live = near && !reduced;

  return (
    <div
      className={`loop${live ? " live" : ""}${idling ? " idling" : ""}${
        stage !== null ? " held" : ""
      }`}
      ref={ref}
    >
      {live ? <Scene stage={stage} onStage={setStage} /> : <StaticFlow {...{ stages, stage, onStage: setStage }} />}

      {/* The legend is the copy, and it is the keyboard path into the diagram:
          focusing a row lights its stage exactly as hovering it does. */}
      {live && (
        <ol className="loop-legend">
          {stages.map((s, i) => (
            <li key={s.k}>
              <button
                type="button"
                className={`loop-key${stage === i ? " on" : ""}`}
                onMouseEnter={() => setStage(i)}
                onMouseLeave={() => setStage(null)}
                onFocus={() => setStage(i)}
                onBlur={() => setStage(null)}
                aria-pressed={stage === i}
                aria-label={`${STAGE_LABEL[i]}: hold the animation on this stage`}
              >
                <span className="loop-key-n mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="loop-key-head">
                  <b className="display">{s.k}</b>
                  <span className="flow-value mono">{s.v}</span>
                </span>
                <span className="loop-key-body">{s.body}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
