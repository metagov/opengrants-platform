import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
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
  Badge,
  Code,
} from '@chakra-ui/react';
import { Navigation } from '../../../../components/Navigation';
import { SystemHeader } from '../../../../components/SystemHeader';
import { MetricCard } from '../../../../components/MetricCard';
import { brandColors } from '../../../../theme/colors';
import { formatCurrency } from '../../../../lib/formatters';
import { paidStatus } from '../../../../lib/scfPaid';

interface Award {
  application_id: string;
  round_name: string;
  quarter_year: string | null;
  submission_title: string | null;
  one_sentence_description: string | null;
  award_type: string | null;
  total_awarded_usd: number | null;
  total_paid_usd: number | null;
  tranche_completion: number | null;
  tranche_status: string | null;
  last_payment_date: string | null;
  submission_url: string | null;
}

interface ProjectData {
  metadata: { last_indexed_at: string } | null;
  project: {
    project_id: string;
    project_name: string | null;
    description?: string | null;
    category?: string | null;
    website?: string | null;
    github?: string | null;
    x?: string | null;
    discord?: string | null;
    linkedin?: string | null;
    integration_status?: string | null;
    regions?: string | null;
    open_source?: string | null;
    soroban_used?: string | null;
  };
  projectRecordMissing: boolean;
  summary: {
    award_count: number;
    total_awarded_usd: number;
    total_paid_usd: number;
    first_round: string | null;
    latest_round: string | null;
    avg_tranche_completion: number | null;
  };
  awards: Award[];
}

const roundNumber = (name: string) => (name || '').match(/#\s*(\d+)/)?.[1];

// Airtable link fields can hold several comma-separated URLs.
const firstUrl = (v?: string | null) => {
  const u = (v || '').split(/[\s,]+/).find((s) => /^https?:\/\//i.test(s));
  return u || null;
};

function ExternalLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Text fontSize="sm" color={brandColors.teal} _hover={{ textDecoration: 'underline' }}>
        {label} ↗
      </Text>
    </a>
  );
}

export default function SCFProjectPage() {
  const router = useRouter();
  const { projectId } = router.query;
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/systems/scf/project/${encodeURIComponent(String(projectId))}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Project not found' : 'Could not load project');
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

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

  if (error || !data) {
    return (
      <>
        <Navigation />
        <Container maxW="7xl" py={12}>
          <Box textAlign="center" py={20}>
            <Text fontSize="xl" color="gray.600">{error || 'Project not found'}</Text>
            <Link href="/system/scf/projects">
              <Text color={brandColors.teal} mt={4} cursor="pointer">Browse all SCF projects</Text>
            </Link>
          </Box>
        </Container>
      </>
    );
  }

  const { project, summary, awards } = data;
  const name = project.project_name || awards[0]?.submission_title || project.project_id;
  const paidPct = summary.total_awarded_usd > 0 ? (summary.total_paid_usd / summary.total_awarded_usd) * 100 : 0;
  const awardStatuses = awards.map((a) => paidStatus(a.total_awarded_usd, a.total_paid_usd));
  const paidSubtitle = awardStatuses.includes('over')
    ? 'Source data records more paid than awarded'
    : awardStatuses.includes('award_missing')
      ? 'Some award amounts not recorded in source data'
      : `${paidPct.toFixed(0)}% of awarded`;
  const apiPath = `/api/systems/scf/project/${encodeURIComponent(String(projectId))}`;
  const rounds = awards.map((a) => a.round_name);
  const span =
    summary.first_round && summary.latest_round && summary.first_round !== summary.latest_round
      ? `${summary.first_round} – ${summary.latest_round}`
      : summary.first_round || '—';

  return (
    <>
      <Head>
        <title>{`${name} · SCF funding history · OpenGrants`}</title>
        <meta
          name="description"
          content={`Stellar Community Fund funding history for ${name}: ${summary.award_count} award(s), ${formatCurrency(summary.total_awarded_usd)} awarded.`}
        />
      </Head>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <HStack mb={4} gap={4}>
            <Link href="/system/scf/projects">
              <Text color={brandColors.teal} fontSize="sm" cursor="pointer">← All SCF projects</Text>
            </Link>
            <Link href="/system/scf">
              <Text color={brandColors.teal} fontSize="sm" cursor="pointer">SCF overview</Text>
            </Link>
          </HStack>

          <SystemHeader
            title={name}
            description={[project.category, project.integration_status, span].filter(Boolean).join(' • ')}
            color={brandColors.olive}
          />

          {data.projectRecordMissing && (
            <Box p={4} mb={6} bg="orange.50" borderRadius="md" borderWidth="1px" borderColor="orange.200">
              <Text fontSize="sm" color="orange.800">
                This project&apos;s record is missing from the SCF project list, so only its awards are
                shown. This usually means the project was renamed or its link is blank in the source data.
              </Text>
            </Box>
          )}

          <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} gap={6} mb={8}>
            <MetricCard label="Total Awarded" value={formatCurrency(summary.total_awarded_usd)} color={brandColors.olive} />
            <MetricCard
              label="Total Paid"
              value={formatCurrency(summary.total_paid_usd)}
              subtitle={paidSubtitle}
            />
            <MetricCard label="SCF Awards" value={summary.award_count} subtitle={rounds.join(', ')} />
            <MetricCard
              label="Avg Tranche Completion"
              value={summary.avg_tranche_completion === null ? '—' : `${summary.avg_tranche_completion.toFixed(0)}%`}
              subtitle="Build awards"
            />
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, lg: 3 }} gap={6} alignItems="start">
            <Box gridColumn={{ lg: 'span 2' }}>
              <Text fontSize="lg" fontWeight="semibold" mb={4}>Funding history</Text>
              <VStack gap={4} align="stretch">
                {awards.length === 0 && (
                  <Text fontSize="sm" color="gray.500">No awards recorded.</Text>
                )}
                {awards.map((a) => {
                  const n = roundNumber(a.round_name);
                  const pct = a.tranche_completion ?? null;
                  return (
                    <Box key={a.application_id + a.round_name} p={5} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                      <HStack justify="space-between" align="start" flexWrap="wrap" gap={2} mb={2}>
                        <VStack align="start" gap={1} flex={1} minW={0}>
                          <HStack gap={2} flexWrap="wrap">
                            {n ? (
                              <Link href={`/system/scf/${n}`}>
                                <Text fontWeight="semibold" color={brandColors.teal} cursor="pointer">{a.round_name}</Text>
                              </Link>
                            ) : (
                              <Text fontWeight="semibold">{a.round_name}</Text>
                            )}
                            {a.quarter_year && <Text fontSize="xs" color="gray.500">{a.quarter_year}</Text>}
                            {a.award_type && <Badge fontSize="xs" px={2}>{a.award_type}</Badge>}
                          </HStack>
                          {a.submission_title && <Text fontSize="sm" color="gray.700">{a.submission_title}</Text>}
                          {a.one_sentence_description && (
                            <Text fontSize="sm" color="gray.500">{a.one_sentence_description}</Text>
                          )}
                        </VStack>
                        <VStack align="end" gap={0}>
                          <Text fontSize="lg" fontWeight="bold" color={brandColors.olive}>
                            {formatCurrency(a.total_awarded_usd)}
                          </Text>
                          <Text fontSize="xs" color="gray.500">{formatCurrency(a.total_paid_usd)} paid</Text>
                          {paidStatus(a.total_awarded_usd, a.total_paid_usd) === 'over' && (
                            <Text fontSize="xs" color="orange.600" title="SDF's source data records more paid than awarded for this award, beyond normal XLM exchange-rate differences.">
                              Paid exceeds award in source data
                            </Text>
                          )}
                          {paidStatus(a.total_awarded_usd, a.total_paid_usd) === 'award_missing' && (
                            <Text fontSize="xs" color="gray.600" title="SDF's source data has payments for this award but no award amount.">
                              Award amount not recorded in source data
                            </Text>
                          )}
                        </VStack>
                      </HStack>
                      {pct !== null && a.award_type === 'Build' && (
                        <Box mt={3}>
                          <HStack justify="space-between" mb={1}>
                            <Text fontSize="xs" color="gray.500">Tranche completion</Text>
                            <Text fontSize="xs" color="gray.600">
                              {Number(pct).toFixed(0)}%{a.tranche_status ? ` · ${a.tranche_status}` : ''}
                            </Text>
                          </HStack>
                          <Box h="6px" bg="gray.100" borderRadius="full" overflow="hidden">
                            <Box h="100%" w={`${Math.min(100, Math.max(0, Number(pct)))}%`} bg={brandColors.olive} />
                          </Box>
                        </Box>
                      )}
                      <HStack gap={4} mt={3} flexWrap="wrap">
                        {a.last_payment_date && (
                          <Text fontSize="xs" color="gray.500">Last payment: {a.last_payment_date}</Text>
                        )}
                        <ExternalLink href={firstUrl(a.submission_url)} label="SCF submission" />
                      </HStack>
                    </Box>
                  );
                })}
              </VStack>
            </Box>

            <VStack align="stretch" gap={6}>
              {project.description && (
                <Box p={5} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>About</Text>
                  <Text fontSize="sm" color="gray.600" whiteSpace="pre-line">{project.description}</Text>
                </Box>
              )}

              <Box p={5} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                <Text fontSize="sm" fontWeight="semibold" mb={2}>Links</Text>
                <VStack align="start" gap={1}>
                  <ExternalLink href={firstUrl(project.website)} label="Website" />
                  <ExternalLink href={firstUrl(project.github)} label="GitHub" />
                  <ExternalLink href={firstUrl(project.x)} label="X" />
                  <ExternalLink href={firstUrl(project.discord)} label="Discord" />
                  <ExternalLink href={firstUrl(project.linkedin)} label="LinkedIn" />
                </VStack>
                {[project.regions && `Regions: ${project.regions}`, project.open_source && `Open source: ${project.open_source}`, project.soroban_used && `Soroban: ${project.soroban_used}`]
                  .filter(Boolean)
                  .map((t) => (
                    <Text key={String(t)} fontSize="xs" color="gray.500" mt={2}>{t}</Text>
                  ))}
              </Box>

              <Box p={5} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                <Text fontSize="sm" fontWeight="semibold" mb={2}>Data</Text>
                <Text fontSize="xs" color="gray.500" mb={1}>DAOIP-5 project ID</Text>
                <Code fontSize="xs" px={2} py={1} display="block" whiteSpace="normal" wordBreak="break-all">
                  {project.project_id}
                </Code>
                <VStack align="start" gap={1} mt={3}>
                  <ExternalLink href={apiPath} label="JSON for this page" />
                  <ExternalLink
                    href={`https://www.pgatlas.xyz/projects/${encodeURIComponent(project.project_id)}`}
                    label="PG Atlas (if listed)"
                  />
                </VStack>
              </Box>
            </VStack>
          </SimpleGrid>

          {data.metadata?.last_indexed_at && (
            <Text fontSize="xs" color="gray.400" mt={8} textAlign="center">
              Data indexed:{' '}
              {new Date(data.metadata.last_indexed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
        </Container>
      </Box>
    </>
  );
}
