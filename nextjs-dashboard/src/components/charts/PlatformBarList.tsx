"use client"

import { BarList, useChart } from "@chakra-ui/charts"

export const PlatformBarList = ({ data, title }) => {
  const chart = useChart({
    sort: { by: "value", direction: "desc" },
    data: data,
    series: [{ name: "name", color: "teal.subtle" }],
  })

  return (
    <div>
      {title && <h3 className="text-lg font-bold mb-4">{title}</h3>}
      <BarList.Root chart={chart}>
        <BarList.Content>
          <BarList.Bar />
          <BarList.Value />
        </BarList.Content>
      </BarList.Root>
    </div>
  )
}