import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  Text,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { RoundTabs } from '../../components/RoundTabs';
import { brandColors } from '../../theme/colors';

interface SCFData {
  summary: any;
  rounds: any[];
  topProjects: any[];
}

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
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const infoContent = (
    <Box
      p={8}
      bg="white"
      borderRadius="lg"
      borderWidth="1px"
      borderColor="gray.100"
    >
      <VStack align="start" gap={4}>
        <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
          About Stellar Community Fund
        </Text>
        <Text color="gray.600" fontFamily="Inter">
          The Stellar Community Fund (SCF) is a grant program designed to support projects building on the Stellar network.
          It provides funding for developers, entrepreneurs, and creators who want to build applications that improve
          financial access and inclusion.
        </Text>
        <SimpleGrid columns={2} gap={6} w="full" mt={4}>
          <Box>
            <Text fontSize="sm" color="gray.500" mb={1} fontFamily="Inter">
              Primary Mechanism
            </Text>
            <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
              Build Awards
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.500" mb={1} fontFamily="Inter">
              Total Rounds
            </Text>
            <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
              {data?.summary?.total_rounds || 35}
            </Text>
          </Box>
        </SimpleGrid>
      </VStack>
    </Box>
  );

  const tabs = [
    {
      label: 'Info',
      content: infoContent,
    },
    ...((data?.rounds || []).slice(0, 15).map((round: any) => ({
      label: round.round_name,
      content: (
        <Box>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} mb={8}>
            <MetricCard
              label="Total Awarded"
              value={formatCurrency(round.total_awarded_usd || 0)}
              color={brandColors.olive}
            />
            <MetricCard
              label="Projects Funded"
              value={round.awarded_submissions || 0}
            />
            <MetricCard
              label="Avg per Project"
              value={formatCurrency(round.avg_awarded_usd || 0)}
            />
          </SimpleGrid>

          <VStack gap={6} align="stretch">
            <Box
              p={6}
              bg="white"
              borderRadius="lg"
              borderWidth="1px"
              borderColor="gray.100"
            >
              <Text fontSize="sm" fontWeight="medium" mb={4} fontFamily="Inter">
                Round Details
              </Text>
              <SimpleGrid columns={2} gap={4}>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontFamily="Inter">
                    Quarter
                  </Text>
                  <Text fontFamily="Inter">{round.quarter_year || 'N/A'}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontFamily="Inter">
                    Phase
                  </Text>
                  <Text fontFamily="Inter">{round.phase || 'Completed'}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontFamily="Inter">
                    Total Paid
                  </Text>
                  <Text fontFamily="Inter">{formatCurrency(round.total_paid_usd || 0)}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontFamily="Inter">
                    Applications
                  </Text>
                  <Text fontFamily="Inter">{round.applied_submissions || 'N/A'}</Text>
                </Box>
              </SimpleGrid>
            </Box>
          </VStack>
        </Box>
      ),
    }))),
  ];

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

          <RoundTabs tabs={tabs} />
        </Container>
      </Box>
    </>
  );
}
