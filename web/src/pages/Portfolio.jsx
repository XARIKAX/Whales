import { formatEther } from "viem";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import Creature from "../components/pixel/creature.jsx";
import CountUp from "../components/CountUp.jsx";
import { Link } from "../router.jsx";
import { SAMPLE_WHALES, SAMPLE_MARKET, SAMPLE_PAYOUTS } from "../placeholder.js";
import { usd, multiplier, address } from "../format.js";

const num = (n, d = 3) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const clamp = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

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

/* --- One whale in the holdings grid -------------------------------------- */

function Holding({ whale, price }) {
  const earned = Number(formatEther(whale.lifetimeEarned));
  const waiting = Number(formatEther(whale.unclaimed));

  return (
    <article className={`holding${whale.fed ? " fed" : ""}`}>
      <div className="holding-art">
        <Creature kind="whale" species={whale.species} height={52} beat={2.2} />
      </div>

      <header className="holding-head">
        <h3 className="display">#{whale.tokenId}</h3>
        <span className="holding-tier mono">{whale.tier}</span>
      </header>

      <p className="holding-state mono">
        <span className={`pick-dot${whale.fed ? " on" : ""}`} aria-hidden="true" />
        {whale.fed ? `Awake · ${multiplier(whale.weight)}` : "Dormant"}
      </p>

      {/* Weight against the 3.33x cap: the one number that keeps moving while
          you do nothing, so it gets the meter. */}
      <div className="strip-meter">
        <span className="strip-meter-fill" style={{ "--v": clamp(whale.weight / 33_300) }} />
      </div>

      <dl className="holding-rows">
        <div>
          <dt className="mono">Earned</dt>
          <dd className="mono">{usd(whale.lifetimeEarned, price) || `${num(earned, 4)} ETH`}</dd>
        </div>
        <div>
          <dt className="mono">Waiting</dt>
          <dd className="mono">{num(waiting, 4)} ETH</dd>
        </div>
        <div>
          <dt className="mono">Held</dt>
          <dd className="mono">{whale.heldDays}d</dd>
        </div>
      </dl>

      {!whale.fed && (
        <Link className="btn btn-foam btn-sm holding-cta" to="/activate">
          Wake it
        </Link>
      )}
    </article>
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

  return (
    <main className="sheet" id="top">
      <section className="deep sheet-head">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">
              Your position
              {account && <span className="addr-pill mono">{address(account)}</span>}
            </p>
            <h1 className="display sheet-title">
              Everything you <span className="tide on-dark">hold.</span>
            </h1>
            <p className="lede on-dark">
              Every whale in this wallet, what each is worth at the floor, what each has earned, and
              what is waiting to land. Read straight from the chain once the contracts are deployed.
            </p>
          </Reveal>

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

      {/* --- The position panel ------------------------------------------ */}
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
          {live ? "Live · read straight from the contract" : "Sample · reads from the chain on deployment"}
        </p>
      </div>

      {/* --- Holdings ------------------------------------------------------ */}
      <section className="deep">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">Holdings</p>
            <h2 className="display">
              {held} in the water, <span className="tide on-dark">{awake} awake.</span>
            </h2>
          </Reveal>

          <Lane plane="drift" shoal="school" seed={13} tall />

          <Reveal className="holdings" stagger step={60}>
            {pod.map((whale) => (
              <Holding key={whale.tokenId} whale={whale} price={price} />
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
                {market.floorChange >= 0 ? "▲" : "▼"} {Math.abs(market.floorChange * 100).toFixed(1)}%
                over 24h
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
