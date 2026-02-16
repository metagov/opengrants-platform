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
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { ProgramProfile } from '../../components/ProgramProfile';
import { SupportFooter } from '../../components/SupportFooter';
import { gitcoinColors, brandColors } from '../../theme/colors';

interface GrantStackData {
  metadata: {
    platform: string;
    last_indexed_at: string;
    data_source: string;
    notes: string;
  } | null;
  summary: {
    total_grant_pools: number;
    active_grant_pools: number;
    total_matching_pool_usd: number;
    total_projects: number;
    total_applications: number;
    approved_applications: number;
    total_donations: number;
    total_donated_usd: number;
    unique_donors: number;
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
  };
  payoutMetrics: {
    total_payouts: number;
    total_paid_usd: number;
    applications_paid: number;
    avg_payout_usd: number;
    median_payout_usd: number;
    matching_distribution_rate_pct: number;
  };
  topRounds: Array<{
    round_id: string;
    round_name: string;
    funding_mechanism: string;
    is_active: boolean;
    chain_id: number;
    matching_pool_usd: number;
    total_applications: number;
    approved_applications: number;
    approval_rate_pct: number;
    verified_donations_usd: number;
    payouts_total_usd: number;
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
}

const CHAIN_COLORS = [
  '#00433B', // Gitcoin primary
  '#6F3FF5', // Purple
  '#15B8A6', // Teal
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#14B8A6', // Cyan
];

const STATUS_COLORS: { [key: string]: string } = {
  approved: '#10B981',
  funded: '#00433B',
  pending: '#F59E0B',
  rejected: '#EF4444',
  in_review: '#3B82F6',
  completed: '#6F3FF5',
};

export default function GrantStackPage() {
  const [data, setData] = useState<GrantStackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleRounds, setVisibleRounds] = useState(10);

  const loadMoreRounds = () => {
    setVisibleRounds(prev => prev + 10);
  };

  useEffect(() => {
    fetch('/api/systems/grantsstack')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching GrantStack data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color={gitcoinColors.primary} />
        </Center>
      </>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value?.toFixed(0) || 0}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value?.toFixed(0) || '0';
  };

  const chainChartData = (data?.chainMetrics || []).map((c, idx) => ({
    name: c.chain_name,
    funding: Number(c.total_funding_volume_usd) || 0,
    rounds: Number(c.round_count) || 0,
    donations: Number(c.donation_volume_usd) || 0,
    color: CHAIN_COLORS[idx % CHAIN_COLORS.length],
  }));

  const mechanismChartData = (data?.fundingMechanisms || []).map((m, idx) => ({
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

  const approvalRate = data?.summary?.total_applications > 0
    ? ((data.summary.approved_applications / data.summary.total_applications) * 100).toFixed(1)
    : '0';

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Gitcoin Grants Stack"
            description="Decentralized grants infrastructure powering quadratic funding rounds across multiple chains"
            color={gitcoinColors.primary}
          />

          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={6} mb={12}>
            <MetricCard
              label="Total Funding"
              value={formatCurrency((data?.summary?.total_matching_pool_usd || 0) + (data?.summary?.total_donated_usd || 0))}
              color={gitcoinColors.primary}
            />
            <MetricCard
              label="Unique Donors"
              value={formatNumber(data?.summary?.unique_donors || 0)}
            />
            <MetricCard
              label="Grant Rounds"
              value={data?.summary?.total_grant_pools || 0}
            />
            <MetricCard
              label="Active Chains"
              value={data?.summary?.unique_chains || 0}
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
                _selected={{ color: gitcoinColors.primary, borderColor: gitcoinColors.primary }}
                _hover={{ color: gitcoinColors.primary }}
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
                _selected={{ color: gitcoinColors.primary, borderColor: gitcoinColors.primary }}
                _hover={{ color: gitcoinColors.primary }}
              >
                Analytics
              </Tabs.Trigger>
              <Tabs.Trigger
                value="chains"
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
                Chains
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
                _selected={{ color: gitcoinColors.primary, borderColor: gitcoinColors.primary }}
                _hover={{ color: gitcoinColors.primary }}
              >
                Rounds
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="overview">
              <VStack gap={8} align="stretch">
                <ProgramProfile
                  name="Gitcoin Grants Stack"
                  description="Grants Stack is Gitcoin's decentralized grants protocol that enables communities to run their own quadratic funding rounds. It provides the infrastructure for transparent, community-driven capital allocation across multiple blockchain networks."
                  programDescription="The platform supports various funding mechanisms including Quadratic Funding (QF) which amplifies small donations, and Direct Grants for milestone-based funding. Projects apply to rounds, receive community donations, and matching funds are distributed based on the number of unique contributors."
                  primaryMechanism="Quadratic Funding"
                  fundingMechanismDescription="Quadratic Funding prioritizes projects with broad community support over those with a few large donors. The matching pool is distributed based on the square root of the sum of square roots of contributions, creating democratic capital allocation."
                  links={[
                    { label: 'Grants Stack', url: 'https://www.gitcoin.co/grants-stack' },
                    { label: 'Gitcoin', url: 'https://gitcoin.co' },
                    { label: 'Explorer', url: 'https://explorer.gitcoin.co' },
                  ]}
                  tags={['Web3', 'Quadratic Funding', 'Multi-chain', 'Grants']}
                  color={gitcoinColors.primary}
                  lastIndexedAt={data?.metadata?.last_indexed_at}
                  dataSource={data?.metadata?.data_source}
                />

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
                          <Text fontSize="sm" fontWeight="medium" color="gray.800">
                            {project.project_name || `Project ${project.id?.slice(0, 8)}`}
                          </Text>
                          <Text fontSize="xs" color="gray.400">
                            {project.rounds_participated} round{project.rounds_participated !== 1 ? 's' : ''} participated
                          </Text>
                        </VStack>
                        <Text fontSize="sm" fontWeight="semibold" color={gitcoinColors.primary}>
                          {formatCurrency(project.total_funds_approved)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Funding by Chain</Text>
                    <Box h="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chainChartData.slice(0, 8)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis
                            type="number"
                            tick={{ fill: '#4A5568', fontSize: 11 }}
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: '#4A5568', fontSize: 11 }}
                            width={100}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                            formatter={(value: number) => [formatCurrency(value), 'Total Funding']}
                          />
                          <Bar dataKey="funding" fill={gitcoinColors.primary} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Funding Mechanisms</Text>
                    <Box h="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={mechanismChartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name?.split(' ')[0] || 'Other'} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {mechanismChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHAIN_COLORS[index % CHAIN_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string, props: any) => [
                              `${value} rounds (${formatCurrency(props.payload.funding)})`,
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
                      {data?.donationMetrics?.repeat_donor_percentage?.toFixed(1) || 0}% of donors
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>One-Time Donors</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatNumber(data?.donationMetrics?.one_time_donors || 0)}
                    </Text>
                  </Box>
                </SimpleGrid>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={2}>Donation Trends Over Time</Text>
                  <Text fontSize="sm" color="gray.500" mb={4}>Monthly donation volume and donor activity</Text>
                  <Box h="350px">
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: '#4A5568', fontSize: 10 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fill: '#4A5568', fontSize: 11 }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: '#4A5568', fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                          formatter={(value: number, name: string) => {
                            if (name === 'Donated') return [formatCurrency(value), name];
                            return [formatNumber(value), name];
                          }}
                        />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="donations"
                          name="Donated"
                          stroke={gitcoinColors.primary}
                          fill={gitcoinColors.primary}
                          fillOpacity={0.2}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="donors"
                          name="Unique Donors"
                          stroke={gitcoinColors.secondary}
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Donation Size Distribution</Text>
                    <Box h="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={donationDistData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis
                            dataKey="range"
                            tick={{ fill: '#4A5568', fontSize: 10 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis tick={{ fill: '#4A5568', fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                            formatter={(value: number, name: string) => [
                              name === 'count' ? formatNumber(value) + ' donations' : formatCurrency(value),
                              name === 'count' ? 'Count' : 'Total'
                            ]}
                          />
                          <Bar dataKey="count" fill={gitcoinColors.accent} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={4}>Application Status Distribution</Text>
                    <Box h="300px">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={applicationStatusData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {applicationStatusData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={STATUS_COLORS[entry.name] || CHAIN_COLORS[index % CHAIN_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string, props: any) => [
                              `${formatNumber(value)} applications`,
                              name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                </SimpleGrid>

                <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary} mt={4}>Payout Analytics</Text>

                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Paid Out</Text>
                    <Text fontSize="xl" fontWeight="semibold" color={gitcoinColors.primary}>
                      {formatCurrency(data?.payoutMetrics?.total_paid_usd || 0)}
                    </Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data?.payoutMetrics?.total_payouts || 0)} payouts</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Applications Paid</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatNumber(data?.payoutMetrics?.applications_paid || 0)}
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Avg Payout</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {formatCurrency(data?.payoutMetrics?.avg_payout_usd || 0)}
                    </Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Distribution Rate</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {data?.payoutMetrics?.matching_distribution_rate_pct?.toFixed(1) || 0}%
                    </Text>
                    <Text fontSize="xs" color="gray.400">of matching pool</Text>
                  </Box>
                </SimpleGrid>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="chains">
              <VStack gap={8} align="stretch">
                <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>
                  Multi-Chain Deployment ({data?.summary?.unique_chains || 0} chains)
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

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={4}>Funding Distribution by Chain</Text>
                  <Box h="400px">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={chainChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#4A5568', fontSize: 10 }}
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
                          formatter={(value: number, name: string) => [
                            formatCurrency(value),
                            name === 'funding' ? 'Total Funding' : name === 'donations' ? 'Donations' : name
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="funding" name="Total Funding" fill={gitcoinColors.primary} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="donations" name="Donations" fill={gitcoinColors.accent} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="rounds">
              <VStack gap={6} align="stretch">
                <HStack justify="space-between" mb={2}>
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
                        <HStack gap={2}>
                          <Text fontSize="lg" fontWeight="semibold">
                            {round.round_name || `Round ${round.round_id?.slice(0, 8)}`}
                          </Text>
                        </HStack>
                        <HStack gap={2}>
                          <Badge
                            bg={round.is_active ? gitcoinColors.accent : 'gray.400'}
                            color="white"
                            px={2}
                            py={0.5}
                            borderRadius="md"
                            fontSize="xs"
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
                      <Text fontSize="2xl" fontWeight="bold" color={gitcoinColors.primary}>
                        {formatCurrency(round.matching_pool_usd)}
                      </Text>
                    </HStack>
                    <SimpleGrid columns={{ base: 2, md: 5 }} gap={4}>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Applications</Text>
                        <Text fontSize="md" fontWeight="medium">{round.total_applications}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Approved</Text>
                        <Text fontSize="md" fontWeight="medium">{round.approved_applications}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Approval Rate</Text>
                        <Text fontSize="md" fontWeight="medium">{round.approval_rate_pct}%</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Donations</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.verified_donations_usd)}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Paid Out</Text>
                        <Text fontSize="md" fontWeight="medium">{formatCurrency(round.payouts_total_usd)}</Text>
                      </VStack>
                    </SimpleGrid>
                  </Box>
                ))}

                {visibleRounds < (data?.topRounds?.length || 0) && (
                  <Center>
                    <Button
                      onClick={loadMoreRounds}
                      variant="outline"
                      colorPalette="gray"
                      size="lg"
                    >
                      Load More Rounds ({(data?.topRounds?.length || 0) - visibleRounds} remaining)
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
