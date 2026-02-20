import {
  LineChart as RechartsLineChart,
  Line,
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
} from './chartDefaults';

interface LineDef {
  dataKey: string;
  name?: string;
  color: string;
  strokeWidth?: number;
  dot?: boolean | { r: number };
}

interface LineChartProps {
  data: any[];
  xKey: string;
  lines: LineDef[];
  height?: number;
  tooltipFormatter?: (value: number, name: string) => [string, string];
  showLegend?: boolean;
  yTickFormatter?: (value: number) => string;
  xTickSize?: 'sm' | 'md';
  xLabel?: { value: string; position: string; offset: number; style?: object };
  xAxisInterval?: number | 'preserveStartEnd';
}

export const LineChart = ({
  data,
  xKey,
  lines,
  height = 300,
  tooltipFormatter,
  showLegend = false,
  yTickFormatter,
  xTickSize = 'md',
  xLabel,
  xAxisInterval,
}: LineChartProps) => {
  const xTick = xTickSize === 'sm' ? TICK_STYLE_SMALL : TICK_STYLE;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey={xKey}
          tick={xTick}
          label={xLabel as any}
          interval={xAxisInterval}
        />
        <YAxis tick={TICK_STYLE} tickFormatter={yTickFormatter} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={tooltipFormatter as any}
        />
        {showLegend && <Legend />}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name || line.dataKey}
            stroke={line.color}
            strokeWidth={line.strokeWidth || 2}
            dot={line.dot !== undefined ? line.dot : { r: 3 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};
