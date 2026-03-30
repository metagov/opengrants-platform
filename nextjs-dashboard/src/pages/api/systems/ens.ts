import type { NextApiRequest, NextApiResponse } from 'next';
import { safeQuery } from '../../../lib/safeQuery';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const [
      summaryResult,
      voteStats,
      rounds,
      roundTypeBreakdown,
      topProjects,
      roundsParticipation,
      voterRetention,
      voterParticipation,
    ] = await Promise.all([
      safeQuery(`
        SELECT
          COUNT(DISTINCT "io.ens.proposalId") as total_rounds,
          COUNT(*) as total_applicants,
          COUNT(DISTINCT name) as unique_project_names,
          AVG(CAST("io.ens.score" AS numeric)) as avg_score_per_applicant
        FROM silver_ens_projects
        WHERE "io.ens.score" IS NOT NULL
      `, []),

      safeQuery(`
        SELECT
          SUM(CAST("io.ens.totalVotes" AS numeric)) as total_votes
        FROM silver_ens_grant_pools
      `, []),

      // Add vote_system flag: rounds 10-11 switched to equal-weight (avg VP ≈ 100)
      safeQuery(`
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
          "io.ens.voteType" as vote_type,
          CASE
            WHEN CAST("io.ens.scoringTotal" AS numeric) /
                 NULLIF(CAST("io.ens.totalVotes" AS numeric), 0) > 100
            THEN 'Token Weighted'
            ELSE 'Equal Weight'
          END as vote_system
        FROM silver_ens_grant_pools
        ORDER BY "io.ens.endTs" DESC NULLS LAST
      `, []),

      // Fix: merge "Public Goods Scholarships" → "Public Goods" so pie has 2 slices not 3
      safeQuery(`
        SELECT
          CASE
            WHEN "io.ens.roundType" LIKE 'Public Goods%' THEN 'Public Goods'
            ELSE COALESCE("io.ens.roundType", 'Unknown')
          END as round_type,
          COUNT(DISTINCT "io.ens.proposalId") as round_count,
          COUNT(*) as total_applicants,
          -- Only sum VP for token-weighted rounds (avg VP > 100 means token-weighted)
          SUM(
            CASE
              WHEN CAST("io.ens.scoringTotal" AS numeric) /
                   NULLIF(CAST("io.ens.score" AS numeric) + 1, 0) > 100
              THEN CAST("io.ens.score" AS numeric)
              ELSE 0
            END
          ) as token_weighted_vp
        FROM silver_ens_projects
        WHERE "io.ens.roundType" IS NOT NULL
        GROUP BY 1
        ORDER BY round_count DESC
      `, []),

      safeQuery(`
        SELECT
          name as project_name,
          SUM(CAST("io.ens.score" AS numeric)) as total_voting_power,
          COUNT(DISTINCT "io.ens.proposalId") as rounds_participated,
          ROUND(
            AVG(
              CAST("io.ens.score" AS numeric) /
              NULLIF(CAST("io.ens.scoringTotal" AS numeric), 0) * 100
            )::numeric,
            1
          ) as avg_vote_share_pct,
          MAX("io.ens.proposalTitle") as latest_round,
          -- Normalise round_type: merge Scholarships → Public Goods
          CASE
            WHEN MAX("io.ens.roundType") LIKE 'Public Goods%' THEN 'Public Goods'
            ELSE MAX("io.ens.roundType")
          END as round_type
        FROM silver_ens_projects
        WHERE "io.ens.score" IS NOT NULL
          AND name IS NOT NULL
          AND CAST("io.ens.score" AS numeric) > 0
          AND CAST("io.ens.scoringTotal" AS numeric) > 0
        GROUP BY name
        ORDER BY total_voting_power DESC
        LIMIT 20
      `, []),

      safeQuery(`
        SELECT
          CAST("io.ens.roundNumber" AS numeric) as round_number,
          CASE
            WHEN "io.ens.roundType" LIKE 'Public Goods%' THEN 'Public Goods'
            ELSE COALESCE("io.ens.roundType", 'Unknown')
          END as round_type,
          COUNT(*) as applicant_count
        FROM silver_ens_projects
        WHERE "io.ens.roundNumber" IS NOT NULL
        GROUP BY "io.ens.roundNumber", "io.ens.roundType"
        ORDER BY "io.ens.roundNumber" ASC
      `, []),

      // Voter retention — from bronze_ens_votes (untapped data)
      safeQuery(`
        SELECT
          COUNT(DISTINCT voter) as total_unique_voters,
          COUNT(DISTINCT voter) FILTER (WHERE round_count >= 2) as repeat_voters,
          ROUND(
            COUNT(DISTINCT voter) FILTER (WHERE round_count >= 2)::numeric /
            NULLIF(COUNT(DISTINCT voter), 0) * 100,
            1
          ) as repeat_voter_pct,
          ROUND(AVG(round_count)::numeric, 1) as avg_rounds_per_voter
        FROM (
          SELECT voter, COUNT(DISTINCT proposal_id) as round_count
          FROM bronze_ens_votes
          GROUP BY voter
        ) voter_rounds
      `, []),

      // Voters per round (for trend chart) — joins bronze tables
      safeQuery(`
        SELECT
          bep.title as round_name,
          bep.end_ts,
          COUNT(DISTINCT bev.voter) as unique_voters,
          ROUND(AVG(bev.vp)::numeric, 0) as avg_vp_per_voter,
          ROUND(MAX(bev.vp)::numeric, 0) as max_vp
        FROM bronze_ens_votes bev
        JOIN bronze_ens_proposals bep ON bev.proposal_id = bep.id
        GROUP BY bep.id, bep.title, bep.end_ts
        ORDER BY bep.end_ts ASC
      `, []),
    ]);

    const vr = voterRetention[0] || {};

    const summary = {
      total_rounds:           Number(summaryResult[0]?.total_rounds) || 0,
      total_applicants:       Number(summaryResult[0]?.total_applicants) || 0,
      unique_project_names:   Number(summaryResult[0]?.unique_project_names) || 0,
      avg_score_per_applicant: Number(summaryResult[0]?.avg_score_per_applicant) || 0,
      total_votes:            Number(voteStats[0]?.total_votes) || 0,
      unique_voters:          Number(vr.total_unique_voters) || 0,
      repeat_voters:          Number(vr.repeat_voters) || 0,
      repeat_voter_pct:       Number(vr.repeat_voter_pct) || 0,
      avg_rounds_per_voter:   Number(vr.avg_rounds_per_voter) || 0,
    };

    res.status(200).json({
      summary,
      rounds,
      roundTypeBreakdown,
      topProjects,
      roundsParticipation,
      voterParticipation,
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
