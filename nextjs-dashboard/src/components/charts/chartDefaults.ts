export const TICK_STYLE = { fill: '#4A5568', fontSize: 11 };

export const TICK_STYLE_SMALL = { fill: '#4A5568', fontSize: 10 };

export const TICK_STYLE_XS = { fill: '#4A5568', fontSize: 9 };

export const GRID_PROPS = {
  strokeDasharray: '3 3' as const,
  stroke: '#E2E8F0',
};

export const TOOLTIP_STYLE = {
  backgroundColor: 'white',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
};

/** Preset for angle=-45 rotation (most charts) */
export const ROTATED_45 = {
  angle: -45 as const,
  textAnchor: 'end' as const,
  dx: -8,
  dy: 8,
  height: 80,
};

/** Preset for angle=-25 rotation (ecosystem) */
export const ROTATED_25 = {
  angle: -25 as const,
  textAnchor: 'end' as const,
  dx: -5,
  dy: 5,
  height: 80,
};

export const BAR_RADIUS_TOP: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_RIGHT: [number, number, number, number] = [0, 4, 4, 0];
export const BAR_RADIUS_SMALL: [number, number, number, number] = [2, 2, 0, 0];
