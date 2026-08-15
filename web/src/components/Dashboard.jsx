import { useState } from "react";
import Actions from "./Actions.jsx";
import Reveal from "./Reveal.jsx";
import { eth, usd, multiplier, percent, ago, address, countdown } from "../format.js";

const PAGE = 12;

export default function Dashboard({ ocean, whales, price, wallet, onDone }) {
  const [filter, setFilter] = useState("fed");
  const [shown, setShown] = useState(PAGE);

  const rows = whales.filter((w) => {
    if (filter === "fed") return w.activatedAt !== 0n;
    if (filter === "owed") return w.claimable > 0n;
    if (filter === "earners") return w.lifetimeEarned > 0n;
    return true;
  });

  const fill = ocean ? percent(ocean.pot, ocean.haulThreshold) : 0;

  return (
    <section className="deep" id="dashboard">
      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow on-dark">Dashboard</p>
          <h2 className="display">Watch the net fill.</h2>
        </Reveal>

        <Reveal className="glass on-dark dash" style={{ marginTop: 40 }} delay={120}>
          <div className="dash-top">
            <div className="gauge">
              <div className="gauge-water" style={{ height: `${fill}%` }} />
              <div className="gauge-read">
                <div>
                  <p className="featured-label" style={{ color: "rgba(245,251,254,0.5)" }}>
                    Trench pot
                  </p>
                  <div className="gauge-figure num">
                    {ocean ? `${eth(ocean.pot, 4)} ETH` : "·"}
                  </div>
                  {ocean && usd(ocean.pot, price) && (
                    <div className="num" style={{ color: "var(--gold)", marginTop: 4 }}>
                      {usd(ocean.pot, price)}
                    </div>
                  )}
                </div>
              </div>
              <div className="gauge-note num">
                <span>
                  {ocean?.readyToHaul
                    ? "Ready, anyone can haul"
                    : ocean
                      ? `${eth(ocean.haulThreshold - ocean.pot, 4)} ETH to go`
                      : ""}
                </span>
                <span>threshold {ocean ? eth(ocean.haulThreshold, 3) : "·"} ETH</span>
              </div>
            </div>

            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <p className="featured-label" style={{ color: "rgba(245,251,254,0.5)" }}>
                  Delivered to whales
                </p>
                <div className="gauge-figure num">
                  {ocean ? eth(ocean.totalDelivered, 3) : "·"}{" "}
                  <span style={{ fontSize: "0.4em" }}>ETH</span>
                </div>
              </div>
              <div>
                <p className="featured-label" style={{ color: "rgba(245,251,254,0.5)" }}>
                  Hauls
                </p>
                <div className="gauge-figure num">{ocean ? String(ocean.haulCount) : "·"}</div>
                {ocean && (
                  <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--on-dark-dim)" }}>
                    last {ago(ocean.lastHaulAt, ocean.now)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="row" style={{ marginBottom: 18 }}>
              {["fed", "owed", "earners", "all"].map((option) => (
                <button
                  key={option}
                  className={`btn btn-sm btn-ghost on-dark${filter === option ? " active" : ""}`}
                  onClick={() => {
                    setFilter(option);
                    setShown(PAGE);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="dash-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Whale</th>
                    <th>Status</th>
                    <th className="right">Weight</th>
                    <th className="right">Fed for</th>
                    <th className="right">Owed</th>
                    <th className="right">Lifetime</th>
                    <th>Wallet</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, shown).map((w) => {
                    const fed = w.activatedAt !== 0n;
                    return (
                      <tr key={String(w.tokenId)}>
                        <td>#{String(w.tokenId)}</td>
                        <td>
                          <span className={`pill ${fed ? "fed" : "dormant"}`}>
                            {fed ? "Fed" : "Dormant"}
                          </span>
                        </td>
                        <td className="right num">{fed ? multiplier(w.weight) : "·"}</td>
                        <td className="right num">
                          {fed && ocean ? countdown(ocean.now - Number(w.activatedAt)) : "·"}
                        </td>
                        <td className="right num">{eth(w.claimable)}</td>
                        <td className="right num gold">
                          {usd(w.lifetimeEarned, price) || eth(w.lifetimeEarned)}
                        </td>
                        <td className="num">{address(w.account)}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ color: "var(--on-dark-faint)" }}>
                        No whales match that filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {shown < rows.length && (
              <button
                className="btn btn-ghost on-dark btn-sm"
                style={{ marginTop: 18 }}
                onClick={() => setShown((n) => n + PAGE)}
              >
                Show more ({rows.length - shown} left)
              </button>
            )}
          </div>

          <Actions ocean={ocean} wallet={wallet} onDone={onDone} />
        </Reveal>
      </div>
    </section>
  );
}
