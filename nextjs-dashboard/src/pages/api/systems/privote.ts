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

    const summary = await query(`
      SELECT 
        COUNT(*) as total_projects,
        SUM(allocation_eth) as total_allocated,
        SUM(votes) as total_votes,
        AVG(allocation_eth) as avg_allocation
      FROM privote.ui_allocations
    `, []);

    const systemProfile = await query(`
      SELECT 
        'privote' as platform,
        CAST(COUNT(DISTINCT recipient_index) AS INTEGER) as total_applications,
        CAST(SUM(votes) AS NUMERIC) as total_votes,
        CAST(AVG(votes) AS NUMERIC) as avg_votes_per_project,
        CAST(MAX(votes) AS INTEGER) as max_votes,
        CAST(SUM(allocation_eth) AS DOUBLE PRECISION) as total_funding_distributed_usd,
        CAST(AVG(allocation_eth) AS DOUBLE PRECISION) as avg_funding_per_project,
        3 as top_3_projects,
        CAST(COUNT(DISTINCT project_name) AS INTEGER) as total_projects,
        1 as total_grant_pools
      FROM privote.ui_allocations
    `, []);

    res.status(200).json({
      profile: systemProfile[0] || {},
      allocations,
      summary: summary[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
