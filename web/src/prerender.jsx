import { renderToStaticMarkup } from "react-dom/server";
import Docs from "./pages/Docs.jsx";

/**
 * The docs page as flat HTML, for a reader with no JavaScript.
 *
 * The site is a single-page app, so with scripting off there is nothing in the
 * document but an empty div — which for a marketing page is a shrug and for
 * documentation is a broken promise. This renders the article once at build
 * time and the build script drops it inside a `<noscript>` in a copy of
 * index.html served at /docs.
 *
 * `<noscript>` rather than hydration is the deliberate choice. Hydrating
 * prerendered markup would mean every component agreeing with itself across two
 * very different environments — no IntersectionObserver, no matchMedia, no
 * layout to measure — and the failure mode of getting that wrong is a page that
 * flickers or silently loses its event handlers. Inside `<noscript>` the two
 * copies never coexist: the browser renders this one only when React was never
 * going to run at all.
 *
 * Everything degrades on its own, because everything was already written to.
 * `useNear` is false without an observer, so the widgets render the fallback
 * paragraph that states their conclusion; `useReducedMotion` is false, so the
 * loop renders its static four cards. The one thing CSS has to fix is the
 * accordion, which cannot be opened without a click — `.docs-static` holds
 * every answer open.
 */
export function render() {
  return renderToStaticMarkup(
    <div className="page page-deep docs-static">
      <div className="dive" />
      <Docs />
    </div>
  );
}
