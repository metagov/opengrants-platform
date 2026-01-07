import { Box, Text, VStack, HStack } from '@chakra-ui/react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  info?: string;
}

export const MetricCard = ({ label, value, subtitle, color = 'gray.600', info }: MetricCardProps) => {
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
        <HStack gap={1}>
          <Text
            fontSize="xs"
            fontWeight="medium"
            letterSpacing="wide"
            textTransform="uppercase"
            color="gray.600"
          >
            {label}
          </Text>
          {info && (
            <Box 
              as="span" 
              cursor="help" 
              color="gray.400" 
              fontSize="xs"
              title={info}
              _hover={{ color: 'gray.600' }}
            >
              ⓘ
            </Box>
          )}
        </HStack>
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
