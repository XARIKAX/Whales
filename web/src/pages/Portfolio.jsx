import { useState } from "react";
import Portrait from "../components/Portrait.jsx";
import { pad } from "../cast.js";
import { formatEther } from "viem";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import Creature from "../components/pixel/creature.jsx";
import CountUp from "../components/CountUp.jsx";
import { Link } from "../router.jsx";
import { useWhaleArt } from "../components/WhaleArt.jsx";
import { SAMPLE_WHALES } from "../placeholder.js";
import { useHauls } from "../hooks.js";
import { publicClient, withdrawFromWhale } from "../chain.js";
import { speciesFor } from "../whales.js";
import { usd, multiplier, address, eth } from "../format.js";

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

function Holding({ whale, price, wallet, connected, onDone, onFocus }) {
  const earned = Number(formatEther(whale.lifetimeEarned));
  const waiting = Number(formatEther(whale.unclaimed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /* Money that has already been delivered is not in this page's gift — it is
     in the whale's own wallet, and only the holder can move it. */
  const inWallet = whale.accountBalance ?? 0n;
  const mine = connected && wallet?.account?.toLowerCase() === whale.holder?.toLowerCase();

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const client = await wallet.client();
      const hash = await withdrawFromWhale({
        client,
        holder: client.account.address,
        tokenId: whale.tokenId,
        whaleAccount: whale.account,
        deployed: whale.accountDeployed,
        amount: inWallet,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");
      onDone?.();
    } catch (e) {
      setError(e.shortMessage || e.message);
    } finally {
      setBusy(false);
    }
  }

  /* A page about what you own should show the thing you own, at the size of
     the thing rather than as a thumbnail beside its numbers. Every one of the
     thousand ships with the site, so this is a path and not a chain read; tier
     rides along in the metadata for anything the sample does not carry. */
  const { tier } = useWhaleArt(whale.tokenId);
  const shown = whale.tier || tier;

  return (
    <article className={`holding${whale.fed ? " fed" : ""}`}>
      <button
        type="button"
        className="holding-art"
        onClick={() => onFocus?.(whale.tokenId)}
        aria-label={`Bring whale ${whale.tokenId} to the top`}
      >
        <Portrait whale={whale} size={300} />
        <span className="tile-hover mono">Show</span>
      </button>

      <header className="holding-head">
        <h3 className="display">#{pad(whale.tokenId)}</h3>
        <span className="holding-tier mono">{shown || "Common"}</span>
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
          <dt className="mono">In its wallet</dt>
          <dd className="mono">{num(Number(formatEther(inWallet)), 4)} ETH</dd>
        </div>
        <div>
          <dt className="mono">Held</dt>
          <dd className="mono">{whale.heldDays}d</dd>
        </div>
      </dl>

      {inWallet > 0n && mine && (
        <button className="btn btn-foam btn-sm holding-cta" onClick={withdraw} disabled={busy}>
          {busy ? "Confirm in your wallet…" : `Withdraw ${num(Number(formatEther(inWallet)), 4)} ETH`}
        </button>
      )}

      {!whale.fed && inWallet === 0n && (
        <Link className="btn btn-foam btn-sm holding-cta" to="/activate">
          Wake it
        </Link>
      )}

      {error && <p className="notice error">{error}</p>}
    </article>
  );
}

/* --- Page ---------------------------------------------------------------- */

export default function Portfolio({ wallet, whales, ocean, price, live, onRefresh }) {
  const account = wallet?.account;
  /* Connected means real, even when the honest answer is "none". */
  const connected = Boolean(account) && live;
  const pod = connected ? whales : SAMPLE_WHALES;
  const hauls = useHauls(ocean?.haulCount);

  const held = pod.length;
  const awake = pod.filter((w) => w.fed).length;
  const earned = pod.reduce((sum, w) => sum + Number(formatEther(w.lifetimeEarned)), 0);
  const waiting = pod.reduce((sum, w) => sum + Number(formatEther(w.unclaimed)), 0);
  const weight = pod.reduce((sum, w) => sum + w.weight, 0) / 10_000;
  const inWallets = pod.reduce((sum, w) => sum + (w.accountBalance ?? 0n), 0n);
  const withdrawable = Number(formatEther(inWallets));

  /* Collection-wide figures come from the contract, not from a marketplace. A
     floor price and a 24h volume would have to be fetched from somewhere that
     can be wrong or absent, and this page would rather show fewer numbers than
     a number it cannot stand behind. */
  const supply = ocean ? Number(ocean.maxSupply) : 1000;
  const activated = ocean ? Number(ocean.activated) : 0;

  /* The page leads with one whale at full size, because a wall of thumbnails
     tells you that you own six things and a portrait tells you what one of them
     is. The best earner takes the spot; anything in the grid can replace it. */
  const [focus, setFocus] = useState(null);
  const featured =
    pod.find((w) => w.tokenId === focus) ||
    pod.reduce((best, w) => (w.lifetimeEarned > best.lifetimeEarned ? w : best), pod[0]) ||
    null;

  return (
    <main className="sheet" id="top">
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
                  #{pad(featured.tokenId)}
                  {featured.tier ? ` · ${featured.tier}` : ""}
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
                          style={{ "--v": Math.min(1, featured.weight / 33_300) }}
                        />
                      </div>
                      <span className="console-note mono">
                        climbing to 3.33x · fed {featured.heldDays}d
                      </span>
                    </div>

                    <dl className="spotlight-rows">
                      <div>
                        <dt className="mono">Earned all time</dt>
                        <dd className="figure">
                          {Number(formatEther(featured.lifetimeEarned)).toFixed(4)}
                          <span className="unit">ETH</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="mono">Waiting in the Trench</dt>
                        <dd className="figure">
                          {Number(formatEther(featured.unclaimed)).toFixed(4)}
                          <span className="unit">ETH</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="mono">In its own wallet</dt>
                        <dd className="figure">
                          {Number(formatEther(featured.accountBalance ?? 0n)).toFixed(4)}
                          <span className="unit">ETH</span>
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <>
                    <p className="spotlight-note">
                      This one is asleep. It carries no weight, takes no share of any haul, and goes
                      on earning nothing until somebody burns a million $WHALE to wake it.
                    </p>
                    <Link className="btn btn-foam" to="/activate">
                      Wake #{pad(featured.tokenId)}
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

      {/* --- The position panel ------------------------------------------ */}
      <div className="strip" id="position">
        <div className="wrap strip-grid">
          <Reading
            label="Earned all time"
            value={<CountUp value={earned} format={(n) => num(n, 3)} />}
            unit="ETH"
            meter={earned / Math.max(earned + waiting, 1e-9)}
            of={usd(pod.reduce((s, w) => s + w.lifetimeEarned, 0n), price) || "paid into each whale's own wallet"}
          />
          <Reading
            label="Waiting to land"
            value={<CountUp value={waiting} format={(n) => num(n, 4)} />}
            unit="ETH"
            meter={waiting / Math.max(earned + waiting, 1e-9)}
            of="anyone can deliver it, no claim form"
          />
          <Reading
            label="On the payroll"
            value={<CountUp value={awake} format={(n) => Math.round(n).toString()} />}
            unit={`/ ${held}`}
            meter={held ? awake / held : 0}
            of={`${weight.toFixed(2)}x total weight`}
          />
          <Reading
            label="In your whale wallets"
            value={<CountUp value={withdrawable} format={(n) => num(n, 4)} />}
            unit="ETH"
            meter={withdrawable / Math.max(withdrawable + waiting, 1e-9)}
            of="yours to withdraw, on each card below"
          />
        </div>
        <p className="strip-foot mono">
          <span className="strip-ping" aria-hidden="true" />
          {connected ? "Live · read straight from the contract" : "Sample · connect a wallet to read your own"}
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
              <Holding
                onFocus={setFocus}
                key={whale.tokenId}
                whale={whale}
                price={price}
                wallet={wallet}
                connected={connected}
                onDone={onRefresh}
              />
            ))}
          </Reveal>

          {held === 0 && (
            <p className="picker-empty">
              No whales in this wallet. Mint one for $1 on the front page, ten a transaction, or
              pick one up on secondary.
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

          {/* Read from the Trench's own Hauled logs. Not a per-wallet
              statement: a haul credits every fed whale at once through an
              accumulator, so the chain records the pot and the split, not a
              line item per holder. What each of your whales took from it is
              the "Earned" figure on its card above. */}
          <Reveal className="ledger" stagger step={40}>
            <div className="ledger-head mono">
              <span>Haul</span>
              <span>Pot</span>
              <span>To whales</span>
              <span>Hauler's tip</span>
            </div>
            {hauls.map((row) => (
              <div className="ledger-row" key={String(row.block)}>
                <span className="mono ledger-when">
                  <b>block {row.block.toLocaleString()}</b>
                  <em>{address(row.keeper)}</em>
                </span>
                <span className="mono">{eth(row.pot)} ETH</span>
                <span className="mono ledger-share">{eth(row.distributed)} ETH</span>
                <span className="mono">{eth(row.tip)} ETH</span>
              </div>
            ))}
          </Reveal>

          {hauls.length === 0 && (
            <p className="picker-empty">
              {ocean?.haulCount
                ? `${ocean.haulCount} haul${ocean.haulCount === 1n ? "" : "s"} so far, none inside the block window this page reads.`
                : "No hauls yet. The first one lands when the pot reaches the threshold."}
            </p>
          )}

          {/* --- The collection ------------------------------------------ */}
          <Reveal className="market" stagger step={50}>
            <div className="market-cell">
              <span className="console-label mono">Mint</span>
              <p className="console-value figure">
                {ocean ? eth(ocean.mintPrice, 6) : "not read"}
                <span className="unit">ETH</span>
              </p>
              <span className="console-note mono">ten a transaction, no wallet limit</span>
            </div>
            <div className="market-cell">
              <span className="console-label mono">Minted</span>
              <p className="console-value figure">
                {ocean ? Number(ocean.minted).toLocaleString() : "not read"}
                <span className="unit">of {supply}</span>
              </p>
              <span className="console-note mono">{activated} awake</span>
            </div>
            <div className="market-cell">
              <span className="console-label mono">Trench pot</span>
              <p className="console-value figure">
                {ocean ? eth(ocean.pot) : "not read"}
                <span className="unit">ETH</span>
              </p>
              <span className="console-note mono">
                {ocean ? `next haul at ${eth(ocean.haulThreshold)} ETH` : "next haul at threshold"}
              </span>
            </div>
            <div className="market-cell">
              <span className="console-label mono">Hauled all time</span>
              <p className="console-value figure">
                {ocean ? eth(ocean.totalDistributed) : "not read"}
                <span className="unit">ETH</span>
              </p>
              <span className="console-note mono">
                across {ocean ? Number(ocean.haulCount) : 0} hauls
              </span>
            </div>
          </Reveal>

          <p className="trust">
            {connected
              ? "Every figure on this page is read from the contracts. Nothing here is a projection or a promise: yield comes only from trading activity that may never happen."
              : "The pod above is a sample until you connect a wallet. The collection figures beside it are read from the contracts either way. Nothing here is a projection or a promise: yield comes only from trading activity that may never happen."}
          </p>
        </div>
      </section>
    </main>
  );
}
