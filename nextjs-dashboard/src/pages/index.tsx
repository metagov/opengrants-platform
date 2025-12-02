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

const BarSegment = ({ data }: { data: { name: string; value: number; color: string }[] }) => {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <VStack align="stretch" gap={3} w="100%">
      {data.map((d) => (
        <HStack key={d.name} gap={3}>
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
            {`${(d.value / 1000000).toFixed(1)}M`}
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
      { name: "SCF", value: 49864415.82, color: "orange.400" },
      { name: "Giveth", value: 9655304.52, color: "purple.400" },
      { name: "Privote", value: 123924.85, color: "teal.400" },
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
      <VStack gap={4}>
        <Heading
          as="h1"
          fontSize={["5xl", "6xl"]}
          color="#800020"
          fontWeight="thin"
          letterSpacing="tight"
        >
          OpenGrants
        </Heading>
        <Text
          fontSize="lg"
          color="gray.600"
          textAlign="center"
        >
          Unified insights across grant ecosystems
        </Text>

        <Box w={["90%", "75%", "60%"]} mt={6}>
          <BarSegment data={chartData} />
        </Box>

        <Link href="/ecosystem">
          <Button
            mt={8}
            variant="outline"
            borderColor="#800020"
            color="#800020"
            borderRadius="full"
            px={8}
            py={6}
            fontWeight="medium"
            _hover={{
              bg: "#800020",
              color: "white",
            }}
          >
            Explore Analytics
          </Button>
        </Link>
      </VStack>
    </Box>
  );
}
