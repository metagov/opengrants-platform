import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Box, Container, HStack, VStack, Text, Spinner, Center, Input, Badge } from '@chakra-ui/react';
import { Navigation } from '../../../components/Navigation';
import { SystemHeader } from '../../../components/SystemHeader';
import { brandColors } from '../../../theme/colors';
import { formatCurrency } from '../../../lib/formatters';
import { projectPath } from '../../../lib/scfIds';

interface ProjectRow {
  project_id: string;
  project_name: string | null;
  category: string | null;
  award_count: number | string;
  total_awarded_usd: number | null;
  total_paid_usd: number | null;
  rounds: string[] | null;
}

const PAGE = 50;

export default function SCFProjectsIndex() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    fetch('/api/systems/scf/projects')
      .then((r) => {
        if (!r.ok) throw new Error('Could not load projects');
        return r.json();
      })
      .then((d) => {
        setRows(d.projects || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.project_name, r.category, r.project_id, ...(r.rounds || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  return (
    <>
      <Head>
        <title>SCF projects · OpenGrants</title>
      </Head>
      <Navigation />
      <Box minH="100vh" bg="gray.50">
        <Container maxW="7xl" py={12}>
          <HStack mb={4}>
            <Link href="/system/scf">
              <Text color={brandColors.teal} fontSize="sm" cursor="pointer">← Back to SCF</Text>
            </Link>
          </HStack>
          <SystemHeader
            title="SCF Projects"
            description="Every project funded by the Stellar Community Fund, with its funding history."
            color={brandColors.olive}
          />

          <Input
            placeholder="Search by project, category or round (e.g. SCF #44)"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            bg="white"
            mb={4}
            maxW="560px"
          />

          {loading && (
            <Center py={20}>
              <Spinner size="xl" color={brandColors.olive} />
            </Center>
          )}
          {error && <Text color="red.600">{error}</Text>}

          {!loading && !error && (
            <>
              <Text fontSize="sm" color="gray.500" mb={4}>
                {filtered.length} of {rows.length} projects
              </Text>
              <VStack align="stretch" gap={2}>
                {filtered.slice(0, shown).map((r) => {
                  const href = projectPath(r.project_id);
                  return (
                    <Link key={r.project_id} href={href || '#'}>
                      <Box
                        p={4}
                        bg="white"
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor="gray.100"
                        _hover={{ borderColor: 'gray.300', shadow: 'sm' }}
                        cursor="pointer"
                      >
                        <HStack justify="space-between" flexWrap="wrap" gap={2}>
                          <VStack align="start" gap={1} minW={0}>
                            <Text fontWeight="semibold">{r.project_name || r.project_id}</Text>
                            <HStack gap={2} flexWrap="wrap">
                              {r.category && <Badge fontSize="xs" px={2}>{r.category}</Badge>}
                              <Text fontSize="xs" color="gray.500">
                                {Number(r.award_count)} award{Number(r.award_count) === 1 ? '' : 's'}
                                {r.rounds?.length ? ` · ${r.rounds.join(', ')}` : ''}
                              </Text>
                            </HStack>
                          </VStack>
                          <VStack align="end" gap={0}>
                            <Text fontWeight="bold" color={brandColors.olive}>{formatCurrency(r.total_awarded_usd)}</Text>
                            <Text fontSize="xs" color="gray.500">{formatCurrency(r.total_paid_usd)} paid</Text>
                          </VStack>
                        </HStack>
                      </Box>
                    </Link>
                  );
                })}
              </VStack>
              {shown < filtered.length && (
                <Center mt={6}>
                  <Text
                    as="button"
                    color={brandColors.teal}
                    fontSize="sm"
                    onClick={() => setShown((s) => s + PAGE)}
                  >
                    Show more
                  </Text>
                </Center>
              )}
            </>
          )}
        </Container>
      </Box>
    </>
  );
}
