import { useMemo } from "react";
import WhaleArt from "./WhaleArt.jsx";
import { eth, usd, multiplier, countdown } from "../format.js";
import { DOCS_URL } from "../config.js";
import Reveal from "./Reveal.jsx";

/** Deterministic bubble field — same every render, so React never reshuffles it. */
const BUBBLES = Array.from({ length: 18 }, (_, i) => {
  const seed = (i * 2654435761) % 1000;
  return {
    left: `${(seed % 97) + 1}%`,
    size: 5 + (seed % 17),
    duration: 13 + (seed % 13),
    delay: -((seed % 19) + i * 0.7),
    drift: `${((seed % 60) - 30) | 0}px`,
  };
});

function WaveEdge() {
  return (
    <div className="wave-edge" aria-hidden="true">
      <svg viewBox="0 0 2400 120" preserveAspectRatio="none">
        <path
          d="M0,64 C150,110 300,10 600,52 C900,94 1050,14 1200,52 C1350,90 1500,10 1800,52 C2100,94 2250,20 2400,64 L2400,120 L0,120 Z"
          fill="#6ec4e6"
          opacity="0.55"
        />
        <path
          d="M0,84 C200,120 340,40 600,74 C880,110 1040,42 1200,74 C1380,108 1520,42 1800,74 C2080,106 2240,46 2400,84 L2400,120 L0,120 Z"
          fill="#3fa9d9"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}

/** Shown before the contracts are live: the collection, with no chain to read. */
function CollectionCard() {
  return (
    <div className="glass featured afloat">
      <div className="featured-art placeholder">
        <span>1000</span>
      </div>
      <div className="featured-head">
        <span className="featured-name">The collection</span>
        <span className="featured-label">Fixed supply</span>
      </div>
      <div className="featured-rows num">
        <div>
          <span>Whales</span>
          <span>1000, never more</span>
        </div>
        <div>
          <span>To activate</span>
          <span>burn 1,000,000 $WHALE</span>
        </div>
        <div>
          <span>Loyalty weight</span>
          <span>1.00x → 3.33x</span>
        </div>
        <div>
          <span>Tax to whales</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

export default function Hero({ ocean, featured, price, wallet, live }) {
  const bubbles = useMemo(() => BUBBLES, []);
  const fed = featured && featured.activatedAt !== 0n;

  return (
    <section className="hero" id="top">
      <div className="bubbles" aria-hidden="true">
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              "--drift": b.drift,
            }}
          />
        ))}
      </div>

      <div className="wrap hero-grid">
        <Reveal stagger step={70}>
          <p className="eyebrow">$WHALE · Robinhood Chain</p>
          <h1 className="display">
            <span className="line">
              <span>Every trade</span>
            </span>
            <span className="line">
              <span>feeds the pod.</span>
            </span>
          </h1>
          <p className="hero-sub">
            2% buy / 3% sell on every trade — all of it flows to activated whales. In ETH, tracked in
            dollars.
          </p>
          <div className="hero-cta">
            <button className="btn btn-navy" onClick={() => wallet.connect()} disabled={Boolean(wallet.account)}>
              {wallet.account
                ? `${wallet.account.slice(0, 6)}…${wallet.account.slice(-4)}`
                : "Connect wallet"}
            </button>
            <a className="btn btn-ghost" href={DOCS_URL}>
              Read the docs
            </a>
          </div>
        </Reveal>

        {!live || !featured ? (
          <CollectionCard />
        ) : (
          <div className="glass featured afloat">
            <WhaleArt
              tokenId={featured.tokenId}
              className="featured-art"
              alt={`Whale #${featured.tokenId}, the top earner`}
            />
            <div className="featured-head">
              <span className="featured-name">Whale #{String(featured.tokenId)}</span>
              <span className="featured-label">{fed ? "Fed" : "Dormant"}</span>
            </div>
            <div>
              <p className="featured-label" style={{ marginBottom: 6 }}>
                Lifetime earnings
              </p>
              <div className={`featured-earn figure${fed ? " treasure" : ""}`}>
                {usd(featured.lifetimeEarned, price) ? (
                  usd(featured.lifetimeEarned, price)
                ) : (
                  <>
                    {eth(featured.lifetimeEarned)}
                    <span className="unit">ETH</span>
                  </>
                )}
              </div>
            </div>
            <div className="featured-rows num">
              <div>
                <span>Weight</span>
                <span>{fed ? multiplier(featured.weight) : "—"}</span>
              </div>
              <div>
                <span>Fed for</span>
                <span>{fed ? countdown(ocean.now - Number(featured.activatedAt)) : "—"}</span>
              </div>
              <div>
                <span>Owed now</span>
                <span>{eth(featured.claimable)} ETH</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <WaveEdge />
    </section>
  );
}
