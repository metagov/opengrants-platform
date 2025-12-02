import { Box, HStack, Link as ChakraLink } from '@chakra-ui/react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const router = useRouter();
  const isActive = router.pathname === href || router.pathname.startsWith(href + '/');

  return (
    <Link href={href} passHref legacyBehavior>
      <ChakraLink
        fontSize="sm"
        fontWeight={isActive ? 'semibold' : 'medium'}
        color={isActive ? '#800020' : 'gray.600'}
        letterSpacing="wide"
        textTransform="uppercase"
        _hover={{
          color: '#600018',
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
  return (
    <Box
      as="nav"
      position="sticky"
      top={0}
      zIndex={10}
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.100"
      px={8}
      py={4}
    >
      <HStack justify="space-between">
        <HStack gap={8}>
          <Link href="/" passHref legacyBehavior>
            <ChakraLink
              fontSize="lg"
              fontWeight="thin"
              letterSpacing="tight"
              color="#800020"
              _hover={{ textDecoration: 'none' }}
            >
              OpenGrants
            </ChakraLink>
          </Link>
          <HStack gap={6}>
            <NavLink href="/ecosystem">Ecosystem</NavLink>
            <NavLink href="/system/giveth">Giveth</NavLink>
            <NavLink href="/system/scf">SCF</NavLink>
            <NavLink href="/system/privote">Privote</NavLink>
          </HStack>
        </HStack>
      </HStack>
    </Box>
  );
};
