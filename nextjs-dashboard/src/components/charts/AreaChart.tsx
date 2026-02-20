import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TICK_STYLE,
  GRID_PROPS,
  TOOLTIP_STYLE,
  ROTATED_45,
} from './chartDefaults';

interface AreaDef {
  dataKey: string;
  name?: string;
  color: string;
  fillOpacity?: number;
}

interface AreaChartProps {
  data: any[];
  xKey: string;
  areas: AreaDef[];
  height?: number;
  rotateLabels?: boolean;
  tooltipFormatter?: (value: number, name: string) => [string, string];
  yTickFormatter?: (value: number) => string;
}

export const AreaChart = ({
  data,
  xKey,
  areas,
  height = 300,
  rotateLabels = false,
  tooltipFormatter,
  yTickFormatter,
}: AreaChartProps) => {
  const rotation = rotateLabels ? ROTATED_45 : {};

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} tick={TICK_STYLE} {...rotation} />
        <YAxis tick={TICK_STYLE} tickFormatter={yTickFormatter} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={tooltipFormatter as any}
        />
        {areas.map((area) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name || area.dataKey}
            stroke={area.color}
            fill={area.color}
            fillOpacity={area.fillOpacity ?? 0.3}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
};
