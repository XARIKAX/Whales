import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_MS, CONFIGURED, CHAIN } from "./config.js";
import { readOcean, readWhales, readWhaleBalance, readHauls, readEthPrice } from "./chain.js";
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

/** A wallet's $WHALE, re-read whenever the wallet or the pod changes. */
export function useWhaleBalance(account, signal) {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!CONFIGURED || !account) {
      setBalance(null);
      return;
    }
    let live = true;
    readWhaleBalance(account)
      .then((value) => live && setBalance(value))
      .catch(() => live && setBalance(null));
    return () => {
      live = false;
    };
  }, [account, signal]);

  return balance;
}

/** Recent hauls from the Trench's own logs. Empty is a normal answer. */
export function useHauls(haulCount) {
  const [hauls, setHauls] = useState([]);

  useEffect(() => {
    if (!CONFIGURED) return;
    let live = true;
    readHauls().then((rows) => live && setHauls(rows));
    return () => {
      live = false;
    };
  }, [haulCount]);

  return hauls;
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
/* Quantised to twenty-four steps across the whole document.
   These three variables feed gradients, blurred shadows and layer opacities,
   and every distinct value of them is a repaint of something full-screen. Fed
   a new float sixty times a second they were forcing thousands of those
   repaints for a change no eye can follow. Twenty-four steps is the same
   picture at roughly two orders of magnitude less work, and the half-second
   transitions already on those properties smooth the steps out. */
const STEPS = 24;
const quantise = (v) => Math.round(v * STEPS) / STEPS;

export function useDive() {
  const [deep, setDeep] = useState(false);
  const [lit, setLit] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    const style = root.style;
    let wasDeep = false;
    let wasLit = true;
    let lastSun = -1;
    let lastDepth = -1;
    let lastPressure = -1;

    return onDive((progress) => {
      const sun = quantise(Math.max(0, 1 - progress / 0.15));
      const depth = quantise(Math.min(1, Math.max(0, (progress - 0.26) / 0.5)));
      const pressure = quantise(progress);

      if (sun !== lastSun) {
        lastSun = sun;
        style.setProperty("--sun", String(sun));
        /* Hiding the sunlit layers in CSS was not enough. `display: none` stops
           them painting but leaves their infinite transform animation declared,
           and that alone was costing frames in every section below the light.
           They come out of the document instead. This flips twice in the whole
           page, so the re-render is free. */
        const nowLit = sun > 0;
        if (nowLit !== wasLit) {
          wasLit = nowLit;
          setLit(nowLit);
        }
      }

      if (depth !== lastDepth) {
        lastDepth = depth;
        style.setProperty("--depth", String(depth));
        root.classList.toggle("sunk", depth > 0);
      }

      if (pressure !== lastPressure) {
        lastPressure = pressure;
        style.setProperty("--pressure", String(pressure));
      }

      const nowDeep = progress > 0.2;
      if (nowDeep !== wasDeep) {
        wasDeep = nowDeep;
        setDeep(nowDeep);
      }
    });
  }, []);

  return { deep, lit };
}

/**
 * Wallet connection.
 *
 * The implementation moved to `components/wallet/` when the stack became
 * lazily loaded — it has to be a context now, because the object a page reads
 * differs depending on whether wagmi has arrived yet. Re-exported here so the
 * dozen call sites that import it from `hooks.js` did not all have to move.
 */
export { useWallet } from "./components/wallet/context.js";
