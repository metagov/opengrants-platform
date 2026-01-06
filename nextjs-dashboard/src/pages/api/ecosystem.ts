import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
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
    `);

    const crossPlatform = await query(`
      SELECT 
        project_name,
        platforms_present,
        platforms_list,
        total_funding_across_platforms,
        giveth_funding,
        scf_funding,
        privote_funding
      FROM gold__cross_platform
      WHERE platforms_present > 1
      ORDER BY total_funding_across_platforms DESC
      LIMIT 10
    `);

    const scfSummary = await query(`
      SELECT 
        total_grant_pools as total_rounds,
        total_funding_distributed_usd as total_awarded,
        total_funding_distributed_usd as total_paid,
        avg_funding_per_project as avg_per_round
      FROM gold__scf_system_profile
      LIMIT 1
    `);

    res.status(200).json({
      platforms: ecosystemData || [],
      crossPlatform: crossPlatform || [],
      scf: scfSummary?.[0] || null
    });
  } catch (error: any) {
    console.error('Database error:', error.message);
    res.status(500).json({ 
      message: 'Database connection failed',
      error: error.message,
      platforms: [],
      crossPlatform: [],
      scf: null
    });
  }
}
