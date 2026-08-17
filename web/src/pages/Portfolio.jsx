import { useState } from "react";
import { formatEther } from "viem";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import Portrait from "../components/Portrait.jsx";
import CountUp from "../components/CountUp.jsx";
import { Link } from "../router.jsx";
import { SAMPLE_WHALES, SAMPLE_MARKET, SAMPLE_PAYOUTS } from "../placeholder.js";
import { usd, multiplier, address } from "../format.js";

const num = (n, d = 3) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const eth = (wei, d = 4) => num(Number(formatEther(wei)), d);
const clamp = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/* --- One whale in the pod grid ------------------------------------------- */

function Tile({ whale, onFocus, active }) {
  const awake = whale.fed;

  return (
    <article className={`tile${awake ? " awake" : ""}${active ? " on" : ""}`}>
      <button
        type="button"
        className="tile-art"
        onClick={() => onFocus(whale.tokenId)}
        aria-label={`Show whale ${whale.tokenId}`}
      >
        <Portrait whale={whale} size={300} />
        <span className={`tile-chip mono${awake ? " on" : ""}`}>
          <span className={`pick-dot${awake ? " on" : ""}`} aria-hidden="true" />
          {awake ? multiplier(whale.weight) : "Dormant"}
        </span>
        <span className="tile-hover mono">Show</span>
      </button>

      <div className="tile-body">
        <header className="tile-head">
          <b className="display">#{whale.id || whale.tokenId}</b>
          <span className="tile-tier mono">{whale.tier}</span>
        </header>

        {awake ? (
          <dl className="tile-rows">
            <div>
              <dt className="mono">Earned</dt>
              <dd className="mono">{eth(whale.lifetimeEarned)} ETH</dd>
            </div>
          </dl>
        ) : (
          <Link className="btn btn-foam btn-sm tile-cta" to="/activate">
            Wake it
          </Link>
        )}
      </div>
    </article>
  );
}

/* --- One reading on the position panel ----------------------------------- */

function Reading({ label, value, unit, meter, of }) {
  return (
    <div className="strip-cell">
      <p className="strip-label mono">{label}</p>
      <p className="strip-value figure">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </p>
      <div className="strip-meter">
        <span className="strip-meter-fill" style={{ "--v": clamp(meter) }} />
      </div>
      <p className="strip-sub mono">{of}</p>
    </div>
  );
}

/* --- Page ---------------------------------------------------------------- */

export default function Portfolio({ wallet, whales, price, live }) {
  const account = wallet?.account;
  const pod = live && whales?.length ? whales : SAMPLE_WHALES;
  const market = SAMPLE_MARKET;

  const held = pod.length;
  const awake = pod.filter((w) => w.fed).length;
  const earned = pod.reduce((sum, w) => sum + Number(formatEther(w.lifetimeEarned)), 0);
  const waiting = pod.reduce((sum, w) => sum + Number(formatEther(w.unclaimed)), 0);
  const weight = pod.reduce((sum, w) => sum + w.weight, 0) / 10_000;
  const value = held * market.floor;

  /* The page leads with one whale at full size, because a wall of thumbnails
     shows you that you own eight things and a portrait shows you what one of
     them is. The best earner takes the spot; anything in the grid can replace
     it. */
  const [focus, setFocus] = useState(null);
  const featured =
    pod.find((w) => w.tokenId === focus) ||
    pod.reduce((best, w) => (w.lifetimeEarned > best.lifetimeEarned ? w : best), pod[0]) ||
    null;

  return (
    <main className="sheet" id="top">
      {/* --- The hero whale ------------------------------------------------ */}
      <section className="deep sheet-head sheet-tight">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">
              Your position
              {account && <span className="addr-pill mono">{address(account)}</span>}
            </p>
          </Reveal>

          {featured && (
            <Reveal className="spotlight" stagger step={70}>
              <Portrait whale={featured} size={520} className="spotlight-art" />

              <div className="spotlight-body">
                <p className={`spotlight-state mono${featured.fed ? " on" : ""}`}>
                  <span className={`pick-dot${featured.fed ? " on" : ""}`} aria-hidden="true" />
                  {featured.fed ? "On the payroll" : "Dormant"}
                </p>

                <h1 className="display spotlight-name">
                  {featured.name || `Whale #${featured.tokenId}`}
                </h1>

                <p className="spotlight-sub mono">
                  #{featured.id || featured.tokenId} · {featured.tier}
                </p>

                {featured.fed ? (
                  <>
                    <div className="spotlight-weight">
                      <div className="spotlight-weight-head mono">
                        <span>Loyalty weight</span>
                        <b>{multiplier(featured.weight)}</b>
                      </div>
                      <div className="strip-meter">
                        <span
                          className="strip-meter-fill"
                          style={{ "--v": clamp(featured.weight / 33_300) }}
                        />
                      </div>
                      <span className="console-note mono">
                        climbing to 3.33x · held {featured.heldDays}d
                      </span>
                    </div>

                    <dl className="spotlight-rows">
                      <div>
                        <dt className="mono">Earned all time</dt>
                        <dd className="figure">
                          {eth(featured.lifetimeEarned, 4)}
                          <span className="unit">ETH</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="mono">Waiting to land</dt>
                        <dd className="figure">
                          {eth(featured.unclaimed, 4)}
                          <span className="unit">ETH</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="mono">At the floor</dt>
                        <dd className="figure">
                          {market.floor}
                          <span className="unit">ETH</span>
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <p className="spotlight-note">
                      This one is asleep. It carries no weight, takes no share of any haul, and will
                      go on earning nothing until somebody burns a million $WHALE to wake it.
                    </p>
                    <Link className="btn btn-foam" to="/activate">
                      Wake #{featured.id || featured.tokenId}
                    </Link>
                  </>
                )}
              </div>
            </Reveal>
          )}

          {!account && (
            <Reveal>
              <div className="connect-call">
                <p>
                  Connect a wallet to read your own position. Until then this is a sample, so the
                  page can be seen doing its job.
                </p>
                <button className="btn btn-foam" onClick={() => wallet.connect()}>
                  Connect wallet
                </button>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* --- The position panel -------------------------------------------- */}
      <div className="strip" id="position">
        <div className="wrap strip-grid">
          <Reading
            label="Position value"
            value={<CountUp value={value} format={(n) => num(n, 3)} />}
            unit="ETH"
            meter={held / 12}
            of={`${held} whale${held === 1 ? "" : "s"} at ${market.floor} floor`}
          />
          <Reading
            label="Earned all time"
            value={<CountUp value={earned} format={(n) => num(n, 3)} />}
            unit="ETH"
            meter={earned / Math.max(earned + waiting, 1e-9)}
            of={`${num(waiting, 4)} ETH waiting to land`}
          />
          <Reading
            label="On the payroll"
            value={<CountUp value={awake} format={(n) => Math.round(n).toString()} />}
            unit={`/ ${held}`}
            meter={held ? awake / held : 0}
            of={`${weight.toFixed(2)}x total weight`}
          />
          <Reading
            label="Share of the pod"
            value={<CountUp value={(held / market.supply) * 100} format={(n) => n.toFixed(1)} />}
            unit="%"
            meter={held / market.supply}
            of={`${market.activated} of ${market.supply} activated`}
          />
        </div>
        <p className="strip-foot mono">
          <span className="strip-ping" aria-hidden="true" />
          {live
            ? "Live · read straight from the contract"
            : "Sample · reads from the chain on deployment"}
        </p>
      </div>

      {/* --- The rest of the pod ------------------------------------------- */}
      <section className="deep sheet-tight">
        <div className="wrap">
          <Reveal className="showcase-head" stagger>
            <h2 className="display">
              {held} in the water, <span className="tide on-dark">{awake} awake.</span>
            </h2>
            <span className="tag mono">Tap one to bring it up</span>
          </Reveal>

          <Reveal className="showcase" stagger step={50}>
            {pod.map((whale) => (
              <Tile
                key={whale.tokenId}
                whale={whale}
                active={featured && whale.tokenId === featured.tokenId}
                onFocus={setFocus}
              />
            ))}
          </Reveal>

          {held === 0 && (
            <p className="picker-empty">
              No whales in this wallet. All 1000 are minted, so the way in is secondary.
            </p>
          )}

          <Lane plane="sparse" shoal="school" seed={71} />

          {/* --- The ledger ---------------------------------------------- */}
          <Reveal stagger>
            <p className="eyebrow on-dark">The ledger</p>
            <h2 className="display">
              Every haul, and <span className="tide on-dark">your cut of it.</span>
            </h2>
          </Reveal>

          <Reveal className="ledger" stagger step={40}>
            <div className="ledger-head mono">
              <span>Haul</span>
              <span>Pot</span>
              <span>Your share</span>
              <span>Whales paid</span>
            </div>
            {SAMPLE_PAYOUTS.map((row) => (
              <div className="ledger-row" key={row.block}>
                <span className="mono ledger-when">
                  <b>{row.ago} ago</b>
                  <em>block {row.block.toLocaleString()}</em>
                </span>
                <span className="mono">{num(row.pot)} ETH</span>
                <span className="mono ledger-share">+{num(row.share, 4)} ETH</span>
                <span className="mono">{row.whales} of yours</span>
              </div>
            ))}
          </Reveal>

          {/* --- The collection ------------------------------------------ */}
          <Reveal className="market" stagger step={50}>
            <div className="market-cell">
              <span className="console-label mono">Floor</span>
              <p className="console-value figure">
                {market.floor}
                <span className="unit">ETH</span>
              </p>
              <span className={`console-note mono${market.floorChange >= 0 ? " up" : " down"}`}>
                {market.floorChange >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(market.floorChange * 100).toFixed(1)}% over 24h
              </span>
            </div>
            <div className="market-cell">
              <span className="console-label mono">24h volume</span>
              <p className="console-value figure">
                {market.volume24h}
                <span className="unit">ETH</span>
              </p>
              <span className="console-note mono">{market.listed} listed</span>
            </div>
            <div className="market-cell">
              <span className="console-label mono">Trench pot</span>
              <p className="console-value figure">
                {market.potEth}
                <span className="unit">ETH</span>
              </p>
              <span className="console-note mono">next haul at threshold</span>
            </div>
            <div className="market-cell">
              <span className="console-label mono">Hauled all time</span>
              <p className="console-value figure">
                {market.hauledEth}
                <span className="unit">ETH</span>
              </p>
              <span className="console-note mono">across {market.hauls} hauls</span>
            </div>
          </Reveal>

          <p className="trust">
            Figures on this page are a sample until the contracts are deployed. Nothing here is a
            projection or a promise: yield comes only from trading activity that may never happen.
          </p>
        </div>
      </section>
    </main>
  );
}
