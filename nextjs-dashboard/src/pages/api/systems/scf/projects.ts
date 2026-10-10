import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

const EXT = 'org.stellar.communityfund.';

// Every SCF project with at least one award, with lifetime totals, for the projects index.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const projects = await query(`
      SELECT
        a."projectId" AS project_id,
        COALESCE(p.name, MAX(a."${EXT}project")) AS project_name,
        COALESCE(p."${EXT}category", MAX(a."${EXT}category")) AS category,
        COUNT(*) AS award_count,
        SUM(a."${EXT}totalAwardedUSD") AS total_awarded_usd,
        SUM(a."${EXT}totalPaidUSD") AS total_paid_usd,
        array_agg(a."grantPoolName") AS rounds
      FROM silver_scf_grant_applications a
      LEFT JOIN silver_scf_projects p ON p.id = a."projectId"
      WHERE a."projectId" IS NOT NULL
        AND COALESCE(a."${EXT}totalAwardedUSD", 0) > 0
      GROUP BY a."projectId", p.name, p."${EXT}category"
      ORDER BY SUM(a."${EXT}totalAwardedUSD") DESC NULLS LAST
    `, []);

    const roundNum = (name: string) => Number((name || '').match(/#\s*(\d+)/)?.[1] ?? 0);
    for (const p of projects) {
      p.rounds = (p.rounds || []).sort((a: string, b: string) => roundNum(a) - roundNum(b));
    }

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ projects, count: projects.length });
  } catch (error: any) {
    const pgCode = error?.code;
    console.error(`SCF projects query failed [code=${pgCode ?? 'n/a'}]:`, error?.message ?? error);
    if (pgCode === '42703' || pgCode === '42P01') {
      return res.status(503).json({
        message: 'Schema mismatch — API column names are out of sync with the database. Check recent silver-table migrations.',
        code: pgCode,
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
}
