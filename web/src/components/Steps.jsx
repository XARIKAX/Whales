import Reveal from "./Reveal.jsx";

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

export default function Steps() {
  return (
    <section id="how">
      <div className="wrap">
        <Reveal stagger>
          <p className="eyebrow">How it works</p>
          <h2 className="display">
            Four steps.
            <br />
            Then the tide does the work.
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
