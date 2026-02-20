export const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value?.toFixed(0) || 0}`;
};

export const formatNumber = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value?.toFixed(0) || '0';
};

export const formatETH = (value: number | undefined | null) => {
  const num = Number(value) || 0;
  return `${num.toFixed(4)} ETH`;
};

export const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};
