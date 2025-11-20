import { useState, useEffect } from "react";
import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  Text,
  useColorModeValue,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { Navigation } from "../../components/Navigation";
import { SystemHeader } from "../../components/SystemHeader";
import { MetricCard } from "../../components/MetricCard";
import { RoundTabs } from "../../components/RoundTabs";

interface GivethData {
  profile: any;
  donations: any;
  engagement: any;
  rounds: any[];
}

export default function GivethPage() {
  const [data, setData] = useState<GivethData | null>(null);
  const [loading, setLoading] = useState(true);
  const bgColor = useColorModeValue("gray.50", "gray.900");

  useEffect(() => {
    fetch("/api/systems/giveth")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching Giveth data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color="purple.500" />
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
      bg={useColorModeValue("white", "gray.800")}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={useColorModeValue("gray.100", "gray.700")}
    >
      <VStack align="start" spacing={4}>
        <Text fontSize="lg" fontWeight="medium">
          About Giveth
        </Text>
        <Text color={useColorModeValue("gray.600", "gray.400")}>
          Giveth is a community focused on Building the Future of Giving using
          blockchain technology. The platform enables direct peer-to-peer
          donations with full transparency and traceability.
        </Text>
        <SimpleGrid columns={2} spacing={6} w="full" mt={4}>
          <Box>
            <Text
              fontSize="sm"
              color={useColorModeValue("gray.500", "gray.500")}
              mb={1}
            >
              Primary Mechanism
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              Direct Donations + QF Rounds
            </Text>
          </Box>
          <Box>
            <Text
              fontSize="sm"
              color={useColorModeValue("gray.500", "gray.500")}
              mb={1}
            >
              Total Grant Pools
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              {data?.profile?.total_grant_pools || 16}
            </Text>
          </Box>
        </SimpleGrid>
      </VStack>
    </Box>
  );

  const tabs = [
    {
      label: "Info",
      content: infoContent,
    },
    ...(data?.rounds || []).map((round: any) => ({
      label: round.round_name,
      content: (
        <Box>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
            <MetricCard
              label="Pool Size"
              value={formatCurrency(round.total_pool_size || 0)}
              color="purple.600"
            />
            <MetricCard
              label="Projects Funded"
              value={round.projects_funded || 0}
            />
            <MetricCard
              label="Avg Funding"
              value={formatCurrency(round.avg_funding_per_project || 0)}
            />
          </SimpleGrid>

          <Box
            p={6}
            bg={useColorModeValue("white", "gray.800")}
            borderRadius="lg"
            borderWidth="1px"
            borderColor={useColorModeValue("gray.100", "gray.700")}
          >
            <Text fontSize="sm" fontWeight="medium" mb={4}>
              Round Details
            </Text>
            <VStack align="stretch" spacing={3}>
              <Box>
                <Text
                  fontSize="xs"
                  color={useColorModeValue("gray.500", "gray.500")}
                >
                  Quarter
                </Text>
                <Text>{round.year_quarter || "N/A"}</Text>
              </Box>
              {round.round_timestamp && (
                <Box>
                  <Text
                    fontSize="xs"
                    color={useColorModeValue("gray.500", "gray.500")}
                  >
                    Date
                  </Text>
                  <Text>
                    {new Date(round.round_timestamp).toLocaleDateString()}
                  </Text>
                </Box>
              )}
            </VStack>
          </Box>
        </Box>
      ),
    })),
  ];

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg={bgColor}>
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Giveth"
            description="Building the Future of Giving with transparent, peer-to-peer donations"
            color="purple.600"
          />

          <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={12}>
            <MetricCard
              label="Total Projects"
              value={data?.profile?.total_projects?.toLocaleString() || "0"}
              color="purple.600"
            />
            <MetricCard
              label="Total Funding"
              value={formatCurrency(
                data?.profile?.total_funding_distributed_usd || 0,
              )}
            />
            <MetricCard
              label="Unique Donors"
              value={
                data?.donations?.total_unique_donors?.toLocaleString() || "0"
              }
            />
            <MetricCard
              label="Avg per Project"
              value={formatCurrency(
                data?.profile?.avg_funding_per_project || 0,
              )}
            />
          </SimpleGrid>

          <RoundTabs tabs={tabs} />
        </Container>
      </Box>
    </>
  );
}
