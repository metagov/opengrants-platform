import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  HStack,
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
  Badge,
} from '@chakra-ui/react';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { RoundTabs } from '../../components/RoundTabs';

interface PrivoteData {
  allocations: any[];
  summary: any;
}

export default function PrivotePage() {
  const [data, setData] = useState<PrivoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const bgColor = useColorModeValue('gray.50', 'gray.900');

  useEffect(() => {
    fetch('/api/systems/privote')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching Privote data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color="teal.500" />
        </Center>
      </>
    );
  }

  const formatCurrency = (value: number) => {
    return `${value.toFixed(2)} ETH`;
  };

  const getMedalEmoji = (medal: string) => {
    const medals: { [key: string]: string } = {
      'Gold': '🥇',
      'Silver': '🥈',
      'Bronze': '🥉'
    };
    return medals[medal] || '';
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
          About Privote
        </Text>
        <Text color={useColorModeValue('gray.600', 'gray.400')}>
          Privote is a privacy-preserving quadratic funding platform that enables communities to democratically 
          allocate resources while maintaining voter privacy through zero-knowledge proofs.
        </Text>
        <SimpleGrid columns={2} spacing={6} w="full" mt={4}>
          <Box>
            <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.500')} mb={1}>
              Primary Mechanism
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              Private Quadratic Funding
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.500')} mb={1}>
              Total Votes
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              {data?.summary?.total_votes?.toLocaleString() || '0'}
            </Text>
          </Box>
        </SimpleGrid>
      </VStack>
    </Box>
  );

  const roundContent = (
    <Box>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        <MetricCard
          label="Total Allocated"
          value={formatCurrency(data?.summary?.total_allocated || 0)}
          color="teal.600"
        />
        <MetricCard
          label="Projects Funded"
          value={data?.summary?.total_projects || 0}
        />
        <MetricCard
          label="Avg Allocation"
          value={formatCurrency(data?.summary?.avg_allocation || 0)}
        />
      </SimpleGrid>

      <Box
        bg={useColorModeValue('white', 'gray.800')}
        borderRadius="lg"
        borderWidth="1px"
        borderColor={useColorModeValue('gray.100', 'gray.700')}
        overflow="hidden"
      >
        <Box p={6} borderBottomWidth="1px" borderColor={useColorModeValue('gray.100', 'gray.700')}>
          <Text fontSize="sm" fontWeight="medium">
            Top Funded Projects
          </Text>
        </Box>
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Rank</Th>
                <Th>Project</Th>
                <Th isNumeric>Allocation</Th>
                <Th isNumeric>Votes</Th>
                <Th>Token</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(data?.allocations || []).slice(0, 20).map((project: any) => (
                <Tr key={project.rank}>
                  <Td>
                    <HStack spacing={2}>
                      <Text fontWeight="bold">#{project.rank}</Text>
                      {project.medal && (
                        <Text>{getMedalEmoji(project.medal)}</Text>
                      )}
                    </HStack>
                  </Td>
                  <Td fontWeight="medium">{project.project_name}</Td>
                  <Td isNumeric fontWeight="medium">
                    {project.allocation_eth.toFixed(4)} ETH
                  </Td>
                  <Td isNumeric>{project.votes.toLocaleString()}</Td>
                  <Td>
                    <Badge colorScheme="teal" variant="subtle">
                      {project.token}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Box>
  );

  const tabs = [
    {
      label: 'Info',
      content: infoContent,
    },
    {
      label: 'GG24 Round',
      content: roundContent,
    },
  ];

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg={bgColor}>
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Privote"
            description="Privacy-preserving quadratic funding with zero-knowledge proofs"
            color="teal.600"
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={12}>
            <MetricCard
              label="Total Allocated"
              value={formatCurrency(data?.summary?.total_allocated || 0)}
              color="teal.600"
            />
            <MetricCard
              label="Total Projects"
              value={data?.summary?.total_projects || 0}
            />
            <MetricCard
              label="Total Votes"
              value={data?.summary?.total_votes?.toLocaleString() || '0'}
            />
            <MetricCard
              label="Avg per Project"
              value={formatCurrency(data?.summary?.avg_allocation || 0)}
            />
          </SimpleGrid>

          <RoundTabs tabs={tabs} />
        </Container>
      </Box>
    </>
  );
}
