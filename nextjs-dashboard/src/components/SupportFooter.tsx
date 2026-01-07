import { useState } from 'react';
import { Box, Text, HStack, VStack, Link } from '@chakra-ui/react';
import { brandColors } from '../theme/colors';

export function SupportFooter() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box 
      position="fixed" 
      bottom={4} 
      right={4} 
      zIndex={100}
    >
      {isExpanded ? (
        <Box 
          bg="white" 
          p={4} 
          borderRadius="lg" 
          shadow="lg" 
          borderWidth="1px" 
          borderColor="gray.200"
          maxW="320px"
        >
          <VStack align="start" gap={2}>
            <HStack justify="space-between" w="full">
              <Text fontSize="sm" fontWeight="semibold" color="gray.700">Report Data Issues</Text>
              <Text 
                fontSize="xs" 
                color="gray.400" 
                cursor="pointer" 
                onClick={() => setIsExpanded(false)}
                _hover={{ color: 'gray.600' }}
              >
                Close
              </Text>
            </HStack>
            <Text fontSize="xs" color="gray.600" lineHeight="tall">
              Notice a discrepancy? Please email{' '}
              <Link href="mailto:rashmi@metagov.org" fontWeight="medium" color={brandColors.teal}>
                rashmi@metagov.org
              </Link>
              {' '}with screenshots and any helpful context.
            </Text>
          </VStack>
        </Box>
      ) : (
        <Box 
          bg="white" 
          px={3} 
          py={2} 
          borderRadius="full" 
          shadow="md" 
          cursor="pointer"
          onClick={() => setIsExpanded(true)}
          _hover={{ shadow: 'lg' }}
          transition="all 0.2s"
          borderWidth="1px"
          borderColor="gray.100"
        >
          <HStack gap={2}>
            <Box w="6px" h="6px" borderRadius="full" bg={brandColors.olive} />
            <Text fontSize="xs" color="gray.500">Report issue</Text>
          </HStack>
        </Box>
      )}
    </Box>
  );
}
