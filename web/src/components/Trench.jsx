import { eth, percent } from "../format.js";

/** The drifting shape behind the deep section. */
function Silhouette() {
  return (
    <svg className="silhouette" viewBox="0 0 240 120" aria-hidden="true">
      <path
        fill="#F5FBFE"
        d="M18 62c14-26 44-42 78-42 26 0 48 9 63 24l10-16c3-5 10-3 10 3v66c0 6-7 8-10 3l-10-16c-15 15-37 24-63 24-34 0-64-16-78-42-3-1-3-3 0-4z"
      />
      <path
        fill="#F5FBFE"
        d="M96 78c22 6 46 4 66-6-16 18-44 24-66 6z"
        opacity="0.6"
      />
      <circle cx="52" cy="54" r="4" fill="#04182B" opacity="0.5" />
    </svg>
  );
}

const FACTS = [
  {
    tag: "No withdraw",
    title: "Nobody takes from the Trench",
    body: "Not holders. Not us. The contract has no withdraw function, no owner and no upgrade path. What enters leaves one way — the haul, split across fed whales.",
  },
  {
    tag: "Loyalty",
    title: "1x climbing to 3.33x",
    body: "Weight climbs the longer a whale stays active, up to a 3.33x cap. Dormant whales carry zero weight — automatically, not by anyone's decision.",
  },
  {
    tag: "Skin in the game",
    title: "Sell it and it sleeps",
    body: "A sale takes the whale off the payroll in the same transaction as the transfer. The new owner burns another million to wake it, and the loyalty clock starts over.",
  },
  {
    tag: "Payout",
    title: "ETH, or your elected stock",
    body: "Each share is delivered into the whale's own on-chain wallet as ETH, or auto-swapped into the equity its holder elected. If the swap fails, the whale is paid in ETH rather than stranded.",
  },
  {
    tag: "Permissionless",
    title: "The keeper has no powers",
    body: "A bot hauls by default. It holds no key the rest of us don't — anyone can call it, and whoever does keeps the 0.5% tip. If the bot dies, the ocean keeps working.",
  },
];

export default function Trench({ ocean }) {
  const fill = ocean ? percent(ocean.pot, ocean.haulThreshold) : 0;

  return (
    <section className="deep" id="trench">
      <Silhouette />
      <div className="wrap">
        <p className="eyebrow on-dark">The Trench</p>
        <h2 className="display">Every fee lands in one contract.</h2>
        <p className="lede on-dark" style={{ marginTop: 20 }}>
          The Flap launch tax arrives here as ETH. So do mint proceeds. So does anything anyone
          throws in. That is the entire integration.
        </p>

        <div className="facts">
          <div className="glass on-dark fact filling">
            <div className="fact-water" style={{ height: `${fill}%` }} aria-hidden="true" />
            <span className="fact-tag">Filling now</span>
            <h3 className="display">
              {ocean ? `${eth(ocean.pot, 3)} ETH in the net` : "Reading the chain…"}
            </h3>
            <p>
              {ocean?.readyToHaul
                ? "The net is full. Anyone can haul it right now and keep 0.5%."
                : ocean
                  ? `${eth(ocean.haulThreshold - ocean.pot, 4)} ETH to go before the pot can be hauled.`
                  : "Waiting on the pot."}
            </p>
          </div>

          {FACTS.map((fact) => (
            <div className="glass on-dark fact" key={fact.tag}>
              <span className="fact-tag">{fact.tag}</span>
              <h3 className="display">{fact.title}</h3>
              <p>{fact.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
