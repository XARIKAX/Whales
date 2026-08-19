import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "../router.jsx";
import { copy } from "./docs/reading.js";
import { toast } from "./docs/Chrome.jsx";
import { address } from "../format.js";
import { CHAIN, LINKS } from "../config.js";

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
 * X and Telegram, as marks rather than words.
 *
 * Drawn on a 16-unit grid with `currentColor`, so they take the pill's ink and
 * invert with it below the thermocline like everything else up here. Icons
 * rather than labels because the pill is already carrying seven items and two
 * more words would push Connect off the end on a laptop — but each one still
 * has a real accessible name, so nothing is icon-only to a screen reader.
 */
const SOCIALS = [
  {
    name: "X",
    href: LINKS.x,
    path: "M12.6 1.5h2.3l-5 5.7 5.9 7.8h-4.6l-3.6-4.7-4.1 4.7H1.1l5.4-6.1L.9 1.5h4.7l3.3 4.3 3.7-4.3zm-.8 12.1h1.3L5.3 2.8H3.9l7.9 10.8z",
  },
  {
    name: "Telegram",
    href: LINKS.telegram,
    path: "M15.6 2.3 13.3 14c-.2.8-.6 1-1.3.6l-3.5-2.6-1.7 1.6c-.2.2-.4.4-.7.4l.3-3.6L12.9 4c.3-.2-.1-.4-.5-.2L5.3 8.4 1.8 7.3c-.8-.2-.8-.8.2-1.1L14.6 1.3c.6-.2 1.2.2 1 1z",
  },
];

function Socials() {
  return SOCIALS.filter((s) => s.href).map((s) => (
    <a
      className="nav-social"
      key={s.name}
      href={s.href}
      target="_blank"
      rel="noreferrer"
      aria-label={s.name}
      title={s.name}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <path d={s.path} fill="currentColor" />
      </svg>
    </a>
  ));
}

/**
 * Every state the connect button can be in, drawn rather than implied.
 *
 * There are four, and the two that used to look identical are the two that
 * matter: a request sitting unanswered behind the browser window, and a wallet
 * connected to the wrong chain. Both used to read as "connected" — the first
 * because nothing changed when you clicked, the second because an address is an
 * address. Now one ripples and the other goes gold, which is the only warning a
 * reader gets before a transaction fails for a reason the error will not
 * explain.
 *
 * Connected, the pill opens a menu of its own rather than RainbowKit's account
 * sheet. That sheet was mounting and closing itself inside the same
 * millisecond — measured, not guessed — which left no way to disconnect at
 * all. Ours is three lines of markup, cannot be dismissed by anybody else's
 * internal logic, and disconnects in one press instead of two.
 */
function Connect({ wallet }) {
  const { account, connecting, wrongNetwork, switchTo, disconnect } = wallet;
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(null);
  const box = useRef(null);
  const menu = useRef(null);

  const state = account
    ? wrongNetwork
      ? "wrong"
      : "on"
    : connecting
      ? "connecting"
      : "idle";

  const label = {
    connecting: "Connecting",
    wrong: `Switch to ${CHAIN.name}`,
    on: account && address(account),
    idle: "Connect",
  }[state];

  /* A menu that outlives the thing it belongs to is a trap: close it on a press
     anywhere else, on Escape, and the moment the wallet goes away. */
  /*
   * The menu is drawn into the document body, not into the nav.
   *
   * The pill lives in `.nav-pill`, which sets `overflow-x: auto` so the row can
   * scroll on a narrow screen — and the moment one axis is not `visible`, CSS
   * makes the other a scroll container too. A menu hanging below the pill was
   * therefore clipped by it: present in the DOM, reachable by a script, and
   * invisible to a person. `position: fixed` does not escape it either, because
   * the pill's `backdrop-filter` makes it the containing block for fixed
   * children. A portal is the way out, so the position is measured instead of
   * inherited.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (r) setAt({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (!box.current?.contains(e.target) && !menu.current?.contains(e.target)) setOpen(false);
    };
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  useEffect(() => {
    if (!account) setOpen(false);
  }, [account]);

  const press = () => {
    if (!account) {
      wallet.connect();
      return;
    }
    setOpen((was) => !was);
  };

  const take = async () => {
    setOpen(false);
    toast((await copy(account)) ? "Address copied" : "Could not copy");
  };

  return (
    <span className="nav-wallet-box" ref={box}>
      <button
        className={`nav-wallet mono is-${state}`}
        onClick={press}
        aria-expanded={account ? open : undefined}
        aria-haspopup={account ? "menu" : undefined}
        title={
          wrongNetwork
            ? `This wallet is on another chain. Switch to ${CHAIN.name}`
            : account
              ? `${account}. Open wallet menu`
              : "Connect a wallet"
        }
      >
        <span className="nav-dot" aria-hidden="true" />
        {label}
      </button>

      {account && open && at && createPortal(
        <div className="nav-menu" role="menu" ref={menu} style={{ top: at.top, right: at.right }}>
          <p className="nav-menu-addr mono">{account}</p>

          {wrongNetwork && switchTo && (
            <button
              type="button"
              role="menuitem"
              className="nav-menu-item mono warn"
              onClick={() => {
                setOpen(false);
                switchTo();
              }}
            >
              Switch to {CHAIN.name}
            </button>
          )}

          <button type="button" role="menuitem" className="nav-menu-item mono" onClick={take}>
            Copy address
          </button>

          <button
            type="button"
            role="menuitem"
            className="nav-menu-item mono"
            onClick={() => {
              setOpen(false);
              disconnect?.();
            }}
            disabled={!disconnect}
          >
            Disconnect
          </button>
        </div>,
        document.body
      )}
    </span>
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

        {PAGES.map(([label, to]) => (
          <Link className={`nav-link${route === to ? " on" : ""}`} to={to} key={to}>
            {label}
          </Link>
        ))}

        {/* Where the docs page hangs its breadcrumb. The shell draws the nav for
            every page and has no business knowing one of them has sections, so
            the page portals into this instead of the nav importing it. */}
        <span className="nav-trail" id="nav-trail" />

        <Socials />

        {wallet && <Connect wallet={wallet} />}
      </div>
    </nav>
  );
}
