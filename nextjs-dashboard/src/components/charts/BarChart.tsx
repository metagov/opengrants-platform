"use client"

import { BarChart as RechartsBarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Box, Text } from '@chakra-ui/react'

interface BarChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  title?: string;
  color?: string;
  height?: number;
}

export const BarChart = ({ 
  data, 
  xKey, 
  yKey, 
  title, 
  color = "#006E7F",
  height = 300 
}: BarChartProps) => {
  return (
    <Box p={4} bg="white" borderRadius="lg" boxShadow="sm">
      {title && (
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {title}
        </Text>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xKey}
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis fontSize={12} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
          <Bar 
            dataKey={yKey} 
            fill={color}
            radius={[4, 4, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </Box>
  )
}