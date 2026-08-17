import { useMemo } from "react";
import { useOcean, useWhales, useEthPrice, useDive, useWallet, useHaulSignal } from "./hooks.js";
import { CONFIGURED, CHAIN } from "./config.js";
import { useRoute } from "./router.jsx";
import { fromChain, heldBy } from "./whales.js";

import Shell from "./components/Shell.jsx";
import Hero from "./components/Hero.jsx";
import StatsStrip from "./components/StatsStrip.jsx";
import Steps from "./components/Steps.jsx";
import Trench from "./components/Trench.jsx";
import Pod from "./components/Pod.jsx";
import Carousel from "./components/Carousel.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Celebration from "./components/Celebration.jsx";
import { Waterline } from "./components/Depth.jsx";
import { useCardTilt } from "./components/Cursor.jsx";
import Overture, { useOverture } from "./components/Overture.jsx";

import Activate from "./pages/Activate.jsx";
import Docs from "./pages/Docs.jsx";
import Mint from "./pages/Mint.jsx";
import Portfolio from "./pages/Portfolio.jsx";

/* --- The landing page ---------------------------------------------------- */

function Landing({ ocean, whales, featured, price, wallet, live, error, unreachable, onRefresh }) {
  return (
    <>
      <Hero ocean={ocean} featured={featured} price={price} wallet={wallet} live={live} />

      <Waterline />
      <StatsStrip ocean={live ? ocean : null} price={price} />

      {!CONFIGURED && (
        <section style={{ paddingBlock: 0, marginTop: 48 }}>
          <div className="wrap">
            <p className="notice pending">
              Not launched yet. The contracts are written, tested and ready. This page goes live the
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
      <Pod />
      <Trench ocean={live ? ocean : null} live={live} />

      {live && (
        <>
          <Carousel whales={whales} />
          <Dashboard
            ocean={ocean}
            whales={whales}
            price={price}
            wallet={wallet}
            onDone={onRefresh}
          />
        </>
      )}
    </>
  );
}

/* --- App ----------------------------------------------------------------- */

export default function App() {
  const { data: ocean, error, refresh } = useOcean();
  const { whales, refresh: refreshWhales } = useWhales(ocean?.minted);
  const price = useEthPrice();
  const { deep, lit } = useDive();
  const wallet = useWallet();
  const haulSignal = useHaulSignal(ocean?.haulCount);
  const overture = useOverture();
  const route = useRoute();
  useCardTilt();

  // The whale on the hero card: whoever has earned the most, falling back to
  // the first fed whale, then to the first whale at all.
  const featured = useMemo(() => {
    if (whales.length === 0) return null;
    const fed = whales.filter((w) => w.activatedAt !== 0n);
    if (fed.length === 0) return whales[0];
    return fed.reduce((best, w) => (w.lifetimeEarned > best.lifetimeEarned ? w : best), fed[0]);
  }, [whales]);

  /* The wallet pages are about one wallet, so they get the rows that wallet
     holds and nothing else. `whaleStates` already carries the holder, so this
     costs no extra reads — and with no wallet connected it is empty, which is
     what puts those pages into their sample state. Ages are measured against
     the chain's clock rather than the browser's; on a test chain that has been
     time-travelled the two are weeks apart. */
  const held = useMemo(
    () => fromChain(heldBy(whales, wallet.account), ocean?.now),
    [whales, wallet.account, ocean?.now]
  );

  // The story stands on its own; the numbers layer in. Before the contracts
  // are live — or if the RPC is unreachable — the page is still the whole
  // pitch rather than an error card between a header and a footer.
  const unreachable = Boolean(error) && error !== "not-configured";
  const live = CONFIGURED && !unreachable;

  /* One refresh for every page that can change the chain. */
  const onRefresh = () => {
    refresh();
    refreshWhales();
  };

  return (
    <Shell deep={deep} lit={lit} live={live} wallet={wallet} route={route}>
      {/* Chrome that only the landing page needs. */}
      {route === "/" && (
        <>
          <Celebration trigger={haulSignal} />
          <Overture playing={overture} />
        </>
      )}

      {route === "/docs" && <Docs />}

      {route === "/mint" && (
        <Mint ocean={ocean} wallet={wallet} price={price} live={live} onDone={onRefresh} />
      )}

      {route === "/activate" && (
        <Activate
          wallet={wallet}
          whales={held}
          ocean={ocean}
          live={live}
          onDone={onRefresh}
        />
      )}

      {route === "/portfolio" && (
        <Portfolio
          wallet={wallet}
          whales={held}
          ocean={ocean}
          price={price}
          live={live}
          onRefresh={onRefresh}
        />
      )}

      {route !== "/activate" &&
        route !== "/portfolio" &&
        route !== "/docs" &&
        route !== "/mint" && (
        <Landing
          ocean={ocean}
          whales={whales}
          featured={featured}
          price={price}
          wallet={wallet}
          live={live}
          error={error}
          unreachable={unreachable}
          onRefresh={onRefresh}
        />
      )}
    </Shell>
  );
}
