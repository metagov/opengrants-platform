"use client"
// --- nextjs-dashboard/src/pages/test.tsx
import error from 'next/error'
import { useTestData } from '../hooks/useTestData'
import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Heading, 
  Card, 
  CardHeader, 
  CardBody, 
  Stack,
  StackDivider,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Code,
  Grid,
  GridItem
} from '@chakra-ui/react'

export default function TestPage() {
  const { data, isLoading, isError, isSuccess } = useTestData()

  if (isLoading) {
    return (
      <Box p={8} textAlign="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text fontSize="lg">Testing database connection...</Text>
        </VStack>
      </Box>
    )
  }

  if (isError) {
    return (
      <Box p={8}>
        <Alert status="error" borderRadius="lg">
          <AlertIcon />
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Database Connection Failed</Text>
            <Text fontSize="sm">Check your database configuration and ensure it's running.</Text>
            <Code colorScheme="red" p={2} borderRadius="md">
              {isError.message}
            </Code>
          </VStack>
        </Alert>
      </Box>
    )
  }

  return (
    <Box p={8} bg="gray.50" minH="100vh">
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <Heading size="2xl" color="blue.600" mb={2}>
            Database Connection Test
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Testing OpenGrants Data Pipeline
          </Text>
          <Badge colorScheme={isSuccess ? "green" : "red"} mt={2}>
            {isSuccess ? "CONNECTED" : "DISCONNECTED"}
          </Badge>
        </Box>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <Heading size="md">Connection Status</Heading>
          </CardHeader>
          <CardBody>
            <Stack divider={<StackDivider />} spacing={4}>
              <HStack justify="space-between">
                <Text fontWeight="medium">Database</Text>
                <Badge colorScheme={isSuccess ? "green" : "red"}>
                  {isSuccess ? "Healthy" : "Error"}
                </Badge>
              </HStack>
              <HStack justify="space-between">
                <Text fontWeight="medium">Last Check</Text>
                <Text fontSize="sm" color="gray.600">
                  {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontWeight="medium">Total Tables</Text>
                <Text>
                  {data?.counts
                    ? (Object.values(data.counts) as number[]).reduce((a, b) => a + b, 0)
                    : 0} records
                </Text>
              </HStack>
            </Stack>
          </CardBody>
        </Card>

        {/* Data Overview */}
        <Grid templateColumns="repeat(2, 1fr)" gap={6}>
          {/* Ecosystem Overview */}
          <GridItem>
            <Card>
              <CardHeader bg="blue.50" borderBottom="1px" borderColor="gray.200">
                <Heading size="sm">Ecosystem Overview</Heading>
              </CardHeader>
              <CardBody>
                {data?.data?.ecosystemOverview?.map((platform: any, index: number) => (
                  <Box key={index} p={2} borderBottom="1px" borderColor="gray.100">
                    <HStack justify="space-between">
                      <Text fontWeight="bold" textTransform="uppercase">
                        {platform.platform || 'Unknown'}
                      </Text>
                      <Badge colorScheme="blue">
                        ${platform.total_funding_usd ? (platform.total_funding_usd / 1000).toFixed(0) + 'K' : 'N/A'}
                      </Badge>
                    </HStack>
                    <HStack justify="space-between" fontSize="sm" color="gray.600">
                      <Text>{platform.total_projects || 0} projects</Text>
                      <Text>{platform.total_applications || 0} applications</Text>
                    </HStack>
                  </Box>
                ))}
              </CardBody>
            </Card>
          </GridItem>

          {/* Funding Metrics */}
          <GridItem>
            <Card>
              <CardHeader bg="purple.50" borderBottom="1px" borderColor="gray.200">
                <Heading size="sm">Funding Metrics</Heading>
              </CardHeader>
              <CardBody>
                {data?.data?.fundingMetrics?.map((funding: any, index: number) => (
                  <VStack key={index} align="stretch" spacing={2}>
                    <HStack justify="space-between">
                      <Text>Total Funding</Text>
                      <Badge colorScheme="purple">
                        ${funding.total_funding_usd?.toLocaleString() || 'N/A'}
                      </Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Avg per Project</Text>
                      <Badge colorScheme="green">
                        ${funding.avg_funding_per_project?.toLocaleString() || 'N/A'}
                      </Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Projects Funded</Text>
                      <Badge colorScheme="blue">
                        {funding.projects_funded?.toLocaleString() || 'N/A'}
                      </Badge>
                    </HStack>
                  </VStack>
                ))}
              </CardBody>
            </Card>
          </GridItem>

          {/* Cross-Platform Projects */}
          <GridItem colSpan={2}>
            <Card>
              <CardHeader bg="teal.50" borderBottom="1px" borderColor="gray.200">
                <Heading size="sm">Cross-Platform Projects (Top 5)</Heading>
              </CardHeader>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Project Name</Th>
                      <Th>Platforms</Th>
                      <Th isNumeric>Total Funding</Th>
                      <Th>Grant Rounds</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data?.data?.crossPlatform?.map((project: any, index: number) => (
                      <Tr key={index}>
                        <Td fontWeight="medium">{project.project_name || 'Unknown'}</Td>
                        <Td>
                          <Badge colorScheme="blue">{project.platforms_list || 'N/A'}</Badge>
                        </Td>
                        <Td isNumeric fontWeight="bold">
                          ${project.total_funding_across_platforms?.toLocaleString() || '0'}
                        </Td>
                        <Td>{project.total_grant_rounds || '0'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        
      </VStack>
    </Box>
  )
}