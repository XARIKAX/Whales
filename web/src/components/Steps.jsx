import Reveal from "./Reveal.jsx";
import { SectionLife } from "./Marine.jsx";

const STEPS = [
  {
    n: "01",
    title: "Buy",
    body: "All 1000 whales minted. Pick one up on secondary.",
  },
  {
    n: "02",
    title: "Feed",
    body: "Burn 1,000,000 $WHALE. Your whale wakes.",
  },
  {
    n: "03",
    title: "Fill",
    body: "Every trade drops 2–3% into the Trench.",
  },
  {
    n: "04",
    title: "Haul",
    body: "Pot hits threshold, anyone hauls. Your cut lands in the whale's own wallet.",
  },
];

const CLAIMS = [
  ["100%", "of the tax goes to whales"],
  ["0", "claim forms"],
  ["3.33x", "max loyalty weight"],
  ["0.5%", "tip to the hauler"],
];

/** By the time the reader reaches this section the water is past the
    thermocline, so it inverts with the water — navy on that blue is a heading
    you have to hunt for. */
export default function Steps() {
  return (
    <section className="deep" id="how">
      {/* Still shallow enough for a school to pass through, but thinner and
          slower than the hero's — the dive is meant to empty out as it goes. */}
      <SectionLife plane="drift" shoal="school" seed={61} />
      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow on-dark">How it works</p>
          <h2 className="display">
            Four steps.
            <br />
            Then <span className="tide on-dark">the tide</span> does the work.
          </h2>
        </Reveal>

        <Reveal className="steps" stagger>
          {STEPS.map((step) => (
            <div className="step" key={step.n}>
              <div className="step-num">{step.n}</div>
              <h3 className="display">{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </Reveal>

        <Reveal className="claims" stagger step={45}>
          {CLAIMS.map(([value, label]) => (
            <div className="claim" key={label}>
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
