import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { safeQuery } from '../../lib/safeQuery';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Gold queries are wrapped individually — a stale or rebuilding gold table
    // won't crash the entire endpoint; affected sections just return empty.
    const ecosystemData = await query(`
      SELECT
        platform,
        total_projects,
        total_grant_pools,
        total_applications,
        total_funding_usd,
        total_funding_display,
        primary_mechanism,
        funding_share_pct
      FROM gold__ecosystem_overview
      ORDER BY total_funding_usd DESC NULLS LAST
    `).catch((e: Error) => {
      console.error('ecosystem_overview query failed:', e.message);
      return [];
    });

    const crossPlatform = await query(`
      SELECT
        project_name,
        platforms_present,
        platforms_list,
        total_funding_across_platforms,
        ens_funding,
        giveth_funding,
        scf_funding,
        privote_funding
      FROM gold__cross_platform
      WHERE platforms_present > 1
      ORDER BY total_funding_across_platforms DESC
      LIMIT 10
    `).catch((e: Error) => {
      console.error('cross_platform query failed:', e.message);
      return [];
    });

    const scfSummary = await query(`
      SELECT
        total_grant_pools as total_rounds,
        total_funding_distributed_usd as total_awarded,
        total_funding_distributed_usd as total_paid,
        avg_funding_per_project as avg_per_round
      FROM gold__scf_system_profile
      LIMIT 1
    `).catch((e: Error) => {
      console.error('scf_system_profile query failed:', e.message);
      return [];
    });

    // Cross-platform comparison: Average grant size per platform
    const avgGrantSize = await query(`
      SELECT
        'SCF' as platform,
        AVG(CAST("fundsApprovedInUSD" AS numeric)) as avg_grant_size,
        COUNT(*) as project_count,
        SUM(CAST("fundsApprovedInUSD" AS numeric)) as total_funding
      FROM silver_scf_grant_applications
      WHERE "fundsApprovedInUSD" IS NOT NULL AND CAST("fundsApprovedInUSD" AS numeric) > 0
      UNION ALL
      SELECT
        'Giveth' as platform,
        AVG(CAST("io.giveth.totalDonations" AS numeric)) as avg_grant_size,
        COUNT(DISTINCT id) as project_count,
        SUM(CAST("io.giveth.totalDonations" AS numeric)) as total_funding
      FROM silver_giveth_projects
      WHERE "io.giveth.totalDonations" IS NOT NULL
      UNION ALL
      SELECT
        'Privote' as platform,
        AVG(CAST("fundsApprovedInUSD" AS numeric)) as avg_grant_size,
        COUNT(*) as project_count,
        SUM(CAST("fundsApprovedInUSD" AS numeric)) as total_funding
      FROM silver_privote_grant_applications
      WHERE "fundsApprovedInUSD" IS NOT NULL AND CAST("fundsApprovedInUSD" AS numeric) > 0
      UNION ALL
      SELECT
        'Gitcoin2' as platform,
        AVG(CAST("fundsApprovedInUSD" AS numeric)) as avg_grant_size,
        COUNT(*) as project_count,
        SUM(CAST("fundsApprovedInUSD" AS numeric)) as total_funding
      FROM silver_gitcoin2_grant_applications
      WHERE "fundsApprovedInUSD" IS NOT NULL AND CAST("fundsApprovedInUSD" AS numeric) > 0
    `).catch((e: Error) => {
      console.error('avgGrantSize query failed:', e.message);
      return [];
    });

    // Funding distribution curve data (top projects per platform)
    const fundingDistribution = await query(`
      WITH scf_ranked AS (
        SELECT
          'SCF' as platform,
          name as project_name,
          CAST("fundsApprovedInUSD" AS numeric) as funding,
          ROW_NUMBER() OVER (ORDER BY CAST("fundsApprovedInUSD" AS numeric) DESC) as rank
        FROM silver_scf_grant_applications
        WHERE "fundsApprovedInUSD" IS NOT NULL AND CAST("fundsApprovedInUSD" AS numeric) > 0
      ),
      giveth_ranked AS (
        SELECT
          'Giveth' as platform,
          name as project_name,
          CAST("io.giveth.totalDonations" AS numeric) as funding,
          ROW_NUMBER() OVER (ORDER BY CAST("io.giveth.totalDonations" AS numeric) DESC) as rank
        FROM (
          SELECT DISTINCT ON (id) name, "io.giveth.totalDonations", id
          FROM silver_giveth_projects
          WHERE "io.giveth.totalDonations" IS NOT NULL
        ) deduped
      ),
      privote_ranked AS (
        SELECT
          'Privote' as platform,
          name as project_name,
          CAST("fundsApprovedInUSD" AS numeric) as funding,
          ROW_NUMBER() OVER (ORDER BY CAST("fundsApprovedInUSD" AS numeric) DESC) as rank
        FROM silver_privote_grant_applications
        WHERE "fundsApprovedInUSD" IS NOT NULL AND CAST("fundsApprovedInUSD" AS numeric) > 0
      ),
      gitcoin2_ranked AS (
        SELECT
          'Gitcoin2' as platform,
          name as project_name,
          CAST("fundsApprovedInUSD" AS numeric) as funding,
          ROW_NUMBER() OVER (ORDER BY CAST("fundsApprovedInUSD" AS numeric) DESC) as rank
        FROM silver_gitcoin2_grant_applications
        WHERE "fundsApprovedInUSD" IS NOT NULL AND CAST("fundsApprovedInUSD" AS numeric) > 0
      )
      SELECT * FROM scf_ranked WHERE rank <= 20
      UNION ALL
      SELECT * FROM giveth_ranked WHERE rank <= 20
      UNION ALL
      SELECT * FROM privote_ranked WHERE rank <= 20
      UNION ALL
      SELECT * FROM gitcoin2_ranked WHERE rank <= 20
      ORDER BY platform, rank
    `).catch((e: Error) => {
      console.error('fundingDistribution query failed:', e.message);
      return [];
    });

    res.status(200).json({
      platforms: ecosystemData || [],
      crossPlatform: crossPlatform || [],
      scf: scfSummary?.[0] || null,
      avgGrantSize: avgGrantSize || [],
      fundingDistribution: fundingDistribution || []
    });
  } catch (error: any) {
    // Log error server-side only, don't expose details to client
    console.error('Database error:', error.message || 'Error occurred');
    res.status(500).json({
      message: 'Internal server error',
      platforms: [],
      crossPlatform: [],
      scf: null
    });
  }
}
