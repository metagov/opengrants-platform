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
      WHERE platform = 'privote'
    `, []);

    const allocations = await query(`
      SELECT 
        rank,
        medal,
        project_name,
        allocation_eth,
        token,
        votes,
        recipient_index
      FROM privote.ui_allocations
      ORDER BY rank ASC
      LIMIT 50
    `, []);

    const summaryData = await query(`
      SELECT 
        COUNT(*) as total_projects,
        SUM(allocation_eth) as total_allocated,
        SUM(votes) as total_votes,
        AVG(allocation_eth) as avg_allocation,
        MAX(allocation_eth) as max_allocation,
        MIN(allocation_eth) as min_allocation
      FROM privote.ui_allocations
    `, []);

    const applicationStats = await query(`
      SELECT 
        COUNT(*) as total_applications,
        SUM(CAST("fundsApprovedInUSD" AS numeric)) as total_approved_usd,
        SUM(CAST("fundsAskedInUSD" AS numeric)) as total_asked_usd,
        AVG(CAST("fundsApprovedInUSD" AS numeric)) as avg_approved_usd,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_count
      FROM silver_privote_grant_applications
    `, []);

    const roundInfo = await query(`
      SELECT 
        id as round_id,
        name as round_name,
        description,
        "totalGrantPoolSizeInUSD" as pool_size_usd,
        "io.privote.chain" as chain
      FROM silver_privote_grant_pools
      LIMIT 1
    `, []);

    const topApplications = await query(`
      SELECT 
        name as project_name,
        description,
        CAST("fundsApprovedInUSD" AS numeric) as funds_approved_usd,
        CAST("fundsAskedInUSD" AS numeric) as funds_asked_usd,
        status,
        "grantPoolName" as grant_pool_name,
        CAST("io.privote.rank" AS integer) as rank,
        CAST("io.privote.votes" AS numeric) as votes
      FROM silver_privote_grant_applications
      WHERE "io.privote.rank" IS NOT NULL
      ORDER BY CAST("io.privote.rank" AS integer) ASC
      LIMIT 20
    `, []);

    const summary = {
      total_projects: Number(summaryData[0]?.total_projects) || 0,
      total_allocated: Number(summaryData[0]?.total_allocated) || 0,
      total_votes: Number(summaryData[0]?.total_votes) || 0,
      avg_allocation: Number(summaryData[0]?.avg_allocation) || 0,
      max_allocation: Number(summaryData[0]?.max_allocation) || 0,
      min_allocation: Number(summaryData[0]?.min_allocation) || 0,
      total_applications: Number(applicationStats[0]?.total_applications) || 0,
      total_approved_usd: Number(applicationStats[0]?.total_approved_usd) || 0,
      total_asked_usd: Number(applicationStats[0]?.total_asked_usd) || 0,
    };

    res.status(200).json({
      metadata: metadata[0] || null,
      summary,
      allocations,
      round: roundInfo[0] || null,
      topApplications,
      applicationStats: applicationStats[0] || {}
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
