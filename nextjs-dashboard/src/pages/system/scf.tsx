import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  Text,
  useColorModeValue,
  Spinner,
  Center,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { RoundTabs } from '../../components/RoundTabs';

interface SCFData {
  summary: any;
  rounds: any[];
  topProjects: any[];
}

export default function SCFPage() {
  const [data, setData] = useState<SCFData | null>(null);
  const [loading, setLoading] = useState(true);
  const bgColor = useColorModeValue('gray.50', 'gray.900');

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
          <Spinner size="xl" color="orange.500" />
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
      bg={useColorModeValue('white', 'gray.800')}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={useColorModeValue('gray.100', 'gray.700')}
    >
      <VStack align="start" spacing={4}>
        <Text fontSize="lg" fontWeight="medium">
          About Stellar Community Fund
        </Text>
        <Text color={useColorModeValue('gray.600', 'gray.400')}>
          The Stellar Community Fund (SCF) is a grant program designed to support projects building on the Stellar network.
          It provides funding for developers, entrepreneurs, and creators who want to build applications that improve
          financial access and inclusion.
        </Text>
        <SimpleGrid columns={2} spacing={6} w="full" mt={4}>
          <Box>
            <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.500')} mb={1}>
              Primary Mechanism
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              Build Awards
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.500')} mb={1}>
              Total Rounds
            </Text>
            <Text fontSize="lg" fontWeight="medium">
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
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
            <MetricCard
              label="Total Awarded"
              value={formatCurrency(round.total_awarded_usd || 0)}
              color="orange.600"
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

          <VStack spacing={6} align="stretch">
            <Box
              p={6}
              bg={useColorModeValue('white', 'gray.800')}
              borderRadius="lg"
              borderWidth="1px"
              borderColor={useColorModeValue('gray.100', 'gray.700')}
            >
              <Text fontSize="sm" fontWeight="medium" mb={4}>
                Round Details
              </Text>
              <SimpleGrid columns={2} spacing={4}>
                <Box>
                  <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.500')}>
                    Quarter
                  </Text>
                  <Text>{round.quarter_year || 'N/A'}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.500')}>
                    Phase
                  </Text>
                  <Text>{round.phase || 'Completed'}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.500')}>
                    Total Paid
                  </Text>
                  <Text>{formatCurrency(round.total_paid_usd || 0)}</Text>
                </Box>
                <Box>
                  <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.500')}>
                    Applications
                  </Text>
                  <Text>{round.applied_submissions || 'N/A'}</Text>
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
      <Box minH="100vh" bg={bgColor}>
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Stellar Community Fund"
            description="Supporting innovation on the Stellar network through grants and funding"
            color="orange.600"
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={12}>
            <MetricCard
              label="Total Awarded"
              value={formatCurrency(data?.summary?.total_awarded || 0)}
              color="orange.600"
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