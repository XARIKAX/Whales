import { formatEther } from "viem";
import CountUp from "./CountUp.jsx";
import { eth, usd, whale, percent } from "../format.js";

const SUPPLY = 1_000_000_000n * 10n ** 18n;

function Cell({ label, children, sub }) {
  return (
    <div className="strip-cell">
      <p className="strip-label">{label}</p>
      {children}
      {sub && <p className="strip-sub">{sub}</p>}
    </div>
  );
}

/** Waiting should look intentional, not broken. */
function Pending() {
  return (
    <>
      <div className="strip" id="stats">
        <div className="wrap strip-grid">
          {["Trench pot", "Total hauled all-time", "Whales activated", "$WHALE burned"].map(
            (label) => (
              <Cell key={label} label={label}>
                <div className="strip-sweep" aria-label="Awaiting deployment" />
              </Cell>
            )
          )}
        </div>
        <p className="strip-foot">Awaiting deployment</p>
      </div>
    </>
  );
}

export default function StatsStrip({ ocean, price }) {
  if (!ocean) return <Pending />;

  const potEth = Number(formatEther(ocean.pot));
  const hauledEth = Number(formatEther(ocean.totalDistributed));
  const burned = Number(formatEther(ocean.burned));

  return (
    <div className="strip" id="stats">
      <div className="wrap strip-grid">
        <Cell
          label="Trench pot"
          sub={usd(ocean.pot, price) || `${percent(ocean.pot, ocean.haulThreshold).toFixed(0)}% to haul`}
        >
          <div className="strip-value">
            <CountUp
              value={potEth}
              format={(n) => n.toLocaleString(undefined, { maximumFractionDigits: 3 })}
            />
            <span className="unit">ETH</span>
          </div>
        </Cell>

        <Cell
          label="Total hauled all-time"
          sub={usd(ocean.totalDistributed, price) || `${String(ocean.haulCount)} hauls`}
        >
          <div className="strip-value">
            <CountUp
              value={hauledEth}
              format={(n) => n.toLocaleString(undefined, { maximumFractionDigits: 3 })}
            />
            <span className="unit">ETH</span>
          </div>
        </Cell>

        <Cell
          label="Whales activated"
          sub={`${(Number(ocean.totalWeight) / 10_000).toFixed(2)}x total weight`}
        >
          <div className="strip-value">
            <CountUp value={Number(ocean.activated)} format={(n) => Math.round(n).toString()} />
            <span className="unit">/ {String(ocean.maxSupply)}</span>
          </div>
        </Cell>

        <Cell
          label="$WHALE burned"
          sub={`${percent(ocean.burned, SUPPLY).toFixed(2)}% of supply gone`}
        >
          <div className="strip-value">
            <CountUp value={burned} format={(n) => whale(BigInt(Math.round(n)) * 10n ** 18n)} />
          </div>
        </Cell>
      </div>
    </div>
  );
}

export { eth };
