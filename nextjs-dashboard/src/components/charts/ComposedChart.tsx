import {
  ComposedChart as RechartsComposedChart,
  Bar,
  Line,
  Area,
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
  GRID_PROPS,
  TOOLTIP_STYLE,
  BAR_RADIUS_SMALL,
} from './chartDefaults';

interface SeriesDef {
  type: 'bar' | 'line' | 'area';
  dataKey: string;
  name?: string;
  color: string;
  yAxisId: string;
  fillOpacity?: number;
  strokeWidth?: number;
  dot?: boolean | { r: number };
  radius?: [number, number, number, number];
}

interface YAxisDef {
  id: string;
  orientation?: 'left' | 'right';
  tickFormatter?: (value: number) => string;
  domain?: [number | string, number | string];
}

interface ComposedChartProps {
  data: any[];
  xKey: string;
  series: SeriesDef[];
  yAxes: YAxisDef[];
  height?: number;
  tooltipFormatter?: (value: number, name: string) => [string, string];
  showLegend?: boolean;
  xTickSize?: 'sm' | 'md';
  xAxisInterval?: number | 'preserveStartEnd';
}

export const ComposedChart = ({
  data,
  xKey,
  series,
  yAxes,
  height = 350,
  tooltipFormatter,
  showLegend = true,
  xTickSize = 'sm',
  xAxisInterval,
}: ComposedChartProps) => {
  const xTick = xTickSize === 'sm' ? TICK_STYLE_SMALL : TICK_STYLE;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsComposedChart data={data}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey={xKey}
          tick={xTick}
          interval={xAxisInterval}
        />
        {yAxes.map((axis) => (
          <YAxis
            key={axis.id}
            yAxisId={axis.id}
            orientation={axis.orientation || 'left'}
            tick={TICK_STYLE}
            tickFormatter={axis.tickFormatter}
            domain={axis.domain as any}
          />
        ))}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={tooltipFormatter as any}
        />
        {showLegend && <Legend />}
        {series.map((s) => {
          if (s.type === 'bar') {
            return (
              <Bar
                key={s.dataKey}
                yAxisId={s.yAxisId}
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                fill={s.color}
                fillOpacity={s.fillOpacity}
                radius={s.radius || BAR_RADIUS_SMALL}
              />
            );
          }
          if (s.type === 'area') {
            return (
              <Area
                key={s.dataKey}
                yAxisId={s.yAxisId}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name || s.dataKey}
                stroke={s.color}
                fill={s.color}
                fillOpacity={s.fillOpacity ?? 0.2}
              />
            );
          }
          return (
            <Line
              key={s.dataKey}
              yAxisId={s.yAxisId}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name || s.dataKey}
              stroke={s.color}
              strokeWidth={s.strokeWidth || 2}
              dot={s.dot !== undefined ? s.dot : false}
            />
          );
        })}
      </RechartsComposedChart>
    </ResponsiveContainer>
  );
};
