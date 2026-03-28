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
    const summaryResult = await query(`
      SELECT
        COUNT(DISTINCT "io.ens.proposalId") as total_rounds,
        COUNT(*) as total_applicants,
        COUNT(DISTINCT name) as unique_project_names,
        SUM(CAST("io.ens.score" AS numeric)) as total_voting_power,
        AVG(CAST("io.ens.score" AS numeric)) as avg_score_per_applicant
      FROM silver_ens_projects
      WHERE "io.ens.score" IS NOT NULL
    `, []);

    const voteStats = await query(`
      SELECT
        SUM(CAST("io.ens.totalVotes" AS numeric)) as total_votes,
        SUM(CAST("io.ens.scoringTotal" AS numeric)) as total_scoring_power
      FROM silver_ens_grant_pools
    `, []);

    const summary = {
      total_rounds: Number(summaryResult[0]?.total_rounds) || 0,
      total_applicants: Number(summaryResult[0]?.total_applicants) || 0,
      unique_project_names: Number(summaryResult[0]?.unique_project_names) || 0,
      total_voting_power: Number(summaryResult[0]?.total_voting_power) || 0,
      avg_score_per_applicant: Number(summaryResult[0]?.avg_score_per_applicant) || 0,
      total_votes: Number(voteStats[0]?.total_votes) || 0,
      total_scoring_power: Number(voteStats[0]?.total_scoring_power) || 0,
    };

    const rounds = await query(`
      SELECT
        id as round_id,
        name as round_name,
        "closeDate" as close_date,
        "isOpen" as is_open,
        "io.ens.startTs" as start_ts,
        "io.ens.endTs" as end_ts,
        CAST("io.ens.totalVotes" AS numeric) as total_votes,
        CAST("io.ens.scoringTotal" AS numeric) as scoring_total,
        CAST("io.ens.totalChoices" AS numeric) as total_choices,
        "io.ens.author" as author,
        "io.ens.voteType" as vote_type
      FROM silver_ens_grant_pools
      ORDER BY "io.ens.endTs" DESC NULLS LAST
    `, []);

    const roundTypeBreakdown = await query(`
      SELECT
        "io.ens.roundType" as round_type,
        COUNT(DISTINCT "io.ens.proposalId") as round_count,
        COUNT(*) as total_applicants,
        SUM(CAST("io.ens.score" AS numeric)) as total_voting_power
      FROM silver_ens_projects
      WHERE "io.ens.roundType" IS NOT NULL
      GROUP BY "io.ens.roundType"
      ORDER BY round_count DESC
    `, []);

    const topProjects = await query(`
      SELECT
        name as project_name,
        SUM(CAST("io.ens.score" AS numeric)) as total_voting_power,
        COUNT(DISTINCT "io.ens.proposalId") as rounds_participated,
        MAX("io.ens.proposalTitle") as latest_round,
        MAX("io.ens.roundType") as round_type
      FROM silver_ens_projects
      WHERE "io.ens.score" IS NOT NULL
        AND name IS NOT NULL
        AND CAST("io.ens.score" AS numeric) > 0
      GROUP BY name
      ORDER BY total_voting_power DESC
      LIMIT 20
    `, []);

    const roundsParticipation = await query(`
      SELECT
        CAST("io.ens.roundNumber" AS numeric) as round_number,
        "io.ens.roundType" as round_type,
        COUNT(*) as applicant_count
      FROM silver_ens_projects
      WHERE "io.ens.roundNumber" IS NOT NULL
      GROUP BY "io.ens.roundNumber", "io.ens.roundType"
      ORDER BY "io.ens.roundNumber" ASC
    `, []);

    res.status(200).json({
      summary,
      rounds,
      roundTypeBreakdown,
      topProjects,
      roundsParticipation,
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
