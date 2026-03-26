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
    // System profile from gold metrics table
    const systemProfile = await query(`
      SELECT * FROM gold__gitcoin2_system_profile
      LIMIT 1
    `, []);

    // Chain metrics from gold table
    const chainMetrics = await query(`
      SELECT
        chain_id,
        chain_name,
        round_count,
        active_rounds,
        total_matching_pool_usd,
        project_count,
        application_count,
        approved_applications,
        approval_rate_pct,
        donation_count,
        donation_volume_usd,
        unique_donors,
        payout_count,
        payout_volume_usd,
        total_funding_volume_usd,
        total_distributed_usd
      FROM gold__gitcoin2_chain_metrics
      ORDER BY total_funding_volume_usd DESC
    `, []);

    // Donation metrics from gold table
    const donationMetrics = await query(`
      SELECT * FROM gold__gitcoin2_donation_metrics
      LIMIT 1
    `, []);

    // Top rounds by matching pool size
    const topRounds = await query(`
      SELECT
        round_id,
        round_name,
        funding_mechanism,
        is_active,
        chain_id,
        strategy_name,
        matching_pool_usd,
        total_donations_count,
        unique_donors_count,
        total_amount_donated_usd,
        match_amount_usd,
        total_distributed_usd,
        total_applications,
        approved_applications,
        approval_rate_pct,
        verified_donations_count,
        verified_donations_usd,
        payouts_count,
        payouts_total_usd,
        applications_start,
        applications_end,
        donations_start,
        donations_end
      FROM gold__gitcoin2_round_metrics
      ORDER BY matching_pool_usd DESC NULLS LAST
      LIMIT 100
    `, []);

    // Funding mechanism distribution
    const fundingMechanisms = await query(`
      SELECT
        "grantFundingMechanism" as mechanism,
        COUNT(*) as round_count,
        COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) as total_pool_usd,
        COALESCE(SUM("io.gitcoin2.totalAmountDonatedInUsd"::numeric), 0) as total_donated_usd
      FROM silver_gitcoin2_grant_pools
      WHERE "grantFundingMechanism" IS NOT NULL
      GROUP BY "grantFundingMechanism"
      ORDER BY total_pool_usd DESC
    `, []);

    // Top projects by total donations received
    const topProjects = await query(`
      SELECT
        p.id,
        p.name as project_name,
        p."io.gitcoin2.chainId" as chain_id,
        COUNT(DISTINCT a.id) as application_count,
        COUNT(DISTINCT a."grantPoolId") as rounds_participated,
        COALESCE(SUM(a."fundsApprovedInUSD"::numeric), 0) as total_funds_approved
      FROM silver_gitcoin2_projects p
      LEFT JOIN silver_gitcoin2_grant_applications a ON p.id = a."projectId"
      GROUP BY p.id, p.name, p."io.gitcoin2.chainId"
      ORDER BY total_funds_approved DESC
      LIMIT 20
    `, []);

    // Donation size distribution
    const donationDistribution = await query(`
      SELECT
        CASE
          WHEN "amountInUsd"::numeric < 1    THEN 'Under $1'
          WHEN "amountInUsd"::numeric < 10   THEN '$1-$10'
          WHEN "amountInUsd"::numeric < 50   THEN '$10-$50'
          WHEN "amountInUsd"::numeric < 100  THEN '$50-$100'
          WHEN "amountInUsd"::numeric < 500  THEN '$100-$500'
          WHEN "amountInUsd"::numeric < 1000 THEN '$500-$1K'
          ELSE '$1K+'
        END as range,
        COUNT(*) as donation_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_amount
      FROM silver_gitcoin2_donations
      WHERE "amountInUsd" IS NOT NULL
      GROUP BY 1
      ORDER BY
        CASE
          WHEN "amountInUsd"::numeric < 1    THEN 1
          WHEN "amountInUsd"::numeric < 10   THEN 2
          WHEN "amountInUsd"::numeric < 50   THEN 3
          WHEN "amountInUsd"::numeric < 100  THEN 4
          WHEN "amountInUsd"::numeric < 500  THEN 5
          WHEN "amountInUsd"::numeric < 1000 THEN 6
          ELSE 7
        END
    `, []);

    // Monthly donation trends (all historical data)
    const donationTrends = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "timestamp"::timestamp), 'YYYY-MM') as month,
        COUNT(*) as donation_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_donated,
        COUNT(DISTINCT "donorAddress") as unique_donors
      FROM silver_gitcoin2_donations
      WHERE "timestamp" IS NOT NULL
        AND "timestamp" != 'None'
      GROUP BY DATE_TRUNC('month', "timestamp"::timestamp)
      ORDER BY month ASC
    `, []);

    // Application status breakdown
    const applicationStats = await query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM("fundsApprovedInUSD"::numeric), 0) as total_funds
      FROM silver_gitcoin2_grant_applications
      GROUP BY status
      ORDER BY count DESC
    `, []);

    // Active vs closed rounds
    const roundStatus = await query(`
      SELECT
        "isOpen"::boolean as is_open,
        COUNT(*) as count,
        COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) as total_pool_usd
      FROM silver_gitcoin2_grant_pools
      GROUP BY "isOpen"::boolean
    `, []);

    // Year-over-year summary (rounds by year)
    const roundsByYear = await query(`
      SELECT
        EXTRACT(YEAR FROM "io.gitcoin2.donationsStartTime"::timestamp)::integer as year,
        COUNT(*) as round_count,
        COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) as total_matching_usd,
        COALESCE(SUM("io.gitcoin2.totalAmountDonatedInUsd"::numeric), 0) as total_donated_usd,
        COALESCE(SUM("io.gitcoin2.uniqueDonorsCount"::integer), 0) as total_donors
      FROM silver_gitcoin2_grant_pools
      WHERE "io.gitcoin2.donationsStartTime" IS NOT NULL
        AND "io.gitcoin2.donationsStartTime" != 'None'
      GROUP BY EXTRACT(YEAR FROM "io.gitcoin2.donationsStartTime"::timestamp)
      ORDER BY year ASC
    `, []);

    // Build summary from system profile
    const profile = systemProfile[0] || {};
    const summary = {
      total_grant_pools: Number(profile.total_grant_pools) || 0,
      active_grant_pools: Number(profile.active_grant_pools) || 0,
      total_matching_pool_usd: Number(profile.total_matching_pool_usd) || 0,
      total_donated_via_rounds_usd: Number(profile.total_donated_via_rounds_usd) || 0,
      total_distributed_usd: Number(profile.total_distributed_usd) || 0,
      total_projects: Number(profile.total_projects) || 0,
      total_applications: Number(profile.total_applications) || 0,
      approved_applications: Number(profile.approved_applications) || 0,
      rejected_applications: Number(profile.rejected_applications) || 0,
      pending_applications: Number(profile.pending_applications) || 0,
      total_donations: Number(profile.total_donations) || 0,
      total_donated_usd: Number(profile.total_donated_usd) || 0,
      unique_donors: Number(profile.unique_donors) || 0,
      avg_donation_usd: Number(profile.avg_donation_usd) || 0,
      total_payouts: Number(profile.total_payouts) || 0,
      total_paid_out_usd: Number(profile.total_paid_out_usd) || 0,
      unique_chains: Number(profile.unique_chains) || 0,
      qf_rounds: Number(profile.qf_rounds) || 0,
      direct_grant_rounds: Number(profile.direct_grant_rounds) || 0,
    };

    res.status(200).json({
      summary,
      chainMetrics,
      donationMetrics: donationMetrics[0] || {},
      topRounds,
      fundingMechanisms,
      topProjects,
      donationDistribution,
      donationTrends,
      applicationStats,
      roundStatus,
      roundsByYear,
    });
  } catch (error) {
    console.error('Gitcoin2 API error:', error);
    res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
}
