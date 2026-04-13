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
    const section = (req.query.section as string) || 'overview';

    // ── OVERVIEW SECTION ──────────────────────────────────────────────────────
    if (section === 'overview') {
      const [systemProfile, chainMetrics, topProjects, fundingMechanisms, donationMetrics] = await Promise.all([
        safeQuery(`SELECT * FROM gold__gitcoin2_system_profile LIMIT 1`, []),

        safeQuery(`
          SELECT
            chain_id, chain_name, round_count, active_rounds,
            total_matching_pool_usd, project_count, application_count,
            approved_applications, approval_rate_pct, donation_count,
            donation_volume_usd, unique_donors, payout_count, payout_volume_usd,
            total_funding_volume_usd, total_distributed_usd
          FROM gold__gitcoin2_chain_metrics
          ORDER BY total_funding_volume_usd DESC
        `, []),

        safeQuery(`
          SELECT
            project_id as id, project_name,
            COUNT(DISTINCT grant_pool_id) as rounds_participated,
            SUM(donations_count)::integer as total_donations,
            ROUND(SUM(total_donated_usd)::numeric, 2) as total_donated_usd,
            SUM(unique_donors)::integer as total_unique_donors,
            ROUND(MAX(qf_score_estimate)::numeric, 2) as best_qf_score
          FROM gold__gitcoin2_project_qf_scores
          WHERE total_donated_usd >= 50
          GROUP BY project_id, project_name
          ORDER BY SUM(total_donated_usd) DESC
          LIMIT 20
        `, []),

        safeQuery(`
          SELECT
            "grantFundingMechanism" as mechanism,
            COUNT(*) as round_count,
            COALESCE(SUM("co.gitcoin.matchAmountInUsd"::numeric), 0) as total_pool_usd,
            COALESCE(SUM("co.gitcoin.totalAmountDonatedInUsd"::numeric), 0) as total_donated_usd
          FROM silver_gitcoin2_grant_pools
          WHERE "grantFundingMechanism" IS NOT NULL
            AND "co.gitcoin.chainId"::integer IN (1, 10, 42, 137, 324, 1088, 1329, 8453, 42161, 42220, 43114, 534352)
            AND "co.gitcoin.fundedAmountInUsd"::numeric >= 100
            AND "co.gitcoin.totalAmountDonatedInUsd"::numeric > 0
          GROUP BY "grantFundingMechanism"
          ORDER BY total_pool_usd DESC
        `, []),

        safeQuery(`SELECT * FROM gold__gitcoin2_donation_metrics LIMIT 1`, []),
      ]);

      const profile = systemProfile[0] || {};
      const summary = {
        total_grant_pools:             Number(profile.total_grant_pools) || 0,
        active_grant_pools:            Number(profile.active_grant_pools) || 0,
        total_matching_pool_usd:       Number(profile.total_matching_pool_usd) || 0,
        total_donated_via_rounds_usd:  Number(profile.total_donated_via_rounds_usd) || 0,
        total_distributed_usd:         Number(profile.total_distributed_usd) || 0,
        total_projects:                Number(profile.total_projects) || 0,
        total_applications:            Number(profile.total_applications) || 0,
        approved_applications:         Number(profile.approved_applications) || 0,
        rejected_applications:         Number(profile.rejected_applications) || 0,
        pending_applications:          Number(profile.pending_applications) || 0,
        total_donations:               Number(profile.total_donations) || 0,
        total_donated_usd:             Number(profile.total_donated_usd) || 0,
        unique_donors:                 Number(profile.unique_donors) || 0,
        avg_donation_usd:              Number(profile.avg_donation_usd) || 0,
        total_payouts:                 Number(profile.total_payouts) || 0,
        total_paid_out_usd:            Number(profile.total_paid_out_usd) || 0,
        unique_chains:                 Number(profile.unique_chains) || 0,
        qf_rounds:                     Number(profile.qf_rounds) || 0,
        direct_grant_rounds:           Number(profile.direct_grant_rounds) || 0,
      };

      return res.status(200).json({
        summary,
        chainMetrics,
        topProjects,
        fundingMechanisms,
        donationMetrics: donationMetrics[0] || {},
      });
    }

    // ── ANALYTICS SECTION ────────────────────────────────────────────────────
    if (section === 'analytics') {
      const [donationDistribution, donationTrends, applicationStats, roundStatus] = await Promise.all([
        safeQuery(`
          SELECT range, donation_count, total_amount
          FROM gold__gitcoin2_donation_distribution
          ORDER BY sort_order
        `, []),

        safeQuery(`
          SELECT month, donation_count, total_donated, unique_donors
          FROM gold__gitcoin2_donation_trends
          ORDER BY month ASC
        `, []),

        safeQuery(`
          SELECT
            status,
            COUNT(*) as count,
            COALESCE(SUM("fundsApprovedInUSD"::numeric), 0) as total_funds
          FROM silver_gitcoin2_grant_applications
          GROUP BY status
          ORDER BY count DESC
        `, []),

        safeQuery(`
          SELECT
            "isOpen"::boolean as is_open,
            COUNT(*) as count,
            COALESCE(SUM("co.gitcoin.matchAmountInUsd"::numeric), 0) as total_pool_usd
          FROM silver_gitcoin2_grant_pools
          WHERE "co.gitcoin.chainId"::integer IN (1, 10, 42, 137, 324, 1088, 1329, 8453, 42161, 42220, 43114, 534352)
            AND "co.gitcoin.fundedAmountInUsd"::numeric >= 100
            AND "co.gitcoin.totalAmountDonatedInUsd"::numeric > 0
          GROUP BY "isOpen"::boolean
        `, []),
      ]);

      return res.status(200).json({ donationDistribution, donationTrends, applicationStats, roundStatus });
    }

    // ── QF SECTION ───────────────────────────────────────────────────────────
    if (section === 'qf') {
      const [qfRoundAnalysis, qfSummary, donorSegments, attestationImpact, donorRetention, tokenFlows, topQfProjects] = await Promise.all([
        safeQuery(`
          SELECT
            round_id, round_name, chain_id, strategy_name,
            match_pool_usd, community_donated_usd, unique_donors,
            donations_count, total_distributed_usd,
            qf_amplification_ratio, avg_donors_per_project,
            top_10_donor_concentration_pct, top_donor_concentration_pct,
            avg_donation_usd, median_donation_usd,
            projects_receiving_donations, projects_paid_out, round_duration_days
          FROM gold__gitcoin2_qf_round_analysis
          WHERE qf_amplification_ratio IS NOT NULL
            AND community_donated_usd > 0
          ORDER BY qf_amplification_ratio DESC
          LIMIT 30
        `, []),

        safeQuery(`
          SELECT
            COUNT(*) as rounds_with_donations,
            ROUND(AVG(qf_amplification_ratio)::numeric, 2) as avg_amplification_ratio,
            ROUND(MAX(qf_amplification_ratio)::numeric, 2) as max_amplification_ratio,
            ROUND(AVG(avg_donors_per_project)::numeric, 2) as avg_donors_per_project,
            ROUND(AVG(top_10_donor_concentration_pct)::numeric, 2) as avg_top10_concentration,
            COUNT(*) FILTER (WHERE avg_donors_per_project >= 10) as rounds_with_broad_participation
          FROM gold__gitcoin2_qf_round_analysis
          WHERE community_donated_usd > 0
        `, []),

        safeQuery(`
          SELECT
            segment, donor_count, pct_of_total_donors,
            avg_rounds_donated_to, avg_chains_donated_on,
            avg_total_donated_usd, avg_projects_supported,
            total_donated_usd_segment, pct_of_total_volume
          FROM gold__gitcoin2_donor_segments
          ORDER BY donor_count DESC
        `, []),

        safeQuery(`
          SELECT
            has_passport_attestation, donor_count, pct_of_total_donors,
            avg_donations_count, avg_rounds_donated_to, avg_projects_supported,
            avg_chains_donated_on, avg_total_donated_usd, avg_single_donation_usd,
            total_donated_usd_segment, pct_of_total_volume
          FROM gold__gitcoin2_attestation_impact
          ORDER BY has_passport_attestation DESC
        `, []),

        safeQuery(`
          SELECT
            cohort_year, cohort_size, retained_year_1, ever_returned,
            year_1_retention_pct, ever_returned_pct,
            cohort_avg_donated_usd, cohort_total_donated_usd,
            cohort_avg_rounds_donated, returning_donor_avg_donated_usd,
            one_time_donor_avg_donated_usd
          FROM gold__gitcoin2_donor_retention
          ORDER BY cohort_year ASC
        `, []),

        safeQuery(`
          SELECT
            chain_id, chain_name, token_address, token_symbol,
            donation_count, total_donated_usd, unique_donors,
            rounds_using_token, pct_of_chain_volume
          FROM gold__gitcoin2_token_flows
          ORDER BY total_donated_usd DESC
          LIMIT 20
        `, []),

        safeQuery(`
          SELECT
            project_id, project_name, grant_pool_id, round_name, chain_id,
            unique_donors, donations_count, total_donated_usd,
            qf_score_estimate, qf_rank_in_round,
            donor_breadth_rank_in_round, qf_advantage_over_volume_rank
          FROM gold__gitcoin2_project_qf_scores
          WHERE qf_score_estimate > 0
          ORDER BY qf_score_estimate DESC
          LIMIT 20
        `, []),
      ]);

      return res.status(200).json({
        qfRoundAnalysis,
        qfSummary: qfSummary[0] || {},
        donorSegments,
        attestationImpact,
        donorRetention,
        tokenFlows,
        topQfProjects,
      });
    }

    // ── ROUNDS SECTION ───────────────────────────────────────────────────────
    if (section === 'rounds') {
      const topRounds = await safeQuery(`
        SELECT
          round_id, round_name, funding_mechanism, is_active, chain_id,
          strategy_name, matching_pool_usd, total_donations_count,
          unique_donors_count, total_amount_donated_usd, match_amount_usd,
          total_distributed_usd, total_applications, approved_applications,
          approval_rate_pct, verified_donations_count, verified_donations_usd,
          payouts_count, payouts_total_usd,
          applications_start, applications_end, donations_start, donations_end
        FROM gold__gitcoin2_round_metrics
        ORDER BY matching_pool_usd DESC NULLS LAST
        LIMIT 100
      `, []);

      return res.status(200).json({ topRounds });
    }

    // ── HISTORY SECTION ──────────────────────────────────────────────────────
    if (section === 'history') {
      const [roundsByYear] = await Promise.all([
        safeQuery(`
          SELECT
            r.year,
            r.round_count,
            r.total_matching_usd,
            r.total_donated_usd,
            COALESCE(d.unique_donors, 0) as total_donors
          FROM (
            SELECT
              EXTRACT(YEAR FROM "co.gitcoin.donationsStartTime"::timestamp)::integer as year,
              COUNT(*) as round_count,
              COALESCE(SUM("co.gitcoin.matchAmountInUsd"::numeric), 0) as total_matching_usd,
              COALESCE(SUM("co.gitcoin.totalAmountDonatedInUsd"::numeric), 0) as total_donated_usd
            FROM silver_gitcoin2_grant_pools
            WHERE "co.gitcoin.donationsStartTime" IS NOT NULL
              AND "co.gitcoin.donationsStartTime" != 'None'
              AND "co.gitcoin.chainId"::integer IN (1, 10, 42, 137, 324, 1088, 1329, 8453, 42161, 42220, 43114, 534352)
              AND "co.gitcoin.fundedAmountInUsd"::numeric >= 100
              AND "co.gitcoin.totalAmountDonatedInUsd"::numeric > 0
            GROUP BY EXTRACT(YEAR FROM "co.gitcoin.donationsStartTime"::timestamp)
          ) r
          LEFT JOIN (
            SELECT
              EXTRACT(YEAR FROM "timestamp"::timestamp)::integer as year,
              COUNT(DISTINCT "donorAddress") as unique_donors
            FROM silver_gitcoin2_donations
            WHERE "amountInUsd" <= 50000
              AND "timestamp" IS NOT NULL
            GROUP BY EXTRACT(YEAR FROM "timestamp"::timestamp)
          ) d ON r.year = d.year
          ORDER BY r.year ASC
        `, []),
      ]);

      return res.status(200).json({ roundsByYear });
    }

    return res.status(400).json({ message: 'Unknown section' });

  } catch (error) {
    console.error('Gitcoin2 API error:', error);
    res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
}
