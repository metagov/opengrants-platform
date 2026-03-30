"use client";

import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Spinner,
  HStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { brandColors, platformColors, platformDisplayNames, platformHexColors } from "../theme/colors";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  return `$${(value / 1000).toFixed(0)}K`;
};

const platformRoutes: { [key: string]: string } = {
  scf: "/system/scf",
  giveth: "/system/giveth",
  privote: "/system/privote",
  ens: "/system/ens",
  gitcoin2: "/system/gitcoin",
};

function FundingChart({ platforms }: { platforms: any[] }) {
  const router = useRouter();

  const sortedPlatforms = [...platforms]
    .filter(p => (parseFloat(String(p.total_funding_usd)) || 0) > 0)
    .sort((a, b) => parseFloat(String(b.total_funding_usd)) - parseFloat(String(a.total_funding_usd)));

  const totalFunding = sortedPlatforms.reduce(
    (sum, p) => sum + (parseFloat(String(p.total_funding_usd)) || 0),
    0
  );

  // Use sqrt scale so smaller platforms are visible alongside larger ones.
  // Each segment width = sqrt(value) / sum(sqrt(values)) — preserves order
  // while giving meaningful width to sub-1% platforms.
  const sqrtValues = sortedPlatforms.map(p => Math.sqrt(parseFloat(String(p.total_funding_usd)) || 0));
  const sqrtTotal = sqrtValues.reduce((a, b) => a + b, 0);

  return (
    <Box w="100%">
      <HStack w="100%" h="48px" borderRadius="lg" overflow="hidden" gap={0}>
        {sortedPlatforms.map((p, index) => {
          const value = parseFloat(String(p.total_funding_usd)) || 0;
          const linearPct = totalFunding > 0 ? (value / totalFunding) * 100 : 0;
          const sqrtPct = sqrtTotal > 0 ? (sqrtValues[index] / sqrtTotal) * 100 : 0;
          const color = platformHexColors[p.platform] || "#718096";
          const route = platformRoutes[p.platform];

          return (
            <Box
              key={p.platform}
              w={`${sqrtPct}%`}
              h="100%"
              bg={color}
              cursor={route ? "pointer" : "default"}
              onClick={() => route && router.push(route)}
              transition="all 0.2s"
              _hover={{
                transform: "scaleY(1.08)",
                zIndex: 10,
              }}
              position="relative"
              title={`${platformDisplayNames[p.platform] || p.platform}: ${formatCurrency(value)} (${linearPct.toFixed(1)}% of total)`}
            />
          );
        })}
      </HStack>
      <Text fontSize="10px" color="gray.400" textAlign="right" mt={1} fontFamily="Inter">
        bar uses √ scale — hover segments for exact values
      </Text>

      <VStack gap={3} mt={4} align="stretch">
        {sortedPlatforms.map((p) => {
          const value = parseFloat(String(p.total_funding_usd)) || 0;
          const percentage = totalFunding > 0 ? (value / totalFunding) * 100 : 0;
          const color = platformHexColors[p.platform] || "#718096";
          const route = platformRoutes[p.platform];

          return (
            <HStack
              key={p.platform}
              justify="space-between"
              px={2}
              py={2}
              borderRadius="md"
              cursor={route ? "pointer" : "default"}
              onClick={() => route && router.push(route)}
              _hover={{ bg: "gray.50" }}
              transition="background 0.2s"
            >
              <HStack gap={3}>
                <Box w="12px" h="12px" borderRadius="sm" bg={color} />
                <Text fontSize="sm" color="gray.700" fontFamily="Inter">
                  {platformDisplayNames[p.platform] || p.platform}
                </Text>
              </HStack>
              <HStack gap={4}>
                <Text fontSize="sm" fontWeight="medium" color="gray.800" fontFamily="Inter">
                  {formatCurrency(value)}
                </Text>
                <Text fontSize="xs" color="gray.500" fontFamily="Inter" minW="45px" textAlign="right">
                  {percentage.toFixed(1)}%
                </Text>
              </HStack>
            </HStack>
          );
        })}
      </VStack>
    </Box>
  );
}

export default function Index() {
  const { data, isLoading } = useSWR("/api/ecosystem?lite=1", fetcher, {
    revalidateOnFocus: true,
    revalidateOnMount: true,
    refreshInterval: 300000,
    dedupingInterval: 60000,
  });

  const hasData = data?.platforms && data.platforms.length > 0;

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDir="column"
      bg="white"
      px={6}
    >
      <VStack gap={4} w="100%" maxW="900px">
        <Heading
          as="h1"
          fontSize={["4xl", "5xl"]}
          color={brandColors.burgundy}
          fontWeight="normal"
          letterSpacing="tight"
          fontFamily="Inter"
        >
          OpenGrants
        </Heading>
        <Text
          fontSize="md"
          color="gray.600"
          textAlign="center"
          fontFamily="Inter"
        >
          Unified Insights Across Grant Ecosystems
        </Text>

        <Box w="100%" mt={8} px={4}>
          <Text fontSize="sm" color="gray.600" textAlign="center" mb={4} fontFamily="Inter">
            Total Funding Distribution
          </Text>
          {isLoading || !hasData ? (
            <Box display="flex" justifyContent="center" py={8}>
              <Spinner size="lg" color={brandColors.burgundy} />
            </Box>
          ) : (
            <FundingChart platforms={data.platforms} />
          )}
        </Box>

        <Link href="/ecosystem">
          <Button
            mt={8}
            bg="transparent"
            color={brandColors.burgundy}
            borderWidth="2px"
            borderColor={brandColors.burgundy}
            borderRadius="full"
            px={8}
            py={5}
            fontWeight="medium"
            fontSize="sm"
            fontFamily="Inter"
            _hover={{
              bg: brandColors.burgundy,
              color: brandColors.textOnColor,
            }}
          >
            Explore Analytics
          </Button>
        </Link>
      </VStack>
    </Box>
  );
}
