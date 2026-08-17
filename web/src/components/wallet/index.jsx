import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { WalletContext } from "./context.js";

export { useWallet } from "./context.js";

/**
 * The wallet stack, loaded when it is wanted rather than when the page opens.
 *
 * wagmi, RainbowKit and WalletConnect's core come to about 320 kB gzipped. That
 * is a fair price on a page where somebody is about to sign something and a bad
 * joke on a documentation page they are only reading — it was tripling the
 * weight of every route on the site to serve a button most visitors never press.
 *
 * So the tree starts cold. `useWallet` returns a working object either way, and
 * the only difference is that the cold `connect()` loads the stack first and
 * then opens the modal. From the outside there is one behaviour.
 *
 * **`children` never moves.** The lazy part is a headless sibling that reports
 * its state up through a callback, not a provider wrapped around the app. The
 * obvious shape — swapping a plain provider for `<Suspense><LiveWallet>` around
 * the same children — changes the component type at that position, so React
 * throws the entire application away and rebuilds it: scroll position, running
 * animations, and, most visibly, the click that was in flight on the button
 * that triggered the load. Keeping the children in one place costs a callback
 * and fixes all three.
 *
 * Three things boot it without a click, because in each case a cold pill would
 * be wrong rather than merely late:
 *
 *   1. **A wallet is already connected.** wagmi records that in localStorage, so
 *      a reload of a connected session boots straight away — otherwise the pill
 *      would say "Connect" to somebody who already had.
 *   2. **The route needs it.** /activate and /portfolio are entirely about a
 *      wallet; making the first thing you do there a second wait is silly.
 *   3. **The pointer is over the button.** Hover starts the download so the
 *      press usually lands on something already in memory.
 */

const LiveWallet = lazy(() => import("./LiveWallet.jsx"));

const WALLET_ROUTES = new Set(["/activate", "/portfolio"]);

/** Whether wagmi has a connection stored from a previous visit. */
function hasStoredConnection() {
  try {
    const raw = window.localStorage.getItem("wagmi.store");
    return Boolean(raw) && raw.includes('"connections"') && !raw.includes('"value":[]');
  } catch {
    // Private mode, or storage disabled. Not worth a boot on its own.
    return false;
  }
}

export default function WalletProvider({ route, children }) {
  const [live, setLive] = useState(false);
  const [value, setValue] = useState(null);

  /* A counter, not a flag. Hovering the pill boots the stack, so by the time
     the click lands the live subtree may already exist — and a boolean read
     once on mount is then read before the press that set it, losing the press.
     A token that increments is something the bridge can react to whenever it
     arrives, in any order. */
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (live) return;
    if (WALLET_ROUTES.has(route) || hasStoredConnection()) setLive(true);
  }, [live, route]);

  /* Hover begins the download before the click lands. On a desktop that is
     usually the whole latency; on a phone `pointerenter` fires on touch-down,
     which buys the ~100ms before touch-up. */
  useEffect(() => {
    if (live) return;
    const warm = () => setLive(true);
    const pill = document.querySelector(".nav-wallet");
    pill?.addEventListener("pointerenter", warm, { once: true });
    return () => pill?.removeEventListener("pointerenter", warm);
  }, [live]);

  const cold = useMemo(
    () => ({
      account: null,
      connect: async () => {
        setRequest((n) => n + 1);
        setLive(true);
      },
      client: async () => {
        throw new Error("Connect a wallet to sign.");
      },
      error: null,
      /* The press has been accepted and something is happening, which is what
         the pill's connecting state is for. Anything else and a slow connection
         looks like a dead button. */
      connecting: request > 0,
      /* Nothing to open, switch or disconnect until the real stack is up. */
      openAccount: null,
      switchNetwork: null,
      disconnect: null,
      chainId: null,
      wrongNetwork: false,
      available: true,
      ready: false,
    }),
    [request]
  );

  const publish = useCallback((next) => setValue(next), []);

  return (
    <WalletContext.Provider value={value ?? cold}>
      {children}
      {live && (
        <Suspense fallback={null}>
          <LiveWallet request={request} onValue={publish} />
        </Suspense>
      )}
    </WalletContext.Provider>
  );
}
