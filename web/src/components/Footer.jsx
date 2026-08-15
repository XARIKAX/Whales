import { ADDRESSES, CHAIN, LINKS, explorerUrl } from "../config.js";

const CONTRACTS = [
  ["$WHALE token", "whaleToken"],
  ["Whales NFT", "whales"],
  ["The Trench", "trench"],
  ["Account registry", "registry"],
];

export default function Footer() {
  return (
    <footer className="abyss" id="abyss">
      <div className="wrap">
        <div className="abyss-grid">
          <div>
            <h2 className="display">Feed the whale.
              <br />Haul the Trench.
              <br />Own the tide.</h2>
            <p className="lede on-dark">
              1000 pixel whales on {CHAIN.name}. Fixed supply, never more.
            </p>
          </div>

          <div className="abyss-col">
            <h4>Contracts</h4>
            {CONTRACTS.map(([label, key]) => {
              const value = ADDRESSES[key];
              const href = value && explorerUrl("address", value);
              return (
                <div key={key} style={{ marginBottom: 14 }}>
                  <span style={{ marginBottom: 4, color: "var(--on-dark-faint)" }}>{label}</span>
                  {href ? (
                    <a className="addr" href={href} target="_blank" rel="noreferrer">
                      {value}
                    </a>
                  ) : (
                    <span className="addr">{value || "not configured"}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="abyss-col">
            <h4>Elsewhere</h4>
            {LINKS.x && (
              <a href={LINKS.x} target="_blank" rel="noreferrer">
                X / Twitter
              </a>
            )}
            {LINKS.opensea && (
              <a href={LINKS.opensea} target="_blank" rel="noreferrer">
                OpenSea
              </a>
            )}
            {LINKS.docs && <a href={LINKS.docs}>Docs</a>}
            {!LINKS.x && !LINKS.opensea && (
              <span style={{ color: "var(--on-dark-faint)" }}>
                Set VITE_X_URL and VITE_OPENSEA_URL to list them here.
              </span>
            )}
          </div>
        </div>

        <p className="trust">
          Only trust contract addresses listed on this site. We will never message you first.
        </p>

        <p className="disclaimer">
          Experimental NFT project. $WHALE and the Whales NFTs are not investments, securities, or a
          promise of return by anyone. Yield comes only from trading activity that may never happen;
          fees can be zero indefinitely. Activating a whale destroys 1,000,000 $WHALE permanently and
          cannot be undone. Selling a whale removes it from the payroll immediately. The contracts
          are immutable and unaudited — nobody, including the developers, can recover funds, reverse
          a transaction, or intervene once they are deployed. Do not spend more than you are willing
          to lose entirely.
        </p>
      </div>
    </footer>
  );
}
