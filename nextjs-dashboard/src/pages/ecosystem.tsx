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
} from '@chakra-ui/react';
import { Navigation } from '../components/Navigation';
import { SystemHeader } from '../components/SystemHeader';
import { MetricCard } from '../components/MetricCard';

interface PlatformData {
  platform: string;
  total_projects: number;
  total_grant_pools: number;
  total_applications: number;
  total_funding_usd: number;
  total_funding_display: string;
  primary_mechanism: string;
}

interface EcosystemData {
  platforms: PlatformData[];
  scf: {
    total_awarded: number;
    total_paid: number;
    total_rounds: number;
  };
}

export default function Ecosystem() {
  const [data, setData] = useState<EcosystemData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ecosystem')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching ecosystem data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color="#800020" />
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

  const totalFunding = (data?.platforms || []).reduce((sum, p) => sum + (p.total_funding_usd || 0), 0) + (data?.scf?.total_awarded || 0);
  const totalProjects = (data?.platforms || []).reduce((sum, p) => sum + p.total_projects, 0);
  const totalPools = (data?.platforms || []).reduce((sum, p) => sum + p.total_grant_pools, 0) + (data?.scf?.total_rounds || 0);

  const platformColors: { [key: string]: string } = {
    giveth: 'purple.500',
    scf: 'orange.500',
    privote: 'teal.500',
  };

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Ecosystem Overview"
            description="Unified insights across grant platforms, tracking funding flows and project success"
          />

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} mb={12}>
            <MetricCard
              label="Total Funding"
              value={formatCurrency(totalFunding)}
              subtitle="Across all platforms"
              color="#800020"
            />
            <MetricCard
              label="Projects"
              value={totalProjects.toLocaleString()}
              subtitle="Unique projects tracked"
            />
            <MetricCard
              label="Grant Rounds"
              value={totalPools}
              subtitle="Active and completed"
            />
          </SimpleGrid>

          <VStack gap={8} align="stretch">
            <Box>
              <Text
                fontSize="sm"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="gray.600"
                mb={6}
              >
                Platform Breakdown
              </Text>

              <VStack gap={4} align="stretch">
                {data?.platforms.map((platform) => (
                  <Box
                    key={platform.platform}
                    p={6}
                    bg="white"
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor="gray.100"
                  >
                    <HStack justify="space-between" mb={4}>
                      <VStack align="start" gap={1}>
                        <Text
                          fontSize="xl"
                          fontWeight="medium"
                          textTransform="capitalize"
                          color={platformColors[platform.platform] || 'gray.700'}
                        >
                          {platform.platform}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {platform.primary_mechanism}
                        </Text>
                      </VStack>
                      <VStack align="end" gap={0}>
                        <Text fontSize="2xl" fontWeight="light">
                          {platform.total_funding_display || formatCurrency(platform.total_funding_usd)}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          total funding
                        </Text>
                      </VStack>
                    </HStack>

                    <SimpleGrid columns={3} gap={4}>
                      <Box>
                        <Text fontSize="xs" color="gray.500">
                          Projects
                        </Text>
                        <Text fontSize="lg" fontWeight="medium">
                          {platform.total_projects.toLocaleString()}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.500">
                          Grant Pools
                        </Text>
                        <Text fontSize="lg" fontWeight="medium">
                          {platform.total_grant_pools}
                        </Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.500">
                          Applications
                        </Text>
                        <Text fontSize="lg" fontWeight="medium">
                          {platform.total_applications?.toLocaleString() || 'N/A'}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Box>
                ))}

                <Box
                  p={6}
                  bg="white"
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="gray.100"
                >
                  <HStack justify="space-between" mb={4}>
                    <VStack align="start" gap={1}>
                      <Text
                        fontSize="xl"
                        fontWeight="medium"
                        color="orange.500"
                      >
                        SCF (Stellar)
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        Build Awards
                      </Text>
                    </VStack>
                    <VStack align="end" gap={0}>
                      <Text fontSize="2xl" fontWeight="light">
                        {formatCurrency(data?.scf?.total_awarded || 0)}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        total awarded
                      </Text>
                    </VStack>
                  </HStack>

                  <SimpleGrid columns={3} gap={4}>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        Total Rounds
                      </Text>
                      <Text fontSize="lg" fontWeight="medium">
                        {data?.scf?.total_rounds || 0}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        Paid Out
                      </Text>
                      <Text fontSize="lg" fontWeight="medium">
                        {formatCurrency(data?.scf?.total_paid || 0)}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="gray.500">
                        Avg per Round
                      </Text>
                      <Text fontSize="lg" fontWeight="medium">
                        {formatCurrency((data?.scf?.total_awarded || 0) / (data?.scf?.total_rounds || 1))}
                      </Text>
                    </Box>
                  </SimpleGrid>
                </Box>
              </VStack>
            </Box>
          </VStack>
        </Container>
      </Box>
    </>
  );
}
