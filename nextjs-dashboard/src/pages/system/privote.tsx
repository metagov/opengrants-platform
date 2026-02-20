import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  HStack,
  Text,
  Spinner,
  Center,
  Tabs,
  Badge,
  Table,
} from '@chakra-ui/react';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { ProgramProfile } from '../../components/ProgramProfile';
import { BarChart, ChartCard } from '../../components/charts';
import { formatETH, formatCurrency } from '@/lib/formatters';
import { brandColors } from '../../theme/colors';

interface PrivoteData {
  metadata?: {
    platform: string;
    last_indexed_at: string;
    data_source: string;
    notes: string;
  };
  summary: {
    total_projects: number;
    total_allocated: number;
    total_votes: number;
    avg_allocation: number;
    max_allocation: number;
    min_allocation: number;
    total_applications: number;
    total_approved_usd: number;
    total_asked_usd: number;
  };
  allocations: Array<{
    rank: number;
    medal: string;
    project_name: string;
    allocation_eth: number;
    token: string;
    votes: number;
    recipient_index: number;
  }>;
  round?: {
    round_id: string;
    round_name: string;
    description: string;
    pool_size_usd: string;
    chain: string;
  };
  topApplications: Array<{
    project_name: string;
    description: string;
    funds_approved_usd: number;
    funds_asked_usd: number;
    status: string;
    grant_pool_name: string;
    rank: number;
    votes: number;
  }>;
}

export default function PrivotePage() {
  const [data, setData] = useState<PrivoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/systems/privote')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Privote data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color={brandColors.teal} />
        </Center>
      </>
    );
  }

  const getMedalEmoji = (medal: string) => {
    const medals: { [key: string]: string } = {
      'Gold': '1',
      'Silver': '2',
      'Bronze': '3'
    };
    return medals[medal] || '';
  };

  const allocationChartData = (data?.allocations || []).slice(0, 15).map(a => ({
    name: a.project_name?.substring(0, 12) || `#${a.rank}`,
    allocation: Number(a.allocation_eth) || 0,
    votes: Number(a.votes) || 0,
  }));

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Privote (GG24 Privacy)"
            description="Privacy-preserving quadratic funding with zero-knowledge proofs"
            color={brandColors.teal}
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} gap={6} mb={12}>
            <MetricCard
              label="Total Allocated"
              value={formatETH(data?.summary?.total_allocated || 0)}
              color={brandColors.teal}
            />
            <MetricCard
              label="Total Projects"
              value={data?.summary?.total_projects || 0}
            />
            <MetricCard
              label="Total Votes"
              value={(data?.summary?.total_votes || 0).toLocaleString()}
            />
            <MetricCard
              label="Avg per Project"
              value={formatETH(data?.summary?.avg_allocation || 0)}
            />
          </SimpleGrid>

          <Tabs.Root defaultValue="overview" variant="line">
            <Tabs.List borderBottomWidth="1px" borderColor="gray.200" mb={8} gap={2}>
              <Tabs.Trigger
                value="overview"
                fontSize="sm"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="gray.500"
                px={4}
                py={3}
                _selected={{ color: brandColors.teal, borderColor: brandColors.teal }}
                _hover={{ color: brandColors.teal }}
              >
                Overview
              </Tabs.Trigger>
              <Tabs.Trigger
                value="analytics"
                fontSize="sm"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="gray.500"
                px={4}
                py={3}
                _selected={{ color: brandColors.teal, borderColor: brandColors.teal }}
                _hover={{ color: brandColors.teal }}
              >
                Analytics
              </Tabs.Trigger>
              <Tabs.Trigger
                value="allocations"
                fontSize="sm"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="gray.500"
                px={4}
                py={3}
                _selected={{ color: brandColors.teal, borderColor: brandColors.teal }}
                _hover={{ color: brandColors.teal }}
              >
                Allocations
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="overview">
              <VStack gap={8} align="stretch">
                <ProgramProfile
                  name="Privote (GG24 Privacy Round)"
                  description="Privote is a privacy-preserving quadratic funding platform developed for Gitcoin Grants Round 24. It enables communities to democratically allocate resources while maintaining voter privacy through MACI (Minimum Anti-Collusion Infrastructure) and zero-knowledge proofs."
                  programDescription="The GG24 Privacy Round allocated funds to projects focused on privacy, security, and decentralized infrastructure. Votes were cast privately using MACI, ensuring that individual voting choices remain confidential while the final allocation results are publicly verifiable."
                  primaryMechanism="Private Quadratic Funding (MACI)"
                  fundingMechanismDescription="Privote uses MACI to enable private voting while preventing bribery and collusion. Voters submit encrypted votes which are tallied using zero-knowledge proofs, ensuring privacy while maintaining verifiability. The quadratic funding formula is then applied to determine allocations."
                  links={[
                    { label: 'MACI Documentation', url: 'https://maci.pse.dev' },
                    { label: 'Gitcoin Grants', url: 'https://grants.gitcoin.co' },
                    { label: 'Privacy & Scaling Explorations', url: 'https://pse.dev' },
                  ]}
                  tags={['Web3', 'Privacy', 'Zero-Knowledge', 'MACI', 'Arbitrum']}
                  color={brandColors.teal}
                  lastIndexedAt={data?.metadata?.last_indexed_at}
                  dataSource={data?.metadata?.data_source}
                />

                <ChartCard title="Allocation Distribution (Top 15 Projects)" height="350px">
                  <BarChart
                    data={allocationChartData}
                    xKey="name"
                    bars={[{ dataKey: 'allocation', name: 'Allocation (ETH)', color: brandColors.teal }]}
                    height={350}
                    rotateLabels
                    tickSize="xs"
                    tooltipFormatter={(value: number, name: string) => [
                      name === 'allocation' ? formatETH(value) : value.toLocaleString(),
                      name === 'allocation' ? 'Allocation' : 'Votes'
                    ]}
                    yAxes={[{
                      id: 'left',
                      tickFormatter: (value: number) => `${value.toFixed(2)}`,
                    }]}
                  />
                </ChartCard>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="analytics">
              <VStack gap={8} align="stretch">
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Round Statistics</Text>
                    <VStack align="stretch" gap={3}>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Total Applications</Text>
                        <Text fontSize="sm" fontWeight="medium">{data?.summary?.total_applications || 0}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Projects Funded</Text>
                        <Text fontSize="sm" fontWeight="medium">{data?.summary?.total_projects || 0}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Total Votes Cast</Text>
                        <Text fontSize="sm" fontWeight="medium">{(data?.summary?.total_votes || 0).toLocaleString()}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Max Allocation</Text>
                        <Text fontSize="sm" fontWeight="medium">{formatETH(data?.summary?.max_allocation)}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Min Allocation</Text>
                        <Text fontSize="sm" fontWeight="medium">{formatETH(data?.summary?.min_allocation)}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Funds Approved (USD)</Text>
                        <Text fontSize="sm" fontWeight="medium" color={brandColors.teal}>
                          {formatCurrency(data?.summary?.total_approved_usd || 0)}
                        </Text>
                      </HStack>
                    </VStack>
                  </Box>

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Top 5 Projects by Allocation</Text>
                    <VStack align="stretch" gap={2}>
                      {(data?.allocations || []).slice(0, 5).map((project, idx) => (
                        <HStack key={idx} justify="space-between" py={2} borderBottomWidth={idx < 4 ? "1px" : "0"} borderColor="gray.100" gap={4}>
                          <HStack gap={2} flex="1" minW="0" overflow="hidden">
                            <Badge colorPalette="teal" size="sm">#{project.rank}</Badge>
                            <Text fontSize="sm" fontWeight="medium" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                              {project.project_name}
                            </Text>
                          </HStack>
                          <Text fontSize="sm" fontWeight="semibold" color={brandColors.teal} flexShrink={0}>
                            {formatETH(project.allocation_eth)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                </SimpleGrid>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={2}>About Privacy-Preserving Voting</Text>
                  <Text fontSize="sm" color="gray.600" lineHeight="tall">
                    Privote uses MACI (Minimum Anti-Collusion Infrastructure) to enable private voting in quadratic funding.
                    MACI ensures that voters cannot prove how they voted, preventing bribery and vote-buying.
                    The system uses zero-knowledge proofs to verify vote tallies without revealing individual votes,
                    combining the democratic benefits of quadratic funding with strong privacy guarantees.
                  </Text>
                </Box>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="allocations">
              <Box bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100" overflow="hidden">
                <Box p={6} borderBottomWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold">All Project Allocations</Text>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Showing {data?.allocations?.length || 0} projects ranked by final allocation
                  </Text>
                </Box>
                <Box overflowX="auto">
                  <Table.Root size="sm">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader px={4} py={3}>Rank</Table.ColumnHeader>
                        <Table.ColumnHeader px={4} py={3}>Project</Table.ColumnHeader>
                        <Table.ColumnHeader px={4} py={3} textAlign="end">Allocation</Table.ColumnHeader>
                        <Table.ColumnHeader px={4} py={3} textAlign="end">Votes</Table.ColumnHeader>
                        <Table.ColumnHeader px={4} py={3}>Token</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {(data?.allocations || []).map((project, idx) => (
                        <Table.Row key={idx}>
                          <Table.Cell px={4} py={3}>
                            <HStack gap={2}>
                              <Text fontWeight="bold">#{project.rank}</Text>
                              {project.medal && (
                                <Badge colorPalette={project.medal === 'Gold' ? 'yellow' : project.medal === 'Silver' ? 'gray' : 'orange'} size="sm">
                                  {project.medal}
                                </Badge>
                              )}
                            </HStack>
                          </Table.Cell>
                          <Table.Cell px={4} py={3} fontWeight="medium">{project.project_name}</Table.Cell>
                          <Table.Cell px={4} py={3} textAlign="end" fontWeight="medium" color={brandColors.teal}>
                            {formatETH(project.allocation_eth)}
                          </Table.Cell>
                          <Table.Cell px={4} py={3} textAlign="end">{(Number(project.votes) || 0).toLocaleString()}</Table.Cell>
                          <Table.Cell px={4} py={3}>
                            <Badge colorPalette="teal" variant="subtle">
                              {project.token}
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Box>
            </Tabs.Content>
          </Tabs.Root>
        </Container>
      </Box>
    </>
  );
}
