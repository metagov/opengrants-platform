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
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { ProgramProfile } from '../../components/ProgramProfile';
import { SupportFooter } from '../../components/SupportFooter';
import { BarChart, PieChart, AreaChart, LineChart, ComposedChart, ChartCard } from '../../components/charts';
import { formatCurrency } from '@/lib/formatters';
import { brandColors } from '../../theme/colors';

interface SCFData {
  metadata: {
    platform: string;
    last_indexed_at: string;
    data_source: string;
    notes: string;
  } | null;
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
    round_id: string;
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
    year: number;
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
    most_recent_payment_date: string;
  }>;
  milestoneProjects: Array<{
    project_name: string;
    round_name: string;
    total_awarded_usd: number;
    total_paid_usd: number;
    tranche_status: string;
    tranche_completion_percent: number;
    most_recent_payment_date: string;
  }>;
  fundingEfficiency: Array<{
    round_name: string;
    round_num: number;
    awarded: number;
    paid: number;
    voters: number;
    projects_funded: number;
    avg_grant_size: number;
  }>;
  categoryPerformance: Array<{
    category: string;
    total_projects: number;
    total_awarded: number;
    total_paid: number;
    avg_completion: number;
    fully_completed: number;
  }>;
  repeatFundingStats: {
    total_funding_instances: number;
    total_unique_projects: number;
    new_projects: number;
    repeat_funded: number;
    funded_twice: number;
    funded_thrice: number;
    funded_four_times: number;
    funded_five_plus: number;
  };
  cohortAnalysis: Array<{
    round_name: string;
    round_num: number;
    repeat_funded_projects: number;
    total_funded_in_round: number;
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
  const [visibleRounds, setVisibleRounds] = useState(10);

  const loadMoreRounds = () => {
    setVisibleRounds(prev => prev + 10);
  };

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

  const quarterlyChartData = (data?.quarterlyData || [])
    .slice()
    .reverse()
    .map(q => ({
      quarter: q.quarter_year,
      projects: Number(q.awarded_submissions) || 0,
      funding: Number(q.total_paid_usd) || 0,
    }));

  const categoryChartData = (data?.categoryData || []).map(c => ({
    name: c.category,
    value: Number(c.project_count) || 0,
    funding: Number(c.total_awarded_usd) || 0,
  }));

  const roundsChartData = (data?.rounds || [])
    .slice(0, 15)
    .reverse()
    .map(r => {
      const roundNum = r.round_name?.match(/#(\d+)/)?.[1] || '';
      return {
        name: `#${roundNum}`,
        fullName: r.round_name || '',
        awarded: Number(r.awarded_submissions) || 0,
        applied: Number(r.applied_submissions) || 0,
      };
    });

  const completionRate = data?.trancheMetrics?.total_paid_usd && data?.trancheMetrics?.total_awarded_usd
    ? ((data.trancheMetrics.total_paid_usd / data.trancheMetrics.total_awarded_usd) * 100).toFixed(1)
    : '0';

  const fundingEfficiencyData = (data?.fundingEfficiency || []).map(r => ({
    round: `#${r.round_num}`,
    awarded: Number(r.awarded) || 0,
    paid: Number(r.paid) || 0,
    paymentRate: r.awarded > 0 ? Math.round((Number(r.paid) / Number(r.awarded)) * 100) : 0,
  }));

  const avgGrantTrendData = (data?.fundingEfficiency || []).map(r => ({
    round: `#${r.round_num}`,
    avgGrant: Number(r.avg_grant_size) || 0,
    voters: Number(r.voters) || 0,
    projects: Number(r.projects_funded) || 0,
  }));

  const categoryPerfData = (data?.categoryPerformance || []).map(c => ({
    category: c.category,
    projects: Number(c.total_projects) || 0,
    awarded: Number(c.total_awarded) || 0,
    paid: Number(c.total_paid) || 0,
    completionRate: c.total_awarded > 0 ? Math.round((Number(c.total_paid) / Number(c.total_awarded)) * 100) : 0,
    avgCompletion: Math.round(Number(c.avg_completion) || 0),
    fullyCompleted: Number(c.fully_completed) || 0,
  }));

  const cohortChartData = (data?.cohortAnalysis || []).map(r => ({
    round: `#${r.round_num}`,
    repeatFunded: Number(r.repeat_funded_projects),
    totalFunded: Number(r.total_funded_in_round),
  }));

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
                  lastIndexedAt={data?.metadata?.last_indexed_at}
                  dataSource={data?.metadata?.data_source}
                />

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <ChartCard title="Quarterly Projects Awarded">
                    <BarChart
                      data={quarterlyChartData}
                      xKey="quarter"
                      bars={[{ dataKey: 'projects', color: brandColors.olive }]}
                      height={300}
                      rotateLabels
                      tooltipFormatter={(value: number) => [String(value), 'Projects']}
                    />
                  </ChartCard>

                  <ChartCard title="Projects by Category">
                    <PieChart
                      data={categoryChartData}
                      colors={CATEGORY_COLORS}
                      height={300}
                      label={({ name, percent }: any) => `${name?.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                      tooltipFormatter={(value: number, name: string, props: any) => [
                        `${value} projects (${formatCurrency(props.payload.funding)})`,
                        name
                      ]}
                    />
                  </ChartCard>
                </SimpleGrid>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Top Funded Projects</Text>
                  <VStack align="stretch" gap={0}>
                    {(data?.topProjects || []).slice(0, 10).map((project, idx) => (
                      <HStack
                        key={idx}
                        justify="space-between"
                        py={3}
                        borderBottomWidth={idx < 9 ? "1px" : "0"}
                        borderColor="gray.100"
                      >
                        <VStack align="start" gap={0}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.800">{project.project_name}</Text>
                          <Text fontSize="xs" color="gray.400">{project.round_name}</Text>
                        </VStack>
                        <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                          {formatCurrency(project.total_paid_usd || project.total_awarded_usd)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

              </VStack>
            </Tabs.Content>

            <Tabs.Content value="analytics">
              <VStack gap={8} align="stretch">
                <Text fontSize="lg" fontWeight="semibold" color={brandColors.olive}>Funding Efficiency Analysis</Text>

                <ChartCard
                  title="Payment Rate by Round"
                  subtitle="Comparing awarded vs paid amounts across rounds (higher % = faster disbursement)"
                  height="350px"
                >
                  <ComposedChart
                    data={fundingEfficiencyData}
                    xKey="round"
                    series={[
                      { type: 'bar', dataKey: 'awarded', name: 'Awarded', color: brandColors.olive, yAxisId: 'left', fillOpacity: 0.6 },
                      { type: 'bar', dataKey: 'paid', name: 'Paid', color: brandColors.teal, yAxisId: 'left' },
                      { type: 'line', dataKey: 'paymentRate', name: 'Payment Rate', color: brandColors.burgundy, yAxisId: 'right', strokeWidth: 2, dot: false },
                    ]}
                    yAxes={[
                      { id: 'left', tickFormatter: (v: number) => formatCurrency(v) },
                      { id: 'right', orientation: 'right', tickFormatter: (v: number) => `${v}%`, domain: [0, 120] },
                    ]}
                    height={350}
                    tooltipFormatter={(value: number, name: string) => {
                      if (name === 'Payment Rate') return [`${value}%`, name];
                      return [formatCurrency(value), name];
                    }}
                    xAxisInterval={2}
                  />
                </ChartCard>

                <Text fontSize="lg" fontWeight="semibold" color={brandColors.olive} mt={4}>Category Performance</Text>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Category Funding Breakdown</Text>
                  <VStack align="stretch" gap={4}>
                    {categoryPerfData.map((cat, idx) => (
                      <HStack key={cat.category} justify="space-between" align="center">
                        <HStack gap={3}>
                          <Box
                            w="12px"
                            h="12px"
                            borderRadius="full"
                            bg={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                          />
                          <Text fontSize="md" fontWeight="medium">{cat.category}</Text>
                        </HStack>
                        <Text fontSize="md" fontWeight="semibold" color="gray.700">{formatCurrency(cat.awarded)}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

                <Text fontSize="lg" fontWeight="semibold" color={brandColors.olive} mt={4}>Trend Analysis</Text>

                <ChartCard
                  title="Average Grant Size Trend"
                  subtitle="How average grant size has evolved over rounds"
                  height="250px"
                >
                  <LineChart
                    data={avgGrantTrendData}
                    xKey="round"
                    lines={[{ dataKey: 'avgGrant', color: brandColors.olive, strokeWidth: 2, dot: { r: 3 } }]}
                    height={250}
                    yTickFormatter={(v: number) => formatCurrency(v)}
                    tooltipFormatter={(value: number) => [formatCurrency(value), 'Avg Grant']}
                    xTickSize="sm"
                    xAxisInterval={4}
                  />
                </ChartCard>

                {/* Voter Participation Trend - commented out for now */}

                <Text fontSize="lg" fontWeight="semibold" color={brandColors.olive} mt={4}>Cohort Analysis</Text>

                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Funding Instances</Text>
                    <Text fontSize="xl" fontWeight="semibold">{data?.repeatFundingStats?.total_funding_instances || 0}</Text>
                    <Text fontSize="xs" color="gray.400">Including repeat funding</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Unique Projects Funded</Text>
                    <Text fontSize="xl" fontWeight="semibold">{data?.repeatFundingStats?.total_unique_projects || 0}</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>New Projects</Text>
                    <Text fontSize="xl" fontWeight="semibold">{data?.repeatFundingStats?.new_projects || 0}</Text>
                    <Text fontSize="xs" color="gray.400">Funded only once</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Repeat-Funded Projects</Text>
                    <Text fontSize="xl" fontWeight="semibold" color={brandColors.olive}>{data?.repeatFundingStats?.repeat_funded || 0}</Text>
                  </Box>
                </SimpleGrid>

                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="gray.50" borderRadius="lg">
                    <Text fontSize="xs" color="gray.500" mb={1}>Funded Twice</Text>
                    <Text fontSize="lg" fontWeight="medium">{data?.repeatFundingStats?.funded_twice || 0}</Text>
                  </Box>
                  <Box p={4} bg="gray.50" borderRadius="lg">
                    <Text fontSize="xs" color="gray.500" mb={1}>Funded Thrice</Text>
                    <Text fontSize="lg" fontWeight="medium">{data?.repeatFundingStats?.funded_thrice || 0}</Text>
                  </Box>
                  <Box p={4} bg="gray.50" borderRadius="lg">
                    <Text fontSize="xs" color="gray.500" mb={1}>Funded Four Times</Text>
                    <Text fontSize="lg" fontWeight="medium">{data?.repeatFundingStats?.funded_four_times || 0}</Text>
                  </Box>
                  <Box p={4} bg="gray.50" borderRadius="lg">
                    <Text fontSize="xs" color="gray.500" mb={1}>Funded Five+ Times</Text>
                    <Text fontSize="lg" fontWeight="medium">{data?.repeatFundingStats?.funded_five_plus || 0}</Text>
                  </Box>
                </SimpleGrid>

                <ChartCard
                  title="Cohort Analysis: Repeat-Funded Projects by Round"
                  subtitle="Which grant rounds had the highest number of repeat-funded projects?"
                >
                  <BarChart
                    data={cohortChartData}
                    xKey="round"
                    bars={[
                      { dataKey: 'repeatFunded', name: 'repeatFunded', color: brandColors.olive },
                      { dataKey: 'totalFunded', name: 'totalFunded', color: brandColors.teal, fillOpacity: 0.5 },
                    ]}
                    height={300}
                    showLegend
                    legendFormatter={(value: string) => value === 'repeatFunded' ? 'Repeat-Funded Projects' : 'Total Funded in Round'}
                    tooltipFormatter={(value: number, name: string) => [String(value), name === 'repeatFunded' ? 'Repeat-Funded' : 'Total Funded']}
                    tickSize="sm"
                    xAxisInterval={2}
                  />
                </ChartCard>

                <ChartCard title="Quarterly Funding Distribution">
                  <AreaChart
                    data={quarterlyChartData}
                    xKey="quarter"
                    areas={[{ dataKey: 'funding', color: brandColors.olive, fillOpacity: 0.3 }]}
                    height={300}
                    rotateLabels
                    yTickFormatter={(v: number) => formatCurrency(v)}
                    tooltipFormatter={(value: number) => [formatCurrency(value), 'Funding']}
                  />
                </ChartCard>
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
                              bg={status.tranche_status?.includes('Complete') ? brandColors.olive : status.tranche_status?.includes('Progress') ? brandColors.teal : 'gray.400'}
                              color="white"
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
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Recent Milestone Activity</Text>
                  <Text fontSize="sm" color="gray.500" mb={6}>
                    Projects with their tranche completion status and most recent payment date.
                  </Text>

                  {(data?.milestoneProjects || []).length > 0 ? (
                    <VStack align="stretch" gap={0}>
                      {(data?.milestoneProjects || []).map((project, idx) => (
                        <HStack
                          key={idx}
                          justify="space-between"
                          py={3}
                          borderBottomWidth={idx < (data?.milestoneProjects?.length || 1) - 1 ? "1px" : "0"}
                          borderColor="gray.100"
                        >
                          <VStack align="start" gap={0} flex={1}>
                            <Text fontSize="sm" fontWeight="medium" color="gray.800">{project.project_name}</Text>
                            <HStack gap={2}>
                              <Text fontSize="xs" color="gray.400">{project.round_name}</Text>
                              {project.most_recent_payment_date && (
                                <Text fontSize="xs" color="gray.500">
                                  Last paid: {new Date(project.most_recent_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </Text>
                              )}
                            </HStack>
                          </VStack>
                          <HStack gap={4}>
                            <Badge
                              bg={project.tranche_completion_percent === 100 ? brandColors.olive : project.tranche_completion_percent > 0 ? brandColors.teal : 'gray.400'}
                              color="white"
                              px={2}
                              py={0.5}
                              fontSize="xs"
                            >
                              {project.tranche_status}
                            </Badge>
                            <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                              {formatCurrency(project.total_paid_usd || project.total_awarded_usd)}
                            </Text>
                          </HStack>
                        </HStack>
                      ))}
                    </VStack>
                  ) : (
                    <Box p={8} textAlign="center" bg="gray.50" borderRadius="lg">
                      <Text color="gray.500">No milestone activity data available yet.</Text>
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
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.500">
                    Showing {Math.min(visibleRounds, data?.rounds?.length || 0)} of {data?.rounds?.length || 0} rounds
                  </Text>
                </HStack>

                {(data?.rounds || []).slice(0, visibleRounds).map((round, idx) => {
                  const roundNum = round.round_name?.match(/#(\d+)/)?.[1];
                  return (
                    <Link key={idx} href={roundNum ? `/system/scf/${roundNum}` : '#'} style={{ textDecoration: 'none' }}>
                      <Box
                        p={6}
                        bg="white"
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor="gray.100"
                        _hover={{ borderColor: 'gray.300', shadow: 'sm', cursor: 'pointer' }}
                        transition="all 0.2s"
                      >
                        <HStack justify="space-between" mb={4}>
                          <VStack align="start" gap={1}>
                            <HStack gap={2}>
                              <Text fontSize="lg" fontWeight="semibold">{round.round_name}</Text>
                              <Text fontSize="sm" color={brandColors.teal}>→</Text>
                            </HStack>
                            <HStack gap={2}>
                              <Badge bg={brandColors.teal} color="white" px={2} py={0.5} borderRadius="md" fontSize="xs">{round.quarter_year}</Badge>
                              <Badge bg="gray.400" color="white" px={2} py={0.5} borderRadius="md" fontSize="xs">{round.round_type}</Badge>
                            </HStack>
                          </VStack>
                          <Text fontSize="2xl" fontWeight="bold" color={brandColors.olive}>
                            {formatCurrency(round.total_paid_usd || round.total_awarded_usd)}
                          </Text>
                        </HStack>
                        <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                          <VStack align="start" gap={0}>
                            <Text fontSize="xs" color="gray.500">Projects</Text>
                            <Text fontSize="md" fontWeight="medium">{round.awarded_submissions}</Text>
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
                    </Link>
                  );
                })}

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
      <SupportFooter />
    </>
  );
}
