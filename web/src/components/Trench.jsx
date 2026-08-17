import { eth, percent } from "../format.js";
import Whale from "./Whale.jsx";
import Reveal from "./Reveal.jsx";
import { Lane } from "./Marine.jsx";
import Pot from "./Pot.jsx";

const FACTS = [
  {
    tag: "No withdraw",
    title: "Nobody takes from the Trench",
    body: "Not holders. Not us. The contract has no withdraw function, no owner and no upgrade path. What enters leaves one way: the haul, split across fed whales.",
  },
  {
    tag: "Loyalty",
    title: "1x climbing to 3.33x",
    body: "Weight climbs the longer a whale stays active, up to a 3.33x cap. Dormant whales carry zero weight, automatically, not by anyone's decision.",
  },
  {
    tag: "Skin in the game",
    title: "Sell it and it sleeps",
    body: "A sale takes the whale off the payroll in the same transaction as the transfer. The new owner burns another million to wake it, and the loyalty clock starts over.",
  },
  {
    tag: "Payout",
    title: "ETH, into the whale's own wallet",
    body: "The Flap tax arrives as ETH and leaves as ETH. Each share is delivered into the whale's own on-chain wallet: no swap, no router, no second asset to go wrong. Hold the whale, hold the wallet.",
  },
  {
    tag: "Permissionless",
    title: "The keeper has no powers",
    body: "A bot hauls by default. It holds no key the rest of us don't. Anyone can call it, and whoever does keeps the 0.5% tip. If the bot dies, the ocean keeps working.",
  },
];

export default function Trench({ ocean, live, price }) {

  return (
    <section className="deep" id="trench">
      {/* The near one is mirrored because it is cropped by the right edge and
          it drifts left: nose-right, the crop took the nose and left a pale
          mass, and the drift ran it backwards. Nose-left, the crop takes the
          tail, which nobody was reading, and it moves the way it points. */}
      <Whale className="whale-near" mirrored />
      <Whale className="whale-far" />
      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow on-dark">The Trench</p>
          <h2 className="display">
            Every fee lands in <span className="tide on-dark">one contract.</span>
          </h2>
          <p className="lede on-dark" style={{ marginTop: 20 }}>
            The Flap launch tax arrives here as ETH. So do mint proceeds. So does anything anyone
            throws in. That is the entire integration.
          </p>
        </Reveal>

        {/* The only colour left down here is the lure. */}
        <Lane plane="sparse" shoal="abyss" seed={83} tall />

        <Reveal className="facts" stagger>
          {live && ocean ? (
            <Pot ocean={ocean} price={price} />
          ) : (
            <div className="glass on-dark fact">
              <span className="fact-tag">The threshold</span>
              <h3 className="display">One transaction, however many whales</h3>
              <p>
                The pot is split by a running per-weight total rather than a loop, so a single haul
                pays every fed whale at once, whether that is three of them or all thousand.
              </p>
            </div>
          )}

          {FACTS.map((fact, i) => (
            <div className="glass on-dark fact" key={fact.tag} style={{ "--i": i + 1 }}>
              <span className="fact-tag">{fact.tag}</span>
              <h3 className="display">{fact.title}</h3>
              <p>{fact.body}</p>
            </div>
          ))}
        </Reveal>

        <Lane plane="drift" shoal="abyss" seed={29} />
      </div>
    </section>
  );
}
