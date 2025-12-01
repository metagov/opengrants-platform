"use client";

import { NextPage } from "next";
import { useEffect, useState } from "react";
import { Box, Heading, Text, Spinner, VStack, Tabs, TabList, TabPanels, Tab, TabPanel } from "@chakra-ui/react";
import { MarkdownRenderer } from "@/lib/markdown";
import { getGivethAnalytics } from "@/lib/analytics";

const GivethSystemPage: NextPage = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGivethAnalytics().then((data) => {
      setAnalytics(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Box textAlign="center" py={20}>
        <Spinner size="xl" color="#800020" />
        <Text mt={4} fontSize="lg" color="#2A0055">
          Loading Giveth analytics...
        </Text>
      </Box>
    );
  }

  return (
    <Box maxW="1200px" mx="auto" py={8} px={4}>
      <Heading fontSize="48px" fontFamily="Inter" color="#800020" mb={6}>
        Giveth — Grant Analytics
      </Heading>

      <Tabs variant="enclosed" colorScheme="purple">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Round-by-Round</Tab>
          <Tab>Grant Process</Tab>
        </TabList>

        <TabPanels>
          {/* ---------------- Overview ---------------- */}
          <TabPanel>
            <VStack align="start" spacing={6}>
              <Box>
                <Heading size="md" color="#2A0055">Total Projects</Heading>
                <Text fontSize="xl" color="#006E7F">
                  {analytics.total_projects}
                </Text>
              </Box>

              <Box>
                <Heading size="md" color="#2A0055">Total Funding</Heading>
                <Text fontSize="xl" color="#8B9A46">
                  ${analytics.total_funding_usd.toLocaleString()}
                </Text>
              </Box>

              <Box>
                <Heading size="md" color="#2A0055">Total Donations</Heading>
                <Text fontSize="xl" color="#800020">
                  ${analytics.total_donations.toLocaleString()}
                </Text>
              </Box>
            </VStack>
          </TabPanel>

          {/* ---------------- Round-by-Round ---------------- */}
          <TabPanel>
            <MarkdownRenderer filePath="/grant_docs/giveth_rounds.md" />
          </TabPanel>

          {/* ---------------- Grant Process ---------------- */}
          <TabPanel>
            <MarkdownRenderer filePath="/grant_docs/giveth_process.md" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default GivethSystemPage;
