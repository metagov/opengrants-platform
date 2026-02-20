import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TICK_STYLE,
  TICK_STYLE_SMALL,
  TICK_STYLE_XS,
  GRID_PROPS,
  TOOLTIP_STYLE,
  ROTATED_45,
  ROTATED_25,
  BAR_RADIUS_TOP,
  BAR_RADIUS_RIGHT,
} from './chartDefaults';

type TickSize = 'xs' | 'sm' | 'md';

interface BarDef {
  dataKey: string;
  name?: string;
  color: string;
  yAxisId?: string;
  fillOpacity?: number;
  radius?: [number, number, number, number];
  maxBarSize?: number;
}

interface YAxisDef {
  id: string;
  orientation?: 'left' | 'right';
  tickFormatter?: (value: number) => string;
  label?: {
    value: string;
    angle?: number;
    position?: string;
    offset?: number;
    style?: object;
  };
  domain?: [number | string, number | string];
}

interface BarChartProps {
  data: any[];
  xKey: string;
  bars: BarDef[];
  height?: number;
  layout?: 'horizontal' | 'vertical';
  rotateLabels?: boolean | 'gentle';
  tickSize?: TickSize;
  yAxes?: YAxisDef[];
  tooltipFormatter?: (value: number, name: string, props?: any) => [string, string];
  showLegend?: boolean;
  legendFormatter?: (value: string) => string;
  xAxisInterval?: number | 'preserveStartEnd';
  yAxisWidth?: number;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

const getTickStyle = (size: TickSize) => {
  if (size === 'xs') return TICK_STYLE_XS;
  if (size === 'sm') return TICK_STYLE_SMALL;
  return TICK_STYLE;
};

export const BarChart = ({
  data,
  xKey,
  bars,
  height = 300,
  layout = 'horizontal',
  rotateLabels = false,
  tickSize = 'md',
  yAxes,
  tooltipFormatter,
  showLegend = false,
  legendFormatter,
  xAxisInterval,
  yAxisWidth,
  margin,
}: BarChartProps) => {
  const tick = getTickStyle(tickSize);
  const rotation = rotateLabels === 'gentle' ? ROTATED_25 : rotateLabels ? ROTATED_45 : {};
  const isVertical = layout === 'vertical';
  const hasDualAxis = yAxes && yAxes.length > 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} layout={layout} margin={margin}>
        <CartesianGrid {...GRID_PROPS} />

        {isVertical ? (
          <>
            <XAxis
              type="number"
              tick={tick}
              tickFormatter={yAxes?.[0]?.tickFormatter}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              tick={tick}
              width={yAxisWidth || 100}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={tick}
              interval={xAxisInterval}
              {...rotation}
            />
            {yAxes ? (
              yAxes.map((axis) => (
                <YAxis
                  key={axis.id}
                  yAxisId={axis.id}
                  orientation={axis.orientation || 'left'}
                  tick={tick}
                  tickFormatter={axis.tickFormatter}
                  label={axis.label as any}
                  domain={axis.domain as any}
                />
              ))
            ) : (
              <YAxis tick={tick} tickFormatter={bars[0] && undefined} />
            )}
          </>
        )}

        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={tooltipFormatter as any}
        />

        {showLegend && <Legend formatter={legendFormatter} wrapperStyle={rotateLabels ? undefined : undefined} />}

        {bars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name || bar.dataKey}
            fill={bar.color}
            fillOpacity={bar.fillOpacity}
            yAxisId={hasDualAxis ? bar.yAxisId : undefined}
            radius={bar.radius || (isVertical ? BAR_RADIUS_RIGHT : BAR_RADIUS_TOP)}
            maxBarSize={bar.maxBarSize}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};
