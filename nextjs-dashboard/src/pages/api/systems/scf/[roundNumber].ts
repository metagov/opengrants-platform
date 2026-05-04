import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { roundNumber } = req.query;
  const roundName = `SCF #${roundNumber}`;

  try {
    // Get round details
    const roundData = await query(`
      SELECT 
        id as round_id,
        name as round_name,
        description,
        "org.stellar.communityfund.quarterYear" as quarter_year,
        "org.stellar.communityfund.phase" as phase,
        "org.stellar.communityfund.type" as round_type,
        "org.stellar.communityfund.awardedSubmissions" as awarded_submissions,
        "org.stellar.communityfund.appliedSubmissions" as applied_submissions,
        "org.stellar.communityfund.totalAwardedUSD" as total_awarded_usd,
        "org.stellar.communityfund.totalPaidUSD" as total_paid_usd,
        "org.stellar.communityfund.averageAwardedUSD" as avg_awarded_usd,
        "org.stellar.communityfund.votersNumber" as voters_count,
        "org.stellar.communityfund.year" as year,
        "org.stellar.communityfund.roundURL" as round_url,
        "org.stellar.communityfund.roundRecap" as round_recap
      FROM silver_scf_grant_pools
      WHERE name = $1 OR TRIM(name) = $1
      LIMIT 1
    `, [roundName]);

    if (!roundData || roundData.length === 0) {
      return res.status(404).json({ message: 'Round not found' });
    }

    // Get all projects in this round
    const projects = await query(`
      SELECT 
        id as project_id,
        name as project_name,
        description,
        "org.stellar.communityfund.category" as category,
        "org.stellar.communityfund.totalAwardedUSD" as total_awarded_usd,
        "org.stellar.communityfund.totalPaidUSD" as total_paid_usd,
        "org.stellar.communityfund.trancheCompletionPercent" as tranche_completion,
        "org.stellar.communityfund.trancheCompletion" as tranche_status,
        "org.stellar.communityfund.awardType" as award_type,
        "org.stellar.communityfund.website" as website,
        "org.stellar.communityfund.oneSentenceDescription" as one_sentence_description
      FROM silver_scf_grant_applications
      WHERE "org.stellar.communityfund.round" = $1 OR TRIM("org.stellar.communityfund.round") = $1
      ORDER BY "org.stellar.communityfund.totalPaidUSD" DESC NULLS LAST, "org.stellar.communityfund.totalAwardedUSD" DESC NULLS LAST
    `, [roundName]);

    // Platform metadata
    const metadata = await query(`
      SELECT platform, last_indexed_at, data_source
      FROM platform_metadata
      WHERE platform = 'scf'
    `, []);

    res.status(200).json({
      metadata: metadata[0] || null,
      round: roundData[0],
      projects: projects || [],
      projectCount: projects?.length || 0
    });
  } catch (error: any) {
    const pgCode = error?.code;
    console.error(`SCF round ${roundNumber} query failed [code=${pgCode ?? "n/a"}]:`, error?.message ?? error);
    if (pgCode === '42703' || pgCode === '42P01') {
      return res.status(503).json({
        message: 'Schema mismatch — API column names are out of sync with the database. Check recent silver-table migrations.',
        code: pgCode,
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
}
