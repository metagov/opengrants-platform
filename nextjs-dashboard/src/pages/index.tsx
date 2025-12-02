"use client";

import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
} from "@chakra-ui/react";
import { BarSegment, useChart } from "@chakra-ui/charts";
import Link from "next/link";

export default function Index() {
  const chart = useChart({
    sort: { by: "value", direction: "desc" },
    data: [
      { name: "SCF", value: 49864415.82, color: "orange.solid" },
      { name: "Giveth", value: 9655304.52, color: "purple.solid" },
      { name: "Privote", value: 123924.85, color: "blue.solid" },
    ],
  });

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
          <BarSegment.Root chart={chart}>
            <BarSegment.Content>
              <BarSegment.Value />
              <BarSegment.Bar />
              <BarSegment.Label />
            </BarSegment.Content>
          </BarSegment.Root>
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
