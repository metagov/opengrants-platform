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
  Button,
  Progress,
} from '@chakra-ui/react';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { ProgramProfile } from '../../components/ProgramProfile';
import { SupportFooter } from '../../components/SupportFooter';
import { BarChart, PieChart, ComposedChart, ChartCard } from '../../components/charts';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { gitcoinColors } from '../../theme/colors';

interface GitcoinData {
  summary: {
    total_grant_pools: number;
    active_grant_pools: number;
    total_matching_pool_usd: number;
    total_donated_via_rounds_usd: number;
    total_distributed_usd: number;
    total_projects: number;
    total_applications: number;
    approved_applications: number;
    rejected_applications: number;
    pending_applications: number;
    total_donations: number;
    total_donated_usd: number;
    unique_donors: number;
    avg_donation_usd: number;
    total_payouts: number;
    total_paid_out_usd: number;
    unique_chains: number;
    qf_rounds: number;
    direct_grant_rounds: number;
  };
  chainMetrics: Array<{
    chain_id: number;
    chain_name: string;
    round_count: number;
    active_rounds: number;
    total_matching_pool_usd: number;
    total_distributed_usd: number;
    project_count: number;
    application_count: number;
    approved_applications: number;
    approval_rate_pct: number;
    donation_count: number;
    donation_volume_usd: number;
    unique_donors: number;
    payout_count: number;
    payout_volume_usd: number;
    total_funding_volume_usd: number;
  }>;
  donationMetrics: {
    total_donations: number;
    total_donated_usd: number;
    unique_donors: number;
    avg_donation_usd: number;
    median_donation_usd: number;
    one_time_donors: number;
    repeat_donors: number;
    repeat_donor_percentage: number;
    rounds_with_donations: number;
    projects_with_donations: number;
  };
  topRounds: Array<{
    round_id: string;
    round_name: string;
    funding_mechanism: string;
    is_active: boolean;
    chain_id: number;
    strategy_name: string;
    matching_pool_usd: number;
    total_donations_count: number;
    unique_donors_count: number;
    total_amount_donated_usd: number;
    total_distributed_usd: number;
    total_applications: number;
    approved_applications: number;
    approval_rate_pct: number;
    verified_donations_usd: number;
    payouts_total_usd: number;
    donations_start: string;
    donations_end: string;
  }>;
  fundingMechanisms: Array<{
    mechanism: string;
    round_count: number;
    total_pool_usd: number;
    total_donated_usd: number;
  }>;
  topProjects: Array<{
    id: string;
    project_name: string;
    chain_id: number;
    application_count: number;
    rounds_participated: number;
    total_funds_approved: number;
  }>;
  donationDistribution: Array<{
    range: string;
    donation_count: number;
    total_amount: number;
  }>;
  donationTrends: Array<{
    month: string;
    donation_count: number;
    total_donated: number;
    unique_donors: number;
  }>;
  applicationStats: Array<{
    status: string;
    count: number;
    total_funds: number;
  }>;
  roundStatus: Array<{
    is_open: boolean;
    count: number;
    total_pool_usd: number;
  }>;
  roundsByYear: Array<{
    year: number;
    round_count: number;
    total_matching_usd: number;
    total_donated_usd: number;
    total_donors: number;
  }>;
}

const CHAIN_COLORS = [
  '#00433B',
  '#6F3FF5',
  '#15B8A6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#10B981',
  '#3B82F6',
  '#F97316',
  '#14B8A6',
];

const STATUS_COLORS: { [key: string]: string } = {
  approved:   '#10B981',
  funded:     '#00433B',
  pending:    '#F59E0B',
  rejected:   '#EF4444',
  in_review:  '#3B82F6',
  completed:  '#6F3FF5',
  cancelled:  '#9CA3AF',
};

export default function GitcoinPage() {
  const [data, setData] = useState<GitcoinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleRounds, setVisibleRounds] = useState(10);

  useEffect(() => {
    fetch('/api/systems/gitcoin')
      .then(res => res.json())
      .then(d => {
        if (d.message === 'Internal server error') {
          setError(d.error || 'Failed to load data');
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <VStack gap={4}>
            <Spinner size="xl" color={gitcoinColors.primary} />
            <Text color="gray.500" fontSize="sm">Loading Gitcoin 2.0 historical data…</Text>
          </VStack>
        </Center>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <VStack gap={4} maxW="lg" textAlign="center">
            <Text fontSize="2xl">⚠️</Text>
            <Text fontWeight="semibold">Data pipeline not yet run</Text>
            <Text fontSize="sm" color="gray.500">
              Run the <strong>bronze_gitcoin2_job</strong> → <strong>silver_gitcoin2_etl_job</strong> → <strong>gold_dbt_job</strong> in Dagster to load the historical data.
            </Text>
            <Box p={3} bg="gray.100" borderRadius="md" fontSize="xs" fontFamily="mono" color="gray.700" w="full" textAlign="left">
              {error}
            </Box>
          </VStack>
        </Center>
      </>
    );
  }

  // Chart data transformations
  const chainChartData = (data?.chainMetrics || []).map((c, idx) => ({
    name: c.chain_name,
    funding: Number(c.total_funding_volume_usd) || 0,
    rounds: Number(c.round_count) || 0,
    donations: Number(c.donation_volume_usd) || 0,
    color: CHAIN_COLORS[idx % CHAIN_COLORS.length],
  }));

  const mechanismChartData = (data?.fundingMechanisms || []).map(m => ({
    name: m.mechanism || 'Other',
    value: Number(m.round_count) || 0,
    funding: Number(m.total_pool_usd) || 0,
  }));

  const donationDistData = (data?.donationDistribution || []).map(d => ({
    range: d.range,
    count: Number(d.donation_count) || 0,
    amount: Number(d.total_amount) || 0,
  }));

  const trendData = (data?.donationTrends || []).map(t => ({
    month: t.month,
    donations: Number(t.total_donated) || 0,
    donors: Number(t.unique_donors) || 0,
    count: Number(t.donation_count) || 0,
  }));

  const applicationStatusData = (data?.applicationStats || []).map(s => ({
    name: s.status,
    value: Number(s.count) || 0,
    funds: Number(s.total_funds) || 0,
  }));

  const applicationStatusColors = applicationStatusData.map((entry, idx) =>
    STATUS_COLORS[entry.name] || CHAIN_COLORS[idx % CHAIN_COLORS.length]
  );

  const yearlyData = (data?.roundsByYear || []).map(y => ({
    year: String(y.year),
    rounds: Number(y.round_count) || 0,
    matching: Number(y.total_matching_usd) || 0,
    donated: Number(y.total_donated_usd) || 0,
    donors: Number(y.total_donors) || 0,
  }));

  const approvalRate = (data?.summary?.total_applications || 0) > 0
    ? (((data?.summary?.approved_applications || 0) / data!.summary.total_applications) * 100).toFixed(1)
    : '0';

  const totalFunding = (data?.summary?.total_matching_pool_usd || 0) + (data?.summary?.total_donated_usd || 0);

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Gitcoin 2.0"
            description="Complete historical record of Gitcoin Grants Stack — 497k donations, 2.3k rounds, 14k projects across multiple chains"
            color={gitcoinColors.primary}
          />

          {/* Top-line KPIs */}
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={6} mb={12}>
            <MetricCard
              label="Total Funding"
              value={formatCurrency(totalFunding)}
              color={gitcoinColors.primary}
            />
            <MetricCard
              label="Unique Donors"
              value={formatNumber(data?.summary?.unique_donors || 0)}
            />
            <MetricCard
              label="Grant Rounds"
              value={formatNumber(data?.summary?.total_grant_pools || 0)}
            />
            <MetricCard
              label="Blockchains"
              value={data?.summary?.unique_chains || 0}
            />
          </SimpleGrid>

          <Tabs.Root defaultValue="overview" variant="line">
            <Tabs.List borderBottomWidth="1px" borderColor="gray.200" mb={8} gap={2}>
              {['overview', 'analytics', 'chains', 'rounds', 'history'].map(tab => (
                <Tabs.Trigger
                  key={tab}
                  value={tab}
                  fontSize="sm"
                  fontWeight="medium"
                  letterSpacing="wide"
                  textTransform="uppercase"
                  color="gray.500"
                  px={4}
                  py={3}
                  _selected={{ color: gitcoinColors.primary, borderColor: gitcoinColors.primary }}
                  _hover={{ color: gitcoinColors.primary }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* ── OVERVIEW TAB ────────────────────────────────────── */}
            <Tabs.Content value="overview">
              <VStack gap={8} align="stretch">
                <ProgramProfile
                  name="Gitcoin 2.0 (Grants Stack)"
                  description="Gitcoin Grants Stack is the decentralized grants infrastructure powering quadratic funding across the Ethereum ecosystem. This dataset represents the complete historical record from the March 2026 snapshot."
                  programDescription="The platform supports Quadratic Funding (QF), Direct Grants, and other mechanisms. Projects apply to community-run rounds, receive donations from the community, and matching funds are distributed proportionally to the breadth of community support."
                  primaryMechanism="Quadratic Funding"
                  fundingMechanismDescription="Quadratic Funding amplifies impact of small donations: the matching amount is proportional to the square of the sum of square roots of contributions. A project with 100 donors of $1 receives more matching than one with 1 donor of $100."
                  links={[
                    { label: 'Gitcoin', url: 'https://gitcoin.co' },
                    { label: 'Grants Stack', url: 'https://www.gitcoin.co/grants-stack' },
                    { label: 'Explorer', url: 'https://explorer.gitcoin.co' },
                  ]}
                  tags={['Web3', 'Quadratic Funding', 'Multi-chain', 'Historical Data']}
                  color={gitcoinColors.primary}
                  lastIndexedAt="2026-03-17"
                  dataSource="CSV Snapshot — 17 March 2026"
                />

                {/* Secondary KPIs */}
                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Donated</Text>
                    <Text fontSize="xl" fontWeight="semibold" color={gitcoinColors.primary}>
                      {formatCurrency(data?.summary?.total_donated_usd || 0)}
                    </Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data?.summary?.total_donations || 0)} donations</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Matching Pool</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatCurrency(data?.summary?.total_matching_pool_usd || 0)}
                    </Text>
                    <Text fontSize="xs" color="gray.400">{data?.summary?.qf_rounds || 0} QF rounds</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Projects</Text>
                    <Text fontSize="xl" fontWeight="semibold">{formatNumber(data?.summary?.total_projects || 0)}</Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data?.summary?.total_applications || 0)} applications</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Approval Rate</Text>
                    <Text fontSize="xl" fontWeight="semibold">{approvalRate}%</Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data?.summary?.approved_applications || 0)} approved</Text>
                  </Box>
                </SimpleGrid>

                {/* Top projects */}
                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Top Funded Projects</Text>
                  <VStack align="stretch" gap={0}>
                    {(data?.topProjects || []).slice(0, 10).map((project, idx) => (
                      <HStack
                        key={idx}
                        justify="space-between"
                        py={3}
                        borderBottomWidth={idx < 9 ? '1px' : '0'}
                        borderColor="gray.100"
                      >
                        <VStack align="start" gap={0}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.800">
                            {project.project_name || `Project ${project.id?.slice(0, 8)}`}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {project.rounds_participated} round{project.rounds_participated !== 1 ? 's' : ''}
                          </Text>
                        </VStack>
                        <Text fontSize="sm" fontWeight="semibold" color={gitcoinColors.primary}>
                          {formatCurrency(project.total_funds_approved)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

                {/* Charts row */}
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <ChartCard title="Funding by Chain">
                    <BarChart
                      data={chainChartData.slice(0, 8)}
                      xKey="name"
                      bars={[{ dataKey: 'funding', color: gitcoinColors.primary }]}
                      layout="vertical"
                      height={300}
                      tooltipFormatter={(value: number) => [formatCurrency(value), 'Total Funding']}
                    />
                  </ChartCard>

                  <ChartCard title="Funding Mechanisms">
                    <PieChart
                      data={mechanismChartData}
                      colors={CHAIN_COLORS}
                      height={300}
                      label={({ name, percent }: any) => `${name?.split(' ')[0] || 'Other'} ${(percent * 100).toFixed(0)}%`}
                      tooltipFormatter={(value: number, name: string, props: any) => [
                        `${value} rounds (${formatCurrency(props.payload.funding)})`,
                        name,
                      ]}
                    />
                  </ChartCard>
                </SimpleGrid>
              </VStack>
            </Tabs.Content>

            {/* ── ANALYTICS TAB ───────────────────────────────────── */}
            <Tabs.Content value="analytics">
              <VStack gap={8} align="stretch">
                <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>Donation Analytics</Text>

                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Avg Donation</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatCurrency(data?.donationMetrics?.avg_donation_usd || 0)}
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Median Donation</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatCurrency(data?.donationMetrics?.median_donation_usd || 0)}
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Repeat Donors</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatNumber(data?.donationMetrics?.repeat_donors || 0)}
                    </Text>
                    <Text fontSize="xs" color="gray.400">
                      {(data?.donationMetrics?.repeat_donor_percentage || 0).toFixed(1)}% of donors
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>One-Time Donors</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatNumber(data?.donationMetrics?.one_time_donors || 0)}
                    </Text>
                  </Box>
                </SimpleGrid>

                <ChartCard
                  title="Donation Volume Over Time"
                  subtitle="Monthly donation volume and unique donor count"
                  height="380px"
                >
                  <ComposedChart
                    data={trendData}
                    xKey="month"
                    series={[
                      { type: 'area', dataKey: 'donations', name: 'Donated', color: gitcoinColors.primary, yAxisId: 'left', fillOpacity: 0.2 },
                      { type: 'line', dataKey: 'donors', name: 'Unique Donors', color: gitcoinColors.secondary, yAxisId: 'right', strokeWidth: 2, dot: false },
                    ]}
                    yAxes={[
                      { id: 'left', tickFormatter: (v: number) => formatCurrency(v) },
                      { id: 'right', orientation: 'right' },
                    ]}
                    height={380}
                    tooltipFormatter={(value: number, name: string) => {
                      if (name === 'Donated') return [formatCurrency(value), name];
                      return [formatNumber(value), name];
                    }}
                    xAxisInterval="preserveStartEnd"
                  />
                </ChartCard>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <ChartCard title="Donation Size Distribution">
                    <BarChart
                      data={donationDistData}
                      xKey="range"
                      bars={[{ dataKey: 'count', color: gitcoinColors.accent }]}
                      height={300}
                      rotateLabels
                      tickSize="sm"
                      tooltipFormatter={(value: number, name: string) => [
                        name === 'count' ? formatNumber(value) + ' donations' : formatCurrency(value),
                        name === 'count' ? 'Count' : 'Total',
                      ]}
                    />
                  </ChartCard>

                  <ChartCard title="Application Status Distribution">
                    <PieChart
                      data={applicationStatusData}
                      colors={applicationStatusColors}
                      height={300}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      tooltipFormatter={(value: number, name: string) => [
                        `${formatNumber(value)} applications`,
                        name,
                      ]}
                    />
                  </ChartCard>
                </SimpleGrid>

                {/* Payout summary */}
                <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary} mt={4}>Payout Summary</Text>
                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Paid Out</Text>
                    <Text fontSize="xl" fontWeight="semibold" color={gitcoinColors.primary}>
                      {formatCurrency(data?.summary?.total_paid_out_usd || 0)}
                    </Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data?.summary?.total_payouts || 0)} payouts</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Distributed</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatCurrency(data?.summary?.total_distributed_usd || 0)}
                    </Text>
                    <Text fontSize="xs" color="gray.400">on-chain distribution</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Projects Funded</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatNumber(data?.donationMetrics?.projects_with_donations || 0)}
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Rounds With Donations</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatNumber(data?.donationMetrics?.rounds_with_donations || 0)}
                    </Text>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Tabs.Content>

            {/* ── CHAINS TAB ──────────────────────────────────────── */}
            <Tabs.Content value="chains">
              <VStack gap={8} align="stretch">
                <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>
                  Multi-Chain Deployment ({data?.summary?.unique_chains || 0} blockchains)
                </Text>

                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
                  {(data?.chainMetrics || []).map((chain, idx) => (
                    <Box
                      key={chain.chain_id}
                      p={6}
                      bg="white"
                      borderRadius="lg"
                      borderWidth="1px"
                      borderColor="gray.100"
                      borderLeftWidth="4px"
                      borderLeftColor={CHAIN_COLORS[idx % CHAIN_COLORS.length]}
                    >
                      <HStack justify="space-between" mb={4}>
                        <Text fontSize="lg" fontWeight="semibold">{chain.chain_name}</Text>
                        {chain.active_rounds > 0 && (
                          <Badge bg={gitcoinColors.accent} color="white" px={2} py={0.5} borderRadius="md" fontSize="xs">
                            {chain.active_rounds} Active
                          </Badge>
                        )}
                      </HStack>

                      <SimpleGrid columns={2} gap={4} mb={4}>
                        <VStack align="start" gap={0}>
                          <Text fontSize="xs" color="gray.500">Total Funding</Text>
                          <Text fontSize="md" fontWeight="semibold" color={gitcoinColors.primary}>
                            {formatCurrency(chain.total_funding_volume_usd)}
                          </Text>
                        </VStack>
                        <VStack align="start" gap={0}>
                          <Text fontSize="xs" color="gray.500">Rounds</Text>
                          <Text fontSize="md" fontWeight="semibold">{chain.round_count}</Text>
                        </VStack>
                        <VStack align="start" gap={0}>
                          <Text fontSize="xs" color="gray.500">Donations</Text>
                          <Text fontSize="md" fontWeight="medium">{formatNumber(chain.donation_count)}</Text>
                        </VStack>
                        <VStack align="start" gap={0}>
                          <Text fontSize="xs" color="gray.500">Unique Donors</Text>
                          <Text fontSize="md" fontWeight="medium">{formatNumber(chain.unique_donors)}</Text>
                        </VStack>
                      </SimpleGrid>

                      <VStack align="stretch" gap={2}>
                        <HStack justify="space-between">
                          <Text fontSize="xs" color="gray.500">Approval Rate</Text>
                          <Text fontSize="xs" fontWeight="medium">{chain.approval_rate_pct}%</Text>
                        </HStack>
                        <Progress.Root value={chain.approval_rate_pct} size="sm">
                          <Progress.Track bg="gray.100" borderRadius="full">
                            <Progress.Range bg={gitcoinColors.accent} borderRadius="full" />
                          </Progress.Track>
                        </Progress.Root>
                      </VStack>
                    </Box>
                  ))}
                </SimpleGrid>

                <ChartCard title="Donation Volume by Chain" height="400px">
                  <BarChart
                    data={chainChartData}
                    xKey="name"
                    bars={[
                      { dataKey: 'donations', name: 'Donations', color: gitcoinColors.primary },
                      { dataKey: 'funding', name: 'Matching Pool', color: gitcoinColors.accent },
                    ]}
                    height={400}
                    rotateLabels
                    tickSize="sm"
                    showLegend
                    tooltipFormatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name,
                    ]}
                  />
                </ChartCard>
              </VStack>
            </Tabs.Content>

            {/* ── ROUNDS TAB ──────────────────────────────────────── */}
            <Tabs.Content value="rounds">
              <VStack gap={6} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm" color="gray.500">
                    Showing {Math.min(visibleRounds, data?.topRounds?.length || 0)} of {data?.topRounds?.length || 0} rounds (sorted by matching pool size)
                  </Text>
                </HStack>

                {(data?.topRounds || []).slice(0, visibleRounds).map((round, idx) => (
                  <Box
                    key={idx}
                    p={6}
                    bg="white"
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor="gray.100"
                    _hover={{ borderColor: 'gray.300', shadow: 'sm' }}
                    transition="all 0.2s"
                  >
                    <HStack justify="space-between" mb={4}>
                      <VStack align="start" gap={1}>
                        <HStack gap={2} flexWrap="wrap">
                          <Text fontSize="md" fontWeight="semibold">
                            {round.round_name || `Round ${round.round_id?.slice(0, 8)}`}
                          </Text>
                        </HStack>
                        <HStack gap={2} flexWrap="wrap">
                          <Badge
                            bg={round.is_active ? gitcoinColors.accent : 'gray.400'}
                            color="white"
                            px={2} py={0.5} borderRadius="md" fontSize="xs"
                          >
                            {round.is_active ? 'Active' : 'Closed'}
                          </Badge>
                          <Badge bg={gitcoinColors.secondary} color="white" px={2} py={0.5} borderRadius="md" fontSize="xs">
                            {round.funding_mechanism || 'QF'}
                          </Badge>
                          <Badge bg="gray.500" color="white" px={2} py={0.5} borderRadius="md" fontSize="xs">
                            Chain {round.chain_id}
                          </Badge>
                        </HStack>
                      </VStack>
                      <VStack align="end" gap={0}>
                        <Text fontSize="2xl" fontWeight="bold" color={gitcoinColors.primary}>
                          {formatCurrency(round.matching_pool_usd)}
                        </Text>
                        <Text fontSize="xs" color="gray.400">matching pool</Text>
                      </VStack>
                    </HStack>

                    <SimpleGrid columns={{ base: 2, md: 5 }} gap={4}>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Applications</Text>
                        <Text fontSize="md" fontWeight="medium">{round.total_applications || 0}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Approved</Text>
                        <Text fontSize="md" fontWeight="medium">{round.approved_applications || 0}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Approval Rate</Text>
                        <Text fontSize="md" fontWeight="medium">{round.approval_rate_pct || 0}%</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Donations</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.total_amount_donated_usd || 0)}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Distributed</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.total_distributed_usd || 0)}</Text>
                      </VStack>
                    </SimpleGrid>
                  </Box>
                ))}

                {visibleRounds < (data?.topRounds?.length || 0) && (
                  <Center>
                    <Button
                      onClick={() => setVisibleRounds(v => v + 10)}
                      variant="outline"
                      colorPalette="gray"
                      size="lg"
                    >
                      Load More ({(data?.topRounds?.length || 0) - visibleRounds} remaining)
                    </Button>
                  </Center>
                )}
              </VStack>
            </Tabs.Content>

            {/* ── HISTORY TAB ─────────────────────────────────────── */}
            <Tabs.Content value="history">
              <VStack gap={8} align="stretch">
                <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>Historical Growth</Text>

                {yearlyData.length > 0 && (
                  <>
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                      <ChartCard title="Matching Pool by Year">
                        <BarChart
                          data={yearlyData}
                          xKey="year"
                          bars={[{ dataKey: 'matching', name: 'Matching Pool', color: gitcoinColors.primary }]}
                          height={300}
                          tooltipFormatter={(value: number) => [formatCurrency(value), 'Matching Pool']}
                        />
                      </ChartCard>

                      <ChartCard title="Community Donations by Year">
                        <BarChart
                          data={yearlyData}
                          xKey="year"
                          bars={[{ dataKey: 'donated', name: 'Total Donated', color: gitcoinColors.accent }]}
                          height={300}
                          tooltipFormatter={(value: number) => [formatCurrency(value), 'Total Donated']}
                        />
                      </ChartCard>
                    </SimpleGrid>

                    <ChartCard title="Rounds & Donors by Year">
                      <ComposedChart
                        data={yearlyData}
                        xKey="year"
                        series={[
                          { type: 'bar', dataKey: 'rounds', name: 'Rounds', color: gitcoinColors.primary, yAxisId: 'left' },
                          { type: 'line', dataKey: 'donors', name: 'Total Donors', color: gitcoinColors.secondary, yAxisId: 'right', strokeWidth: 2, dot: true },
                        ]}
                        yAxes={[
                          { id: 'left' },
                          { id: 'right', orientation: 'right', tickFormatter: (v: number) => formatNumber(v) },
                        ]}
                        height={300}
                        tooltipFormatter={(value: number, name: string) => [
                          name === 'Rounds' ? `${value} rounds` : formatNumber(value),
                          name,
                        ]}
                      />
                    </ChartCard>

                    {/* Year-by-year table */}
                    <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="md" fontWeight="semibold" mb={4}>Year-by-Year Breakdown</Text>
                      <Box overflowX="auto">
                        <Box as="table" w="full" fontSize="sm">
                          <Box as="thead">
                            <Box as="tr" borderBottomWidth="2px" borderColor="gray.200">
                              {['Year', 'Rounds', 'Matching Pool', 'Community Donations', 'Donors'].map(h => (
                                <Box key={h} as="th" textAlign="left" py={2} pr={6} color="gray.500" fontWeight="medium" fontSize="xs" textTransform="uppercase">
                                  {h}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                          <Box as="tbody">
                            {yearlyData.map((row, idx) => (
                              <Box
                                key={idx}
                                as="tr"
                                borderBottomWidth="1px"
                                borderColor="gray.100"
                                _hover={{ bg: 'gray.50' }}
                              >
                                <Box as="td" py={3} pr={6} fontWeight="semibold">{row.year}</Box>
                                <Box as="td" py={3} pr={6}>{row.rounds}</Box>
                                <Box as="td" py={3} pr={6} color={gitcoinColors.primary} fontWeight="medium">{formatCurrency(row.matching)}</Box>
                                <Box as="td" py={3} pr={6}>{formatCurrency(row.donated)}</Box>
                                <Box as="td" py={3} pr={6}>{formatNumber(row.donors)}</Box>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </>
                )}

                {yearlyData.length === 0 && (
                  <Center py={16}>
                    <Text color="gray.400">No historical data available yet — run the pipeline to populate this view.</Text>
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
