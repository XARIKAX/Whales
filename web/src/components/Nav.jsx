const LINKS = [
  ["Stats", "#stats"],
  ["How", "#how"],
  ["Trench", "#trench"],
  ["Pod", "#pod"],
  ["Dashboard", "#dashboard"],
];

/** Sticky pill nav. It inverts below the thermocline so it stays legible as
    the water darkens. */
export default function Nav({ deep }) {
  return (
    <nav className="nav">
      <div className={`nav-pill${deep ? " deep" : ""}`}>
        <a className="nav-brand" href="#top">
          Whales
        </a>
        {LINKS.map(([label, href]) => (
          <a className="nav-link" href={href} key={href}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
