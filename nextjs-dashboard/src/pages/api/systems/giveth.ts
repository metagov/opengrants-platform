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
    const systemProfile = await query(`
      SELECT * FROM gold__giveth_system_profile
    `, []);

    const donationMetrics = await query(`
      SELECT * FROM gold__donation_metrics WHERE platform = 'giveth'
    `, []);

    const engagementMetrics = await query(`
      SELECT * FROM gold__engagement_metrics WHERE platform = 'giveth'
    `, []);

    const rounds = await query(`
      SELECT 
        platform,
        round_name,
        round_timestamp,
        year_quarter,
        total_pool_size,
        projects_funded,
        avg_funding_per_project
      FROM gold_temporal_funding
      WHERE platform = 'giveth'
      ORDER BY round_timestamp DESC
    `, []);

    res.status(200).json({
      profile: systemProfile[0] || {},
      donations: donationMetrics[0] || {},
      engagement: engagementMetrics[0] || {},
      rounds
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
