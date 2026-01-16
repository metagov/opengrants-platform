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
        "io.scf.category" as category,
        "io.scf.totalAwardedUSD" as total_awarded_usd,
        "io.scf.totalPaidUSD" as total_paid_usd,
        "io.scf.trancheCompletionPercent" as tranche_completion,
        "io.scf.trancheCompletion" as tranche_status,
        "io.scf.awardType" as award_type,
        "io.scf.website" as website,
        "io.scf.oneSentenceDescription" as one_sentence_description
      FROM silver_scf_grant_applications
      WHERE "io.scf.round" = $1 OR TRIM("io.scf.round") = $1
      ORDER BY "io.scf.totalPaidUSD" DESC NULLS LAST, "io.scf.totalAwardedUSD" DESC NULLS LAST
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
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
