import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  SimpleGrid,
  VStack,
  Text,
  useColorModeValue,
  Spinner,
  Center,
} from '@chakra-ui/react';
import { Navigation } from '../components/Navigation';
import { SystemHeader } from '../components/SystemHeader';
import { MetricCard } from '../components/MetricCard';

export default function GG24Page() {
  const [loading, setLoading] = useState(false);
  const bgColor = useColorModeValue('gray.50', 'gray.900');

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <Center h="80vh">
          <Spinner size="xl" color="blue.500" />
        </Center>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <Box minH="100vh" bg={bgColor}>
        <Container maxW="7xl" py={12}>
          <SystemHeader
            title="GitcoinGrants 24 (GG24)"
            description="Combined analysis of Gitcoin Grants Round 24 - featuring 2 Giveth rounds and 1 Privote round"
            color="blue.600"
          />

          <Box
            p={8}
            bg={useColorModeValue('white', 'gray.800')}
            borderRadius="lg"
            borderWidth="1px"
            borderColor={useColorModeValue('gray.100', 'gray.700')}
          >
            <VStack align="start" spacing={4}>
              <Text fontSize="lg" fontWeight="medium">
                GG24 Overview
              </Text>
              <Text color={useColorModeValue('gray.600', 'gray.400')}>
                GitcoinGrants 24 (GG24) was a special round that included participation from multiple platforms.
                This page will show combined analytics from the 2 Giveth rounds and 1 Privote round that were 
                part of GG24.
              </Text>
              <Box
                p={6}
                bg={useColorModeValue('blue.50', 'blue.900')}
                borderRadius="md"
                w="full"
              >
                <Text fontSize="sm" color={useColorModeValue('blue.700', 'blue.200')}>
                  This page is under construction. Round-specific data and combined metrics will be added soon.
                </Text>
              </Box>
            </VStack>
          </Box>
        </Container>
      </Box>
    </>
  );
}
