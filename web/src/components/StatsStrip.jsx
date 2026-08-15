import { formatEther } from "viem";
import CountUp from "./CountUp.jsx";
import { usd, whale, percent } from "../format.js";
import { CHAIN } from "../config.js";

const SUPPLY = 1_000_000_000n * 10n ** 18n;

const clamp = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const num = (n, digits = 3) =>
  n.toLocaleString(undefined, { maximumFractionDigits: digits });

/**
 * One reading on the panel: a name, a figure, a meter and what the meter is of.
 *
 * The meter is the whole point of the redesign. Four numbers in a dark band is
 * a table with the lines rubbed out; the same four numbers each against the
 * thing that bounds them is an instrument, and an instrument is what a page
 * about a pot filling up should be showing.
 */
function Cell({ label, value, unit, meter, of }) {
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

/**
 * Before the contracts exist, every one of these is honestly zero. That is a
 * reading, so the panel shows it as one.
 *
 * It used to show four ghost placeholders instead, which on a dark band were
 * invisible: a row of labels floating over nothing, which reads as a page that
 * failed to load rather than a page waiting to start.
 */
const STANDBY = [
  { label: "Trench pot", value: "0.000", unit: "ETH", of: "0% to the first haul" },
  { label: "Hauled all time", value: "0.000", unit: "ETH", of: "No hauls yet" },
  { label: "Whales activated", value: "0", unit: "/ 1,000", of: "None minted yet" },
  { label: "$WHALE burned", value: "0", unit: "$WHALE", of: "0.00% of supply gone" },
];

function Panel({ children, status }) {
  return (
    <div className="strip" id="stats">
      <div className="wrap strip-grid">{children}</div>
      <p className="strip-foot mono">
        <span className="strip-ping" aria-hidden="true" />
        {status}
      </p>
    </div>
  );
}

export default function StatsStrip({ ocean, price }) {
  if (!ocean) {
    return (
      <Panel status="Standby · reads from the chain on deployment">
        {STANDBY.map((cell) => (
          <Cell key={cell.label} {...cell} meter={0} />
        ))}
      </Panel>
    );
  }

  const potEth = Number(formatEther(ocean.pot));
  const hauledEth = Number(formatEther(ocean.totalDistributed));
  const burned = Number(formatEther(ocean.burned));
  const toHaul = percent(ocean.pot, ocean.haulThreshold);
  const burnedShare = percent(ocean.burned, SUPPLY);
  const activatedShare = Number(ocean.activated) / Number(ocean.maxSupply || 1n);

  return (
    <Panel status={`Live on ${CHAIN.name} · read straight from the contract`}>
      <Cell
        label="Trench pot"
        value={<CountUp value={potEth} format={(n) => num(n)} />}
        unit="ETH"
        meter={toHaul / 100}
        of={
          usd(ocean.pot, price)
            ? `${usd(ocean.pot, price)} · ${toHaul.toFixed(0)}% to the haul`
            : `${toHaul.toFixed(0)}% to the haul`
        }
      />

      <Cell
        label="Hauled all time"
        value={<CountUp value={hauledEth} format={(n) => num(n)} />}
        unit="ETH"
        meter={hauledEth / Math.max(hauledEth + potEth, 1e-9)}
        of={
          usd(ocean.totalDistributed, price)
            ? `${usd(ocean.totalDistributed, price)} · ${String(ocean.haulCount)} hauls`
            : `${String(ocean.haulCount)} hauls, all of it to whales`
        }
      />

      <Cell
        label="Whales activated"
        value={<CountUp value={Number(ocean.activated)} format={(n) => Math.round(n).toString()} />}
        unit={`/ ${String(ocean.maxSupply)}`}
        meter={activatedShare}
        of={`${(Number(ocean.totalWeight) / 10_000).toFixed(2)}x weight on the payroll`}
      />

      <Cell
        label="$WHALE burned"
        value={
          <CountUp value={burned} format={(n) => whale(BigInt(Math.round(n)) * 10n ** 18n)} />
        }
        unit="$WHALE"
        meter={burnedShare / 100}
        of={`${burnedShare.toFixed(2)}% of supply gone for good`}
      />
    </Panel>
  );
}
