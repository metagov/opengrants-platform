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
    `, []);

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
    `, []);

    const scfSummary = await query(`
      SELECT 
        COUNT(*) as total_rounds,
        SUM(total_awarded_usd) as total_awarded,
        SUM(total_paid_usd) as total_paid,
        AVG(total_awarded_usd) as avg_per_round
      FROM gold_scf_rounds_parsed
      WHERE total_awarded_usd > 0
    `, []);

    res.status(200).json({
      platforms: ecosystemData,
      crossPlatform,
      scf: scfSummary[0]
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
