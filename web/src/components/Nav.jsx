const ALWAYS = [
  ["Stats", "#stats"],
  ["How", "#how"],
  ["Trench", "#trench"],
];

/** Only linkable once there is a chain to read them from. */
const LIVE_ONLY = [
  ["Pod", "#pod"],
  ["Dashboard", "#dashboard"],
];

/** Sticky pill nav. It inverts below the thermocline so it stays legible as
    the water darkens. */
export default function Nav({ deep, live }) {
  const links = live ? [...ALWAYS, ...LIVE_ONLY] : ALWAYS;

  return (
    <nav className="nav">
      <div className={`nav-pill${deep ? " deep" : ""}`}>
        <a className="nav-brand" href="#top">
          Whales
        </a>
        {links.map(([label, href]) => (
          <a className="nav-link" href={href} key={href}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
