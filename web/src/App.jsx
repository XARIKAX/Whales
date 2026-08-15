import { useEffect, useState } from "react";
import { useOcean, useWhales, useEthPrice, useDepth, useWallet } from "./hooks.js";
import { eth, usd, whale, percent, ago, address, plural } from "./format.js";
import { ADDRESSES, CONFIGURED, CHAIN, explorerUrl } from "./config.js";
import Pod from "./components/Pod.jsx";
import Actions from "./components/Actions.jsx";

const BILLION = 1_000_000_000n * 10n ** 18n;

export default function App() {
  const { data: ocean, error, loading, refresh } = useOcean();
  const { whales, refresh: refreshWhales } = useWhales(ocean?.minted);
  const price = useEthPrice();
  const depth = useDepth();
  const wallet = useWallet();
  const [filter, setFilter] = useState("all");

  // The sunlight fades as the reader sinks.
  useEffect(() => {
    document.documentElement.style.setProperty("--sunlight", String(Math.max(0, 1 - depth * 1.6)));
  }, [depth]);

  const refreshAll = () => {
    refresh();
    refreshWhales();
  };

  const metres = Math.round(depth * 10_900);

  return (
    <>
      <div className="ocean" />
      <div className="shafts" />

      <div className="wrap">
        <header className="masthead">
          <p className="ticker">$WHALE · {CHAIN.name}</p>
          <h1 className="wordmark">WHALES</h1>
          <p className="lede">
            Whales don't chase liquidity. <em>They are liquidity.</em>
          </p>
          <p className="sub">
            1000 pixel whales. Every fee in the ocean flows to them — paid in ETH, delivered into
            each whale's own wallet. No claim forms. No admin keys. No trust.
          </p>
        </header>

        {!CONFIGURED && (
          <section>
            <p className="notice error">
              No deployment configured. Copy <code>.env.example</code> to <code>.env</code>, fill in
              the addresses from <code>contracts/deployments/&lt;network&gt;.json</code>, and
              restart the dev server.
            </p>
          </section>
        )}

        {CONFIGURED && (
          <>
            <section id="trench">
              <div className="section-head">
                <h2>The Trench</h2>
                <span className="depth">{metres.toLocaleString()} m</span>
              </div>

              {loading && !ocean && <p className="muted">Sounding the depths…</p>}
              {error && error !== "not-configured" && (
                <p className="notice error">Could not reach {CHAIN.name}: {error}</p>
              )}

              {ocean && (
                <div className="panel pot">
                  <div>
                    <div className="pot-figure">
                      {eth(ocean.pot, 5)}
                      <span>ETH IN THE NET</span>
                    </div>
                    {usd(ocean.pot, price) && <div className="pot-usd">{usd(ocean.pot, price)}</div>}
                  </div>

                  <div>
                    <div className="net">
                      <div
                        className={`net-fill${ocean.readyToHaul ? " ready" : ""}`}
                        style={{ width: `${percent(ocean.pot, ocean.haulThreshold)}%` }}
                      />
                    </div>
                    <div className="net-label">
                      <span>
                        {ocean.readyToHaul
                          ? "ready — anyone can haul it"
                          : `${eth(ocean.haulThreshold - ocean.pot, 5)} ETH to go`}
                      </span>
                      <span>threshold {eth(ocean.haulThreshold)} ETH</span>
                    </div>
                  </div>

                  <p className="muted">
                    The Trench has no withdraw function. What enters leaves one way: the haul, split
                    across every activated whale by weight, in a single transaction.{" "}
                    {explorerUrl("address", ADDRESSES.trench) ? (
                      <a href={explorerUrl("address", ADDRESSES.trench)} target="_blank" rel="noreferrer">
                        Read the contract
                      </a>
                    ) : (
                      <span className="mono">{address(ADDRESSES.trench)}</span>
                    )}
                    .
                  </p>
                </div>
              )}
            </section>

            {ocean && (
              <section id="all-time">
                <div className="section-head">
                  <h2>All time</h2>
                  <span className="depth">{metres.toLocaleString()} m</span>
                </div>

                <dl className="stats">
                  <div className="stat">
                    <dt>Distributed</dt>
                    <dd>
                      {eth(ocean.totalDistributed)} ETH
                      {usd(ocean.totalDistributed, price) && <small>{usd(ocean.totalDistributed, price)}</small>}
                    </dd>
                  </div>
                  <div className="stat">
                    <dt>Delivered to whales</dt>
                    <dd>
                      {eth(ocean.totalDelivered)} ETH
                      <small>
                        {plural(ocean.haulCount, "haul")} · last {ago(ocean.lastHaulAt, ocean.now)}
                      </small>
                    </dd>
                  </div>
                  <div className="stat">
                    <dt>$WHALE burned</dt>
                    <dd>
                      {whale(ocean.burned)}
                      <small>{percent(ocean.burned, BILLION).toFixed(2)}% of supply gone</small>
                    </dd>
                  </div>
                  <div className="stat">
                    <dt>Whales fed</dt>
                    <dd>
                      {String(ocean.activated)} / {String(ocean.minted)}
                      <small>{String(ocean.maxSupply)} will ever exist</small>
                    </dd>
                  </div>
                  <div className="stat">
                    <dt>Total weight</dt>
                    <dd>
                      {(Number(ocean.totalWeight) / 10_000).toFixed(2)}x
                      <small>1.00x at feeding, 3.33x at the cap</small>
                    </dd>
                  </div>
                  <div className="stat">
                    <dt>Paid to keepers</dt>
                    <dd>
                      {eth(ocean.totalTipped)} ETH
                      <small>0.5% of every haul, to whoever calls it</small>
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            <section id="pod">
              <div className="section-head">
                <h2>The Pod</h2>
                <span className="depth">{metres.toLocaleString()} m</span>
              </div>

              <div className="row" style={{ marginBottom: 20 }}>
                {["all", "fed", "dormant", "owed"].map((option) => (
                  <button
                    key={option}
                    className={`small${filter === option ? "" : " ghost"}`}
                    onClick={() => setFilter(option)}
                  >
                    {option}
                  </button>
                ))}
                <button className="small ghost" onClick={refreshAll}>
                  refresh
                </button>
              </div>

              <Pod
                whales={whales}
                price={price}
                revealed={ocean?.revealed}
                filter={filter}
                now={ocean?.now}
              />
            </section>

            <section id="act">
              <div className="section-head">
                <h2>Press the buttons</h2>
                <span className="depth">{metres.toLocaleString()} m</span>
              </div>
              <p className="muted" style={{ marginBottom: 20 }}>
                A keeper bot normally does this. It has no special powers — every call below is one
                any wallet can make, and hauling pays the caller 0.5%.
              </p>
              <Actions
                ocean={ocean && { ...ocean, activationBurn: 1_000_000n * 10n ** 18n }}
                wallet={wallet}
                onDone={refreshAll}
              />
            </section>
          </>
        )}

        <section id="loop">
          <div className="section-head">
            <h2>The Loop</h2>
            <span className="depth">{metres.toLocaleString()} m</span>
          </div>
          <div className="loop">
            <div className="loop-step">
              <strong>01 — Trade</strong>2% buy, 3% sell. Flap collects the tax in ETH.
            </div>
            <div className="loop-step">
              <strong>02 — Trench</strong>The tax lands in a contract with no withdraw function.
            </div>
            <div className="loop-step">
              <strong>03 — Haul</strong>Anyone splits the pot across fed whales. Caller keeps 0.5%.
            </div>
            <div className="loop-step">
              <strong>04 — Weight</strong>Every fed whale starts at 1x, climbs toward 3.33x.
            </div>
            <div className="loop-step">
              <strong>05 — Deliver</strong>Each share lands in the whale's own wallet, as ETH or the
              stock its holder elected.
            </div>
          </div>
        </section>

        <footer>
          <p>
            Feed the whale. Haul the Trench. Own the tide. — Activating burns 1,000,000 $WHALE
            permanently. Selling a whale takes it off the payroll in the same transaction; the new
            owner burns another million to put it back on.
          </p>
          <p className="mono">
            {Object.entries(ADDRESSES).map(([name, value]) => (
              <span key={name} style={{ display: "block" }}>
                {name}: {value || "unset"}
              </span>
            ))}
          </p>
        </footer>
      </div>
    </>
  );
}
