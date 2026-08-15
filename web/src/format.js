import { formatEther } from "viem";

/** ETH with enough precision to see a small pot move, without noise. */
export function eth(wei, places = 4) {
  if (wei === undefined || wei === null) return "—";
  const value = Number(formatEther(wei));
  if (value === 0) return "0";
  if (value < 10 ** -places) return `<${10 ** -places}`;
  return value.toLocaleString(undefined, { maximumFractionDigits: places });
}

export function usd(wei, price) {
  if (!price || wei === undefined || wei === null) return null;
  const value = Number(formatEther(wei)) * price;
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 100 ? 2 : 0,
  });
}

/** $WHALE amounts, which run to the billions. */
export function whale(wei) {
  if (wei === undefined || wei === null) return "—";
  const value = Number(formatEther(wei));
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** Weight basis points as the multiplier holders actually talk about. */
export function multiplier(weight) {
  return `${(Number(weight) / 10_000).toFixed(2)}x`;
}

export function address(value) {
  if (!value) return "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/** `now` should be the chain's clock, which drifts from the browser's. */
export function ago(timestamp, now = Math.floor(Date.now() / 1000)) {
  if (!timestamp) return "never";
  const seconds = now - Number(timestamp);
  if (seconds < 60) return "just now";
  return `${countdown(seconds)} ago`;
}

export function plural(count, singular, plural_ = `${singular}s`) {
  const n = Number(count);
  return `${n.toLocaleString()} ${n === 1 ? singular : plural_}`;
}

export function countdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.min(100, Number((numerator * 10_000n) / denominator) / 100);
}
