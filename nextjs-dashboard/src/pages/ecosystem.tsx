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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
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

  const totalFunding = (data?.platforms || []).reduce((sum, p) => sum + (parseFloat(String(p.total_funding_usd)) || 0), 0);
  const totalProjects = (data?.platforms || []).reduce((sum, p) => sum + (parseInt(String(p.total_projects)) || 0), 0);
  const totalPools = (data?.platforms || []).reduce((sum, p) => sum + (parseInt(String(p.total_grant_pools)) || 0), 0);

  const platformColors: { [key: string]: string } = {
    giveth: 'purple.500',
    scf: 'orange.500',
    privote: 'teal.500',
  };

  const platformDisplayNames: { [key: string]: string } = {
    scf: 'Stellar Community Fund',
    giveth: 'Giveth',
    privote: 'Privote',
  };

  const getPlatformName = (key: string) => platformDisplayNames[key] || key;

  const chartData = (data?.platforms || []).map((platform) => ({
    name: getPlatformName(platform.platform),
    funding: parseFloat(String(platform.total_funding_usd)) || 0,
    applications: parseInt(String(platform.total_applications)) || 0,
  }));

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

          <Box mb={12} p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
            <HStack gap={2} mb={2}>
              <Text fontSize="xl" fontWeight="medium" color="gray.800">
                System Funding Comparison
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.600" mb={6}>
              Total funding and application metrics across grant systems
            </Text>

            <Box h="400px">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 60, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#4A5568', fontSize: 12 }}
                    angle={-25}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: '#4A5568', fontSize: 12 }}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                      return `$${value}`;
                    }}
                    label={{ 
                      value: 'Total Funding', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fill: '#4A5568', fontSize: 12 }
                    }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#4A5568', fontSize: 12 }}
                    label={{ 
                      value: 'Applications', 
                      angle: 90, 
                      position: 'insideRight',
                      style: { textAnchor: 'middle', fill: '#4A5568', fontSize: 12 }
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'Total Funding') {
                        return [formatCurrency(value), name];
                      }
                      return [value.toLocaleString(), name];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="funding" 
                    name="Total Funding"
                    fill="#800020" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                  <Bar 
                    yAxisId="right"
                    dataKey="applications" 
                    name="Applications"
                    fill="#006E7F" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Box>

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
                {(data?.platforms || []).map((platform) => (
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
                          color={platformColors[platform.platform] || 'gray.700'}
                        >
                          {getPlatformName(platform.platform)}
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
              </VStack>
            </Box>
          </VStack>
        </Container>
      </Box>
    </>
  );
}
