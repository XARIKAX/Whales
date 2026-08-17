import { ADDRESSES, CHAIN, LINKS, DOCS_URL, explorerUrl } from "../config.js";
import { Link } from "../router.jsx";
import Reveal from "./Reveal.jsx";
import Seabed from "./Seabed.jsx";
import { copy } from "./docs/reading.js";
import { toast } from "./docs/Chrome.jsx";
import { checksummed } from "../address.js";

const CONTRACTS = [
  ["Whales NFT", "whales"],
  ["The Trench", "trench"],
  ["Account registry", "registry"],
];

/** Deterministic, so the lanterns never reshuffle between renders. */
const LANTERNS = Array.from({ length: 14 }, (_, i) => {
  const seed = (i * 2654435761) % 997;
  return {
    left: `${(seed % 94) + 3}%`,
    top: `${(seed % 78) + 8}%`,
    delay: -((seed % 13) + i * 0.7),
    duration: 9 + (seed % 11),
  };
});

/**
 * One contract, as a row you can act on.
 *
 * Three affordances, because an address on a page is only useful if you can do
 * something with it: read it, copy it exactly, and check it on an explorer.
 * Before deployment there is no address, and the row says that rather than
 * printing "not configured", which reads like a fault on our side.
 */
function ContractRow({ label, value }) {
  const href = value && explorerUrl("address", value);

  const take = async () => {
    if (!value) return;
    toast((await copy(await checksummed(value))) ? "Address copied" : "Could not copy");
  };

  return (
    <div className="addr-row">
      <span className="addr-label mono">{label}</span>

      {value ? (
        <>
          <button type="button" className="addr mono addr-copy" onClick={take} title="Copy address">
            <span className="addr-text">{value}</span>
            <span className="addr-icon" aria-hidden="true" />
          </button>
          {href && (
            <a className="addr-verify mono" href={href} target="_blank" rel="noreferrer">
              Verify on {CHAIN.blockExplorers?.default?.name || "the explorer"} ↗
            </a>
          )}
        </>
      ) : (
        <span className="chip mono">
          <span className="chip-sweep" aria-hidden="true" />
          Awaiting deployment
        </span>
      )}
    </div>
  );
}

export default function Footer() {
  /* Only what is actually configured. An unset link used to leave a line of
     instructions to ourselves sitting in the live footer. */
  const elsewhere = [
    LINKS.x && ["X / Twitter", LINKS.x],
    LINKS.telegram && ["Telegram", LINKS.telegram],
    LINKS.opensea && ["OpenSea", LINKS.opensea],
  ].filter(Boolean);

  return (
    <footer className="abyss" id="abyss">
      {/* The only things visible this deep are the ones making their own light. */}
      <div className="abyss-glow" aria-hidden="true">
        {LANTERNS.map((l, i) => (
          <span
            key={i}
            style={{
              left: l.left,
              top: l.top,
              animationDelay: `${l.delay}s`,
              animationDuration: `${l.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="wrap">
        <Reveal className="abyss-grid" stagger step={80}>
          <div>
            <h2 className="display">Feed the whale.
              <br />Haul the Trench.
              <br />Own the tide.</h2>
            <p className="lede on-dark">
              1000 pixel whales on {CHAIN.name}. Fixed supply, never more.
            </p>
          </div>

          <div className="abyss-col" id="contracts">
            <h4>Contracts</h4>
            {CONTRACTS.map(([label, key]) => (
              <ContractRow key={key} label={label} value={ADDRESSES[key]} />
            ))}
          </div>

          <div className="abyss-col">
            <h4>Elsewhere</h4>
            {elsewhere.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            ))}
            {DOCS_URL.startsWith("/") ? (
              <Link to={DOCS_URL}>Docs</Link>
            ) : (
              <a href={DOCS_URL} target="_blank" rel="noreferrer">
                Docs
              </a>
            )}
          </div>
        </Reveal>

        <p className="trust">
          Only trust{" "}
          <a className="trust-link" href="#contracts">
            contract addresses
          </a>{" "}
          listed on this site. We will never message you first.
        </p>

        <p className="disclaimer">
          Experimental NFT project. $WHALE and the Whales NFTs are not investments, securities, or a
          promise of return by anyone. Yield comes only from trading activity that may never happen;
          fees can be zero indefinitely. Activating a whale destroys 1,000,000 $WHALE permanently and
          cannot be undone. Selling a whale removes it from the payroll immediately. The contracts
          are immutable and unaudited. Nobody, including the developers, can recover funds, reverse
          a transaction, or intervene once they are deployed. Do not spend more than you are willing
          to lose entirely.
        </p>
      </div>

      {/* The floor. The dive has to land somewhere. */}
      <Seabed />
    </footer>
  );
}
