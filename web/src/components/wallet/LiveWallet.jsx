import { useCallback, useEffect, useMemo, useState } from "react";
import { WagmiProvider, useAccount, useDisconnect } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  useAccountModal,
  useChainModal,
  useConnectModal,
} from "@rainbow-me/rainbowkit";
import { getAccount, watchAccount } from "@wagmi/core";

import { wagmiConfig } from "../../wagmi.js";
import { CHAIN } from "../../config.js";
import { getWalletClient } from "../../chain.js";

import "@rainbow-me/rainbowkit/styles.css";

/**
 * The real wallet stack. Loaded on demand — see `index.jsx` for why.
 *
 * RainbowKit supplies the wallet list, the QR flow, the recent-wallet memory
 * and the mobile deep links: the parts that are genuinely hard and that a
 * hand-rolled `window.ethereum` button silently does not have. It does *not*
 * supply the connect button on this site. The pill in the nav is ours, with its
 * own idle, connecting, connected and wrong-network states, and it opens
 * RainbowKit's modal rather than being replaced by RainbowKit's button.
 *
 * That split is deliberate: the modal is a commodity and worth taking, the
 * button sits in the middle of a design system and is not.
 */

/* One client for the whole app, at module scope — created inside the component
   it would be thrown away, and wagmi's cache with it, on every render. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The site polls the chain on its own schedule through `useOcean`. wagmi
      // refetching the same reads on window focus would double the traffic to
      // an RPC we do not run.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * The modal, in the site's water rather than RainbowKit's neutral grey.
 *
 * `darkTheme()` only takes an accent, which leaves a charcoal sheet floating
 * over a deep-blue page — close enough to look like a third-party widget and
 * far enough to look like a mistake. The rest is overridden directly: the panel
 * takes the same trench blue as the deep sections, the hairlines take the same
 * foam at the same opacity as the plates, and the body font becomes the one the
 * rest of the site is set in.
 */
const base = darkTheme({
  accentColor: "#8fd4ee",
  accentColorForeground: "#04182b",
  borderRadius: "small",
  overlayBlur: "small",
});

const theme = {
  ...base,
  fonts: { body: '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif' },
  colors: {
    ...base.colors,
    modalBackground: "#072338",
    modalBorder: "rgba(190, 231, 245, 0.18)",
    modalText: "#f5fbfe",
    modalTextSecondary: "rgba(245, 251, 254, 0.6)",
    modalTextDim: "rgba(245, 251, 254, 0.42)",
    menuItemBackground: "rgba(190, 231, 245, 0.06)",
    actionButtonBorder: "rgba(190, 231, 245, 0.16)",
    actionButtonBorderMobile: "rgba(190, 231, 245, 0.16)",
    actionButtonSecondaryBackground: "rgba(190, 231, 245, 0.08)",
    closeButton: "rgba(245, 251, 254, 0.6)",
    closeButtonBackground: "rgba(190, 231, 245, 0.08)",
    generalBorder: "rgba(190, 231, 245, 0.12)",
    profileForeground: "#06283f",
    profileAction: "rgba(190, 231, 245, 0.08)",
    profileActionHover: "rgba(190, 231, 245, 0.14)",
    connectButtonBackground: "#072338",
    connectButtonInnerBackground: "rgba(190, 231, 245, 0.08)",
    /* The one place gold is allowed in here, and for the reason it always is:
       this is the colour of something being wrong. */
    connectionIndicator: "#8fd4ee",
    error: "#f4c542",
  },
  shadows: {
    ...base.shadows,
    dialog: "0 40px 90px rgba(2, 12, 22, 0.7)",
  },
};

/**
 * Publishes wagmi's state into the same context shape the cold path uses.
 *
 * Headless on purpose. It renders nothing and wraps nothing — the app's
 * children live one level up and never move, so loading this cannot remount
 * them. Everything on the site reads `{ account, connect, client, error,
 * connecting, chainId, wrongNetwork, available }` and nothing reads wagmi
 * directly, which is what let the plumbing change underneath without touching
 * a page.
 */
function Bridge({ request, onValue }) {
  const { address, chainId, status } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  /**
   * Three ways out of a connected session, in descending order of niceness —
   * and the first two are allowed to be missing.
   *
   * RainbowKit withholds `openAccountModal` unless the wallet's *current* chain
   * is one of wagmi's configured chains:
   *
   *     openAccountModal: isCurrentChainSupported && status === "connected"
   *       ? openAccountModal : undefined
   *
   * Which is exactly backwards for the case that needs it most. A wallet parked
   * on the wrong network is the one situation where a reader most wants to
   * disconnect and start again, and it is the one situation where the sheet
   * that offers Disconnect is not handed over. The pill was then a button that
   * visibly did nothing.
   *
   * So the bridge publishes all three and lets the pill fall down the list:
   * the account sheet if there is one, the chain switcher if the wallet is
   * merely on the wrong network, and a plain `disconnect()` — which wagmi
   * always provides — as the floor. There is no state in which pressing it
   * does nothing.
   */
  const { openAccountModal } = useAccountModal();
  const { openChainModal } = useChainModal();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState(null);

  /* wagmi reports "reconnecting" while it revives a session stored from a
     previous visit, and a stale WalletConnect session can leave it there
     indefinitely — the pill then said "Connecting" from the moment the page
     opened and never settled. Honour the state for the few seconds a real
     revival takes, then stop calling it connecting: a reconnect that has not
     landed by then is not going to, and the pill should offer a way in rather
     than report a wait that never ends. */
  const [reviving, setReviving] = useState(true);
  useEffect(() => {
    const patience = setTimeout(() => setReviving(false), 8_000);
    return () => clearTimeout(patience);
  }, []);

  /* A press of Connect can land before this subtree exists, while it is
     loading, or after it has mounted. The request token covers all three: it
     changes on every press, so this fires whichever side of the boot the press
     happened on. Deliberately not keyed on `address` — that would reopen the
     modal the moment somebody disconnects. */
  useEffect(() => {
    if (request > 0 && !getAccount(wagmiConfig).address) openConnectModal?.();
  }, [request, openConnectModal]);

  /* Opening the modal is not the same as connecting, so this resolves when a
     wallet has actually been picked rather than when the sheet appears. The
     actions console signs immediately after awaiting it, and would otherwise
     race the person still choosing. */
  const connect = useCallback(async () => {
    setError(null);
    if (getAccount(wagmiConfig).address) return;

    /* RainbowKit withholds the connect modal while wagmi is mid-reconnect, and
       a wedged session can hold it there. With no modal to open, the only move
       that leads anywhere is clearing the dead session — wagmi flips to
       disconnected, RainbowKit hands the modal back, and the next press opens
       it. Without this, a press in that state did nothing at all. */
    if (openConnectModal) openConnectModal();
    else disconnect();

    await new Promise((resolve) => {
      const stop = watchAccount(wagmiConfig, {
        onChange(account) {
          if (account.address) {
            stop();
            resolve();
          }
        },
      });
      // Nobody is obliged to finish. Give up quietly rather than leaving a
      // promise open for the life of the page.
      setTimeout(() => {
        stop();
        resolve();
      }, 120_000);
    });
  }, [openConnectModal, disconnect]);

  const client = useCallback(async () => {
    try {
      return await getWalletClient();
    } catch (e) {
      setError(e.shortMessage || e.message);
      throw e;
    }
  }, []);

  const value = useMemo(
    () => ({
      account: address ?? null,
      connect,
      client,
      error,
      /* An address settles the question. A modal left open behind a wallet that
         has already connected used to keep the pill saying "Connecting" over
         the top of a working session, with no way to press it. */
      connecting:
        !address &&
        (status === "connecting" || (status === "reconnecting" && reviving) || connectModalOpen),
      /* Disconnecting, switching account and copying the address all live in
         RainbowKit's own sheet. The pill opens it once there is something to
         open it for, and falls through to the two below when there is not. */
      openAccount: openAccountModal ?? null,
      switchNetwork: openChainModal ?? null,
      disconnect: address ? disconnect : null,
      chainId: chainId ?? null,
      wrongNetwork: Boolean(address) && chainId != null && chainId !== CHAIN.id,
      /* There is always a way in now — an extension, a QR code or a deep link.
         This used to mean "a browser extension exists", which is what made the
         whole site look broken on a phone. */
      available: true,
      ready: true,
    }),
    [
      address,
      chainId,
      status,
      reviving,
      connectModalOpen,
      openAccountModal,
      openChainModal,
      disconnect,
      connect,
      client,
      error,
    ]
  );

  useEffect(() => {
    onValue(value);
  }, [value, onValue]);

  return null;
}

export default function LiveWallet({ request, onValue }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme}
          initialChain={CHAIN}
          appInfo={{ appName: "WHALES", learnMoreUrl: "/docs" }}
          modalSize="compact"
        >
          <Bridge request={request} onValue={onValue} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
