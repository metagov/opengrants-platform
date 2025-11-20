import { Box, HStack, Link as ChakraLink, useColorModeValue } from '@chakra-ui/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { DarkModeSwitch } from './DarkModeSwitch';

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const router = useRouter();
  const isActive = router.pathname === href || router.pathname.startsWith(href + '/');
  const activeColor = useColorModeValue('purple.600', 'purple.300');
  const inactiveColor = useColorModeValue('gray.600', 'gray.400');
  const hoverColor = useColorModeValue('purple.700', 'purple.200');

  return (
    <Link href={href} passHref legacyBehavior>
      <ChakraLink
        fontSize="sm"
        fontWeight={isActive ? 'semibold' : 'medium'}
        color={isActive ? activeColor : inactiveColor}
        letterSpacing="wide"
        textTransform="uppercase"
        _hover={{
          color: hoverColor,
          textDecoration: 'none',
        }}
        transition="color 0.2s"
      >
        {children}
      </ChakraLink>
    </Link>
  );
};

export const Navigation = () => {
  const bgColor = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.100', 'gray.800');

  return (
    <Box
      as="nav"
      position="sticky"
      top={0}
      zIndex={10}
      bg={bgColor}
      borderBottomWidth="1px"
      borderColor={borderColor}
      px={8}
      py={4}
    >
      <HStack justify="space-between">
        <HStack spacing={8}>
          <Link href="/" passHref legacyBehavior>
            <ChakraLink
              fontSize="lg"
              fontWeight="thin"
              letterSpacing="tight"
              _hover={{ textDecoration: 'none' }}
            >
              OpenGrants
            </ChakraLink>
          </Link>
          <HStack spacing={6}>
            <NavLink href="/ecosystem">Ecosystem</NavLink>
            <NavLink href="/system/giveth">Giveth</NavLink>
            <NavLink href="/system/scf">SCF</NavLink>
            <NavLink href="/system/privote">Privote</NavLink>
            <NavLink href="/gg24">GG24</NavLink>
          </HStack>
        </HStack>
        <DarkModeSwitch />
      </HStack>
    </Box>
  );
};
