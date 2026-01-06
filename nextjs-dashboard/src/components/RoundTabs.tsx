import { Tabs, Box } from '@chakra-ui/react';
import { brandColors } from '../theme/colors';

interface RoundTabsProps {
  tabs: Array<{
    label: string;
    content: React.ReactNode;
  }>;
  defaultIndex?: number;
}

export const RoundTabs = ({ tabs, defaultIndex = 0 }: RoundTabsProps) => {
  const defaultValue = tabs[defaultIndex]?.label || tabs[0]?.label;

  return (
    <Tabs.Root defaultValue={defaultValue} variant="line">
      <Tabs.List
        borderBottomWidth="1px"
        borderColor="gray.200"
        mb={8}
        gap={2}
      >
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.label}
            value={tab.label}
            fontSize="sm"
            fontWeight="medium"
            fontFamily="Inter"
            letterSpacing="wide"
            textTransform="uppercase"
            color="gray.500"
            px={4}
            py={3}
            borderBottomWidth="2px"
            borderColor="transparent"
            _selected={{
              color: brandColors.deepPurple,
              borderColor: brandColors.deepPurple,
            }}
            _hover={{
              color: brandColors.deepPurple,
            }}
            transition="all 0.2s"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map((tab) => (
        <Tabs.Content key={tab.label} value={tab.label} px={0}>
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};
