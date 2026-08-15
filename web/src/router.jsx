import { useEffect, useState } from "react";

/**
 * Three pages and no router library.
 *
 * The whole of it is `history.pushState`, a `popstate` listener and a link that
 * intercepts its own click. A routing package would be larger than every page
 * it routes to, and this site has no nested routes, no params and no loaders.
 *
 * Paths rather than hashes, because the nav already uses hashes to jump to
 * sections on the landing page and the two would fight. That means the host has
 * to serve index.html for unknown paths; the rewrite lives in vercel.json and
 * in public/.htaccess, and the two are kept in step.
 */

const listeners = new Set();

function announce() {
  for (const listener of listeners) listener(window.location.pathname);
}

/** Navigate without a reload. Returns to the top, the way a page load would. */
export function go(path) {
  if (path === window.location.pathname) return;
  window.history.pushState({}, "", path);
  window.scrollTo(0, 0);
  announce();
}

export function useRoute() {
  const [path, setPath] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname
  );

  useEffect(() => {
    const update = (next) => setPath(next);
    listeners.add(update);
    const onPop = () => announce();
    window.addEventListener("popstate", onPop);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return path.replace(/\/+$/, "") || "/";
}

/**
 * An anchor that stays an anchor. It has a real href, so it opens in a new tab
 * on a middle click and copies as a URL, and it only takes over the plain
 * left-click case that a router can do better.
 */
export function Link({ to, children, className = "", ...rest }) {
  const onClick = (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    go(to);
  };

  return (
    <a href={to} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
