import { useEffect, useMemo } from "react";
import { useOcean, useWhales, useEthPrice, useDepth, useWallet, useHaulSignal } from "./hooks.js";
import { CONFIGURED, CHAIN } from "./config.js";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import StatsStrip from "./components/StatsStrip.jsx";
import Steps from "./components/Steps.jsx";
import Trench from "./components/Trench.jsx";
import Carousel from "./components/Carousel.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Footer from "./components/Footer.jsx";
import Celebration from "./components/Celebration.jsx";

export default function App() {
  const { data: ocean, error, refresh } = useOcean();
  const { whales, refresh: refreshWhales } = useWhales(ocean?.minted);
  const price = useEthPrice();
  const depth = useDepth();
  const wallet = useWallet();
  const haulSignal = useHaulSignal(ocean?.haulCount);

  // Sun shafts fade out by the time the reader reaches open water.
  useEffect(() => {
    document.documentElement.style.setProperty("--sun", String(Math.max(0, 1 - depth * 3.4)));
  }, [depth]);

  const refreshAll = () => {
    refresh();
    refreshWhales();
  };

  // The whale on the hero card: whoever has earned the most, falling back to
  // the first fed whale, then to the first whale at all.
  const featured = useMemo(() => {
    if (whales.length === 0) return null;
    const fed = whales.filter((w) => w.activatedAt !== 0n);
    if (fed.length === 0) return whales[0];
    return fed.reduce((best, w) => (w.lifetimeEarned > best.lifetimeEarned ? w : best), fed[0]);
  }, [whales]);

  // The story stands on its own; the numbers layer in. Before the contracts
  // are live — or if the RPC is unreachable — the page is still the whole
  // pitch rather than an error card between a header and a footer.
  const unreachable = Boolean(error) && error !== "not-configured";
  const live = CONFIGURED && !unreachable;

  return (
    <div className="page">
      <div className="dive" />
      <div className="rays" />

      {/* The pill inverts once the water is dark enough that a light pill
          stops reading — a little before the section boundary, not after. */}
      <Nav deep={depth > 0.2} live={live} />
      <Celebration trigger={haulSignal} />

      <Hero ocean={ocean} featured={featured} price={price} wallet={wallet} live={live} />

      <StatsStrip ocean={live ? ocean : null} price={price} />

      {!CONFIGURED && (
        <section style={{ paddingBlock: 0, marginTop: 48 }}>
          <div className="wrap">
            <p className="notice pending">
              Not launched yet. The contracts are written, tested and ready — this page goes live the
              moment they are deployed and the addresses are set.
            </p>
          </div>
        </section>
      )}

      {CONFIGURED && unreachable && (
        <section style={{ paddingBlock: 0, marginTop: 48 }}>
          <div className="wrap">
            <p className="notice error">
              Can't reach {CHAIN.name} right now, so the live figures are hidden rather than shown
              stale. Everything below is unaffected. ({error})
            </p>
          </div>
        </section>
      )}

      <Steps />
      <Trench ocean={live ? ocean : null} live={live} />

      {live && (
        <>
          <Carousel whales={whales} />
          <Dashboard
            ocean={ocean}
            whales={whales}
            price={price}
            wallet={wallet}
            onDone={refreshAll}
          />
        </>
      )}

      <Footer />
    </div>
  );
}
