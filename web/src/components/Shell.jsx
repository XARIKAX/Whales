import Nav from "./Nav.jsx";
import Footer from "./Footer.jsx";
import Atmosphere from "./Atmosphere.jsx";
import { DiveGauge } from "./Depth.jsx";
import Cursor from "./Cursor.jsx";
import { Toast } from "./docs/Chrome.jsx";

/**
 * The place every page stands in.
 *
 * The water, the light, the gauge down the margin, the nav and the seabed at
 * the bottom are not decoration on the landing page, they are the product's
 * environment: a wallet page that dropped them would read as a different site.
 * So the shell owns them and each page supplies only its own content.
 */
export default function Shell({ deep, lit, live, wallet, route, children }) {
  /* The two wallet pages have no hero and no surface to look up at, so they
     open below the thermocline rather than in bright water. The gauge goes with
     the change: it measures a descent through a story, and there is no story to
     descend on a page that is one screen of instruments. */
  const home = route === "/";

  return (
    <div className={`page${home ? "" : " page-deep"}`}>
      <div className="dive" />
      <Atmosphere lit={home && lit} />
      {home && <DiveGauge />}

      <Nav deep={deep} live={live} route={route} wallet={wallet} />
      <Cursor />

      {children}

      <Footer />
      {/* The copy-confirmation rail. It lives here rather than on the docs
          page because things that copy — the hero's CA chip, the footer's
          address rows — exist on every page, and a toast with no host is
          silence. */}
      <Toast />
    </div>
  );
}
