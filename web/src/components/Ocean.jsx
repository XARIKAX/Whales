import { formatEther } from "viem";
import CountUp from "./CountUp.jsx";
import Reveal from "./Reveal.jsx";
import { Link } from "../router.jsx";
import { CHAIN } from "../config.js";
import { usd, whale, percent, ago, plural } from "../format.js";

/**
 * The ocean, live.
 *
 * This was a thin band of four figures, which is a fair summary and a poor
 * argument. Everything below is already on chain and was simply not being
 * asked for: what has ever landed in the Trench, what has been split, what has
 * actually arrived in the whales' own wallets, what the haulers were paid for
 * doing it, how much of a billion tokens has been destroyed to switch whales
 * on, and how much weight is currently drawing a wage.
 *
 * One reading leads, because a page that shouts eleven numbers shouts nothing:
 * the money that has reached holders, in dollars, at the size of the claim.
 * The rest support it.
 *
 * Every figure here comes from a contract call. There is no marketplace floor
 * and no 24h volume, because those would have to be fetched from somewhere that
 * can be wrong or absent, and this section would rather show fewer numbers than
 * one it cannot stand behind.
 */

const TOKEN_SUPPLY = 1_000_000_000n * 10n ** 18n;

const num = (n, d = 3) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const eth = (wei, d = 4) => num(Number(formatEther(wei ?? 0n)), d);

/* --- One big reading ------------------------------------------------------ */

function Stat({ label, value, unit, meter, foot, body }) {
  return (
    <article className="stat">
      <p className="stat-label mono">{label}</p>

      <p className="stat-figure figure">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </p>

      {body && <p className="stat-body">{body}</p>}

      {meter !== undefined && (
        <div className="strip-meter stat-meter">
          <span
            className="strip-meter-fill"
            style={{ "--v": Math.max(0, Math.min(1, meter)) }}
          />
        </div>
      )}

      {foot && <p className="stat-foot mono">{foot}</p>}
    </article>
  );
}

/* --- One small reading ---------------------------------------------------- */

function Line({ label, value, unit, foot }) {
  return (
    <div className="oline">
      <span className="oline-label mono">{label}</span>
      <span className="oline-value figure">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      {foot && <span className="oline-foot mono">{foot}</span>}
    </div>
  );
}

/* --- Section -------------------------------------------------------------- */

export default function Ocean({ ocean, price, live }) {
  const on = Boolean(live && ocean);

  /* Before there is a chain to read, every one of these is honestly zero. That
     is a reading, so the panel shows it as one rather than as a row of empty
     placeholder boxes, which on a dark band are invisible and read as a page
     that failed rather than a page waiting to start. */
  const o = ocean || {};
  const distributed = o.totalDistributed ?? 0n;
  const received = o.totalReceived ?? 0n;
  const delivered = o.totalDelivered ?? 0n;
  const tipped = o.totalTipped ?? 0n;
  const pot = o.pot ?? 0n;
  const burned = o.burned ?? 0n;
  const minted = Number(o.minted ?? 0);
  const activated = Number(o.activated ?? 0);
  const maxSupply = Number(o.maxSupply ?? 1000);
  const weight = Number(o.totalWeight ?? 0) / 10_000;
  const hauls = Number(o.haulCount ?? 0);

  const paidUsd = usd(distributed, price);
  const paidEth = Number(formatEther(distributed));
  const burnedShare = percent(burned, TOKEN_SUPPLY);
  const toHaul = o.haulThreshold ? percent(pot, o.haulThreshold) : 0;
  const mintedShare = maxSupply ? minted / maxSupply : 0;
  const awakeShare = maxSupply ? activated / maxSupply : 0;

  return (
    <section className="ocean" id="stats">
      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow on-dark">
            The ocean
            <span className={`live-pill mono${on ? " on" : ""}`}>
              <span className="strip-ping" aria-hidden="true" />
              {on ? `Live on ${CHAIN.name}` : "Standby"}
            </span>
          </p>
        </Reveal>

        {/* The claim, at the size of the claim. */}
        <Reveal className="headline-stat" stagger step={60}>
          <p className="stat-label mono">Paid to whales, all time</p>

          <p className="headline-figure">
            {paidUsd ? (
              <b className="display">{paidUsd}</b>
            ) : (
              <>
                <b className="display">
                  <CountUp value={paidEth} format={(n) => num(n, 4)} />
                </b>
                <span className="headline-unit display">ETH</span>
              </>
            )}
          </p>

          <p className="headline-note">
            {paidUsd ? (
              <>
                <b>{eth(distributed)} ETH</b> split across {plural(hauls, "haul")} and delivered into
                each whale's own on-chain wallet. Nobody claims anything, and nobody can take it out
                on the way.
              </>
            ) : (
              <>
                Split across {plural(hauls, "haul")} and delivered into each whale's own on-chain
                wallet. Nobody claims anything, and nobody can take it out on the way.
              </>
            )}
          </p>
        </Reveal>

        {/* The four that describe the collection. */}
        <Reveal className="stat-grid" stagger step={60}>
          <Stat
            label="Whales minted"
            value={<CountUp value={minted} format={(n) => Math.round(n).toLocaleString()} />}
            unit={`/ ${maxSupply.toLocaleString()}`}
            meter={mintedShare}
            body="Minting is the only time a whale is created. The contract has no mint-more path, no owner and no upgrade, so this number can only ever stop."
            foot={`${(mintedShare * 100).toFixed(1)}% minted`}
          />

          <Stat
            label="On the payroll"
            value={<CountUp value={activated} format={(n) => Math.round(n).toLocaleString()} />}
            unit={`/ ${minted.toLocaleString() || maxSupply.toLocaleString()}`}
            meter={awakeShare}
            body="Every one of these burned a million $WHALE to wake up. Each takes a share of the tax on every trade, weighted by how long it has stayed awake."
            foot={`${weight.toFixed(2)}x total weight`}
          />

          <Stat
            label="$WHALE burned"
            value={<CountUp value={Number(formatEther(burned))} format={(n) => whale(BigInt(Math.round(n)) * 10n ** 18n)} />}
            meter={burnedShare / 100}
            body="Destroyed to switch whales on, out of a billion. It does not go to us and it does not come back, so supply only ever falls."
            foot={`${burnedShare.toFixed(2)}% of supply gone for good`}
          />

          <Stat
            label="In the Trench now"
            value={<CountUp value={Number(formatEther(pot))} format={(n) => num(n, 4)} />}
            unit="ETH"
            meter={toHaul / 100}
            body="Waiting on the threshold. When it is reached anyone can trigger the haul, and whoever does keeps the tip for the gas."
            foot={
              usd(pot, price)
                ? `${usd(pot, price)} · ${toHaul.toFixed(0)}% to the next haul`
                : `${toHaul.toFixed(0)}% to the next haul`
            }
          />
        </Reveal>

        {/* The five that describe the money, once. */}
        <Reveal className="orail" stagger step={40}>
          <Line
            label="Everything that has landed"
            value={eth(received)}
            unit="ETH"
            foot={usd(received, price) || "into one contract"}
          />
          <Line
            label="Delivered into whale wallets"
            value={eth(delivered)}
            unit="ETH"
            foot={usd(delivered, price) || "ERC-6551, per whale"}
          />
          <Line
            label="Paid to haulers"
            value={eth(tipped)}
            unit="ETH"
            foot={`0.5% tip across ${plural(hauls, "haul")}`}
          />
          <Line
            label="Hauls"
            value={hauls.toLocaleString()}
            foot={o.lastHaulAt ? `last ${ago(Number(o.lastHaulAt), o.now)}` : "none yet"}
          />
          <Line
            label="$WHALE circulating"
            value={o.supply ? whale(o.supply) : "not wired"}
            foot={o.supply ? `of 1B at launch` : "waiting on the token"}
          />
        </Reveal>

        <div className="ocean-foot">
          <p className="mono">
            {on
              ? `Read straight from the contract${o.block ? ` at block ${o.block.toLocaleString()}` : ""}.`
              : "These read from the contract the moment it is deployed."}
          </p>
          <div className="ocean-onward">
            <Link className="btn btn-foam btn-sm" to="/mint">
              Mint a whale
            </Link>
            <Link className="btn btn-ghost on-dark btn-sm" to="/portfolio">
              See your position
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
