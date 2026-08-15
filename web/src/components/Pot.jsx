import { useState } from "react";
import { eth, usd, percent } from "../format.js";

/**
 * Deterministic coin field, so the hoard is the same shape every render.
 *
 * Two uniforms averaged gives a triangular distribution, which piles coins
 * toward the middle; the stack is then capped by a parabola so it tapers at
 * the edges. The result reads as a mound rather than a scattered line.
 */
const COINS = Array.from({ length: 44 }, (_, i) => {
  const seed = (i * 2654435761) % 1009;
  const x = (((seed % 100) / 100) + (((seed >> 5) % 100) / 100)) / 2;
  const fromCentre = Math.abs(x - 0.5) * 2;
  const maxRow = Math.max(0, Math.round(3.4 * (1 - fromCentre * fromCentre)));
  return {
    left: 4 + x * 92,
    row: (seed >> 9) % (maxRow + 1),
    size: 9 + (seed % 4),
    tilt: (seed % 40) - 20,
    delay: (seed % 11) / 10,
  };
});

/**
 * The pot as an object rather than a number: a mound of coins that actually
 * grows with the fill, with the waterline lapping above it. At ninety percent
 * the rim lights and the label changes — the haul stops being theoretical.
 */
export default function Pot({ ocean, price }) {
  const [open, setOpen] = useState(false);

  const fill = percent(ocean.pot, ocean.haulThreshold);
  const imminent = fill >= 90;

  // How many coins the mound shows. Always at least one once anything is in.
  // Lower coins settle first, so the mound builds from its base upward.
  const ordered = [...COINS].sort((a, b) => a.row - b.row);
  const shown = ocean.pot > 0n ? Math.max(1, Math.round((fill / 100) * ordered.length)) : 0;

  const tip = (ocean.pot * 50n) / 10_000n;
  const net = ocean.pot - tip;
  const active = Number(ocean.activeWhales) || 0;
  const perWhale = active > 0 ? net / BigInt(active) : 0n;

  return (
    <div
      className={`glass on-dark fact pot${imminent ? " imminent" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="fact-tag">{imminent ? "Haul imminent" : "Filling now"}</span>

      <h3 className="display figure">
        {eth(ocean.pot, 3)}
        <span className="unit">ETH</span>
      </h3>

      <p className="pot-note">
        {imminent
          ? "The net is full enough. Anyone can haul it and keep 0.5%."
          : `${eth(ocean.haulThreshold - ocean.pot, 4)} ETH to go before the pot can be hauled.`}
      </p>

      {/* The hoard. Coins settle in as the pot fills. */}
      <div className="hoard" aria-hidden="true">
        {ordered.slice(0, shown).map((c, i) => (
          <span
            key={i}
            className="hoard-coin"
            style={{
              left: `${c.left}%`,
              bottom: `${c.row * 5}px`,
              width: c.size,
              height: c.size,
              transform: `rotate(${c.tilt}deg)`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      {/* The waterline laps above the hoard. */}
      <div className="pot-water" style={{ height: `${fill}%` }} aria-hidden="true" />

      {/* Data made touchable: where the pot actually goes. */}
      <div className={`pot-split mono${open ? " open" : ""}`}>
        <div>
          <span>To whales</span>
          <span>
            {eth(net, 4)} ETH {usd(net, price) ? `· ${usd(net, price)}` : ""}
          </span>
        </div>
        <div>
          <span>Keeper tip (0.5%)</span>
          <span>{eth(tip, 4)} ETH</span>
        </div>
        <div>
          <span>Per fed whale (est.)</span>
          <span>{active > 0 ? `${eth(perWhale, 5)} ETH` : "—"}</span>
        </div>
        <div className="pot-split-foot">
          <span>Split by weight, not evenly</span>
        </div>
      </div>
    </div>
  );
}
