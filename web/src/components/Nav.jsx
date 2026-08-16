import { Link } from "../router.jsx";
import { address } from "../format.js";
import { CHAIN } from "../config.js";

/** Sections of the landing page. Only reachable from the landing page. */
const SECTIONS = [
  ["Stats", "#stats"],
  ["How", "#how"],
  ["Trench", "#trench"],
];

/** Pages. Always reachable, from anywhere. */
const PAGES = [
  ["Docs", "/docs"],
  ["Activate", "/activate"],
  ["Portfolio", "/portfolio"],
];

/**
 * Every state the connect button can be in, drawn rather than implied.
 *
 * There are five, and the two that used to look identical are the two that
 * matter: a request sitting unanswered behind the browser window, and a wallet
 * connected to the wrong chain. Both used to read as "connected" — the first
 * because nothing changed when you clicked, the second because an address is an
 * address. Now one ripples and the other goes gold, which is the only warning a
 * reader gets before a transaction fails for a reason the error will not
 * explain.
 */
function Connect({ wallet }) {
  const { account, connecting, wrongNetwork } = wallet;

  const state = connecting ? "connecting" : wrongNetwork ? "wrong" : account ? "on" : "idle";
  const label = {
    connecting: "Connecting",
    wrong: `Switch to ${CHAIN.name}`,
    on: account && address(account),
    idle: "Connect",
  }[state];

  return (
    <button
      className={`nav-wallet mono is-${state}`}
      onClick={() => !account && !connecting && wallet.connect()}
      disabled={connecting}
      title={wrongNetwork ? `This wallet is on another chain` : account || "Connect a wallet"}
    >
      <span className="nav-dot" aria-hidden="true" />
      {label}
    </button>
  );
}

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

        {home && live && (
          <a className="nav-link" href="#pod">
            Pod
          </a>
        )}

        {PAGES.map(([label, to]) => (
          <Link className={`nav-link${route === to ? " on" : ""}`} to={to} key={to}>
            {label}
          </Link>
        ))}

        {/* Where the docs page hangs its breadcrumb. The shell draws the nav for
            every page and has no business knowing one of them has sections, so
            the page portals into this instead of the nav importing it. */}
        <span className="nav-trail" id="nav-trail" />

        {wallet && <Connect wallet={wallet} />}
      </div>
    </nav>
  );
}
