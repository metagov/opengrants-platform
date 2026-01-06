import { Box, HStack, Link as ChakraLink } from '@chakra-ui/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { brandColors } from '../theme/colors';

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const router = useRouter();
  const isActive = router.pathname === href || router.pathname.startsWith(href + '/');

  return (
    <Link href={href} passHref legacyBehavior>
      <ChakraLink
        fontSize="sm"
        fontWeight={isActive ? 'semibold' : 'medium'}
        fontFamily="Inter"
        color={brandColors.textOnColor}
        letterSpacing="wide"
        textTransform="uppercase"
        opacity={isActive ? 1 : 0.85}
        _hover={{
          opacity: 1,
          textDecoration: 'none',
        }}
        transition="opacity 0.2s"
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
      bg={brandColors.burgundy}
      px={8}
      py={4}
    >
      <HStack justify="space-between">
        <HStack gap={8}>
          <Link href="/" passHref legacyBehavior>
            <ChakraLink
              fontSize="lg"
              fontWeight="normal"
              letterSpacing="tight"
              fontFamily="Inter"
              color={brandColors.textOnColor}
              _hover={{ textDecoration: 'none' }}
            >
              OpenGrants
            </ChakraLink>
          </Link>
          <HStack gap={6}>
            <NavLink href="/ecosystem">Ecosystem</NavLink>
            <NavLink href="/system/giveth">Giveth</NavLink>
            <NavLink href="/system/scf">SCF</NavLink>
            <NavLink href="/system/privote">Privote (GG24 Privacy)</NavLink>
          </HStack>
        </HStack>
      </HStack>
    </Box>
  );
};
