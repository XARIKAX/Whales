import { eth, usd, whale, percent } from "../format.js";

const SUPPLY = 1_000_000_000n * 10n ** 18n;

function Cell({ label, value, unit, sub }) {
  return (
    <div className="strip-cell">
      <p className="strip-label">{label}</p>
      <div className="strip-value num">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <p className="strip-sub num">{sub}</p>}
    </div>
  );
}

export default function StatsStrip({ ocean, price }) {
  if (!ocean) {
    return (
      <div className="strip" id="stats">
        <div className="wrap strip-grid">
          {["Trench pot", "Total hauled", "Whales activated", "$WHALE burned"].map((label) => (
            <Cell key={label} label={label} value="—" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="strip" id="stats">
      <div className="wrap strip-grid">
        <Cell
          label="Trench pot"
          value={eth(ocean.pot, 3)}
          unit="ETH"
          sub={usd(ocean.pot, price) || `${percent(ocean.pot, ocean.haulThreshold).toFixed(0)}% to haul`}
        />
        <Cell
          label="Total hauled all-time"
          value={eth(ocean.totalDistributed, 3)}
          unit="ETH"
          sub={usd(ocean.totalDistributed, price) || `${String(ocean.haulCount)} hauls`}
        />
        <Cell
          label="Whales activated"
          value={String(ocean.activated)}
          unit={`/ ${String(ocean.maxSupply)}`}
          sub={`${(Number(ocean.totalWeight) / 10_000).toFixed(2)}x total weight`}
        />
        <Cell
          label="$WHALE burned"
          value={whale(ocean.burned)}
          sub={`${percent(ocean.burned, SUPPLY).toFixed(2)}% of supply gone`}
        />
      </div>
    </div>
  );
}
