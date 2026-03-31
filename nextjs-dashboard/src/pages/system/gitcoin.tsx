import { useState, useEffect, useCallback } from 'react';
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

// ── Types ──────────────────────────────────────────────────────────────────

interface GitcoinSummary {
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
}

interface ChainMetric {
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
}

interface GitcoinData {
  // overview
  summary: GitcoinSummary;
  chainMetrics: ChainMetric[];
  topProjects: Array<{
    id: string; project_name: string; chain_id: number;
    rounds_participated: number; total_donations: number;
    total_donated_usd: number; total_unique_donors: number; best_qf_score: number;
  }>;
  fundingMechanisms: Array<{ mechanism: string; round_count: number; total_pool_usd: number; total_donated_usd: number }>;
  donationMetrics: {
    total_donations: number; total_donated_usd: number; unique_donors: number;
    avg_donation_usd: number; median_donation_usd: number; one_time_donors: number;
    repeat_donors: number; repeat_donor_percentage: number;
    rounds_with_donations: number; projects_with_donations: number;
  };
  // analytics
  donationDistribution: Array<{ range: string; donation_count: number; total_amount: number }>;
  donationTrends: Array<{ month: string; donation_count: number; total_donated: number; unique_donors: number }>;
  applicationStats: Array<{ status: string; count: number; total_funds: number }>;
  roundStatus: Array<{ is_open: boolean; count: number; total_pool_usd: number }>;
  // qf
  qfSummary: {
    rounds_with_donations: number; avg_amplification_ratio: number;
    max_amplification_ratio: number; avg_donors_per_project: number;
    avg_top10_concentration: number; rounds_with_broad_participation: number;
  };
  qfRoundAnalysis: Array<{
    round_id: string; round_name: string; chain_id: number; strategy_name: string;
    match_pool_usd: number; community_donated_usd: number; unique_donors: number;
    donations_count: number; total_distributed_usd: number; qf_amplification_ratio: number;
    avg_donors_per_project: number; top_10_donor_concentration_pct: number;
    avg_donation_usd: number; projects_receiving_donations: number; round_duration_days: number;
  }>;
  donorSegments: Array<{
    segment: string; donor_count: number; pct_of_total_donors: number;
    avg_rounds_donated_to: number; avg_chains_donated_on: number;
    avg_total_donated_usd: number; avg_projects_supported: number;
    total_donated_usd_segment: number; pct_of_total_volume: number;
  }>;
  attestationImpact: Array<{
    has_passport_attestation: boolean; donor_count: number; pct_of_total_donors: number;
    avg_donations_count: number; avg_rounds_donated_to: number; avg_projects_supported: number;
    avg_chains_donated_on: number; avg_total_donated_usd: number; avg_single_donation_usd: number;
    total_donated_usd_segment: number; pct_of_total_volume: number;
  }>;
  donorRetention: Array<{
    cohort_year: number; cohort_size: number; retained_year_1: number; ever_returned: number;
    year_1_retention_pct: number; ever_returned_pct: number; cohort_avg_donated_usd: number;
    cohort_total_donated_usd: number; cohort_avg_rounds_donated: number;
    returning_donor_avg_donated_usd: number; one_time_donor_avg_donated_usd: number;
  }>;
  tokenFlows: Array<{
    chain_id: number; chain_name: string; token_address: string; token_symbol: string;
    donation_count: number; total_donated_usd: number; unique_donors: number;
    rounds_using_token: number; pct_of_chain_volume: number;
  }>;
  topQfProjects: Array<{
    project_id: string; project_name: string; grant_pool_id: string; round_name: string;
    chain_id: number; unique_donors: number; donations_count: number; total_donated_usd: number;
    qf_score_estimate: number; qf_rank_in_round: number; donor_breadth_rank_in_round: number;
    qf_advantage_over_volume_rank: number;
  }>;
  // rounds
  topRounds: Array<{
    round_id: string; round_name: string; funding_mechanism: string; is_active: boolean;
    chain_id: number; strategy_name: string; matching_pool_usd: number;
    total_donations_count: number; unique_donors_count: number;
    total_amount_donated_usd: number; total_distributed_usd: number;
    total_applications: number; approved_applications: number; approval_rate_pct: number;
    verified_donations_usd: number; payouts_total_usd: number;
    donations_start: string; donations_end: string;
  }>;
  // history
  roundsByYear: Array<{
    year: number; round_count: number; total_matching_usd: number;
    total_donated_usd: number; total_donors: number;
  }>;
}

type SectionState = 'idle' | 'loading' | 'loaded' | 'error';

// ── Constants ─────────────────────────────────────────────────────────────

const CHAIN_COLORS = [
  '#00433B', '#6F3FF5', '#15B8A6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#10B981', '#3B82F6', '#F97316', '#14B8A6',
];

const STATUS_COLORS: { [key: string]: string } = {
  approved: '#10B981', funded: '#00433B', pending: '#F59E0B',
  rejected: '#EF4444', in_review: '#3B82F6', completed: '#6F3FF5', cancelled: '#9CA3AF',
};

const SEGMENT_LABELS: Record<string, string> = {
  micro: 'Micro (<$1)', whale: 'Whale ($1K+)', loyal: 'Loyal (3+ rounds)',
  cross_chain: 'Cross-chain', breadth: 'Breadth (5+ proj.)', standard: 'Standard',
};

const SEGMENT_COLORS: Record<string, string> = {
  micro: '#10B981', whale: '#EF4444', loyal: '#00433B',
  cross_chain: '#6F3FF5', breadth: '#F59E0B', standard: '#9CA3AF',
};

// ── Section spinner ────────────────────────────────────────────────────────

function SectionSpinner() {
  return (
    <Center py={16}>
      <VStack gap={3}>
        <Spinner size="lg" color={gitcoinColors.primary} />
        <Text fontSize="sm" color="gray.400">Loading…</Text>
      </VStack>
    </Center>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function GitcoinPage() {
  const [data, setData] = useState<Partial<GitcoinData>>({});
  const [sections, setSections] = useState<Record<string, SectionState>>({ overview: 'loading' });
  const [initError, setInitError] = useState<string | null>(null);
  const [visibleRounds, setVisibleRounds] = useState(10);

  const loadSection = useCallback((section: string) => {
    setSections(prev => {
      if (prev[section] === 'loading' || prev[section] === 'loaded') return prev;
      return { ...prev, [section]: 'loading' };
    });

    fetch(`/api/systems/gitcoin?section=${section}`)
      .then(res => res.json())
      .then(d => {
        if (d.message === 'Internal server error') {
          setSections(prev => ({ ...prev, [section]: 'error' }));
        } else {
          setData(prev => ({ ...prev, ...d }));
          setSections(prev => ({ ...prev, [section]: 'loaded' }));
        }
      })
      .catch(() => {
        setSections(prev => ({ ...prev, [section]: 'error' }));
      });
  }, []);

  // Load overview on mount
  useEffect(() => {
    fetch('/api/systems/gitcoin?section=overview')
      .then(res => res.json())
      .then(d => {
        if (d.message === 'Internal server error') {
          setInitError(d.error || 'Failed to load data');
          setSections(prev => ({ ...prev, overview: 'error' }));
        } else {
          setData(d);
          setSections(prev => ({ ...prev, overview: 'loaded' }));
        }
      })
      .catch(err => {
        setInitError(String(err));
        setSections(prev => ({ ...prev, overview: 'error' }));
      });
  }, []);

  const handleTabChange = (tab: string) => {
    // chains uses overview data (chainMetrics already loaded)
    if (tab === 'overview' || tab === 'chains') return;
    loadSection(tab);
  };

  if (sections.overview === 'loading') {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <VStack gap={4}>
            <Spinner size="xl" color={gitcoinColors.primary} />
            <Text color="gray.500" fontSize="sm">Loading Gitcoin data…</Text>
          </VStack>
        </Center>
      </>
    );
  }

  if (initError || sections.overview === 'error') {
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
            {initError && (
              <Box p={3} bg="gray.100" borderRadius="md" fontSize="xs" fontFamily="mono" color="gray.700" w="full" textAlign="left">
                {initError}
              </Box>
            )}
          </VStack>
        </Center>
      </>
    );
  }

  // ── Chart data (computed from loaded sections, safe with empty fallbacks) ──

  const chainChartData = (data.chainMetrics || []).map((c, idx) => ({
    name: c.chain_name,
    funding: Number(c.total_funding_volume_usd) || 0,
    rounds: Number(c.round_count) || 0,
    donations: Number(c.donation_volume_usd) || 0,
    color: CHAIN_COLORS[idx % CHAIN_COLORS.length],
  }));

  const mechanismChartData = (data.fundingMechanisms || []).map(m => ({
    name: m.mechanism || 'Other',
    value: Number(m.round_count) || 0,
    funding: Number(m.total_pool_usd) || 0,
  }));

  const donationDistData = (data.donationDistribution || []).map(d => ({
    range: d.range,
    count: Number(d.donation_count) || 0,
    amount: Number(d.total_amount) || 0,
  }));

  const trendData = (data.donationTrends || []).map(t => ({
    month: t.month,
    donations: Number(t.total_donated) || 0,
    donors: Number(t.unique_donors) || 0,
    count: Number(t.donation_count) || 0,
  }));

  const applicationStatusData = (data.applicationStats || []).map(s => ({
    name: s.status,
    value: Number(s.count) || 0,
    funds: Number(s.total_funds) || 0,
  }));

  const applicationStatusColors = applicationStatusData.map((entry, idx) =>
    STATUS_COLORS[entry.name] || CHAIN_COLORS[idx % CHAIN_COLORS.length]
  );

  const yearlyData = (data.roundsByYear || []).map(y => ({
    year: String(y.year),
    rounds: Number(y.round_count) || 0,
    matching: Number(y.total_matching_usd) || 0,
    donated: Number(y.total_donated_usd) || 0,
    donors: Number(y.total_donors) || 0,
  }));

  const qfAmplificationData = (data.qfRoundAnalysis || []).slice(0, 20).map(r => ({
    name: r.round_name ? r.round_name.slice(0, 28) + (r.round_name.length > 28 ? '…' : '') : `Round ${r.round_id?.slice(0, 6)}`,
    ratio: Number(r.qf_amplification_ratio) || 0,
    donors: Number(r.unique_donors) || 0,
    donated: Number(r.community_donated_usd) || 0,
    distributed: Number(r.total_distributed_usd) || 0,
  }));

  const donorSegmentData = (data.donorSegments || []).map(s => ({
    segment: SEGMENT_LABELS[s.segment] || s.segment,
    key: s.segment,
    count: Number(s.donor_count) || 0,
    pct: Number(s.pct_of_total_donors) || 0,
    avg_rounds: Number(s.avg_rounds_donated_to) || 0,
    avg_projects: Number(s.avg_projects_supported) || 0,
    volume_pct: Number(s.pct_of_total_volume) || 0,
    color: SEGMENT_COLORS[s.segment] || '#9CA3AF',
  }));

  const attestationCompareData = (data.attestationImpact || []).map(a => ({
    label: a.has_passport_attestation ? 'Passport Holder' : 'No Passport',
    donor_count: Number(a.donor_count) || 0,
    avg_rounds: Number(a.avg_rounds_donated_to) || 0,
    avg_projects: Number(a.avg_projects_supported) || 0,
    avg_donated: Number(a.avg_total_donated_usd) || 0,
    avg_single: Number(a.avg_single_donation_usd) || 0,
    pct_of_donors: Number(a.pct_of_total_donors) || 0,
  }));

  const retentionData = (data.donorRetention || []).map(r => ({
    year: String(r.cohort_year),
    cohort: Number(r.cohort_size) || 0,
    returning: Number(r.retained_year_1) || 0,
    new_only: (Number(r.cohort_size) || 0) - (Number(r.retained_year_1) || 0),
    retention_pct: Number(r.year_1_retention_pct) || 0,
    ever_returned_pct: Number(r.ever_returned_pct) || 0,
  }));

  const tokenFlowData = (data.tokenFlows || []).slice(0, 10).map(t => ({
    name: `${t.token_symbol} (${t.chain_name?.split(' ')[0] || 'Chain ' + t.chain_id})`,
    volume: Number(t.total_donated_usd) || 0,
    donors: Number(t.unique_donors) || 0,
    pct: Number(t.pct_of_chain_volume) || 0,
  }));

  const passportHolder = (data.attestationImpact || []).find(a => a.has_passport_attestation === true);
  const passportPct = Number(passportHolder?.pct_of_total_donors || 0).toFixed(1);

  const approvalRate = (data.summary?.total_applications || 0) > 0
    ? (((data.summary?.approved_applications || 0) / data.summary!.total_applications) * 100).toFixed(1)
    : '0';

  const totalFunding = (data.summary?.total_matching_pool_usd || 0) + (data.summary?.total_donated_usd || 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Gitcoin"
            description="Complete historical record of Gitcoin Grants Stack — 497k donations, 2.3k rounds, 14k projects across multiple chains"
            color={gitcoinColors.primary}
          />

          {/* Top-line KPIs */}
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={6} mb={12}>
            <MetricCard label="Total Funding" value={formatCurrency(totalFunding)} color={gitcoinColors.primary} />
            <MetricCard label="Unique Donors" value={formatNumber(data.summary?.unique_donors || 0)} />
            <MetricCard label="Grant Rounds" value={formatNumber(data.summary?.total_grant_pools || 0)} />
            <MetricCard label="Blockchains" value={data.summary?.unique_chains || 0} />
          </SimpleGrid>

          <Tabs.Root defaultValue="overview" variant="line" onValueChange={(e) => handleTabChange(e.value)}>
            <Tabs.List borderBottomWidth="1px" borderColor="gray.200" mb={8} gap={2}>
              {['overview', 'analytics', 'qf', 'chains', 'rounds', 'history'].map(tab => (
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
                  {tab === 'qf' ? 'QF Mechanics' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
            <Tabs.Content value="overview">
              <VStack gap={8} align="stretch">
                <ProgramProfile
                  name="Gitcoin (Grants Stack)"
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

                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Donated</Text>
                    <Text fontSize="xl" fontWeight="semibold" color={gitcoinColors.primary}>{formatCurrency(data.summary?.total_donated_usd || 0)}</Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data.summary?.total_donations || 0)} donations</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Matching Pool</Text>
                    <Text fontSize="xl" fontWeight="semibold">{formatCurrency(data.summary?.total_matching_pool_usd || 0)}</Text>
                    <Text fontSize="xs" color="gray.400">{data.summary?.qf_rounds || 0} QF rounds</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Projects</Text>
                    <Text fontSize="xl" fontWeight="semibold">{formatNumber(data.summary?.total_projects || 0)}</Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data.summary?.total_applications || 0)} applications</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Approval Rate</Text>
                    <Text fontSize="xl" fontWeight="semibold">{approvalRate}%</Text>
                    <Text fontSize="xs" color="gray.400">{formatNumber(data.summary?.approved_applications || 0)} approved</Text>
                  </Box>
                </SimpleGrid>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <HStack justify="space-between" mb={4}>
                    <Text fontSize="md" fontWeight="semibold">Top Funded Projects</Text>
                    <Text fontSize="xs" color="gray.400">by community donations · {data.topProjects?.length || 0} shown</Text>
                  </HStack>
                  <VStack align="stretch" gap={0}>
                    {(data.topProjects || []).slice(0, 10).map((project, idx) => (
                      <HStack key={idx} justify="space-between" py={3} borderBottomWidth={idx < 9 ? '1px' : '0'} borderColor="gray.100" flexWrap="wrap" gap={2}>
                        <HStack gap={3} flex={1} minW="0">
                          <Text fontSize="sm" color="gray.400" fontWeight="medium" w="20px" flexShrink={0}>{idx + 1}</Text>
                          <VStack align="start" gap={0} minW="0">
                            <Text fontSize="sm" fontWeight="medium" color="gray.800" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" maxW="260px">
                              {project.project_name || `Project ${project.id?.slice(0, 8)}`}
                            </Text>
                            <Text fontSize="xs" color="gray.400">
                              {project.rounds_participated} round{project.rounds_participated !== 1 ? 's' : ''} · {formatNumber(project.total_unique_donors)} donors · {formatNumber(project.total_donations)} donations
                            </Text>
                          </VStack>
                        </HStack>
                        <Text fontSize="sm" fontWeight="semibold" color={gitcoinColors.primary} flexShrink={0}>
                          {formatCurrency(project.total_donated_usd)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>

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
                        `${value} rounds (${formatCurrency(props.payload.funding)})`, name,
                      ]}
                    />
                  </ChartCard>
                </SimpleGrid>

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={1}>Data Notes</Text>
                  <VStack align="start" gap={2} mt={3}>
                    <Text fontSize="xs" color="gray.500">
                      <strong>Mainnet only:</strong> Only rounds on mainnet chains are shown (Ethereum, Optimism, Arbitrum, Polygon, Base, Celo, Avalanche, Scroll, Sei, zkSync Era, Kovan, Metis). Testnet rounds (e.g. Sepolia) are excluded.
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      <strong>Round threshold — $100 funded:</strong> Rounds with less than $100 in actual pool funding are excluded. This removes ~1,800 empty, test, and unnamed rounds (e.g. "Unnamed Round", "test round huss 2", "hello world") from all metrics.
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      <strong>Project threshold — $50 donated:</strong> Projects receiving less than $50 in total community donations within a round are excluded from project rankings and QF analysis.
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      <strong>Donation outlier cap — $50K:</strong> A small number of donation records contain raw token amounts instead of USD values. Records above $50K are excluded from all donation metrics and averages.
                    </Text>
                  </VStack>
                </Box>
              </VStack>
            </Tabs.Content>

            {/* ── ANALYTICS TAB ─────────────────────────────────────────── */}
            <Tabs.Content value="analytics">
              {sections.analytics === 'loading' ? <SectionSpinner /> : (
                <VStack gap={8} align="stretch">
                  <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>Donation Analytics</Text>

                  <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Avg Donation</Text>
                      <Text fontSize="xl" fontWeight="semibold">{formatCurrency(data.donationMetrics?.avg_donation_usd || 0)}</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Median Donation</Text>
                      <Text fontSize="xl" fontWeight="semibold">{formatCurrency(data.donationMetrics?.median_donation_usd || 0)}</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Repeat Donors</Text>
                      <Text fontSize="xl" fontWeight="semibold">{formatNumber(data.donationMetrics?.repeat_donors || 0)}</Text>
                      <Text fontSize="xs" color="gray.400">{Number(data.donationMetrics?.repeat_donor_percentage || 0).toFixed(1)}% of donors</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>One-Time Donors</Text>
                      <Text fontSize="xl" fontWeight="semibold">{formatNumber(data.donationMetrics?.one_time_donors || 0)}</Text>
                    </Box>
                  </SimpleGrid>

                  <ChartCard title="Donation Volume Over Time" subtitle="Monthly donation volume and unique donor count" height="380px">
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
                        tooltipFormatter={(value: number, name: string) => [`${formatNumber(value)} applications`, name]}
                      />
                    </ChartCard>
                  </SimpleGrid>

                  <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary} mt={4}>Payout Summary</Text>
                  <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Total Paid Out</Text>
                      <Text fontSize="xl" fontWeight="semibold" color={gitcoinColors.primary}>{formatCurrency(data.summary?.total_paid_out_usd || 0)}</Text>
                      <Text fontSize="xs" color="gray.400">{formatNumber(data.summary?.total_payouts || 0)} payouts</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Total Distributed</Text>
                      <Text fontSize="xl" fontWeight="semibold">{formatCurrency(data.summary?.total_distributed_usd || 0)}</Text>
                      <Text fontSize="xs" color="gray.400">on-chain distribution</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Projects Funded</Text>
                      <Text fontSize="xl" fontWeight="semibold">{formatNumber(data.donationMetrics?.projects_with_donations || 0)}</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Rounds With Donations</Text>
                      <Text fontSize="xl" fontWeight="semibold">{formatNumber(data.donationMetrics?.rounds_with_donations || 0)}</Text>
                    </Box>
                  </SimpleGrid>
                </VStack>
              )}
            </Tabs.Content>

            {/* ── QF MECHANICS TAB ──────────────────────────────────────── */}
            <Tabs.Content value="qf">
              {sections.qf === 'loading' ? <SectionSpinner /> : (
                <VStack gap={8} align="stretch">
                  <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>Quadratic Funding Mechanics</Text>

                  <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Avg QF Amplification</Text>
                      <Text fontSize="xl" fontWeight="semibold" color={gitcoinColors.primary}>
                        {Number(data.qfSummary?.avg_amplification_ratio || 0).toFixed(2)}x
                      </Text>
                      <Text fontSize="xs" color="gray.400">community $ → total distributed</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Max Amplification (single round)</Text>
                      <Text fontSize="xl" fontWeight="semibold">{Number(data.qfSummary?.max_amplification_ratio || 0).toFixed(1)}x</Text>
                      <Text fontSize="xs" color="gray.400">highest leverage ratio</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Avg Donors / Project / Round</Text>
                      <Text fontSize="xl" fontWeight="semibold">{Number(data.qfSummary?.avg_donors_per_project || 0).toFixed(1)}</Text>
                      <Text fontSize="xs" color="gray.400">breadth of participation</Text>
                    </Box>
                    <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="xs" color="gray.500" mb={1}>Passport Holders</Text>
                      <Text fontSize="xl" fontWeight="semibold">{passportPct}%</Text>
                      <Text fontSize="xs" color="gray.400">of {formatNumber(data.summary?.unique_donors || 0)} donors</Text>
                    </Box>
                  </SimpleGrid>

                  <ChartCard title="Top 20 Rounds by QF Amplification Ratio" subtitle="How many $ were distributed for every $1 donated by the community" height="440px">
                    <BarChart
                      data={qfAmplificationData}
                      xKey="name"
                      bars={[{ dataKey: 'ratio', name: 'Amplification (x)', color: gitcoinColors.primary }]}
                      layout="vertical"
                      height={440}
                      tooltipFormatter={(value: number, _name: string, props: any) => [
                        `${value}x  (${formatNumber(props.payload.donors)} donors, ${formatCurrency(props.payload.distributed)} distributed)`,
                        'Amplification',
                      ]}
                    />
                  </ChartCard>

                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                    <ChartCard title="Donor Community Segments" subtitle="Segments by participation pattern — micro donors power QF democratisation">
                      <BarChart
                        data={donorSegmentData}
                        xKey="segment"
                        bars={[{ dataKey: 'count', name: 'Donors', color: gitcoinColors.accent }]}
                        height={280}
                        rotateLabels
                        tickSize="sm"
                        tooltipFormatter={(value: number, _name: string, props: any) => [
                          `${formatNumber(value)} donors (${props.payload.pct}% of total, ${props.payload.volume_pct}% of volume)`,
                          props.payload.segment,
                        ]}
                      />
                    </ChartCard>

                    <ChartCard title="Passport Holders vs Non-Holders" subtitle="Does Gitcoin Passport verification change donor behaviour?">
                      <BarChart
                        data={attestationCompareData}
                        xKey="label"
                        bars={[
                          { dataKey: 'avg_rounds', name: 'Avg Rounds', color: gitcoinColors.primary },
                          { dataKey: 'avg_projects', name: 'Avg Projects', color: gitcoinColors.accent },
                        ]}
                        height={280}
                        showLegend
                        tooltipFormatter={(value: number, name: string) => [value.toFixed(1), name]}
                      />
                    </ChartCard>
                  </SimpleGrid>

                  {attestationCompareData.length > 0 && (
                    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                      {attestationCompareData.map((a, idx) => (
                        <Box key={idx} p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                          <Text fontSize="xs" color="gray.500" mb={1}>{a.label}</Text>
                          <Text fontSize="xl" fontWeight="semibold" color={idx === 0 ? gitcoinColors.primary : undefined}>{formatNumber(a.donor_count)}</Text>
                          <Text fontSize="xs" color="gray.400">{a.pct_of_donors.toFixed(1)}% of donors</Text>
                          <Text fontSize="xs" color="gray.500" mt={2}>Avg donated: {formatCurrency(a.avg_donated)}</Text>
                          <Text fontSize="xs" color="gray.500">Avg per tx: {formatCurrency(a.avg_single)}</Text>
                        </Box>
                      ))}
                      <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                        <Text fontSize="xs" color="gray.500" mb={1}>Broad Participation Rounds</Text>
                        <Text fontSize="xl" fontWeight="semibold">{Number(data.qfSummary?.rounds_with_broad_participation || 0)}</Text>
                        <Text fontSize="xs" color="gray.400">rounds with 10+ avg donors/project</Text>
                      </Box>
                      <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                        <Text fontSize="xs" color="gray.500" mb={1}>Avg Top-10 Donor Concentration</Text>
                        <Text fontSize="xl" fontWeight="semibold">{Number(data.qfSummary?.avg_top10_concentration || 0).toFixed(1)}%</Text>
                        <Text fontSize="xs" color="gray.400">of round volume from top 10 donors</Text>
                      </Box>
                    </SimpleGrid>
                  )}

                  {retentionData.length > 0 && (
                    <ChartCard title="Donor Cohort Retention" subtitle="New donors per year and how many returned the following year" height="340px">
                      <ComposedChart
                        data={retentionData}
                        xKey="year"
                        series={[
                          { type: 'bar', dataKey: 'cohort', name: 'New Donors', color: gitcoinColors.primary, yAxisId: 'left' },
                          { type: 'line', dataKey: 'retention_pct', name: 'Year-1 Retention %', color: gitcoinColors.secondary, yAxisId: 'right', strokeWidth: 2, dot: true },
                        ]}
                        yAxes={[
                          { id: 'left', tickFormatter: (v: number) => formatNumber(v) },
                          { id: 'right', orientation: 'right', tickFormatter: (v: number) => `${v}%` },
                        ]}
                        height={340}
                        tooltipFormatter={(value: number, name: string) => [
                          name.includes('%') ? `${value}%` : formatNumber(value), name,
                        ]}
                      />
                    </ChartCard>
                  )}

                  {tokenFlowData.length > 0 && (
                    <ChartCard title="Top Donation Tokens by Volume" subtitle="Which tokens move through the protocol most" height="340px">
                      <BarChart
                        data={tokenFlowData}
                        xKey="name"
                        bars={[{ dataKey: 'volume', name: 'Volume (USD)', color: gitcoinColors.secondary }]}
                        layout="vertical"
                        height={340}
                        tooltipFormatter={(value: number) => [formatCurrency(value), 'Volume']}
                      />
                    </ChartCard>
                  )}

                  <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="md" fontWeight="semibold" mb={1}>Top Projects by QF Score</Text>
                    <Text fontSize="xs" color="gray.500" mb={4}>
                      QF Score = (∑√donation)² — projects with many small donors outrank those with fewer large donors.
                      QF Advantage = how many positions higher the project ranks under QF vs pure dollar volume.
                    </Text>
                    <VStack align="stretch" gap={0}>
                      {(data.topQfProjects || []).slice(0, 10).map((p, idx) => (
                        <HStack key={idx} justify="space-between" py={3} borderBottomWidth={idx < 9 ? '1px' : '0'} borderColor="gray.100" flexWrap="wrap" gap={2}>
                          <VStack align="start" gap={0} flex={1} minW="160px">
                            <Text fontSize="sm" fontWeight="medium" color="gray.800">{p.project_name || `Project ${p.project_id?.slice(0, 8)}`}</Text>
                            <Text fontSize="xs" color="gray.400">{p.round_name?.slice(0, 40) || 'Unknown round'}</Text>
                          </VStack>
                          <HStack gap={6} flexWrap="wrap">
                            <VStack align="end" gap={0}>
                              <Text fontSize="xs" color="gray.500">Unique Donors</Text>
                              <Text fontSize="sm" fontWeight="semibold" color={gitcoinColors.primary}>{formatNumber(p.unique_donors)}</Text>
                            </VStack>
                            <VStack align="end" gap={0}>
                              <Text fontSize="xs" color="gray.500">Community $</Text>
                              <Text fontSize="sm" fontWeight="medium">{formatCurrency(p.total_donated_usd)}</Text>
                            </VStack>
                            <VStack align="end" gap={0}>
                              <Text fontSize="xs" color="gray.500">QF Advantage</Text>
                              <Badge
                                bg={p.qf_advantage_over_volume_rank > 0 ? '#10B981' : p.qf_advantage_over_volume_rank < 0 ? '#EF4444' : 'gray.400'}
                                color="white" px={2} py={0.5} borderRadius="md" fontSize="xs"
                              >
                                {p.qf_advantage_over_volume_rank > 0 ? '+' : ''}{p.qf_advantage_over_volume_rank}
                              </Badge>
                            </VStack>
                          </HStack>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                </VStack>
              )}
            </Tabs.Content>

            {/* ── CHAINS TAB ────────────────────────────────────────────── */}
            <Tabs.Content value="chains">
              <VStack gap={8} align="stretch">
                <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>
                  Multi-Chain Deployment ({data.summary?.unique_chains || 0} blockchains)
                </Text>

                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
                  {(data.chainMetrics || []).map((chain, idx) => (
                    <Box key={chain.chain_id} p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100" borderLeftWidth="4px" borderLeftColor={CHAIN_COLORS[idx % CHAIN_COLORS.length]}>
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
                          <Text fontSize="md" fontWeight="semibold" color={gitcoinColors.primary}>{formatCurrency(chain.total_funding_volume_usd)}</Text>
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
                    tooltipFormatter={(value: number, name: string) => [formatCurrency(value), name]}
                  />
                </ChartCard>
              </VStack>
            </Tabs.Content>

            {/* ── ROUNDS TAB ────────────────────────────────────────────── */}
            <Tabs.Content value="rounds">
              {sections.rounds === 'loading' ? <SectionSpinner /> : (
                <VStack gap={6} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">
                      Showing {Math.min(visibleRounds, data.topRounds?.length || 0)} of {data.topRounds?.length || 0} rounds (sorted by matching pool size)
                    </Text>
                  </HStack>

                  {(data.topRounds || []).slice(0, visibleRounds).map((round, idx) => (
                    <Box key={idx} p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100" _hover={{ borderColor: 'gray.300', shadow: 'sm' }} transition="all 0.2s">
                      <HStack justify="space-between" mb={4}>
                        <VStack align="start" gap={1}>
                          <HStack gap={2} flexWrap="wrap">
                            <Text fontSize="md" fontWeight="semibold">{round.round_name || `Round ${round.round_id?.slice(0, 8)}`}</Text>
                          </HStack>
                          <HStack gap={2} flexWrap="wrap">
                            <Badge bg={round.is_active ? gitcoinColors.accent : 'gray.400'} color="white" px={2} py={0.5} borderRadius="md" fontSize="xs">
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
                          <Text fontSize="2xl" fontWeight="bold" color={gitcoinColors.primary}>{formatCurrency(round.matching_pool_usd)}</Text>
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

                  {visibleRounds < (data.topRounds?.length || 0) && (
                    <Center>
                      <Button onClick={() => setVisibleRounds(v => v + 10)} variant="outline" colorPalette="gray" size="lg">
                        Load More ({(data.topRounds?.length || 0) - visibleRounds} remaining)
                      </Button>
                    </Center>
                  )}
                </VStack>
              )}
            </Tabs.Content>

            {/* ── HISTORY TAB ───────────────────────────────────────────── */}
            <Tabs.Content value="history">
              {sections.history === 'loading' ? <SectionSpinner /> : (
                <VStack gap={8} align="stretch">
                  <Text fontSize="lg" fontWeight="semibold" color={gitcoinColors.primary}>Historical Growth</Text>

                  {yearlyData.length > 0 ? (
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
                            name === 'Rounds' ? `${value} rounds` : formatNumber(value), name,
                          ]}
                        />
                      </ChartCard>

                      <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                        <Text fontSize="md" fontWeight="semibold" mb={4}>Year-by-Year Breakdown</Text>
                        <Box overflowX="auto">
                          <Box as="table" w="full" fontSize="sm">
                            <Box as="thead">
                              <Box as="tr" borderBottomWidth="2px" borderColor="gray.200">
                                {['Year', 'Rounds', 'Matching Pool', 'Community Donations', 'Donors'].map(h => (
                                  <Box key={h} as="th" textAlign="left" py={2} pr={6} color="gray.500" fontWeight="medium" fontSize="xs" textTransform="uppercase">{h}</Box>
                                ))}
                              </Box>
                            </Box>
                            <Box as="tbody">
                              {yearlyData.map((row, idx) => (
                                <Box key={idx} as="tr" borderBottomWidth="1px" borderColor="gray.100" _hover={{ bg: 'gray.50' }}>
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
                  ) : (
                    <Center py={16}>
                      <Text color="gray.400">No historical data available yet — run the pipeline to populate this view.</Text>
                    </Center>
                  )}
                </VStack>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </Container>
      </Box>

      <Box bg="gray.50" borderTop="1px" borderColor="gray.200" py={6}>
        <Container maxW="7xl">
          <VStack align="start" gap={2}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wide">
              Data Notes
            </Text>
            <Text fontSize="xs" color="gray.500">
              <strong>Donation outliers excluded:</strong> 15 records with values exceeding $50,000 USD were excluded from all donation aggregates. These records contain raw on-chain token amounts (not USD) due to a known data quality issue in the source CSV snapshot. The excluded records represent 2 unique wallets with values up to $2.5 trillion per transaction. All donation counts, totals, averages, and chain metrics reflect the remaining 497,332 clean records.
            </Text>
            <Text fontSize="xs" color="gray.500">
              <strong>Matching pool totals:</strong> Grant pool sizes are capped at $5M per round to exclude 3 rounds with anomalous values likely caused by the same raw token unit issue. This affects <em>total_matching_pool_usd</em> and <em>total_distributed_usd</em> fields.
            </Text>
          </VStack>
        </Container>
      </Box>
      <SupportFooter />
    </>
  );
}
