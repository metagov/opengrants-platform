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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const platformColors: { [key: string]: string } = {
  scf: "orange.solid",
  giveth: "purple.solid",
  privote: "blue.solid",
};

const platformDisplayNames: { [key: string]: string } = {
  scf: "SCF",
  giveth: "Giveth",
  privote: "Privote",
};

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
      h="100vh"
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
          color="#3498DB"
          fontWeight="normal"
          fontStyle="italic"
          letterSpacing="tight"
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
              <Spinner size="lg" color="gray.500" />
            </Box>
          ) : (
            <FundingChart platforms={data.platforms} />
          )}
        </Box>

        <Link href="/ecosystem">
          <Button
            mt={8}
            bg="#2C3E50"
            color="white"
            borderRadius="full"
            px={8}
            py={5}
            fontWeight="medium"
            fontSize="sm"
            _hover={{
              bg: "#1A252F",
            }}
          >
            Explore Analytics
          </Button>
        </Link>
      </VStack>
    </Box>
  );
}
