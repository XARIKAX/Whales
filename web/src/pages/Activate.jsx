import { useState } from "react";
import { formatEther, maxUint256 } from "viem";
import Reveal from "../components/Reveal.jsx";
import { Lane } from "../components/Marine.jsx";
import Creature from "../components/pixel/creature.jsx";
import { useWhaleArt } from "../components/WhaleArt.jsx";
import { Link } from "../router.jsx";
import { SAMPLE_WHALES, ACTIVATION_COST } from "../placeholder.js";
import { publicClient, ADDRESSES, whalesAbi, erc20Abi } from "../chain.js";
import { useWhaleBalance } from "../hooks.js";
import { speciesFor } from "../whales.js";
import { multiplier } from "../format.js";

/* --- The three things that have to be true ------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Hold the burn",
    body: `${ACTIVATION_COST.toLocaleString()} $WHALE, in the same wallet as the whale. Activation destroys it. It does not go to us and it does not come back.`,
  },
  {
    n: "02",
    title: "Connect that wallet",
    body: "The whale and the tokens have to be in one place. The page reads both and tells you what is missing before you sign anything.",
  },
  {
    n: "03",
    title: "Approve, then activate",
    body: "Two transactions. The first lets the contract take the burn, the second wakes the whale. From that block it is on the payroll.",
  },
];

/* --- What changes the moment it wakes ------------------------------------ */

const EFFECTS = [
  ["Weight", "0", "1.00x", "and climbing to 3.33x"],
  ["Share of every haul", "none", "by weight", "paid in ETH"],
  ["Loyalty clock", "stopped", "running", "starts at this block"],
  ["On sale", "nothing to lose", "sleeps again", "the new owner burns to wake it"],
];

/* --- One whale in the picker --------------------------------------------- */

function WhaleRow({ whale, selected, onSelect, disabled }) {
  // Tier is a metadata trait rather than a contract field, so it arrives with
  // the art. Until it does the row still draws — with the whale's own tier when
  // this is the sample pod, and a plain humpback when it is not.
  const { ref, tier } = useWhaleArt(whale.tokenId);
  const shown = tier || whale.tier;

  return (
    <button
      type="button"
      ref={ref}
      className={`pick${selected ? " on" : ""}${whale.fed ? " fed" : ""}`}
      onClick={() => !whale.fed && onSelect(whale.tokenId)}
      disabled={disabled || whale.fed}
      aria-pressed={selected}
    >
      <span className="pick-art">
        <Creature kind="whale" species={speciesFor(shown)} height={34} beat={2.1} />
      </span>

      <span className="pick-id">
        <b className="mono">#{whale.tokenId}</b>
        <span className="pick-tier mono">{shown || "—"}</span>
      </span>

      <span className="pick-state mono">
        <span className={`pick-dot${whale.fed ? " on" : ""}`} aria-hidden="true" />
        {whale.fed ? `Awake · ${multiplier(whale.weight)}` : "Dormant"}
      </span>

      <span className="pick-go mono">{whale.fed ? "On the payroll" : "Select"}</span>
    </button>
  );
}

/* --- Page ---------------------------------------------------------------- */

export default function Activate({ wallet, whales, ocean, live, onDone }) {
  const account = wallet?.account;
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  /* Connected means real, even when the honest answer is "none". The sample
     only stands in for a visitor who has not connected yet, so the page can be
     read before it can be used — never on top of a wallet's actual position. */
  const connected = Boolean(account) && live;
  const pod = connected ? whales : SAMPLE_WHALES;
  const dormant = pod.filter((w) => !w.fed);

  const tokenLive = Boolean(ocean?.whaleToken);
  const balanceWei = useWhaleBalance(account, ocean?.whaleToken, whales.length);
  const balance = connected ? Math.floor(Number(formatEther(balanceWei ?? 0n))) : 2_400_000;
  const enough = balance >= ACTIVATION_COST;
  const ready = connected && tokenLive && enough && picked !== null && !busy;

  /* Two transactions: the allowance the burn needs, then the burn. The first is
     skipped when the wallet has already given one. */
  async function activate() {
    setBusy(true);
    setMessage(null);
    try {
      const client = await wallet.client();
      const owner = client.account.address;
      const write = (address, abi, functionName, args) =>
        client.writeContract({ account: owner, address, abi, functionName, args, chain: client.chain });

      const [allowance, burn] = await Promise.all([
        publicClient.readContract({
          address: ocean.whaleToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [owner, ADDRESSES.whales],
        }),
        publicClient.readContract({
          address: ADDRESSES.whales,
          abi: whalesAbi,
          functionName: "ACTIVATION_BURN",
        }),
      ]);

      if (allowance < burn) {
        setMessage({ kind: "info", text: "Approving the burn — confirm the first of two." });
        const approval = await write(ocean.whaleToken, erc20Abi, "approve", [
          ADDRESSES.whales,
          maxUint256,
        ]);
        await publicClient.waitForTransactionReceipt({ hash: approval });
      }

      const hash = await write(ADDRESSES.whales, whalesAbi, "activate", [BigInt(picked)]);
      setMessage({ kind: "info", text: `Sent ${hash.slice(0, 14)}… waiting for the block.` });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Transaction reverted.");

      setMessage({ kind: "ok", text: `Whale #${picked} is awake, from block ${receipt.blockNumber}.` });
      setPicked(null);
      onDone?.();
    } catch (e) {
      setMessage({ kind: "error", text: e.shortMessage || e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sheet" id="top">
      <section className="deep sheet-head">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">Activate</p>
            <h1 className="display sheet-title">
              Wake your <span className="tide on-dark">whale.</span>
            </h1>
            <p className="lede on-dark">
              A whale earns nothing until it is fed. Burn {ACTIVATION_COST.toLocaleString()} $WHALE
              and it joins the payroll for every haul from that block on, paid in ETH into its own
              wallet.
            </p>
          </Reveal>

          <Lane plane="drift" shoal="school" seed={7} tall />

          <Reveal className="steps" stagger>
            {STEPS.map((step) => (
              <div className="step" key={step.n}>
                <div className="step-num">{step.n}</div>
                <h3 className="display">{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* --- The console ------------------------------------------------- */}
      <section className="deep" id="console">
        <div className="wrap">
          <Reveal stagger>
            <p className="eyebrow on-dark">The console</p>
            <h2 className="display">
              Pick one, and <span className="tide on-dark">switch it on.</span>
            </h2>
          </Reveal>

          <Reveal className="console" stagger step={70}>
            {/* Wallet and balance, as an instrument rather than a form. */}
            <div className="console-rail">
              <div className="console-cell">
                <span className="console-label mono">Wallet</span>
                <span className="console-value mono">
                  <span className={`pick-dot${account ? " on" : ""}`} aria-hidden="true" />
                  {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Not connected"}
                </span>
                {!account && (
                  <button className="btn btn-navy btn-sm" onClick={() => wallet.connect()}>
                    Connect wallet
                  </button>
                )}
              </div>

              <div className="console-cell">
                <span className="console-label mono">$WHALE balance</span>
                <span className="console-value figure">
                  {balance.toLocaleString()}
                  <span className="unit">$WHALE</span>
                </span>
                <div className="strip-meter">
                  <span
                    className="strip-meter-fill"
                    style={{ "--v": Math.min(1, balance / ACTIVATION_COST) }}
                  />
                </div>
                <span className="console-note mono">
                  {enough
                    ? `Enough for ${Math.floor(balance / ACTIVATION_COST)} activation${
                        Math.floor(balance / ACTIVATION_COST) === 1 ? "" : "s"
                      }`
                    : `${(ACTIVATION_COST - balance).toLocaleString()} short`}
                </span>
              </div>

              <div className="console-cell">
                <span className="console-label mono">Dormant whales</span>
                <span className="console-value figure">
                  {dormant.length}
                  <span className="unit">of {pod.length}</span>
                </span>
                <span className="console-note mono">
                  {dormant.length ? "Waiting on a burn" : "All awake"}
                </span>
              </div>
            </div>

            {/* The picker. */}
            <div className="picker">
              <div className="picker-head">
                <span className="mono">Your whales</span>
                {!connected && <span className="tag mono">Sample data</span>}
              </div>

              {pod.map((whale) => (
                <WhaleRow
                  key={whale.tokenId}
                  whale={whale}
                  selected={picked === whale.tokenId}
                  onSelect={setPicked}
                  disabled={!account}
                />
              ))}

              {pod.length === 0 && (
                <p className="picker-empty">
                  No whales in this wallet. Mint one for $1 on the front page, ten a transaction,
                  or pick one up on secondary.
                </p>
              )}
            </div>

            {/* The commit. */}
            <div className="commit">
              <div className="commit-body">
                <span className="console-label mono">To activate</span>
                <p className="commit-line figure">
                  {ACTIVATION_COST.toLocaleString()}
                  <span className="unit">$WHALE burned</span>
                </p>
                <p className="commit-note">
                  {picked !== null ? (
                    <>
                      Whale <b className="mono">#{picked}</b> joins the payroll at the next haul. The
                      burn is permanent and cannot be undone.
                    </>
                  ) : (
                    "Select a dormant whale above. Nothing is signed until you press the button."
                  )}
                </p>
              </div>

              <div className="commit-actions">
                <button className="btn btn-foam" disabled={!ready} onClick={activate}>
                  {!tokenLive
                    ? "$WHALE is not live yet"
                    : busy
                    ? "Confirm in your wallet…"
                    : ready
                      ? `Approve and activate #${picked}`
                      : "Activate"}
                </button>
                <Link className="btn btn-ghost on-dark" to="/portfolio">
                  See your position
                </Link>
              </div>

              {message && <p className={`notice ${message.kind}`}>{message.text}</p>}
              {wallet.error && <p className="notice error">{wallet.error}</p>}
            </div>
          </Reveal>

          <Lane plane="sparse" shoal="school" seed={23} />

          {/* What changes. */}
          <Reveal stagger>
            <h2 className="display">
              What changes at <span className="tide on-dark">that block.</span>
            </h2>
          </Reveal>

          <Reveal className="effects" stagger step={60}>
            {EFFECTS.map(([label, before, after, note]) => (
              <div className="effect" key={label}>
                <span className="console-label mono">{label}</span>
                <p className="effect-swap">
                  <span className="effect-before mono">{before}</span>
                  <span className="effect-arrow" aria-hidden="true" />
                  <span className="effect-after">{after}</span>
                </p>
                <span className="console-note mono">{note}</span>
              </div>
            ))}
          </Reveal>

          <p className="trust">
            Activation burns {ACTIVATION_COST.toLocaleString()} $WHALE permanently. Selling or
            transferring the whale takes it off the payroll in the same transaction, and the loyalty
            clock starts over for whoever wakes it next.
          </p>
        </div>
      </section>
    </main>
  );
}
