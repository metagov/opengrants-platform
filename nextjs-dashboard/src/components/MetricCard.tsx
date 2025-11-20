import { Box, Text, VStack, useColorModeValue } from '@chakra-ui/react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export const MetricCard = ({ label, value, subtitle, color = 'gray.600' }: MetricCardProps) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.100', 'gray.700');
  const labelColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box
      p={6}
      bg={bgColor}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-2px)',
        shadow: 'sm',
      }}
    >
      <VStack align="start" spacing={2}>
        <Text
          fontSize="xs"
          fontWeight="medium"
          letterSpacing="wide"
          textTransform="uppercase"
          color={labelColor}
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
          <Text fontSize="sm" color={labelColor}>
            {subtitle}
          </Text>
        )}
      </VStack>
    </Box>
  );
};
