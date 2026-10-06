import Head from "next/head";
import { Box, VStack, HStack, Heading, Text, Link, SimpleGrid, Code } from "@chakra-ui/react";
import { Navigation } from "../components/Navigation";
import { SupportFooter } from "../components/SupportFooter";
import { brandColors, platformHexColors } from "../theme/colors";

const DATA_SOURCES = [
  {
    key: "scf",
    name: "Stellar Community Fund (SCF)",
    source: "SDF Airtable (Build Award rounds, awarded submissions and projects)",
    cadence: "Automatic — new records are picked up within minutes",
    href: "/system/scf",
  },
  {
    key: "giveth",
    name: "Giveth",
    source: "Giveth GraphQL API (projects, QF rounds, donations)",
    cadence: "Periodic pipeline runs",
    href: "/system/giveth",
  },
  {
    key: "gitcoin2",
    name: "Gitcoin Grants Stack",
    source: "Gitcoin indexer (mainnet rounds, applications, donations)",
    cadence: "Periodic pipeline runs",
    href: "/system/gitcoin",
  },
  {
    key: "ens",
    name: "ENS Small Grants",
    source: "ENS Small Grants snapshot export",
    cadence: "Per round",
    href: "/system/ens",
  },
  {
    key: "privote",
    name: "Privote (GG24 Privacy)",
    source: "Privote round export",
    cadence: "Per round",
    href: "/system/privote",
  },
];

const LAYERS = [
  {
    name: "Bronze",
    color: "#A0522D",
    body: "Raw data exactly as published by each grant program — no cleaning, kept for auditability.",
  },
  {
    name: "Silver",
    color: "#708090",
    body: "Each source mapped onto the DAOIP-5 standard: grant systems, grant pools (rounds), applications and projects, with consistent types and USD values.",
  },
  {
    name: "Gold",
    color: "#B8860B",
    body: "Cross-ecosystem metrics built on the standardized data — funding totals, round trends, repeat funding, and the charts on this site.",
  },
];

const ACCESS = [
  {
    title: "Dashboard",
    body: "Browse funding by ecosystem and by round on this site. Start with the Ecosystem overview or pick a program in the navigation bar.",
    link: { href: "/ecosystem", label: "Open the Ecosystem overview" },
  },
  {
    title: "Gateway API",
    body: "A public REST API serving DAOIP-5 JSON for grant systems, pools, applications and projects. Anonymous use is rate-limited; free API keys raise the limit.",
    link: { href: "https://grants.daostar.org", label: "grants.daostar.org" },
    code: "GET https://grants.daostar.org/api/v1/grantPools?system=scf",
  },
  {
    title: "MCP server",
    body: "Lets AI agents and assistants (Claude, Cursor, and other MCP clients) query OpenGrants data directly with tools such as list_grant_pools and list_grant_applications.",
    link: {
      href: "https://github.com/metagov/Grants-Gateway-API/tree/main/mcp-server",
      label: "Setup instructions",
    },
  },
  {
    title: "Source code",
    body: "Pipelines, schema maps and dashboard are open source. Every transformation from raw source to DAOIP-5 is in the repository.",
    link: { href: "https://github.com/metagov/opengrants-platform", label: "metagov/opengrants-platform" },
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack align="stretch" gap={4} w="100%">
      <Heading as="h2" size="lg" fontFamily="Inter" fontWeight="semibold" color={brandColors.burgundy}>
        {title}
      </Heading>
      {children}
    </VStack>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="md" color="gray.700" lineHeight="tall" fontFamily="Inter">
      {children}
    </Text>
  );
}

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About · OpenGrants</title>
        <meta
          name="description"
          content="OpenGrants is open data infrastructure for Web3 grants, standardizing funding data from programs like the Stellar Community Fund into the DAOIP-5 format."
        />
      </Head>
      <Box minH="100vh" bg="gray.50">
        <Navigation />
        <Box maxW="960px" mx="auto" px={{ base: 4, md: 8 }} py={{ base: 8, md: 12 }}>
          <VStack align="stretch" gap={12}>
            <VStack align="stretch" gap={4}>
              <Heading as="h1" size="3xl" fontFamily="Inter" fontWeight="semibold" color="gray.900">
                About OpenGrants
              </Heading>
              <Text fontSize="lg" color="gray.700" lineHeight="tall" fontFamily="Inter">
                OpenGrants is open data infrastructure for Web3 grants. It collects funding data from grant
                programs across ecosystems, converts it into one open standard, and makes it available to
                anyone — so programs can learn from each other, delegates can make data-driven decisions, and
                builders can see where funding goes.
              </Text>
            </VStack>

            <Section title="Why it exists">
              <Prose>
                Billions in grant capital have been distributed across Web3, but each program publishes its data
                in its own format, in its own place — spreadsheets, Airtables, APIs, on-chain records. That makes
                it hard to answer simple questions: how much has a program funded, which projects keep coming
                back, how does one round compare to the last? OpenGrants does the collection and standardization
                work once, in the open, so those questions have reliable, comparable answers.
              </Prose>
            </Section>

            <Section title="The DAOIP-5 standard">
              <Prose>
                All data in OpenGrants follows{" "}
                <Link href="https://github.com/metagov/daostar/blob/main/DAOIPs/daoip-5.md" color={brandColors.teal} target="_blank" rel="noopener noreferrer">
                  DAOIP-5
                </Link>
                , an open metadata standard for grant management developed with DAOstar. It describes four
                things:
              </Prose>
              <SimpleGrid columns={{ base: 1, sm: 2 }} gap={3}>
                {[
                  ["Grant system", "A funding program, e.g. the Stellar Community Fund."],
                  ["Grant pool", "A round within a program, with its budget, dates and mechanism."],
                  ["Application", "A project's request to a pool, with amounts requested and approved."],
                  ["Project", "The team or work receiving funding, tracked across rounds and programs."],
                ].map(([term, def]) => (
                  <Box key={term} bg="white" p={4} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                    <Text fontWeight="semibold" fontFamily="Inter" color="gray.900">
                      {term}
                    </Text>
                    <Text fontSize="sm" color="gray.600" fontFamily="Inter">
                      {def}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Section>

            <Section title="Data sources">
              <Prose>Programs currently indexed, where their data comes from, and how often it is refreshed:</Prose>
              <VStack align="stretch" gap={3}>
                {DATA_SOURCES.map((s) => (
                  <HStack
                    key={s.key}
                    align="start"
                    gap={4}
                    bg="white"
                    p={4}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="gray.200"
                  >
                    <Box w="4px" alignSelf="stretch" borderRadius="full" bg={platformHexColors[s.key] || "gray.400"} flexShrink={0} />
                    <VStack align="start" gap={1} flex={1} minW={0}>
                      <Link href={s.href} fontWeight="semibold" fontFamily="Inter" color="gray.900">
                        {s.name}
                      </Link>
                      <Text fontSize="sm" color="gray.600" fontFamily="Inter">
                        {s.source}
                      </Text>
                      <Text fontSize="xs" color="gray.500" fontFamily="Inter">
                        Updates: {s.cadence}
                      </Text>
                    </VStack>
                  </HStack>
                ))}
              </VStack>
            </Section>

            <Section title="How the data is processed">
              <Prose>
                Every source runs through the same three-stage pipeline, so the numbers you see can be traced back
                to the raw record they came from.
              </Prose>
              <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
                {LAYERS.map((l) => (
                  <Box key={l.name} bg="white" p={4} borderRadius="md" borderWidth="1px" borderColor="gray.200" borderTopWidth="4px" borderTopColor={l.color}>
                    <Text fontWeight="semibold" fontFamily="Inter" color="gray.900" mb={1}>
                      {l.name}
                    </Text>
                    <Text fontSize="sm" color="gray.600" fontFamily="Inter" lineHeight="tall">
                      {l.body}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Section>

            <Section title="How to use OpenGrants">
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                {ACCESS.map((a) => (
                  <VStack key={a.title} align="start" gap={2} bg="white" p={4} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                    <Text fontWeight="semibold" fontFamily="Inter" color="gray.900">
                      {a.title}
                    </Text>
                    <Text fontSize="sm" color="gray.600" fontFamily="Inter" lineHeight="tall">
                      {a.body}
                    </Text>
                    {a.code && (
                      <Code fontSize="xs" px={2} py={1} maxW="100%" overflowX="auto" whiteSpace="nowrap">
                        {a.code}
                      </Code>
                    )}
                    <Link
                      href={a.link.href}
                      fontSize="sm"
                      fontWeight="medium"
                      color={brandColors.teal}
                      {...(a.link.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {a.link.label} →
                    </Link>
                  </VStack>
                ))}
              </SimpleGrid>
            </Section>

            <Section title="Who maintains it">
              <Prose>
                OpenGrants is built and maintained by{" "}
                <Link href="https://daostar.org" color={brandColors.teal} target="_blank" rel="noopener noreferrer">
                  DAOstar
                </Link>{" "}
                at{" "}
                <Link href="https://metagov.org" color={brandColors.teal} target="_blank" rel="noopener noreferrer">
                  Metagov
                </Link>
                , with support from the Stellar Community Fund public goods program. Found a number that looks
                wrong, or want your program included? Email{" "}
                <Link href="mailto:rashmi@metagov.org" color={brandColors.teal}>
                  rashmi@metagov.org
                </Link>{" "}
                or open an issue on{" "}
                <Link href="https://github.com/metagov/opengrants-platform/issues" color={brandColors.teal} target="_blank" rel="noopener noreferrer">
                  GitHub
                </Link>
                .
              </Prose>
            </Section>
          </VStack>
        </Box>
        <SupportFooter />
      </Box>
    </>
  );
}
