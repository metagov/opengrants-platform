import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  HStack,
  Flex,
} from "@chakra-ui/react";
import Link from "next/link";
import { useMemo } from "react";

const HorizontalStackedBar = ({ data }: { data: { name: string; value: number; color: string }[] }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  return (
    <VStack align="stretch" gap={2} w="100%">
      <Text fontSize="sm" color="gray.600" textAlign="center" mb={2}>
        Total Funding Distribution
      </Text>
      <Flex w="100%" position="relative">
        {data.map((d, index) => {
          const percentage = (d.value / total) * 100;
          return (
            <Box
              key={d.name}
              position="relative"
              h="32px"
              w={`${percentage}%`}
              bg={d.color}
              borderLeftRadius={index === 0 ? "md" : "none"}
              borderRightRadius={index === data.length - 1 ? "md" : "none"}
            >
              <Text
                position="absolute"
                top="-24px"
                left="50%"
                transform="translateX(-50%)"
                fontSize="xs"
                fontWeight="medium"
                color="gray.700"
                whiteSpace="nowrap"
              >
                {formatValue(d.value)}
              </Text>
            </Box>
          );
        })}
      </Flex>
      <HStack justify="space-between" mt={1}>
        {data.map((d) => (
          <Text key={d.name} fontSize="xs" color="gray.600">
            {d.name}
          </Text>
        ))}
      </HStack>
    </VStack>
  );
};

export default function Index() {
  const chartData = useMemo(
    () => [
      { name: "SCF", value: 49864415.82, color: "#E67E22" },
      { name: "Giveth", value: 9655304.52, color: "#9B59B6" },
      { name: "Privote", value: 123924.85, color: "#3498DB" },
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
          <HorizontalStackedBar data={chartData} />
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
