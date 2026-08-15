import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_MS, CONFIGURED } from "./config.js";
import { readOcean, readWhales, readArt, readEthPrice, getWalletClient } from "./chain.js";
import { onDive } from "./dive.js";

/** Re-reads the chain on an interval so the pot moves without a refresh. */
export function useOcean() {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const refresh = useCallback(async () => {
    if (!CONFIGURED) {
      setState({ data: null, error: "not-configured", loading: false });
      return;
    }
    try {
      setState({ data: await readOcean(), error: null, loading: false });
    } catch (e) {
      setState((prev) => ({ ...prev, error: e.shortMessage || e.message, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { ...state, refresh };
}

export function useWhales(count) {
  const [whales, setWhales] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!CONFIGURED || !count) {
      setWhales([]);
      return;
    }
    try {
      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
      setWhales(await readWhales(ids));
      setError(null);
    } catch (e) {
      setError(e.shortMessage || e.message);
    }
  }, [count]);

  useEffect(() => {
    refresh();
    // Whale rows are an order of magnitude heavier to read than the pot, and
    // they change far less often, so they refresh on a slower beat.
    const id = setInterval(refresh, POLL_MS * 4);
    return () => clearInterval(id);
  }, [refresh]);

  return { whales, error, refresh };
}

/** Fetches a whale's on-chain art once and keeps it. */
export function useArt(tokenId) {
  const [art, setArt] = useState(null);

  useEffect(() => {
    let live = true;
    readArt(tokenId)
      .then((value) => live && setArt(value))
      .catch(() => live && setArt(null));
    return () => {
      live = false;
    };
  }, [tokenId]);

  return art;
}

/**
 * Watches the chain's haul counter and returns a value that changes whenever a
 * haul lands — from anyone, not just this browser. Null until the first one.
 */
export function useHaulSignal(haulCount) {
  const previous = useRef(undefined);
  const [signal, setSignal] = useState(null);

  useEffect(() => {
    if (haulCount === undefined) return;
    if (previous.current !== undefined && haulCount > previous.current) {
      setSignal(Number(haulCount));
    }
    previous.current = haulCount;
  }, [haulCount]);

  return signal;
}

export function useEthPrice() {
  const [price, setPrice] = useState(null);

  useEffect(() => {
    let live = true;
    const load = () => readEthPrice().then((value) => live && setPrice(value));
    load();
    const id = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);

  return price;
}

/**
 * Drives the water column from one shared scroll subscription.
 *
 * The light, the darkness and the pressure are written straight to CSS
 * variables — never through React. This fires on every scroll frame, and the
 * previous version put it through `setState`, which re-rendered every component
 * on the page sixty times a second for a value only the stylesheet consumes.
 *
 * The one thing that does come back as state is a coarse boolean for the nav,
 * and it only changes twice in the whole document.
 */
export function useDive() {
  const [deep, setDeep] = useState(false);

  useEffect(() => {
    const root = document.documentElement.style;
    let wasDeep = false;

    return onDive((progress) => {
      root.setProperty("--sun", String(Math.max(0, 1 - progress / 0.15)));
      root.setProperty("--depth", String(Math.min(1, Math.max(0, (progress - 0.26) / 0.5))));
      root.setProperty("--pressure", String(progress));

      const nowDeep = progress > 0.2;
      if (nowDeep !== wasDeep) {
        wasDeep = nowDeep;
        setDeep(nowDeep);
      }
    });
  }, []);

  return deep;
}

/** Wallet connection, kept deliberately thin: one account, one chain. */
export function useWallet() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);
  const clientRef = useRef(null);

  const connect = useCallback(async () => {
    try {
      const client = await getWalletClient();
      clientRef.current = client;
      setAccount(client.account.address);
      setError(null);
      return client;
    } catch (e) {
      setError(e.shortMessage || e.message);
      throw e;
    }
  }, []);

  const client = useCallback(async () => clientRef.current || connect(), [connect]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts) => {
      clientRef.current = null;
      setAccount(accounts[0] || null);
    };
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", () => {
      clientRef.current = null;
    });
    return () => window.ethereum.removeListener?.("accountsChanged", onAccounts);
  }, []);

  return { account, connect, client, error, available: Boolean(window.ethereum) };
}
