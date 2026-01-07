import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Button,
} from '@chakra-ui/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { ProgramProfile } from '../../components/ProgramProfile';
import { brandColors } from '../../theme/colors';

interface GivethRound {
  round_id: string;
  round_name: string;
  title: string;
  slug: string;
  begin_date: string;
  close_date: string;
  is_open: boolean;
  donations_usd: number;
  matching_pool: number;
  unique_donors: number;
  donations_count: number;
  token_symbol: string;
  qf_strategy: string;
}

interface GivethData {
  metadata?: {
    platform: string;
    last_indexed_at: string;
    data_source: string;
    notes: string;
  };
  summary: {
    total_rounds: number;
    total_donations: number;
    total_matching: number;
    total_distributed: number;
    total_unique_donors: number;
    total_donation_count: number;
    total_projects: number;
  };
  rounds: GivethRound[];
  topProjects: Array<{
    project_name: string;
    slug: string;
    total_donations: number;
    unique_donors: number;
    verification_status: string;
    impact_location: string;
  }>;
  verificationBreakdown: Array<{
    status: string;
    count: number;
  }>;
}

const COLORS = [
  brandColors.deepPurple,
  brandColors.teal,
  brandColors.olive,
  '#800020',
  '#E07000',
];

export default function GivethPage() {
  const [data, setData] = useState<GivethData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleRounds, setVisibleRounds] = useState(10);

  const loadMoreRounds = () => {
    setVisibleRounds(prev => prev + 10);
  };

  useEffect(() => {
    fetch('/api/systems/giveth')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Giveth data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color={brandColors.deepPurple} />
        </Center>
      </>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value?.toFixed(0) || 0}`;
  };

  const roundsChartData = (data?.rounds || []).slice(0, 12).reverse().map(r => ({
    name: r.title?.substring(0, 15) || r.round_name?.substring(0, 15) || '',
    donations: Number(r.donations_usd) || 0,
    matching: Number(r.matching_pool) || 0,
    donors: Number(r.unique_donors) || 0,
  }));

  const verificationData = (data?.verificationBreakdown || []).map(v => ({
    name: v.status || 'Unknown',
    value: Number(v.count) || 0,
  }));

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Giveth"
            description="Building the future of giving through blockchain technology"
            color={brandColors.deepPurple}
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} gap={6} mb={12}>
            <MetricCard
              label="Total Donations"
              value={formatCurrency(data?.summary?.total_donations || 0)}
              color={brandColors.deepPurple}
            />
            <MetricCard
              label="Matching Pools"
              value={formatCurrency(data?.summary?.total_matching || 0)}
            />
            <MetricCard
              label="QF Rounds"
              value={data?.summary?.total_rounds || 0}
            />
            <MetricCard
              label="Projects"
              value={data?.summary?.total_projects || 0}
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
                _selected={{ color: brandColors.deepPurple, borderColor: brandColors.deepPurple }}
                _hover={{ color: brandColors.deepPurple }}
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
                _selected={{ color: brandColors.deepPurple, borderColor: brandColors.deepPurple }}
                _hover={{ color: brandColors.deepPurple }}
              >
                Analytics
              </Tabs.Trigger>
              <Tabs.Trigger
                value="rounds"
                fontSize="sm"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="gray.500"
                px={4}
                py={3}
                _selected={{ color: brandColors.deepPurple, borderColor: brandColors.deepPurple }}
                _hover={{ color: brandColors.deepPurple }}
              >
                Rounds
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="overview">
              <VStack gap={8} align="stretch">
                <ProgramProfile
                  name="Giveth"
                  description="Giveth is a community-driven platform that connects donors with impactful projects. Through blockchain technology, Giveth ensures transparent and efficient fund distribution while rewarding donors with GIV tokens through their innovative GIVbacks program."
                  programDescription="Giveth operates Quadratic Funding rounds that amplify community donations with matching funds. Projects are verified for legitimacy and impact, ensuring donor contributions go to genuine causes. The platform supports multiple chains including Ethereum, Gnosis, Polygon, and Optimism."
                  primaryMechanism="Quadratic Funding"
                  fundingMechanismDescription="Donations are matched using the quadratic funding formula, which prioritizes projects with broad community support over those with few large donors. This democratic approach ensures funding reflects community preferences."
                  links={[
                    { label: 'Official Website', url: 'https://giveth.io' },
                    { label: 'Giveth Docs', url: 'https://docs.giveth.io' },
                    { label: 'Discord', url: 'https://discord.giveth.io' },
                  ]}
                  tags={['Web3', 'Ethereum', 'Quadratic Funding', 'GIVbacks']}
                  color={brandColors.deepPurple}
                  lastIndexedAt={data?.metadata?.last_indexed_at}
                  dataSource={data?.metadata?.data_source}
                />

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Funding by Round</Text>
                    <Box h="300px" minH="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={roundsChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fill: '#4A5568', fontSize: 9 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            tick={{ fill: '#4A5568', fontSize: 11 }}
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                            formatter={(value: number, name: string) => [formatCurrency(value), name === 'donations' ? 'Donations' : 'Matching']}
                          />
                          <Legend />
                          <Bar dataKey="donations" name="Donations" fill={brandColors.deepPurple} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="matching" name="Matching" fill={brandColors.teal} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Project Verification Status</Text>
                    <Box h="300px" minH="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={verificationData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name?.substring(0, 10)} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {verificationData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [value, 'Projects']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="analytics">
              <VStack gap={8} align="stretch">
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Top Funded Projects</Text>
                    <VStack align="stretch" gap={2}>
                      {(data?.topProjects || []).slice(0, 5).map((project, idx) => (
                        <HStack key={idx} justify="space-between" py={2} borderBottomWidth={idx < 4 ? "1px" : "0"} borderColor="gray.100" gap={4}>
                          <Box flex="1" minW="0" overflow="hidden">
                            <Text fontSize="sm" fontWeight="medium" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{project.project_name}</Text>
                            <Text fontSize="xs" color="gray.500">{project.unique_donors} donors</Text>
                          </Box>
                          <Text fontSize="sm" fontWeight="semibold" color={brandColors.deepPurple} flexShrink={0}>
                            {formatCurrency(project.total_donations)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Platform Statistics</Text>
                    <VStack align="stretch" gap={3}>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Total Unique Donors</Text>
                        <Text fontSize="sm" fontWeight="medium">{(data?.summary?.total_unique_donors || 0).toLocaleString()}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Total Donation Count</Text>
                        <Text fontSize="sm" fontWeight="medium">{(data?.summary?.total_donation_count || 0).toLocaleString()}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Average per Donation</Text>
                        <Text fontSize="sm" fontWeight="medium">
                          {formatCurrency((data?.summary?.total_donations || 0) / (data?.summary?.total_donation_count || 1))}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="gray.600">Total Distributed</Text>
                        <Text fontSize="sm" fontWeight="medium" color={brandColors.deepPurple}>
                          {formatCurrency(data?.summary?.total_distributed || 0)}
                        </Text>
                      </HStack>
                    </VStack>
                  </Box>
                </SimpleGrid>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={2}>About Giveth QF Rounds</Text>
                  <Text fontSize="sm" color="gray.600" lineHeight="tall">
                    Giveth runs Quadratic Funding rounds that match community donations with additional funds from sponsors. 
                    The QF mechanism ensures that projects with broader community support receive proportionally more matching funds, 
                    democratizing grant allocation. Projects must be verified to participate, ensuring legitimacy and impact.
                  </Text>
                </Box>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="rounds">
              <VStack gap={6} align="stretch">
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.500">
                    Showing {Math.min(visibleRounds, data?.rounds?.length || 0)} of {data?.rounds?.length || 0} rounds
                  </Text>
                </HStack>
                
                {(data?.rounds || []).slice(0, visibleRounds).map((round, idx) => (
                  <Box 
                    key={idx}
                    p={6} 
                    bg="white" 
                    borderRadius="lg" 
                    borderWidth="1px" 
                    borderColor="gray.100"
                  >
                    <HStack justify="space-between" mb={4}>
                      <VStack align="start" gap={1}>
                        <Text fontSize="lg" fontWeight="semibold">{round.title || round.round_name}</Text>
                        <HStack gap={2}>
                          <Badge colorPalette={round.is_open ? 'green' : 'gray'}>
                            {round.is_open ? 'Active' : 'Closed'}
                          </Badge>
                          {round.qf_strategy && (
                            <Badge colorPalette="purple">{round.qf_strategy}</Badge>
                          )}
                          {round.token_symbol && (
                            <Badge colorPalette="blue">{round.token_symbol}</Badge>
                          )}
                        </HStack>
                      </VStack>
                      <Text fontSize="2xl" fontWeight="bold" color={brandColors.deepPurple}>
                        {formatCurrency((Number(round.donations_usd) || 0) + (Number(round.matching_pool) || 0))}
                      </Text>
                    </HStack>
                    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Donations</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.donations_usd || 0)}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Matching Pool</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.matching_pool || 0)}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Unique Donors</Text>
                        <Text fontSize="md" fontWeight="medium">{(round.unique_donors || 0).toLocaleString()}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Donations</Text>
                        <Text fontSize="md" fontWeight="medium">{(round.donations_count || 0).toLocaleString()}</Text>
                      </VStack>
                    </SimpleGrid>
                  </Box>
                ))}

                {visibleRounds < (data?.rounds?.length || 0) && (
                  <Center>
                    <Button 
                      onClick={loadMoreRounds}
                      variant="outline"
                      colorPalette="gray"
                      size="lg"
                    >
                      Load More Rounds ({(data?.rounds?.length || 0) - visibleRounds} remaining)
                    </Button>
                  </Center>
                )}
              </VStack>
            </Tabs.Content>
          </Tabs.Root>
        </Container>
      </Box>
    </>
  );
}
