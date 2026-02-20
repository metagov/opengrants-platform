import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PieChartProps {
  data: Array<{ name: string; value: number; [key: string]: any }>;
  colors: string[];
  height?: number;
  outerRadius?: number;
  label?: boolean | ((props: any) => string);
  labelLine?: boolean;
  tooltipFormatter?: (value: number, name: string, props?: any) => [string, string];
}

export const PieChart = ({
  data,
  colors,
  height = 300,
  outerRadius = 80,
  label = true,
  labelLine = false,
  tooltipFormatter,
}: PieChartProps) => {
  const defaultLabel = ({ name, percent }: any) =>
    `${name?.substring(0, 10)} ${(percent * 100).toFixed(0)}%`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={outerRadius}
          dataKey="value"
          nameKey="name"
          label={label === true ? defaultLabel : label === false ? false : label}
          labelLine={labelLine}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={tooltipFormatter as any} />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};
