import { Box, VStack, HStack, Text, SimpleGrid, Link, Badge } from '@chakra-ui/react';
import { brandColors } from '../theme/colors';

export interface ProgramLink {
  label: string;
  url: string;
}

export interface ProgramProfileProps {
  name: string;
  description: string;
  programDescription?: string;
  fundingMechanism?: string;
  fundingMechanismDescription?: string;
  primaryMechanism?: string;
  email?: string;
  links?: ProgramLink[];
  tags?: string[];
  color?: string;
  lastIndexedAt?: string;
  dataSource?: string;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}

export function ProgramProfile({
  name,
  description,
  programDescription,
  fundingMechanism,
  fundingMechanismDescription,
  primaryMechanism,
  email,
  links = [],
  tags = [],
  color = brandColors.teal,
  lastIndexedAt,
  dataSource,
}: ProgramProfileProps) {
  return (
    <Box p={8} bg="white" borderRadius="lg" borderWidth="1px" borderColor="gray.100">
      <VStack align="start" gap={4}>
        <HStack justify="space-between" w="full" flexWrap="wrap" gap={2}>
          <Text fontSize="xl" fontWeight="semibold" color={color}>
            About {name}
          </Text>
          <HStack gap={2} flexWrap="wrap">
            {lastIndexedAt && (
              <Badge colorPalette="blue" px={2} py={1} fontSize="xs">
                Data indexed: {formatDate(lastIndexedAt)}
              </Badge>
            )}
            {tags.map((tag, idx) => (
              <Badge key={idx} colorPalette="gray" px={2} py={1}>
                {tag}
              </Badge>
            ))}
          </HStack>
        </HStack>
        
        <Text color="gray.600" lineHeight="tall">
          {description}
        </Text>
        
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={8} w="full" mt={4}>
          {programDescription && (
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="gray.500" mb={2}>
                Program Description
              </Text>
              <Text color="gray.600" fontSize="sm" lineHeight="tall">
                {programDescription}
              </Text>
            </Box>
          )}
          
          {(fundingMechanism || fundingMechanismDescription || primaryMechanism) && (
            <Box>
              <Text fontSize="sm" fontWeight="medium" color="gray.500" mb={2}>
                Funding Mechanism
              </Text>
              {primaryMechanism && (
                <Text fontSize="md" fontWeight="semibold" mb={1}>
                  {primaryMechanism}
                </Text>
              )}
              {fundingMechanismDescription && (
                <Text color="gray.600" fontSize="sm" lineHeight="tall">
                  {fundingMechanismDescription}
                </Text>
              )}
            </Box>
          )}
        </SimpleGrid>

        {(email || links.length > 0) && (
          <Box w="full" mt={4} pt={4} borderTopWidth="1px" borderColor="gray.100">
            <Text fontSize="sm" fontWeight="medium" color="gray.500" mb={3}>
              Links & Resources
            </Text>
            <HStack gap={4} flexWrap="wrap">
              {email && (
                <Link href={`mailto:${email}`} color={brandColors.teal} fontSize="sm" fontWeight="medium">
                  Contact Email
                </Link>
              )}
              {links.map((link, idx) => (
                <Link 
                  key={idx} 
                  href={link.url} 
                  color={brandColors.teal} 
                  fontSize="sm" 
                  fontWeight="medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </Link>
              ))}
            </HStack>
          </Box>
        )}

        {dataSource && (
          <Text fontSize="xs" color="gray.400" mt={2}>
            Source: {dataSource}
          </Text>
        )}
      </VStack>
    </Box>
  );
}
