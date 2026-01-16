import { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';
import { Navigation } from '../../../components/Navigation';
import { SystemHeader } from '../../../components/SystemHeader';
import { MetricCard } from '../../../components/MetricCard';
import { brandColors } from '../../../theme/colors';

interface RoundData {
  metadata: {
    platform: string;
    last_indexed_at: string;
    data_source: string;
  } | null;
  round: {
    round_id: string;
    round_name: string;
    description: string;
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
    round_url: string;
    round_recap: string;
  };
  projects: Array<{
    project_id: string;
    project_name: string;
    description: string;
    category: string;
    total_awarded_usd: number;
    total_paid_usd: number;
    tranche_completion: number;
    tranche_status: string;
    award_type: string;
    website: string;
    one_sentence_description: string;
  }>;
  projectCount: number;
}

export default function SCFRoundPage() {
  const router = useRouter();
  const { roundNumber } = router.query;
  const [data, setData] = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roundNumber) return;
    
    fetch(`/api/systems/scf/${roundNumber}`)
      .then(res => {
        if (!res.ok) throw new Error('Round not found');
        return res.json();
      })
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching round data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [roundNumber]);

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
            <Text fontSize="xl" color="gray.600">Round not found</Text>
            <Link href="/system/scf">
              <Text color={brandColors.teal} mt={4} cursor="pointer">Back to SCF</Text>
            </Link>
          </Box>
        </Container>
      </>
    );
  }

  const { round, projects } = data;

  const formatCurrency = (value: number) => {
    if (!value) return '$0';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Applications': brandColors.olive,
      'Developer Tooling': brandColors.teal,
      'Infrastructure & Services': brandColors.deepPurple,
      'Financial Protocols': brandColors.burgundy,
      'Education & Community': '#E07000',
    };
    return colors[category] || 'gray.500';
  };

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <HStack mb={4}>
            <Link href="/system/scf">
              <Text color={brandColors.teal} fontSize="sm" cursor="pointer">
                ← Back to SCF
              </Text>
            </Link>
          </HStack>

          <SystemHeader
            title={round.round_name}
            description={`${round.quarter_year} • ${round.round_type || 'Build Award Round'}`}
            color={brandColors.olive}
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} gap={6} mb={8}>
            <MetricCard
              label="Total Paid"
              value={formatCurrency(round.total_paid_usd)}
              color={brandColors.olive}
            />
            <MetricCard
              label="Total Awarded"
              value={formatCurrency(round.total_awarded_usd)}
            />
            <MetricCard
              label="Projects Funded"
              value={round.awarded_submissions || 0}
            />
            <MetricCard
              label="Avg per Project"
              value={formatCurrency(round.avg_awarded_usd)}
            />
          </SimpleGrid>

          {round.applied_submissions && (
            <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100" mb={8}>
              <HStack gap={8} flexWrap="wrap">
                <VStack align="start" gap={0}>
                  <Text fontSize="xs" color="gray.500">Applications</Text>
                  <Text fontSize="md" fontWeight="medium">{round.applied_submissions}</Text>
                </VStack>
                <VStack align="start" gap={0}>
                  <Text fontSize="xs" color="gray.500">Acceptance Rate</Text>
                  <Text fontSize="md" fontWeight="medium">
                    {((round.awarded_submissions / round.applied_submissions) * 100).toFixed(0)}%
                  </Text>
                </VStack>
                {round.voters_count && (
                  <VStack align="start" gap={0}>
                    <Text fontSize="xs" color="gray.500">Voters</Text>
                    <Text fontSize="md" fontWeight="medium">{round.voters_count}</Text>
                  </VStack>
                )}
              </HStack>
            </Box>
          )}

          <Box mb={6}>
            <Text fontSize="lg" fontWeight="semibold" mb={4}>
              Funded Projects ({projects.length})
            </Text>
          </Box>

          <VStack gap={4} align="stretch">
            {projects.map((project, idx) => (
              <Box 
                key={project.project_id || idx} 
                p={6} 
                bg="white" 
                borderRadius="lg" 
                borderWidth="1px" 
                borderColor="gray.100"
                _hover={{ borderColor: 'gray.200', shadow: 'sm' }}
                transition="all 0.2s"
              >
                <HStack justify="space-between" align="start" mb={3} flexWrap="wrap" gap={2}>
                  <VStack align="start" gap={1} flex={1}>
                    <HStack gap={2} flexWrap="wrap">
                      <Text fontSize="md" fontWeight="semibold">
                        {project.project_name}
                      </Text>
                      {project.website && (
                        <a href={project.website} target="_blank" rel="noopener noreferrer">
                          <Text fontSize="xs" color={brandColors.teal}>↗</Text>
                        </a>
                      )}
                    </HStack>
                    {project.one_sentence_description && (
                      <Text fontSize="sm" color="gray.600" maxW="600px">
                        {project.one_sentence_description}
                      </Text>
                    )}
                  </VStack>
                  <VStack align="end" gap={1}>
                    <Text fontSize="lg" fontWeight="bold" color={brandColors.olive}>
                      {formatCurrency(project.total_paid_usd || project.total_awarded_usd)}
                    </Text>
                    {project.total_paid_usd !== project.total_awarded_usd && project.total_awarded_usd > 0 && (
                      <Text fontSize="xs" color="gray.500">
                        of {formatCurrency(project.total_awarded_usd)} awarded
                      </Text>
                    )}
                  </VStack>
                </HStack>
                
                <HStack gap={3} flexWrap="wrap">
                  {project.category && (
                    <Badge 
                      bg={getCategoryColor(project.category)} 
                      color="white" 
                      px={2} 
                      py={1}
                      fontSize="xs"
                    >
                      {project.category}
                    </Badge>
                  )}
                  {project.tranche_status && (
                    <Badge 
                      colorPalette={project.tranche_status.includes('Complete') ? 'green' : 'blue'}
                      px={2}
                      py={1}
                      fontSize="xs"
                    >
                      {project.tranche_status}
                    </Badge>
                  )}
                  {project.tranche_completion !== null && project.tranche_completion !== undefined && (
                    <Text fontSize="xs" color="gray.500">
                      {project.tranche_completion}% complete
                    </Text>
                  )}
                </HStack>
              </Box>
            ))}
          </VStack>

          {data.metadata?.last_indexed_at && (
            <Text fontSize="xs" color="gray.400" mt={8} textAlign="center">
              Data indexed: {new Date(data.metadata.last_indexed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
        </Container>
      </Box>
    </>
  );
}
