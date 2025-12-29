  import { NextPage } from "next";
  import { useEffect, useState } from "react";
  import { Box, Heading, Text, Spinner, VStack, Tabs, Container, SimpleGrid, useColorModeValue } from "@chakra-ui/react";
  import { MarkdownRenderer } from "@/lib/markdown";
  import { getGivethAnalytics } from "@/lib/analytics";
  import { Navigation } from "../../components/Navigation";
  import { SystemHeader } from "../../components/SystemHeader";
  import { MetricCard } from "../../components/MetricCard";
  import { brandColors } from "../../theme/colors";

  interface GivethData {
    profile?: {
      total_projects?: number;
      total_funding_distributed_usd?: number;
      total_grant_pools?: number;
      avg_funding_per_project?: number;
    };
    donations?: {
      total_unique_donors?: number;
    };
    rounds?: Array<{
      round_name: string;
      total_pool_size?: number;
      projects_funded?: number;
      avg_funding_per_project?: number;
      year_quarter?: string;
      round_timestamp?: string;
    }>;
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
          <Box textAlign="center" py={20}>
            <Spinner size="xl" color={brandColors.burgundy} />
            <Text mt={4} fontSize="lg" color={brandColors.deepPurple} fontFamily="Inter">
              Loading Giveth analytics...
            </Text>
          </Box>
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
          <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
            About Giveth
          </Text>
          <Text color={useColorModeValue("gray.600", "gray.400")} fontFamily="Inter">
            Giveth is a community-driven platform that connects donors with impactful projects. 
            Through blockchain technology, Giveth ensures transparent and efficient fund distribution 
            while rewarding donors with GIV tokens.
          </Text>
          <SimpleGrid columns={2} spacing={6} w="full" mt={4}>
            <Box>
              <Text
                fontSize="sm"
                color={useColorModeValue("gray.500", "gray.500")}
                mb={1}
                fontFamily="Inter"
              >
                Primary Mechanism
              </Text>
              <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
                Quadratic Funding
              </Text>
            </Box>
            <Box>
              <Text
                fontSize="sm"
                color={useColorModeValue("gray.500", "gray.500")}
                mb={1}
                fontFamily="Inter"
              >
                Total Grant Pools
              </Text>
              <Text fontSize="lg" fontWeight="medium" fontFamily="Inter">
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
              <Text fontSize="sm" fontWeight="medium" mb={4} fontFamily="Inter">
                Round Details
              </Text>
              <VStack align="stretch" spacing={3}>
                <Box>
                  <Text
                    fontSize="xs"
                    color={useColorModeValue("gray.500", "gray.500")}
                    fontFamily="Inter"
                  >
                    Quarter
                  </Text>
                  <Text fontFamily="Inter">{round.year_quarter || "N/A"}</Text>
                </Box>
                {round.round_timestamp && (
                  <Box>
                    <Text
                      fontSize="xs"
                      color={useColorModeValue("gray.500", "gray.500")}
                      fontFamily="Inter"
                    >
                      Date
                    </Text>
                    <Text fontFamily="Inter">
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
              description="Building the future of giving through blockchain technology"
              color={brandColors.deepPurple}
            />

            <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={12}>
              <MetricCard
                label="Total Projects"
                value={data?.profile?.total_projects?.toLocaleString() || "0"}
                color={brandColors.deepPurple}
              />
              <MetricCard
                label="Total Funding"
                value={formatCurrency(
                  data?.profile?.total_funding_distributed_usd || 0,
                )}
                color={brandColors.olive}
              />
              <MetricCard
                label="Unique Donors"
                value={
                  data?.donations?.total_unique_donors?.toLocaleString() || "0"
                }
                color={brandColors.burgundy}
              />
              <MetricCard
                label="Avg per Project"
                value={formatCurrency(
                  data?.profile?.avg_funding_per_project || 0,
                )}
              />
            </SimpleGrid>

            <Tabs.Root defaultValue="overview" variant="line">
              <Tabs.List borderBottomWidth="1px" borderColor="gray.200" mb={8} gap={2}>
                <Tabs.Trigger
                  value="overview"
                  fontSize="sm"
                  fontWeight="medium"
                  fontFamily="Inter"
                  letterSpacing="wide"
                  textTransform="uppercase"
                  color="gray.500"
                  px={4}
                  py={3}
                  _selected={{
                    color: brandColors.deepPurple,
                    borderColor: brandColors.deepPurple,
                  }}
                  _hover={{
                    color: brandColors.deepPurple,
                  }}
                >
                  Overview
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="rounds"
                  fontSize="sm"
                  fontWeight="medium"
                  fontFamily="Inter"
                  letterSpacing="wide"
                  textTransform="uppercase"
                  color="gray.500"
                  px={4}
                  py={3}
                  _selected={{
                    color: brandColors.deepPurple,
                    borderColor: brandColors.deepPurple,
                  }}
                  _hover={{
                    color: brandColors.deepPurple,
                  }}
                >
                  Round-by-Round
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="process"
                  fontSize="sm"
                  fontWeight="medium"
                  fontFamily="Inter"
                  letterSpacing="wide"
                  textTransform="uppercase"
                  color="gray.500"
                  px={4}
                  py={3}
                  _selected={{
                    color: brandColors.deepPurple,
                    borderColor: brandColors.deepPurple,
                  }}
                  _hover={{
                    color: brandColors.deepPurple,
                  }}
                >
                  Grant Process
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="overview">
                {infoContent}
              </Tabs.Content>

              <Tabs.Content value="rounds">
                <Box
                  p={8}
                  bg={useColorModeValue("white", "gray.800")}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={useColorModeValue("gray.100", "gray.700")}
                >
                  <MarkdownRenderer filePath="/grant_docs/giveth_rounds.md" />
                </Box>
              </Tabs.Content>

              <Tabs.Content value="process">
                <Box
                  p={8}
                  bg={useColorModeValue("white", "gray.800")}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor={useColorModeValue("gray.100", "gray.700")}
                >
                  <MarkdownRenderer filePath="/grant_docs/giveth_process.md" />
                </Box>
              </Tabs.Content>
            </Tabs.Root>
          </Container>
        </Box>
      </>
    );
  }