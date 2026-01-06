import { NextPage } from "next";
import { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Text,
  Spinner,
  VStack,
  Tabs,
  Container,
  SimpleGrid,
} from "@chakra-ui/react";
import { MarkdownRenderer } from "@/lib/markdown";
import { getGivethAnalytics } from "../../lib/analytics";
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
          <Text mt={4} fontSize="lg" color={brandColors.deepPurple}>
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
      bg="white"
      borderRadius="lg"
      borderWidth="1px"
      borderColor="gray.100"
    >
      <VStack align="start" gap={4}>
        <Text fontSize="lg" fontWeight="medium">
          About Giveth
        </Text>
        <Text color="gray.600">
          Giveth is a community-driven platform that connects donors with
          impactful projects. Through blockchain technology, Giveth ensures
          transparent and efficient fund distribution while rewarding donors
          with GIV tokens.
        </Text>
        <SimpleGrid columns={2} gap={6} w="full" mt={4}>
          <Box>
            <Text fontSize="sm" color="gray.500" mb={1}>
              Primary Mechanism
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              Quadratic Funding
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.500" mb={1}>
              Total Projects
            </Text>
            <Text fontSize="lg" fontWeight="medium">
              {data?.profile?.total_projects || 0}
            </Text>
          </Box>
        </SimpleGrid>
      </VStack>
    </Box>
  );

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="Giveth"
            description="Building the future of giving through blockchain technology"
            color={brandColors.deepPurple}
          />

          <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} mb={12}>
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
              label="Total Donations"
              value={formatCurrency(
                data?.profile?.total_funding_distributed_usd || 0,
              )}
              color={brandColors.olive}
            />
          </SimpleGrid>

          <Tabs.Root defaultValue="overview" variant="line">
            <Tabs.List
              borderBottomWidth="1px"
              borderColor="gray.200"
              mb={8}
              gap={2}
            >
              <Tabs.Trigger
                value="overview"
                fontSize="sm"
                fontWeight="medium"
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

            <Tabs.Content value="overview">{infoContent}</Tabs.Content>

            <Tabs.Content value="rounds">
              <Box
                p={8}
                bg="white"
                borderRadius="lg"
                borderWidth="1px"
                borderColor="gray.100"
              >
                <MarkdownRenderer filePath="/grant_docs/giveth_rounds.md" />
              </Box>
            </Tabs.Content>

            <Tabs.Content value="process">
              <Box
                p={8}
                bg="white"
                borderRadius="lg"
                borderWidth="1px"
                borderColor="gray.100"
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
