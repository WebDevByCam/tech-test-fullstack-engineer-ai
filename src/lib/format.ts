const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatUsd = (value: number) => usd.format(value);
export const formatUsdCompact = (value: number) => usdCompact.format(value);
export const formatInteger = (value: number) => integer.format(value);
export const formatCompact = (value: number) => compact.format(value);
export const formatRating = (value: number) => value.toFixed(1);
