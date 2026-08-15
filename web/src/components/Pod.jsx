import { useArt } from "../hooks.js";
import { eth, usd, multiplier, address, countdown } from "../format.js";
import { explorerUrl } from "../config.js";

const TIERS = ["Surface Swimmer", "Reef Cruiser", "Twilight Diver", "Abyss Dweller", "Leviathan"];

function WhaleCard({ whale, price, revealed, now }) {
  const art = useArt(whale.tokenId);
  const fed = whale.activatedAt !== 0n;
  const tier = art?.attributes?.find((a) => a.trait_type === "Tier")?.value;
  const link = explorerUrl("address", whale.account);

  return (
    <article className={`whale-card${fed ? " fed" : ""}`}>
      {art ? (
        <img className="whale-art" src={art.image} alt={`Whale #${whale.tokenId}`} loading="lazy" />
      ) : (
        <div className="whale-art loading">surfacing…</div>
      )}

      <div className="whale-body">
        <h3 className="whale-title">
          #{String(whale.tokenId)}
          <span className={`tag ${fed ? "fed" : "dormant"}`}>{fed ? "fed" : "dormant"}</span>
          {revealed && tier && TIERS.includes(tier) && <span className="tag tier">{tier}</span>}
        </h3>

        <dl className="whale-rows">
          <div>
            <dt>weight</dt>
            <dd className={fed ? "earning" : ""}>{fed ? multiplier(whale.weight) : "—"}</dd>
          </div>
          <div>
            <dt>fed for</dt>
            <dd>{fed ? countdown(now - Number(whale.activatedAt)) : "—"}</dd>
          </div>
          <div>
            <dt>owed</dt>
            <dd className={whale.claimable > 0n ? "earning" : ""}>
              {eth(whale.claimable)} {usd(whale.claimable, price) ? `· ${usd(whale.claimable, price)}` : ""}
            </dd>
          </div>
          <div>
            <dt>lifetime</dt>
            <dd>
              {eth(whale.lifetimeEarned)}{" "}
              {usd(whale.lifetimeEarned, price) ? `· ${usd(whale.lifetimeEarned, price)}` : ""}
            </dd>
          </div>
          <div>
            <dt>wallet</dt>
            <dd>
              {link ? (
                <a href={link} target="_blank" rel="noreferrer">
                  {address(whale.account)}
                </a>
              ) : (
                address(whale.account)
              )}
            </dd>
          </div>
          <div>
            <dt>holder</dt>
            <dd>{address(whale.holder)}</dd>
          </div>
          {whale.stock !== "0x0000000000000000000000000000000000000000" && (
            <div>
              <dt>paid in</dt>
              <dd>{address(whale.stock)}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  );
}

export default function Pod({ whales, price, revealed, filter, now }) {
  const shown = whales.filter((w) => {
    if (filter === "fed") return w.activatedAt !== 0n;
    if (filter === "dormant") return w.activatedAt === 0n;
    if (filter === "owed") return w.claimable > 0n;
    return true;
  });

  if (whales.length === 0) {
    return <p className="muted">No whales minted yet. The pod is empty water.</p>;
  }
  if (shown.length === 0) {
    return <p className="muted">No whales match that filter.</p>;
  }

  return (
    <div className="pod">
      {shown.map((whale) => (
        <WhaleCard
          key={String(whale.tokenId)}
          whale={whale}
          price={price}
          revealed={revealed}
          now={now ?? Math.floor(Date.now() / 1000)}
        />
      ))}
    </div>
  );
}
