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
} from '@chakra-ui/react';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { ProgramProfile } from '../../components/ProgramProfile';
import { BarChart, PieChart, ChartCard } from '../../components/charts';
import { brandColors } from '../../theme/colors';

// ── Types ──────────────────────────────────────────────────────────────────

interface ENSRound {
  round_id: string;
  round_name: string;
  close_date: string;
  is_open: boolean;
  start_ts: number;
  end_ts: number;
  total_votes: number;
  scoring_total: number;
  total_choices: number;
  author: string;
  vote_type: string;
  vote_system: 'Token Weighted' | 'Equal Weight';
}

interface ENSSummary {
  total_rounds: number;
  total_applicants: number;
  unique_project_names: number;
  avg_score_per_applicant: number;
  total_votes: number;
  unique_voters: number;
  repeat_voters: number;
  repeat_voter_pct: number;
  avg_rounds_per_voter: number;
}

interface ENSData {
  summary: ENSSummary;
  rounds: ENSRound[];
  roundTypeBreakdown: Array<{
    round_type: string;
    round_count: number;
    total_applicants: number;
    token_weighted_vp: number;
  }>;
  topProjects: Array<{
    project_name: string;
    total_voting_power: number;
    rounds_participated: number;
    avg_vote_share_pct: number;
    latest_round: string;
    round_type: string;
  }>;
  roundsParticipation: Array<{
    round_number: number;
    round_type: string;
    applicant_count: number;
  }>;
  voterParticipation: Array<{
    round_name: string;
    end_ts: number;
    unique_voters: number;
    avg_vp_per_voter: number;
    max_vp: number;
  }>;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ENS_BLUE = '#5298FF';
const ENS_DARK = '#1A1A2E';

const COLORS = [
  ENS_BLUE,
  brandColors.teal,
  brandColors.olive,
  brandColors.deepPurple,
  '#E07000',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatVP(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatDate(ts: number | string): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ENSPage() {
  const [data, setData] = useState<ENSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleRounds, setVisibleRounds] = useState(10);

  useEffect(() => {
    fetch('/api/systems/ens')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching ENS data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color={ENS_BLUE} />
        </Center>
      </>
    );
  }

  // ── Chart data ─────────────────────────────────────────────────────────

  const participationChartData = (data?.roundsParticipation || []).map(r => ({
    name: `R${r.round_number}`,
    applicants: Number(r.applicant_count) || 0,
    type: r.round_type,
  }));

  const roundTypeData = (data?.roundTypeBreakdown || []).map(rt => ({
    name: rt.round_type || 'Unknown',
    value: Number(rt.round_count) || 0,
  }));

  // Voter participation per round — short round label
  const voterTrendData = (data?.voterParticipation || []).map(v => ({
    name: (() => {
      const m = v.round_name?.match(/^(.+?)\s+Round\s+(\d+)/);
      return m ? `${m[1].split(' ').map((w: string) => w[0]).join('')}${m[2]}` : v.round_name?.slice(0, 8) || '?';
    })(),
    voters: Number(v.unique_voters) || 0,
  }));

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="ENS Small Grants"
            description="Community-governed small grants program for ENS ecosystem and public goods"
            color={ENS_BLUE}
          />

          {/* Top-line KPIs */}
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={6} mb={6}>
            <MetricCard label="Rounds" value={data?.summary?.total_rounds || 0} color={ENS_BLUE} />
            <MetricCard label="Unique Projects" value={(data?.summary?.unique_project_names || 0).toLocaleString()} />
            <MetricCard label="Unique Voters" value={(data?.summary?.unique_voters || 0).toLocaleString()} />
            <MetricCard
              label="Repeat Voters"
              value={`${data?.summary?.repeat_voter_pct || 0}%`}
              subtitle="voted in 2+ rounds"
            />
          </SimpleGrid>

          {/* Data enrichment notice */}
          <Box
            mb={10}
            px={4}
            py={3}
            bg="blue.50"
            borderRadius="md"
            borderLeftWidth="3px"
            borderLeftColor="blue.400"
          >
            <HStack gap={2} align="center">
              <Badge colorScheme="blue" fontSize="xs" px={2} py={1} borderRadius="full">
                Data Enrichment In Progress
              </Badge>
              <Text fontSize="sm" color="blue.700" fontFamily="Inter">
                We don't yet have USD grant value data for ENS; Funding amounts are denominated in ENS voting power, not USD.
              </Text>
            </HStack>
          </Box>

          <Tabs.Root defaultValue="overview" variant="line">
            <Tabs.List borderBottomWidth="1px" borderColor="gray.200" mb={8} gap={2}>
              {['overview', 'projects', 'voters', 'rounds'].map(tab => (
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
                  _selected={{ color: ENS_BLUE, borderColor: ENS_BLUE }}
                  _hover={{ color: ENS_BLUE }}
                >
                  {tab === 'voters' ? 'Voter Analysis' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* ── OVERVIEW TAB ──────────────────────────────────────────── */}
            <Tabs.Content value="overview">
              <VStack gap={8} align="stretch">
                <ProgramProfile
                  name="ENS Small Grants"
                  description="ENS DAO runs a community-governed small grants program to support builders and public goods contributors in the ENS ecosystem. Two grant tracks — Ecosystem and Public Goods — allocate funding each round through token-weighted voting on Snapshot."
                  programDescription="Each round, ENS token holders vote on a slate of applicants using the small-grants.eth Snapshot space. The top vote-getters in each category receive grants. Rounds typically run every 3 months with separate tracks for ecosystem tooling and broader public goods work."
                  primaryMechanism="Ranked Choice Voting"
                  fundingMechanismDescription="ENS token holders allocate their voting power across applicants in each round. Projects with the highest total voting power receive grants. The mechanism rewards community endorsement over individual large donors."
                  links={[
                    { label: 'ENS DAO', url: 'https://ensdao.org' },
                    { label: 'Small Grants', url: 'https://small-grants.eth.limo' },
                    { label: 'Snapshot Space', url: 'https://snapshot.org/#/small-grants.eth' },
                  ]}
                  tags={['ENS', 'Web3', 'Ethereum', 'Public Goods', 'DAO Governance']}
                  color={ENS_BLUE}
                />

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  <ChartCard title="Applicants per Round">
                    <BarChart
                      data={participationChartData}
                      xKey="name"
                      bars={[{ dataKey: 'applicants', name: 'Applicants', color: ENS_BLUE }]}
                      height={300}
                      rotateLabels
                      tickSize="xs"
                    />
                  </ChartCard>

                  <ChartCard title="Rounds by Track">
                    <PieChart
                      data={roundTypeData}
                      colors={COLORS}
                      height={300}
                      tooltipFormatter={(value: number) => [String(value), 'Rounds']}
                    />
                  </ChartCard>
                </SimpleGrid>

                {/* Track breakdown — applicant counts only, no misleading VP aggregate */}
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                  {(data?.roundTypeBreakdown || []).map((rt, idx) => (
                    <Box key={idx} p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <Text fontSize="sm" fontWeight="semibold" color="gray.500" mb={3} textTransform="uppercase" letterSpacing="wide">
                        {rt.round_type}
                      </Text>
                      <VStack align="stretch" gap={2}>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="gray.600">Rounds</Text>
                          <Text fontSize="sm" fontWeight="medium">{Number(rt.round_count).toLocaleString()}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="gray.600">Total Applicants</Text>
                          <Text fontSize="sm" fontWeight="medium">{Number(rt.total_applicants).toLocaleString()}</Text>
                        </HStack>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="gray.600">Avg per Round</Text>
                          <Text fontSize="sm" fontWeight="medium">
                            {rt.round_count > 0 ? Math.round(rt.total_applicants / rt.round_count) : 0}
                          </Text>
                        </HStack>
                      </VStack>
                    </Box>
                  ))}
                </SimpleGrid>
              </VStack>
            </Tabs.Content>

            {/* ── TOP PROJECTS TAB ──────────────────────────────────────── */}
            <Tabs.Content value="projects">
              <VStack gap={4} align="stretch">
                <Text fontSize="sm" color="gray.500" mb={2}>
                  Projects ranked by total voting power received across all token-weighted rounds. Avg vote share shows typical % of round total captured.
                </Text>
                {(data?.topProjects || []).map((project, idx) => (
                  <Box key={idx} p={5} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <HStack justify="space-between" gap={4}>
                      <HStack gap={4} flex="1" minW="0">
                        <Text fontSize="xl" fontWeight="bold" color="gray.300" w="2rem" flexShrink={0}>
                          {idx + 1}
                        </Text>
                        <VStack align="start" gap={1} flex="1" minW="0">
                          <Text fontSize="sm" fontWeight="semibold" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                            {project.project_name}
                          </Text>
                          <HStack gap={2} flexWrap="wrap">
                            {project.round_type && (
                              <Badge colorPalette="blue" size="sm">{project.round_type}</Badge>
                            )}
                            <Text fontSize="xs" color="gray.500">
                              {Number(project.rounds_participated)} round{Number(project.rounds_participated) !== 1 ? 's' : ''}
                            </Text>
                            {Number(project.avg_vote_share_pct) > 0 && (
                              <Text fontSize="xs" color="gray.400">
                                ~{Number(project.avg_vote_share_pct).toFixed(1)}% avg share of round
                              </Text>
                            )}
                          </HStack>
                        </VStack>
                      </HStack>
                      <VStack align="end" gap={0} flexShrink={0}>
                        <Text fontSize="lg" fontWeight="bold" color={ENS_BLUE}>
                          {formatVP(Number(project.total_voting_power))}
                        </Text>
                        <Text fontSize="xs" color="gray.400">voting power</Text>
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Tabs.Content>

            {/* ── VOTER ANALYSIS TAB ────────────────────────────────────── */}
            <Tabs.Content value="voters">
              <VStack gap={8} align="stretch">
                <Text fontSize="lg" fontWeight="semibold" color={ENS_BLUE}>Voter Participation</Text>

                <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Unique Voters</Text>
                    <Text fontSize="xl" fontWeight="semibold" color={ENS_BLUE}>
                      {(data?.summary?.unique_voters || 0).toLocaleString()}
                    </Text>
                    <Text fontSize="xs" color="gray.400">across {data?.summary?.total_rounds || 0} rounds</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Repeat Voters</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {(data?.summary?.repeat_voters || 0).toLocaleString()}
                    </Text>
                    <Text fontSize="xs" color="gray.400">{data?.summary?.repeat_voter_pct || 0}% of all voters</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Avg Rounds per Voter</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {data?.summary?.avg_rounds_per_voter || 0}
                    </Text>
                    <Text fontSize="xs" color="gray.400">participation depth</Text>
                  </Box>
                  <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <Text fontSize="xs" color="gray.500" mb={1}>Total Votes Cast</Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {(data?.summary?.total_votes || 0).toLocaleString()}
                    </Text>
                    <Text fontSize="xs" color="gray.400">individual Snapshot votes</Text>
                  </Box>
                </SimpleGrid>

                {voterTrendData.length > 0 && (
                  <ChartCard
                    title="Unique Voters per Round"
                    subtitle="Consistent participation metric across both voting systems (token-weighted and equal-weight)"
                  >
                    <BarChart
                      data={voterTrendData}
                      xKey="name"
                      bars={[{ dataKey: 'voters', name: 'Unique Voters', color: ENS_BLUE }]}
                      height={300}
                      rotateLabels
                      tickSize="xs"
                      tooltipFormatter={(value: number) => [String(value) + ' wallets', 'Unique Voters']}
                    />
                  </ChartCard>
                )}

                <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="md" fontWeight="semibold" mb={1}>Data Notes</Text>
                  <VStack align="start" gap={2} mt={3}>
                    <Text fontSize="xs" color="gray.500">
                      <strong>Voting systems:</strong> Rounds 10-11 (both tracks) used equal-weight voting (each voter received 100 VP regardless of ENS holdings). All other rounds used token-weighted voting where VP = ENS tokens held. Voting power totals are not comparable across these systems.
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      <strong>No USD amounts:</strong> ENS Small Grants allocates fixed grants (e.g. top 5 projects per round receive $10K–$50K each), but exact disbursement amounts are not recorded in the on-chain snapshot data. The metrics here reflect participation and voting power only.
                    </Text>
                  </VStack>
                </Box>
              </VStack>
            </Tabs.Content>

            {/* ── ROUNDS TAB ────────────────────────────────────────────── */}
            <Tabs.Content value="rounds">
              <VStack gap={6} align="stretch">
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" color="gray.500">
                    Showing {Math.min(visibleRounds, data?.rounds?.length || 0)} of {data?.rounds?.length || 0} rounds
                  </Text>
                </HStack>

                {(data?.rounds || []).slice(0, visibleRounds).map((round, idx) => (
                  <Box key={idx} p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <HStack justify="space-between" mb={4}>
                      <VStack align="start" gap={1}>
                        <Text fontSize="lg" fontWeight="semibold">{round.round_name}</Text>
                        <HStack gap={2} flexWrap="wrap">
                          <Badge colorPalette={round.is_open ? 'green' : 'gray'}>
                            {round.is_open ? 'Active' : 'Closed'}
                          </Badge>
                          {round.vote_system && (
                            <Badge
                              bg={round.vote_system === 'Token Weighted' ? ENS_BLUE : brandColors.teal}
                              color="white"
                              px={2} py={0.5} borderRadius="md" fontSize="xs"
                            >
                              {round.vote_system}
                            </Badge>
                          )}
                          {round.vote_type && (
                            <Badge colorPalette="purple">{round.vote_type}</Badge>
                          )}
                        </HStack>
                      </VStack>
                      <VStack align="end" gap={0}>
                        <Text fontSize="2xl" fontWeight="bold" color={ENS_BLUE}>
                          {(Number(round.total_votes) || 0).toLocaleString()}
                        </Text>
                        <Text fontSize="xs" color="gray.400">voters</Text>
                      </VStack>
                    </HStack>
                    <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Applicants</Text>
                        <Text fontSize="md" fontWeight="medium">{(Number(round.total_choices) || 0).toLocaleString()}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Total Scoring</Text>
                        <Text fontSize="md" fontWeight="medium">
                          {round.vote_system === 'Token Weighted'
                            ? formatVP(Number(round.scoring_total))
                            : `${(Number(round.total_votes) || 0)} × 100`}
                        </Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">End Date</Text>
                        <Text fontSize="md" fontWeight="medium">{formatDate(round.end_ts)}</Text>
                      </VStack>
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" color="gray.500">Author</Text>
                        <Text fontSize="sm" fontWeight="medium" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" maxW="120px">
                          {round.author ? `${round.author.slice(0, 6)}…${round.author.slice(-4)}` : '—'}
                        </Text>
                      </VStack>
                    </SimpleGrid>
                  </Box>
                ))}

                {visibleRounds < (data?.rounds?.length || 0) && (
                  <Center>
                    <Button onClick={() => setVisibleRounds(prev => prev + 10)} variant="outline" colorPalette="gray" size="lg">
                      Load More ({(data?.rounds?.length || 0) - visibleRounds} remaining)
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
