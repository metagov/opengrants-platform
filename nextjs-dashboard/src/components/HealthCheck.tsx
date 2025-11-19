"use client"

import useSWR from 'swr'
import { Badge, HStack, Text, Spinner } from '@chakra-ui/react'

const fetcher = (url) => fetch(url).then(r => r.json())

export function HealthCheck() {
  const { data, error, isLoading } = useSWR('/api/health', fetcher, {
    refreshInterval: 30000, // Check every 30 seconds
  })

  if (isLoading) {
    return (
      <HStack>
        <Spinner size="sm" />
        <Text fontSize="sm">Checking database...</Text>
      </HStack>
    )
  }

  return (
    <HStack>
      <Text fontSize="sm">Database:</Text>
      <Badge colorScheme={data?.status === 'healthy' ? 'green' : 'red'}>
        {data?.status === 'healthy' ? 'Connected' : 'Disconnected'}
      </Badge>
    </HStack>
  )
}