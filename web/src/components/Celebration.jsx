import { useEffect, useState } from "react";

/** Deterministic, so the burst is identical on every haul rather than jittering
    between renders. */
const COINS = Array.from({ length: 26 }, (_, i) => {
  const seed = (i * 2654435761) % 997;
  return {
    left: `${(seed % 96) + 2}%`,
    duration: 2.6 + (seed % 18) / 10,
    delay: (seed % 11) / 10,
    sway: `${((seed % 90) - 45) | 0}px`,
    size: 8 + (seed % 8),
  };
});

/**
 * Fired when `haulCount` goes up: a bubble burst, then gold settling to the
 * seafloor. Driven by the chain, not by the click — so it fires for everyone
 * watching, not just whoever pressed the button.
 */
export default function Celebration({ trigger }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (trigger === null || trigger === undefined) return;
    setPlaying(true);
    const id = setTimeout(() => setPlaying(false), 5200);
    return () => clearTimeout(id);
  }, [trigger]);

  if (!playing) return null;

  return (
    <div className="celebrate" aria-hidden="true">
      <div
        className="burst"
        style={{ left: "50%", top: "42%", width: 160, height: 160, marginLeft: -80, marginTop: -80 }}
      />
      <div
        className="burst"
        style={{
          left: "50%",
          top: "42%",
          width: 90,
          height: 90,
          marginLeft: -45,
          marginTop: -45,
          animationDelay: "160ms",
        }}
      />
      {COINS.map((coin, i) => (
        <span
          key={i}
          className="coin"
          style={{
            left: coin.left,
            width: coin.size,
            height: coin.size,
            animationDuration: `${coin.duration}s`,
            animationDelay: `${coin.delay}s`,
            "--sway": coin.sway,
          }}
        />
      ))}
    </div>
  );
}
