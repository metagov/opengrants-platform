import { Box, Heading, Text, VStack, useColorModeValue } from '@chakra-ui/react';

interface SystemHeaderProps {
  title: string;
  description?: string;
  color?: string;
}

export const SystemHeader = ({ title, description, color = 'gray.900' }: SystemHeaderProps) => {
  const descColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box mb={12}>
      <VStack align="start" spacing={3}>
        <Heading
          as="h1"
          fontSize={['4xl', '5xl', '6xl']}
          fontWeight="thin"
          letterSpacing="tight"
          color={color}
        >
          {title}
        </Heading>
        {description && (
          <Text
            fontSize="lg"
            color={descColor}
            maxW="2xl"
          >
            {description}
          </Text>
        )}
      </VStack>
    </Box>
  );
};
