import { Box, Text } from '@chakra-ui/react';
import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: string;
  minHeight?: string;
}

export const ChartCard = ({
  title,
  subtitle,
  children,
  height = '300px',
  minHeight,
}: ChartCardProps) => {
  return (
    <Box p={6} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
      <Text fontSize="md" fontWeight="semibold" mb={subtitle ? 2 : 4}>
        {title}
      </Text>
      {subtitle && (
        <Text fontSize="sm" color="gray.500" mb={4}>
          {subtitle}
        </Text>
      )}
      <Box h={height} minH={minHeight || height}>
        {children}
      </Box>
    </Box>
  );
};
