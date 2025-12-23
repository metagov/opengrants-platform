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
import { Navigation } from "../components/Navigation";
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
    <>
      <Navigation />
      <Box
        minH="calc(100vh - 60px)"
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
            fontStyle="italic"
            letterSpacing="tight"
            fontFamily="Inter"
          >
            OpenGrants
          </Heading>
          <Text
            fontSize="md"
            color="gray.600"
            textAlign="center"
          >
            Unified Insights Across Grant Ecosystems
          </Text>

          <Box w="100%" mt={8} px={4}>
            <Text fontSize="sm" color="gray.600" textAlign="center" mb={4}>
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
              bg={brandColors.teal}
              color={brandColors.textOnColor}
              borderRadius="full"
              px={8}
              py={5}
              fontWeight="medium"
              fontSize="sm"
              _hover={{
                bg: "#005566",
              }}
            >
              Explore Analytics
            </Button>
          </Link>
        </VStack>
      </Box>
    </>
  );
}
