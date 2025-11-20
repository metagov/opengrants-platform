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
      SELECT * FROM gold__scf_system_profile
    `, []);

    const summary = await query(`
      SELECT 
        COUNT(*) as total_rounds,
        SUM(total_awarded_usd) as total_awarded,
        SUM(total_paid_usd) as total_paid,
        SUM(awarded_submissions) as total_projects_funded
      FROM gold_scf_rounds_parsed
      WHERE total_awarded_usd > 0
    `, []);

    const rounds = await query(`
      SELECT 
        round_name,
        quarter_year,
        phase,
        year,
        total_awarded_usd,
        total_paid_usd,
        awarded_submissions,
        applied_submissions,
        voters_count,
        avg_awarded_usd
      FROM gold_scf_rounds_parsed
      WHERE total_awarded_usd > 0
      ORDER BY year DESC, round_name DESC
    `, []);

    const topProjects = await query(`
      SELECT 
        project_name,
        round_name,
        total_awarded_usd,
        total_paid_usd,
        category,
        award_type
      FROM gold_scf_submissions_parsed
      WHERE total_awarded_usd > 0
      ORDER BY total_awarded_usd DESC
      LIMIT 10
    `, []);

    res.status(200).json({
      profile: systemProfile[0] || {},
      summary: summary[0],
      rounds,
      topProjects
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
