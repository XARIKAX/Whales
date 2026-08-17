import { Link } from "../router.jsx";
import { address } from "../format.js";

/** Sections of the landing page. Only reachable from the landing page. */
const SECTIONS = [
  ["Stats", "#stats"],
  ["How", "#how"],
  ["Pod", "#pod"],
  ["Trench", "#trench"],
];

/** Pages. Always reachable, from anywhere. */
const PAGES = [
  ["Mint", "/mint"],
  ["Docs", "/docs"],
  ["Activate", "/activate"],
  ["Portfolio", "/portfolio"],
];

/**
 * The pill. It inverts below the thermocline so it stays legible as the water
 * darkens, and it carries the wallet, because from here on every page has
 * something to do with one.
 */
export default function Nav({ deep, live, route = "/", wallet }) {
  const home = route === "/";
  const account = wallet?.account;

  return (
    <nav className="nav">
      <div className={`nav-pill${deep ? " deep" : ""}`}>
        <Link className="nav-brand" to="/">
          Whales
        </Link>

        {/* Section jumps only exist where the sections do. */}
        {home &&
          SECTIONS.map(([label, href]) => (
            <a className="nav-link" href={href} key={href}>
              {label}
            </a>
          ))}

        {PAGES.map(([label, to]) => (
          <Link className={`nav-link${route === to ? " on" : ""}`} to={to} key={to}>
            {label}
          </Link>
        ))}

        {wallet && (
          <button
            className="nav-wallet mono"
            onClick={() => !account && wallet.connect()}
            title={account || "Connect a wallet"}
          >
            <span className={`nav-dot${account ? " on" : ""}`} aria-hidden="true" />
            {account ? address(account) : "Connect"}
          </button>
        )}
      </div>
    </nav>
  );
}
