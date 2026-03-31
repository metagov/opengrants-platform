export const formatCurrency = (value: number | string | null | undefined) => {
  const n = Number(value) || 0;
  if (n >= 1000000) {
    return `$${(n / 1000000).toFixed(2)}M`;
  }
  if (n >= 1000) {
    return `$${(n / 1000).toFixed(0)}K`;
  }
  return `$${n.toFixed(0)}`;
};

export const formatNumber = (value: number | string | null | undefined) => {
  const n = Number(value) || 0;
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return n.toFixed(0);
};

export const formatETH = (value: number | undefined | null) => {
  const num = Number(value) || 0;
  return `${num.toFixed(4)} ETH`;
};

export const formatPercent = (value: number | string | null | undefined) => {
  return `${Number(value || 0).toFixed(1)}%`;
};
