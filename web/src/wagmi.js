import { createConfig, http } from "wagmi";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { injected } from "wagmi/connectors";
import { CHAIN } from "./config.js";

const env = import.meta.env;

/**
 * The WalletConnect project id, from cloud.reown.com.
 *
 * Public by nature — it ends up in the JavaScript bundle either way and is not
 * a secret. It lives in the environment so a fork of this site does not report
 * its traffic under our project, not to hide it.
 */
const PROJECT_ID = env.VITE_WALLETCONNECT_ID || "";

/**
 * Four wallets, chosen rather than defaulted.
 *
 * RainbowKit's `getDefaultConfig` is the one-liner everybody starts with, and
 * it costs 360 kB gzipped on first paint — it imports every wallet SDK it
 * supports at module scope, so a reader who opens the docs and never touches a
 * wallet still downloads MetaMask's mobile SDK. Naming the wallets brings that
 * back down to something a documentation page can justify.
 *
 * What the list covers:
 *
 *   - `injectedWallet` — every browser extension, including MetaMask, Rabby and
 *     Brave. Deliberately *not* `metaMaskWallet`, which exists only to add
 *     MetaMask's mobile deep-link SDK: 160 kB gzipped for a job WalletConnect
 *     already does for every mobile wallet at once.
 *   - `walletConnectWallet` — the QR code, and every phone.
 *   - `rainbowWallet` and `coinbaseWallet` — the two most common wallets that
 *     are not an extension, and both are thin wrappers.
 */
const wallets = [
  {
    groupName: "Popular",
    wallets: [injectedWallet, walletConnectWallet, rainbowWallet, coinbaseWallet],
  },
];

/**
 * One wagmi config, shared by the React tree and by the plain functions in
 * `chain.js` that need a signer without being components.
 *
 * With no project id there is no WalletConnect, so this falls back to injected
 * wallets only rather than failing to build. Worth knowing what that means: a
 * visitor with no browser extension then opens the modal onto an empty list.
 * It keeps a fresh checkout working for a developer, and it is not good enough
 * for production — set the id before launch.
 */
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: PROJECT_ID
    ? connectorsForWallets(wallets, { appName: "WHALES", projectId: PROJECT_ID })
    : [injected()],
  transports: { [CHAIN.id]: http(CHAIN.rpcUrls.default.http[0]) },
  ssr: false,
});

/** Whether the wallet list will include anything beyond a browser extension. */
export const WALLETCONNECT_READY = Boolean(PROJECT_ID);
