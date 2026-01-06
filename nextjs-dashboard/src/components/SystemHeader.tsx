import { Box, Heading, Text, VStack } from "@chakra-ui/react";

interface SystemHeaderProps {
  title: string;
  description?: string;
  color?: string;
}

export const SystemHeader = ({
  title,
  description,
  color = "#800020",
}: SystemHeaderProps) => {
  return (
    <Box mb={12}>
      <VStack align="start" gap={10}>
        <Heading
          as="h1"
          fontSize={["4xl", "5xl", "6xl"]}
          fontWeight="thin"
          letterSpacing="tight"
          color={color}
        >
          {title}
        </Heading>
        {description && (
          <Text fontSize="lg" color="gray.600" maxW="2xl">
            {description}
          </Text>
        )}
      </VStack>
    </Box>
  );
};
