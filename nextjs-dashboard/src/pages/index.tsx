"use client";

import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Spinner,
} from "@chakra-ui/react";
import { BarSegment, useChart } from "@chakra-ui/charts";
import Link from "next/link";
import useSWR from "swr";
import { brandColors, platformColors, platformDisplayNames } from "../theme/colors";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function FundingChart({ platforms }: { platforms: any[] }) {
  const chartData = platforms.map((p: any) => ({
    name: platformDisplayNames[p.platform] || p.platform,
    value: parseFloat(String(p.total_funding_usd)) || 0,
    color: platformColors[p.platform] || "gray.solid",
  }));

  const chart = useChart({
    sort: { by: "value", direction: "desc" },
    data: chartData,
  });

  return (
    <BarSegment.Root chart={chart}>
      <BarSegment.Content>
        <BarSegment.Value />
        <BarSegment.Bar />
        <BarSegment.Label />
      </BarSegment.Content>
    </BarSegment.Root>
  );
}

export default function Index() {
  const { data, isLoading } = useSWR("/api/ecosystem", fetcher);

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
      <VStack gap={4} w="100%" maxW="700px">
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
