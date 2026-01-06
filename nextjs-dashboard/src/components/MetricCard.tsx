import { Box, Text, VStack } from '@chakra-ui/react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export const MetricCard = ({ label, value, subtitle, color = 'gray.600' }: MetricCardProps) => {
  return (
    <Box
      p={6}
      bg="white"
      borderRadius="lg"
      borderWidth="1px"
      borderColor="gray.100"
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-2px)',
        shadow: 'sm',
      }}
    >
      <VStack align="start" gap={2}>
        <Text
          fontSize="xs"
          fontWeight="medium"
          letterSpacing="wide"
          textTransform="uppercase"
          color="gray.600"
        >
          {label}
        </Text>
        <Text
          fontSize="3xl"
          fontWeight="light"
          color={color}
          lineHeight="1"
        >
          {value}
        </Text>
        {subtitle && (
          <Text fontSize="sm" color="gray.600">
            {subtitle}
          </Text>
        )}
      </VStack>
    </Box>
  );
};
