import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_MS, CONFIGURED } from "./config.js";
import { readOcean, readWhales, readArt, readEthPrice, getWalletClient } from "./chain.js";

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
    const id = setInterval(refresh, POLL_MS);
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

/** Tracks how deep the reader has scrolled, to fade the sunlight out. */
export function useDepth() {
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      setDepth(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return depth;
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
