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
    // Platform metadata
    const metadata = await query(`
      SELECT platform, last_indexed_at, data_source, notes
      FROM platform_metadata
      WHERE platform = 'grantsstack'
    `, []);

    // System profile from gold metrics
    const systemProfile = await query(`
      SELECT * FROM gold__grantsstack_system_profile
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
        total_funding_volume_usd
      FROM gold__grantsstack_chain_metrics
      ORDER BY total_funding_volume_usd DESC
    `, []);

    // Donation metrics from gold table
    const donationMetrics = await query(`
      SELECT * FROM gold__grantsstack_donation_metrics
      LIMIT 1
    `, []);

    // Payout metrics from gold table
    const payoutMetrics = await query(`
      SELECT * FROM gold__grantsstack_payout_metrics
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
      FROM gold__grantsstack_round_metrics
      ORDER BY matching_pool_usd DESC
      LIMIT 50
    `, []);

    // Funding mechanism distribution
    const fundingMechanisms = await query(`
      SELECT
        "grantFundingMechanism" as mechanism,
        COUNT(*) as round_count,
        COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) as total_pool_usd,
        COALESCE(SUM("io.grantsstack.totalAmountDonatedInUsd"::numeric), 0) as total_donated_usd
      FROM silver_grantsstack_grant_pools
      WHERE "grantFundingMechanism" IS NOT NULL
      GROUP BY "grantFundingMechanism"
      ORDER BY total_pool_usd DESC
    `, []);

    // Top projects by donations received
    const topProjects = await query(`
      SELECT
        p.id,
        p.name as project_name,
        p."io.grantsstack.chainId" as chain_id,
        COUNT(DISTINCT a.id) as application_count,
        COUNT(DISTINCT a."grantPoolId") as rounds_participated,
        COALESCE(SUM(a."totalFundsApproved"::numeric), 0) as total_funds_approved
      FROM silver_grantsstack_projects p
      LEFT JOIN silver_grantsstack_grant_applications a ON p.id = a."projectId"
      GROUP BY p.id, p.name, p."io.grantsstack.chainId"
      ORDER BY total_funds_approved DESC
      LIMIT 20
    `, []);

    // Donation size distribution
    const donationDistribution = await query(`
      SELECT
        CASE
          WHEN "amountInUsd"::numeric < 1 THEN 'Under $1'
          WHEN "amountInUsd"::numeric < 10 THEN '$1-$10'
          WHEN "amountInUsd"::numeric < 50 THEN '$10-$50'
          WHEN "amountInUsd"::numeric < 100 THEN '$50-$100'
          WHEN "amountInUsd"::numeric < 500 THEN '$100-$500'
          WHEN "amountInUsd"::numeric < 1000 THEN '$500-$1K'
          ELSE '$1K+'
        END as range,
        COUNT(*) as donation_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_amount
      FROM silver_grantsstack_donations
      GROUP BY 1
      ORDER BY
        CASE
          WHEN "amountInUsd"::numeric < 1 THEN 1
          WHEN "amountInUsd"::numeric < 10 THEN 2
          WHEN "amountInUsd"::numeric < 50 THEN 3
          WHEN "amountInUsd"::numeric < 100 THEN 4
          WHEN "amountInUsd"::numeric < 500 THEN 5
          WHEN "amountInUsd"::numeric < 1000 THEN 6
          ELSE 7
        END
    `, []);

    // Monthly donation trends (last 12 months)
    const donationTrends = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "io.grantsstack.timestamp"::timestamp), 'YYYY-MM') as month,
        COUNT(*) as donation_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_donated,
        COUNT(DISTINCT "donorAddress") as unique_donors
      FROM silver_grantsstack_donations
      WHERE "io.grantsstack.timestamp" IS NOT NULL
      GROUP BY DATE_TRUNC('month', "io.grantsstack.timestamp"::timestamp)
      ORDER BY month DESC
      LIMIT 24
    `, []);

    // Application status breakdown
    const applicationStats = await query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM("totalFundsApproved"::numeric), 0) as total_funds
      FROM silver_grantsstack_grant_applications
      GROUP BY status
      ORDER BY count DESC
    `, []);

    // Active vs closed rounds
    const roundStatus = await query(`
      SELECT
        "isOpen"::boolean as is_open,
        COUNT(*) as count,
        COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) as total_pool_usd
      FROM silver_grantsstack_grant_pools
      GROUP BY "isOpen"::boolean
    `, []);

    // Build summary from system profile
    const profile = systemProfile[0] || {};
    const summary = {
      total_grant_pools: Number(profile.total_grant_pools) || 0,
      active_grant_pools: Number(profile.active_grant_pools) || 0,
      total_matching_pool_usd: Number(profile.total_matching_pool_usd) || 0,
      total_projects: Number(profile.total_projects) || 0,
      total_applications: Number(profile.total_applications) || 0,
      approved_applications: Number(profile.approved_applications) || 0,
      total_donations: Number(profile.total_donations) || 0,
      total_donated_usd: Number(profile.total_donated_usd) || 0,
      unique_donors: Number(profile.unique_donors) || 0,
      total_payouts: Number(profile.total_payouts) || 0,
      total_paid_out_usd: Number(profile.total_paid_out_usd) || 0,
      unique_chains: Number(profile.unique_chains) || 0,
      qf_rounds: Number(profile.qf_rounds) || 0,
      direct_grant_rounds: Number(profile.direct_grant_rounds) || 0,
    };

    res.status(200).json({
      metadata: metadata[0] || { platform: 'grantsstack', last_indexed_at: null },
      summary,
      chainMetrics,
      donationMetrics: donationMetrics[0] || {},
      payoutMetrics: payoutMetrics[0] || {},
      topRounds,
      fundingMechanisms,
      topProjects,
      donationDistribution,
      donationTrends: donationTrends.reverse(),
      applicationStats,
      roundStatus,
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
