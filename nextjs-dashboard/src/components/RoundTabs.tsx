import { Tabs, TabList, TabPanels, Tab, TabPanel, useColorModeValue } from '@chakra-ui/react';

interface RoundTabsProps {
  tabs: Array<{
    label: string;
    content: React.ReactNode;
  }>;
  defaultIndex?: number;
}

export const RoundTabs = ({ tabs, defaultIndex = 0 }: RoundTabsProps) => {
  const selectedColor = useColorModeValue('purple.600', 'purple.300');
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Tabs defaultIndex={defaultIndex} variant="unstyled">
      <TabList
        borderBottomWidth="1px"
        borderColor={borderColor}
        mb={8}
        gap={2}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            fontSize="sm"
            fontWeight="medium"
            letterSpacing="wide"
            textTransform="uppercase"
            color="gray.500"
            px={4}
            py={3}
            borderBottomWidth="2px"
            borderColor="transparent"
            _selected={{
              color: selectedColor,
              borderColor: selectedColor,
            }}
            _hover={{
              color: selectedColor,
            }}
            transition="all 0.2s"
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>

      <TabPanels>
        {tabs.map((tab, index) => (
          <TabPanel key={index} px={0}>
            {tab.content}
          </TabPanel>
        ))}
      </TabPanels>
    </Tabs>
  );
};
