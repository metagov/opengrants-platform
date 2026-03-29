import { useState, useEffect } from "react";
import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  HStack,
  Text,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { Legend } from "recharts";
import { brandColors } from "../theme/colors";
import { Navigation } from "../components/Navigation";
import { SystemHeader } from "../components/SystemHeader";
import { MetricCard } from "../components/MetricCard";
import { BarChart, LineChart, ChartCard } from "../components/charts";
import { formatCurrency } from "@/lib/formatters";

interface PlatformData {
  platform: string;
  total_projects: number;
  total_grant_pools: number;
  total_applications: number;
  total_funding_usd: number;
  total_funding_display: string;
  primary_mechanism: string;
}

interface AvgGrantData {
  platform: string;
  avg_grant_size: number;
  project_count: number;
  total_funding: number;
}

interface FundingDistData {
  platform: string;
  project_name: string;
  funding: number;
  rank: number;
}

interface EcosystemData {
  platforms: PlatformData[];
  scf: {
    total_awarded: number;
    total_paid: number;
    total_rounds: number;
  };
  avgGrantSize: AvgGrantData[];
  fundingDistribution: FundingDistData[];
}

export default function Ecosystem() {
  const [data, setData] = useState<EcosystemData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ecosystem")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching ecosystem data:", err);
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

  const totalFunding = (data?.platforms || []).reduce(
    (sum, p) => sum + (parseFloat(String(p.total_funding_usd)) || 0),
    0,
  );
  const totalProjects = (data?.platforms || []).reduce(
    (sum, p) => sum + (parseInt(String(p.total_projects)) || 0),
    0,
  );
  const totalPools = (data?.platforms || []).reduce(
    (sum, p) => sum + (parseInt(String(p.total_grant_pools)) || 0),
    0,
  );

  const platformColors: { [key: string]: string } = {
    ens: "blue.500",
    giveth: "purple.500",
    scf: "orange.500",
    privote: "teal.500",
    gitcoin2: "green.700",
  };

  const platformDisplayNames: { [key: string]: string } = {
    ens: "ENS Small Grants",
    scf: "Stellar Community Fund",
    giveth: "Giveth",
    privote: "Privote (GG24 Privacy)",
    gitcoin2: "Gitcoin",
  };

  const getPlatformName = (key: string) => platformDisplayNames[key] || key;

  const chartData = (data?.platforms || []).map((platform) => ({
    name: getPlatformName(platform.platform),
    funding: parseFloat(String(platform.total_funding_usd)) || 0,
    applications: parseInt(String(platform.total_applications)) || 0,
  }));

  const avgGrantChartData = (data?.avgGrantSize || []).map((item) => ({
    platform: getPlatformName(item.platform.toLowerCase()),
    avgGrant: Number(item.avg_grant_size) || 0,
    projects: Number(item.project_count) || 0,
  }));

  const fundingDistChartData = (() => {
    const scfData = (data?.fundingDistribution || []).filter(d => d.platform === 'SCF').map(d => ({
      rank: Number(d.rank),
      scf: Number(d.funding) || 0,
    }));
    const givethData = (data?.fundingDistribution || []).filter(d => d.platform === 'Giveth').map(d => ({
      rank: Number(d.rank),
      giveth: Number(d.funding) || 0,
    }));
    const privoteData = (data?.fundingDistribution || []).filter(d => d.platform === 'Privote').map(d => ({
      rank: Number(d.rank),
      privote: Number(d.funding) || 0,
    }));
    const gitcoin2Data = (data?.fundingDistribution || []).filter(d => d.platform === 'Gitcoin2').map(d => ({
      rank: Number(d.rank),
      gitcoin2: Number(d.funding) || 0,
    }));

    const ranks = Array.from({ length: 20 }, (_, i) => i + 1);
    return ranks.map(rank => ({
      rank,
      SCF: scfData.find(d => d.rank === rank)?.scf || 0,
      Giveth: givethData.find(d => d.rank === rank)?.giveth || 0,
      Privote: privoteData.find(d => d.rank === rank)?.privote || 0,
      Gitcoin: gitcoin2Data.find(d => d.rank === rank)?.gitcoin2 || 0,
    }));
  })();

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

          <Box
            mb={12}
            p={6}
            bg="white"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="gray.100"
          >
            <HStack gap={2} mb={2}>
              <Text fontSize="xl" fontWeight="medium" color="gray.800">
                System Funding Comparison
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.600" mb={6}>
              Total funding and application metrics across grant systems
            </Text>

            <Box h="400px">
              <BarChart
                data={chartData}
                xKey="name"
                bars={[
                  { dataKey: 'funding', name: 'Total Funding', color: '#800020', yAxisId: 'left', maxBarSize: 60 },
                  { dataKey: 'applications', name: 'Applications', color: '#006E7F', yAxisId: 'right', maxBarSize: 60 },
                ]}
                height={400}
                rotateLabels="gentle"
                yAxes={[
                  {
                    id: 'left',
                    tickFormatter: (value: number) => {
                      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                      return `$${value}`;
                    },
                    label: {
                      value: 'Total Funding',
                      angle: -90,
                      position: 'insideLeft',
                      offset: -40,
                      style: { textAnchor: 'middle', fill: '#4A5568', fontSize: 12 },
                    },
                  },
                  {
                    id: 'right',
                    orientation: 'right',
                    label: {
                      value: 'Applications',
                      angle: 90,
                      position: 'insideRight',
                      offset: 0,
                      style: { textAnchor: 'middle', fill: '#4A5568', fontSize: 12 },
                    },
                  },
                ]}
                xAxisInterval={0}
                showLegend
                tooltipFormatter={(value: number, name: string) => {
                  if (name === 'Total Funding') {
                    return [formatCurrency(value), name];
                  }
                  return [value.toLocaleString(), name];
                }}
                margin={{ top: 20, right: 60, left: 60, bottom: 60 }}
              />
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
                          color={
                            platformColors[platform.platform] || "gray.700"
                          }
                        >
                          {getPlatformName(platform.platform)}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {platform.primary_mechanism}
                        </Text>
                      </VStack>
                      <VStack align="end" gap={0}>
                        <Text fontSize="2xl" fontWeight="light">
                          {platform.total_funding_display ||
                            formatCurrency(platform.total_funding_usd)}
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
                          {platform.total_applications?.toLocaleString() ||
                            "N/A"}
                        </Text>
                      </Box>
                    </SimpleGrid>
                  </Box>
                ))}
              </VStack>
            </Box>
          </VStack>

          <Box mt={12}>
            <HStack mb={6} align="center" gap={2}>
              <Text
                fontSize="sm"
                fontWeight="medium"
                letterSpacing="wide"
                textTransform="uppercase"
                color="gray.600"
              >
                Cross-Platform Comparison
              </Text>
              <Box
                px={2}
                py={1}
                bg="blue.50"
                borderRadius="md"
                title="We are actively indexing more historical data for Giveth and Privote. Current comparison is based on available data."
              >
                <Text fontSize="xs" color="blue.600">
                  Data indexing in progress
                </Text>
              </Box>
            </HStack>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
              <ChartCard
                title="Average Grant Size by Platform"
                subtitle="Comparing typical grant amounts across ecosystems"
              >
                <BarChart
                  data={avgGrantChartData}
                  xKey="platform"
                  bars={[{ dataKey: 'avgGrant', name: 'Average Grant', color: brandColors.burgundy }]}
                  layout="vertical"
                  height={300}
                  yAxisWidth={140}
                  tooltipFormatter={(value: number) => [formatCurrency(value), 'Avg Grant']}
                />
              </ChartCard>

              <ChartCard
                title="Funding Distribution Curve"
                subtitle="How funding is distributed across top 20 projects per platform"
              >
                <LineChart
                  data={fundingDistChartData}
                  xKey="rank"
                  lines={[
                    { dataKey: 'SCF', color: brandColors.olive, strokeWidth: 2, dot: { r: 3 } },
                    { dataKey: 'Giveth', color: brandColors.deepPurple, strokeWidth: 2, dot: { r: 3 } },
                    { dataKey: 'Privote', color: brandColors.teal, strokeWidth: 2, dot: { r: 3 } },
                    { dataKey: 'Gitcoin', color: '#00433B', strokeWidth: 2, dot: { r: 3 } },
                  ]}
                  height={300}
                  showLegend
                  yTickFormatter={(value: number) => formatCurrency(value)}
                  tooltipFormatter={(value: number, name: string) => [formatCurrency(value), name]}
                  xLabel={{ value: 'Project Rank', position: 'insideBottom', offset: -5, style: { fill: '#4A5568', fontSize: 11 } }}
                />
              </ChartCard>
            </SimpleGrid>
          </Box>
        </Container>
      </Box>
    </>
  );
}
