import { createContext, useContext } from "react";

/**
 * What every page reads. One shape, whether the wallet stack has loaded or not.
 *
 * The cold default is not an error state and not a disabled state: `connect` is
 * a real function that boots the stack and then opens the modal. A reader who
 * lands on the docs and presses Connect gets a wallet list, and never finds out
 * that 320 kB of JavaScript arrived between the press and the sheet.
 */
export const WalletContext = createContext({
  account: null,
  connect: async () => {},
  client: async () => {
    throw new Error("Connect a wallet to sign.");
  },
  error: null,
  connecting: false,
  /* Nothing to open, switch or disconnect until a wallet is attached. */
  openAccount: null,
  switchNetwork: null,
  disconnect: null,
  chainId: null,
  wrongNetwork: false,
  available: true,
  ready: false,
});

export function useWallet() {
  return useContext(WalletContext);
}
