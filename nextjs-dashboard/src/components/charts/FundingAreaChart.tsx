"use client"

import { Chart, useChart } from "@chakra-ui/charts"
import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts"

export const FundingAreaChart = ({ data, title }) => {
  const chart = useChart({
    data: data,
    series: [
      { name: "funding", color: "teal.solid" },
      { name: "projects", color: "purple.solid" },
    ],
  })

  return (
    <div>
      {title && <h3 className="text-lg font-bold mb-4">{title}</h3>}
      <Chart.Root maxH="sm" chart={chart}>
        <AreaChart
          accessibilityLayer
          data={chart.data}
          margin={{ bottom: 24, left: 24 }}
        >
          <XAxis
            dataKey="month"
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)}
            stroke={chart.color("border")}
          />
          <YAxis stroke={chart.color("border")} />
          <Tooltip
            cursor={false}
            animationDuration={100}
            content={<Chart.Tooltip />}
          />
          {chart.series.map((item) => (
            <Area
              type="natural"
              key={item.name}
              isAnimationActive={false}
              dataKey={chart.key(item.name)}
              fill={chart.color(item.color)}
              fillOpacity={0.2}
              stroke={chart.color(item.color)}
              stackId="a"
            />
          ))}
        </AreaChart>
      </Chart.Root>
    </div>
  )
}