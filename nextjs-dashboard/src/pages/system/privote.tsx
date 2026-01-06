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
  Table,
  Badge,
} from '@chakra-ui/react';
import { Navigation } from '../../components/Navigation';
import { SystemHeader } from '../../components/SystemHeader';
import { MetricCard } from '../../components/MetricCard';
import { RoundTabs } from '../../components/RoundTabs';
import { brandColors } from '../../theme/colors';

interface PrivoteData {
  allocations: any[];
  summary: any;
}

export default function PrivotePage() {
  const [data, setData] = useState<PrivoteData | null>(null);
  const [loading, setLoading] = useState(true);

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
          <Spinner size="xl" color={brandColors.teal} />
        </Center>
      </>
    );
  }

  const formatCurrency = (value: number | undefined | null) => {
    const num = Number(value) || 0;
    return `${num.toFixed(2)} ETH`;
  };

  const getMedalEmoji = (medal: string) => {
    const medals: { [key: string]: string } = {
      'Gold': '1',
      'Silver': '2',
      'Bronze': '3'
    };
    return medals[medal] || '';
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
          About Privote
        </Text>
        <Text color="gray.600" fontFamily="Inter">
          Privote is a privacy-preserving quadratic funding platform that enables communities to democratically 
          allocate resources while maintaining voter privacy through zero-knowledge proofs.
        </Text>
        <SimpleGrid columns={2} gap={6} w="full" mt={4}>
          <Box>
            <Text fontSize="sm" color="gray.500" mb={1} fontFamily="Inter">
              Primary Mechanism
            </Text>
            <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
              Private Quadratic Funding
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.500" mb={1} fontFamily="Inter">
              Total Votes
            </Text>
            <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
              {data?.summary?.total_votes?.toLocaleString() || '0'}
            </Text>
          </Box>
        </SimpleGrid>
      </VStack>
    </Box>
  );

  const roundContent = (
    <Box>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} mb={8}>
        <MetricCard
          label="Total Allocated"
          value={formatCurrency(data?.summary?.total_allocated || 0)}
          color={brandColors.teal}
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
        bg="white"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.100"
        overflow="hidden"
      >
        <Box p={6} borderBottomWidth="1px" borderColor="gray.100">
          <Text fontSize="sm" fontWeight="medium" fontFamily="Inter">
            Top Funded Projects
          </Text>
        </Box>
        <Box overflowX="auto">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader fontFamily="Inter">Rank</Table.ColumnHeader>
                <Table.ColumnHeader fontFamily="Inter">Project</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end" fontFamily="Inter">Allocation</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end" fontFamily="Inter">Votes</Table.ColumnHeader>
                <Table.ColumnHeader fontFamily="Inter">Token</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(data?.allocations || []).slice(0, 20).map((project: any) => (
                <Table.Row key={project.rank}>
                  <Table.Cell>
                    <HStack gap={2}>
                      <Text fontWeight="bold" fontFamily="Inter">#{project.rank}</Text>
                      {project.medal && (
                        <Text fontFamily="Inter">{getMedalEmoji(project.medal)}</Text>
                      )}
                    </HStack>
                  </Table.Cell>
                  <Table.Cell fontWeight="medium" fontFamily="Inter">{project.project_name}</Table.Cell>
                  <Table.Cell textAlign="end" fontWeight="medium" fontFamily="Inter">
                    {(Number(project.allocation_eth) || 0).toFixed(4)} ETH
                  </Table.Cell>
                  <Table.Cell textAlign="end" fontFamily="Inter">{(Number(project.votes) || 0).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette="teal" variant="subtle" fontFamily="Inter">
                      {project.token}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
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
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Privote"
            description="Privacy-preserving quadratic funding with zero-knowledge proofs"
            color={brandColors.teal}
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} gap={6} mb={12}>
            <MetricCard
              label="Total Allocated"
              value={formatCurrency(data?.summary?.total_allocated || 0)}
              color={brandColors.teal}
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
