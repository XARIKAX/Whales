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

  return (
    <div className="page">
      <div className="dive" />
      <div className="rays" />

      {/* The pill inverts once the water is dark enough that a light pill
          stops reading — a little before the section boundary, not after. */}
      <Nav deep={depth > 0.2} />
      <Celebration trigger={haulSignal} />

      <Hero ocean={ocean} featured={featured} price={price} wallet={wallet} />

      {!CONFIGURED ? (
        <section>
          <div className="wrap">
            <div className="glass" style={{ padding: 28 }}>
              <h3 className="display">No deployment configured</h3>
              <p className="lede" style={{ marginTop: 12 }}>
                Copy <code>.env.example</code> to <code>.env</code>, fill in the addresses from{" "}
                <code>contracts/deployments/&lt;network&gt;.json</code>, and restart the dev server.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <StatsStrip ocean={ocean} price={price} />

          {error && error !== "not-configured" && (
            <section style={{ paddingBlock: 32 }}>
              <div className="wrap">
                <div className="glass" style={{ padding: 20 }}>
                  <p className="lede" style={{ margin: 0 }}>
                    Could not reach {CHAIN.name}: {error}
                  </p>
                </div>
              </div>
            </section>
          )}

          <Steps />
          <Trench ocean={ocean} />
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
