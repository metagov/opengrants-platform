import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const metadata = await query(`
      SELECT platform, last_indexed_at, data_source, notes
      FROM platform_metadata
      WHERE platform = 'giveth'
    `, []);

    const summaryTotals = await query(`
      SELECT 
        COUNT(*) as total_rounds,
        SUM(CAST("io.giveth.allDonationsUsdValue" AS numeric)) as total_donations,
        SUM(CAST("io.giveth.matchingPool" AS numeric)) as total_matching,
        SUM(CAST("io.giveth.uniqueDonors" AS numeric)) as total_unique_donors,
        SUM(CAST("io.giveth.donationsCount" AS numeric)) as total_donation_count
      FROM silver_giveth_grant_pools
    `, []);

    const projectCount = await query(`
      SELECT COUNT(*) as total_projects FROM silver_giveth_projects
    `, []);

    const summary = {
      total_rounds: Number(summaryTotals[0]?.total_rounds) || 0,
      total_donations: Number(summaryTotals[0]?.total_donations) || 0,
      total_matching: Number(summaryTotals[0]?.total_matching) || 0,
      total_distributed: (Number(summaryTotals[0]?.total_donations) || 0) + (Number(summaryTotals[0]?.total_matching) || 0),
      total_unique_donors: Number(summaryTotals[0]?.total_unique_donors) || 0,
      total_donation_count: Number(summaryTotals[0]?.total_donation_count) || 0,
      total_projects: Number(projectCount[0]?.total_projects) || 0,
    };

    const rounds = await query(`
      SELECT 
        id as round_id,
        name as round_name,
        "io.giveth.title" as title,
        "io.giveth.slug" as slug,
        "io.giveth.beginDate" as begin_date,
        "closeDate" as close_date,
        "isOpen" as is_open,
        CAST("io.giveth.allDonationsUsdValue" AS numeric) as donations_usd,
        CAST("io.giveth.matchingPool" AS numeric) as matching_pool,
        CAST("io.giveth.uniqueDonors" AS numeric) as unique_donors,
        CAST("io.giveth.donationsCount" AS numeric) as donations_count,
        "io.giveth.allocatedTokenSymbol" as token_symbol,
        "io.giveth.qfStrategy" as qf_strategy
      FROM silver_giveth_grant_pools
      ORDER BY "io.giveth.beginDate" DESC NULLS LAST
    `, []);

    const topProjects = await query(`
      SELECT DISTINCT ON ("io.giveth.slug")
        name as project_name,
        "io.giveth.slug" as slug,
        CAST("io.giveth.totalDonations" AS numeric) as total_donations,
        CAST("io.giveth.countUniqueDonors" AS numeric) as unique_donors,
        "io.giveth.verificationStatus" as verification_status,
        "io.giveth.impactLocation" as impact_location
      FROM silver_giveth_projects
      WHERE "io.giveth.totalDonations" IS NOT NULL
        AND "io.giveth.slug" IS NOT NULL
      ORDER BY "io.giveth.slug", CAST("io.giveth.totalDonations" AS numeric) DESC
    `, []);
    
    const topProjectsSorted = topProjects
      .sort((a: any, b: any) => Number(b.total_donations) - Number(a.total_donations))
      .slice(0, 10);

    const verificationBreakdown = await query(`
      SELECT 
        "io.giveth.verificationStatus" as status,
        COUNT(*) as count
      FROM silver_giveth_projects
      WHERE "io.giveth.verificationStatus" IS NOT NULL
      GROUP BY "io.giveth.verificationStatus"
      ORDER BY count DESC
    `, []);

    res.status(200).json({
      metadata: metadata[0] || null,
      summary,
      rounds,
      topProjects: topProjectsSorted,
      verificationBreakdown
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
