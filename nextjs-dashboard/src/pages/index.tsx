"use client";

import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  HStack,
  useColorModeValue,
  Flex,
  Link,
} from "@chakra-ui/react";
import { DarkModeSwitch } from "../components/DarkModeSwitch";
import { useMemo } from "react";

// Simple bar-segment component (no ColorSwatch)
const BarSegment = ({ data }: { data: { name: string; value: number; color: string }[] }) => {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <VStack align="stretch" spacing={3} w="100%">
      {data.map((d) => (
        <HStack key={d.name} spacing={3}>
          <Box flex="1">
            <Flex align="center">
              <Box
                h="24px"
                w={`${(d.value / max) * 100}%`}
                bg={d.color}
                borderRadius="md"
                transition="width 0.3s ease"
              />
            </Flex>
          </Box>
          <Text fontWeight="bold" fontSize="sm" w="60px" textAlign="right">
            {`${d.value / 1000}K`}
          </Text>
          <Text fontSize="sm" w="80px">
            {d.name}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
};

export default function Index() {
  const chartData = useMemo(
    () => [
      { name: "Gitcoin", value: 500000, color: "teal.400" },
      { name: "Celo", value: 200000, color: "yellow.300" },
      { name: "SCF", value: 49864415.82, color: "orange.400" },
      { name: "Giveth", value: 1025000, color: "purple.400" },
    ],
    []
  );

  return (
    <Box
      h="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDir="column"
      bg={useColorModeValue("white", "gray.900")}
      px={6}
    >
      <VStack spacing={4}>
        <Heading
          as="h1"
          fontSize={["5xl", "6xl"]}
          color="red.900"
          fontWeight="thin"
          letterSpacing="tight"
        >
          OpenGrants
        </Heading>
        <Text
          fontSize="lg"
          color={useColorModeValue("red.700", "red.300")}
          textAlign="center"
        >
          Unified insights across ecosystems
        </Text>

        <Box w={["90%", "75%", "60%"]} mt={6}>
          <BarSegment data={chartData} />
        </Box>

      <Link href="/overview">
        <Button
          mt={8}
          variant="outline"
          colorScheme="red"
          borderRadius="full"
          px={8}
          py={6}
          fontWeight="medium"
          _hover={{
            bg: useColorModeValue("red.50", "red.900"),
            transform: "scale(1.05)",
            transition: "0.2s ease",
          }}
        >
          View Details
        </Button>
        </Link>
      </VStack>

      <DarkModeSwitch />
    </Box>
  );
}
