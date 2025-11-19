"use client"

import { BarChart as ChakraBarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Box, Text, useColorModeValue } from '@chakra-ui/react'

export const BarChart = ({ 
  data, 
  xKey, 
  yKey, 
  title, 
  color = "blue.500",
  height = 300 
}) => {
  const tooltipBg = useColorModeValue('white', 'gray.700')
  
  return (
    <Box p={4} bg="white" borderRadius="lg" boxShadow="sm">
      {title && (
        <Text fontSize="lg" fontWeight="bold" mb={4}>
          {title}
        </Text>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <ChakraBarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xKey}
            fontSize="12px"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis fontSize="12px" />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: tooltipBg,
              borderRadius: '8px',
              border: 'none',
              boxShadow: 'lg'
            }}
          />
          <Bar 
            dataKey={yKey} 
            fill={`var(--chakra-colors-${color.replace('.', '-')})`}
            radius={[4, 4, 0, 0]}
          />
        </ChakraBarChart>
      </ResponsiveContainer>
    </Box>
  )
}