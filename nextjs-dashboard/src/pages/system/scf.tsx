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
  AreaChart,
  Area,
} from 'recharts';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { ProgramProfile } from '../../components/ProgramProfile';
import { brandColors } from '../../theme/colors';

interface SCFData {
  summary: {
    total_rounds: number;
    total_awarded: number;
    total_paid: number;
    total_projects_funded: number;
  };
  quarterlyData: Array<{
    quarter_year: string;
    year: number;
    awarded_submissions: number;
    total_awarded_usd: number;
    total_paid_usd: number;
    round_count: number;
  }>;
  categoryData: Array<{
    category: string;
    project_count: number;
    total_awarded_usd: number;
    total_paid_usd: number;
  }>;
  rounds: Array<{
    round_name: string;
    quarter_year: string;
    phase: string;
    round_type: string;
    awarded_submissions: number;
    applied_submissions: number;
    total_awarded_usd: number;
    total_paid_usd: number;
    avg_awarded_usd: number;
    voters_count: number;
  }>;
  trancheMetrics: {
    total_applications: number;
    completed_tranches: number;
    in_progress_tranches: number;
    not_started_tranches: number;
    avg_completion_percent: number;
    total_awarded_usd: number;
    total_paid_usd: number;
  };
  trancheByStatus: Array<{
    tranche_status: string;
    count: number;
    total_awarded_usd: number;
    total_paid_usd: number;
  }>;
  topProjects: Array<{
    project_name: string;
    round_name: string;
    total_awarded_usd: number;
    total_paid_usd: number;
    category: string;
    award_type: string;
    tranche_completion: number;
  }>;
}

const CATEGORY_COLORS = [
  '#8B9A46', // olive
  '#006E7F', // teal
  '#2A0055', // deep purple
  '#800020', // burgundy
  '#E07000', // orange
];

export default function SCFPage() {
  const [data, setData] = useState<SCFData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/systems/scf')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching SCF data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color={brandColors.olive} />
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

  const quarterlyChartData = (data?.quarterlyData || [])
    .slice()
    .reverse()
    .map(q => ({
      quarter: q.quarter_year,
      projects: Number(q.awarded_submissions) || 0,
      funding: Number(q.total_awarded_usd) || 0,
    }));

  const categoryChartData = (data?.categoryData || []).map(c => ({
    name: c.category,
    value: Number(c.project_count) || 0,
    funding: Number(c.total_awarded_usd) || 0,
  }));

  const roundsChartData = (data?.rounds || [])
    .slice(0, 12)
    .reverse()
    .map(r => ({
      name: r.round_name?.replace('SCF ', '').replace('Build Award Round ', 'BAR ') || '',
      awarded: Number(r.awarded_submissions) || 0,
      applied: Number(r.applied_submissions) || 0,
    }));

  const completionRate = data?.trancheMetrics?.total_paid_usd && data?.trancheMetrics?.total_awarded_usd
    ? ((data.trancheMetrics.total_paid_usd / data.trancheMetrics.total_awarded_usd) * 100).toFixed(1)
    : '0';

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Stellar Community Fund"
            description="Supporting innovation on the Stellar network through grants and funding"
            color={brandColors.olive}
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} gap={6} mb={12}>
            <MetricCard
              label="Total Awarded"
              value={formatCurrency(data?.summary?.total_awarded || 0)}
              color={brandColors.olive}
            />
            <MetricCard
              label="Total Paid"
              value={formatCurrency(data?.summary?.total_paid || 0)}
            />
            <MetricCard
              label="Total Rounds"
              value={data?.summary?.total_rounds || 0}
            />
            <MetricCard
              label="Projects Funded"
              value={data?.summary?.total_projects_funded || 0}
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
                _selected={{ color: brandColors.olive, borderColor: brandColors.olive }}
                _hover={{ color: brandColors.olive }}
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
                _selected={{ color: brandColors.olive, borderColor: brandColors.olive }}
                _hover={{ color: brandColors.olive }}
              >
                Analytics
              </Tabs.Trigger>
              <Tabs.Trigger
                value="milestones"
                fontSize="sm"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="gray.500"
                px={4}
                py={3}
                _selected={{ color: brandColors.olive, borderColor: brandColors.olive }}
                _hover={{ color: brandColors.olive }}
              >
                Milestones
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
                _selected={{ color: brandColors.olive, borderColor: brandColors.olive }}
                _hover={{ color: brandColors.olive }}
              >
                Rounds
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="overview">
              <VStack gap={8} align="stretch">
                <ProgramProfile
                  name="Stellar Community Fund"
                  description="The Stellar Community Fund (SCF) is a grant program designed to support projects building on the Stellar network. It provides funding for developers, entrepreneurs, and creators who want to build applications that improve financial access and inclusion. The program operates through Build Award Rounds that evaluate and fund innovative projects across multiple categories."
                  programDescription="SCF funds projects through a structured evaluation process with community voting. Awards are distributed in tranches tied to milestone completion, ensuring accountability and project progress. The fund supports various categories including developer tooling, infrastructure, applications, and education."
                  primaryMechanism="Build Awards"
                  fundingMechanismDescription="Projects receive funding in multiple tranches based on deliverable completion. Typical structure includes pre-launch, testnet, and mainnet phases. Community members vote on project proposals during award rounds."
                  links={[
                    { label: 'Official Website', url: 'https://communityfund.stellar.org' },
                    { label: 'Stellar Foundation', url: 'https://stellar.org' },
                    { label: 'Developer Discord', url: 'https://discord.gg/stellardev' },
                  ]}
                  tags={['Web3', 'Stellar Network', 'Grants']}
                  color={brandColors.olive}
                />

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Quarterly Projects Awarded</Text>
                    <Box h="300px" minH="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={quarterlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="quarter" 
                            tick={{ fill: '#4A5568', fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis tick={{ fill: '#4A5568', fontSize: 11 }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                            formatter={(value: number) => [value, 'Projects']}
                          />
                          <Bar dataKey="projects" fill={brandColors.olive} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Projects by Category</Text>
                    <Box h="300px" minH="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name?.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {categoryChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string, props: any) => [
                              `${value} projects (${formatCurrency(props.payload.funding)})`,
                              name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="analytics">
              <VStack gap={8} align="stretch">
                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Quarterly Funding Distribution</Text>
                  <Box h="350px" minH="350px">
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={quarterlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis 
                          dataKey="quarter" 
                          tick={{ fill: '#4A5568', fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fill: '#4A5568', fontSize: 11 }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                          formatter={(value: number) => [formatCurrency(value), 'Funding']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="funding" 
                          stroke={brandColors.olive} 
                          fill={brandColors.olive}
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Awarded Submissions by Round</Text>
                  <Box h="350px" minH="350px">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={roundsChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis type="number" tick={{ fill: '#4A5568', fontSize: 11 }} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          tick={{ fill: '#4A5568', fontSize: 10 }}
                          width={100}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Bar dataKey="awarded" name="Awarded" fill={brandColors.olive} radius={[0, 4, 4, 0]} />
                        <Bar dataKey="applied" name="Applied" fill={brandColors.teal} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Category Funding Breakdown</Text>
                    <VStack align="stretch" gap={3}>
                      {categoryChartData.map((cat, idx) => (
                        <HStack key={cat.name} justify="space-between">
                          <HStack>
                            <Box w={3} h={3} borderRadius="full" bg={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                            <Text fontSize="sm">{cat.name}</Text>
                          </HStack>
                          <Text fontSize="sm" fontWeight="medium">{formatCurrency(cat.funding)}</Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Top Funded Projects</Text>
                    <VStack align="stretch" gap={2}>
                      {(data?.topProjects || []).slice(0, 5).map((project, idx) => (
                        <HStack key={idx} justify="space-between" py={2} borderBottomWidth={idx < 4 ? "1px" : "0"} borderColor="gray.100">
                          <VStack align="start" gap={0}>
                            <Text fontSize="sm" fontWeight="medium" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{project.project_name}</Text>
                            <Text fontSize="xs" color="gray.500">{project.category}</Text>
                          </VStack>
                          <Text fontSize="sm" fontWeight="semibold" color={brandColors.olive}>
                            {formatCurrency(project.total_awarded_usd)}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="milestones">
              <VStack gap={8} align="stretch">
                <SimpleGrid columns={{ base: 1, md: 4 }} gap={6}>
                  <MetricCard
                    label="Total Applications"
                    value={data?.trancheMetrics?.total_applications || 0}
                    color={brandColors.olive}
                  />
                  <MetricCard
                    label="Completed Tranches"
                    value={data?.trancheMetrics?.completed_tranches || 0}
                  />
                  <MetricCard
                    label="In Progress"
                    value={data?.trancheMetrics?.in_progress_tranches || 0}
                  />
                  <MetricCard
                    label="Disbursement Rate"
                    value={`${completionRate}%`}
                  />
                </SimpleGrid>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Tranche Status Overview</Text>
                  <Text fontSize="sm" color="gray.500" mb={6}>
                    SCF projects receive funding in tranches tied to milestone completion. This shows the current status of all funded projects.
                  </Text>
                  
                  {(data?.trancheByStatus || []).length > 0 ? (
                    <VStack align="stretch" gap={4}>
                      {(data?.trancheByStatus || []).slice(0, 10).map((status, idx) => (
                        <HStack key={idx} justify="space-between" py={3} borderBottomWidth="1px" borderColor="gray.100">
                          <HStack gap={3}>
                            <Badge 
                              colorPalette={status.tranche_status?.includes('Complete') ? 'green' : status.tranche_status?.includes('Progress') ? 'blue' : 'gray'}
                              px={2}
                              py={1}
                            >
                              {status.count}
                            </Badge>
                            <Text fontSize="sm">{status.tranche_status || 'Unknown'}</Text>
                          </HStack>
                          <HStack gap={4}>
                            <VStack align="end" gap={0}>
                              <Text fontSize="xs" color="gray.500">Awarded</Text>
                              <Text fontSize="sm" fontWeight="medium">{formatCurrency(status.total_awarded_usd)}</Text>
                            </VStack>
                            <VStack align="end" gap={0}>
                              <Text fontSize="xs" color="gray.500">Paid</Text>
                              <Text fontSize="sm" fontWeight="medium" color={brandColors.olive}>{formatCurrency(status.total_paid_usd)}</Text>
                            </VStack>
                          </HStack>
                        </HStack>
                      ))}
                    </VStack>
                  ) : (
                    <Box p={8} textAlign="center" bg="gray.50" borderRadius="lg">
                      <Text color="gray.500">Milestone tracking data is being collected and will be available soon.</Text>
                    </Box>
                  )}
                </Box>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={2}>About SCF Milestones</Text>
                  <Text fontSize="sm" color="gray.600" lineHeight="tall">
                    SCF projects typically receive funding in three tranches: Pre-Launch (33%), Testnet deployment (33%), 
                    and Mainnet launch (34%). Each tranche is unlocked upon successful review of deliverables. 
                    This structure ensures accountability and allows the community to track project progress effectively.
                  </Text>
                </Box>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="rounds">
              <VStack gap={6} align="stretch">
                {(data?.rounds || []).slice(0, 15).map((round, idx) => (
                  <Box key={idx} p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <HStack justify="space-between" mb={4}>
                      <VStack align="start" gap={1}>
                        <Text fontSize="lg" fontWeight="semibold">{round.round_name}</Text>
                        <HStack gap={2}>
                          <Badge colorPalette="blue">{round.quarter_year}</Badge>
                          <Badge colorPalette="gray">{round.round_type}</Badge>
                        </HStack>
                      </VStack>
                      <Text fontSize="2xl" fontWeight="bold" color={brandColors.olive}>
                        {formatCurrency(round.total_awarded_usd)}
                      </Text>
                    </HStack>
                    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Awarded</Text>
                        <Text fontSize="md" fontWeight="medium">{round.awarded_submissions} projects</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Applied</Text>
                        <Text fontSize="md" fontWeight="medium">{round.applied_submissions || 'N/A'}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Avg Award</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.avg_awarded_usd)}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Paid Out</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.total_paid_usd)}</Text>
                      </VStack>
                    </SimpleGrid>
                  </Box>
                ))}
              </VStack>
            </Tabs.Content>
          </Tabs.Root>
        </Container>
      </Box>
    </>
  );
}
