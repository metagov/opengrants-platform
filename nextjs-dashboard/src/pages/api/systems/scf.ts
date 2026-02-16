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
      WHERE platform = 'scf'
    `, []);

    // Summary stats - get accurate totals from silver tables (only count completed rounds with payments)
    const summaryTotals = await query(`
      SELECT 
        SUM("org.stellar.communityfund.totalAwardedUSD") as total_awarded,
        SUM("org.stellar.communityfund.totalPaidUSD") as total_paid,
        COUNT(*) FILTER (WHERE "org.stellar.communityfund.totalPaidUSD" > 0) as total_rounds,
        SUM("org.stellar.communityfund.awardedSubmissions") as total_projects_funded
      FROM silver_scf_grant_pools
    `, []);
    
    const summary = {
      total_rounds: Number(summaryTotals[0]?.total_rounds) || 0,
      total_awarded: Number(summaryTotals[0]?.total_awarded) || 0,
      total_paid: Number(summaryTotals[0]?.total_paid) || 0,
      total_projects_funded: Number(summaryTotals[0]?.total_projects_funded) || 0,
    };

    // Quarterly breakdown - include rounds with payments OR projects
    const quarterlyData = await query(`
      SELECT 
        "org.stellar.communityfund.quarterYear" as quarter_year,
        "org.stellar.communityfund.year" as year,
        SUM("org.stellar.communityfund.awardedSubmissions") as awarded_submissions,
        SUM("org.stellar.communityfund.totalAwardedUSD") as total_awarded_usd,
        SUM("org.stellar.communityfund.totalPaidUSD") as total_paid_usd,
        COUNT(*) as round_count
      FROM silver_scf_grant_pools
      WHERE "org.stellar.communityfund.totalPaidUSD" > 0 
         OR "org.stellar.communityfund.awardedSubmissions" > 0
      GROUP BY "org.stellar.communityfund.quarterYear", "org.stellar.communityfund.year"
      ORDER BY "org.stellar.communityfund.year" DESC, "org.stellar.communityfund.quarterYear" DESC
    `, []);

    // Category distribution from silver_scf_projects
    const categoryData = await query(`
      SELECT 
        "io.scf.category" as category,
        COUNT(*) as project_count,
        SUM("io.scf.totalAwardedUSD") as total_awarded_usd,
        SUM("io.scf.totalPaidUSD") as total_paid_usd
      FROM silver_scf_projects
      WHERE "io.scf.category" IS NOT NULL
      GROUP BY "io.scf.category"
      ORDER BY total_awarded_usd DESC
    `, []);

    // All active rounds (with payments OR projects) - no limit for lazy loading
    const roundsBreakdown = await query(`
      SELECT 
        id as round_id,
        name as round_name,
        "org.stellar.communityfund.quarterYear" as quarter_year,
        "org.stellar.communityfund.phase" as phase,
        "org.stellar.communityfund.type" as round_type,
        "org.stellar.communityfund.awardedSubmissions" as awarded_submissions,
        "org.stellar.communityfund.appliedSubmissions" as applied_submissions,
        "org.stellar.communityfund.totalAwardedUSD" as total_awarded_usd,
        "org.stellar.communityfund.totalPaidUSD" as total_paid_usd,
        "org.stellar.communityfund.averageAwardedUSD" as avg_awarded_usd,
        "org.stellar.communityfund.votersNumber" as voters_count,
        "org.stellar.communityfund.year" as year
      FROM silver_scf_grant_pools
      WHERE "org.stellar.communityfund.totalPaidUSD" > 0 
         OR "org.stellar.communityfund.awardedSubmissions" > 0
      ORDER BY "org.stellar.communityfund.year" DESC, 
               CAST(REGEXP_REPLACE(name, '[^0-9]', '', 'g') AS INTEGER) DESC
    `, []);

    // Tranche/milestone metrics from silver_scf_grant_applications
    const trancheMetrics = await query(`
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN "io.scf.trancheCompletionPercent" = 100 THEN 1 END) as completed_tranches,
        COUNT(CASE WHEN "io.scf.trancheCompletionPercent" > 0 AND "io.scf.trancheCompletionPercent" < 100 THEN 1 END) as in_progress_tranches,
        COUNT(CASE WHEN "io.scf.trancheCompletionPercent" = 0 OR "io.scf.trancheCompletionPercent" IS NULL THEN 1 END) as not_started_tranches,
        AVG("io.scf.trancheCompletionPercent") as avg_completion_percent,
        SUM("io.scf.totalAwardedUSD") as total_awarded_usd,
        SUM("io.scf.totalPaidUSD") as total_paid_usd
      FROM silver_scf_grant_applications
      WHERE "io.scf.totalPaidUSD" > 0 OR "io.scf.totalAwardedUSD" > 0
    `, []);

    // Tranche completion by status
    const trancheByStatus = await query(`
      SELECT 
        "io.scf.trancheCompletion" as tranche_status,
        COUNT(*) as count,
        SUM("io.scf.totalAwardedUSD") as total_awarded_usd,
        SUM("io.scf.totalPaidUSD") as total_paid_usd
      FROM silver_scf_grant_applications
      WHERE "io.scf.trancheCompletion" IS NOT NULL AND "io.scf.trancheCompletion" != ''
      GROUP BY "io.scf.trancheCompletion"
      ORDER BY count DESC
    `, []);

    // Top projects by paid amount
    const topProjects = await query(`
      SELECT
        name as project_name,
        "io.scf.round" as round_name,
        "io.scf.totalAwardedUSD" as total_awarded_usd,
        "io.scf.totalPaidUSD" as total_paid_usd,
        "io.scf.category" as category,
        "io.scf.awardType" as award_type,
        "io.scf.trancheCompletionPercent" as tranche_completion,
        "io.scf.mostRecentPaymentDate" as most_recent_payment_date
      FROM silver_scf_grant_applications
      WHERE "io.scf.totalPaidUSD" > 0 OR "io.scf.totalAwardedUSD" > 0
      ORDER BY "io.scf.totalPaidUSD" DESC
      LIMIT 10
    `, []);

    // Milestone projects with dates for milestones tab
    const milestoneProjects = await query(`
      SELECT
        name as project_name,
        "io.scf.round" as round_name,
        "io.scf.totalAwardedUSD" as total_awarded_usd,
        "io.scf.totalPaidUSD" as total_paid_usd,
        "io.scf.trancheCompletion" as tranche_status,
        "io.scf.trancheCompletionPercent" as tranche_completion_percent,
        "io.scf.mostRecentPaymentDate" as most_recent_payment_date
      FROM silver_scf_grant_applications
      WHERE ("io.scf.totalPaidUSD" > 0 OR "io.scf.totalAwardedUSD" > 0)
        AND "io.scf.trancheCompletion" IS NOT NULL AND "io.scf.trancheCompletion" != ''
      ORDER BY "io.scf.mostRecentPaymentDate" DESC NULLS LAST, "io.scf.totalPaidUSD" DESC
      LIMIT 20
    `, []);

    // Funding efficiency by round (awarded vs paid with payment rate)
    const fundingEfficiency = await query(`
      SELECT 
        name as round_name,
        CAST(REGEXP_REPLACE(name, '[^0-9]', '', 'g') AS INTEGER) as round_num,
        CAST("org.stellar.communityfund.totalAwardedUSD" AS numeric) as awarded,
        CAST("org.stellar.communityfund.totalPaidUSD" AS numeric) as paid,
        CAST("org.stellar.communityfund.votersNumber" AS numeric) as voters,
        CAST("org.stellar.communityfund.awardedSubmissions" AS numeric) as projects_funded,
        CAST("org.stellar.communityfund.averageAwardedUSD" AS numeric) as avg_grant_size
      FROM silver_scf_grant_pools
      WHERE "org.stellar.communityfund.totalPaidUSD" > 0
      ORDER BY CAST(REGEXP_REPLACE(name, '[^0-9]', '', 'g') AS INTEGER)
    `, []);

    // Category performance with completion rates (limit to top 5)
    const categoryPerformance = await query(`
      SELECT 
        "io.scf.category" as category,
        COUNT(*) as total_projects,
        SUM("io.scf.totalAwardedUSD") as total_awarded,
        SUM("io.scf.totalPaidUSD") as total_paid,
        AVG("io.scf.trancheCompletionPercent") as avg_completion,
        COUNT(CASE WHEN "io.scf.trancheCompletionPercent" = 100 THEN 1 END) as fully_completed
      FROM silver_scf_grant_applications
      WHERE "io.scf.category" IS NOT NULL AND "io.scf.totalAwardedUSD" > 0
      GROUP BY "io.scf.category"
      ORDER BY total_awarded DESC
      LIMIT 5
    `, []);

    // Repeat funding statistics - use grant pools total for consistency with summary
    const repeatFundingStats = await query(`
      WITH project_funding_counts AS (
        SELECT 
          "io.scf.project" as project_name,
          COUNT(*) as funding_count
        FROM silver_scf_grant_applications
        WHERE "io.scf.totalPaidUSD" > 0 AND "io.scf.project" IS NOT NULL AND "io.scf.project" != ''
        GROUP BY "io.scf.project"
      )
      SELECT 
        (SELECT SUM("org.stellar.communityfund.awardedSubmissions") FROM silver_scf_grant_pools) as total_funding_instances,
        (SELECT COUNT(*) FROM project_funding_counts) as total_unique_projects,
        (SELECT COUNT(*) FROM project_funding_counts WHERE funding_count = 1) as new_projects,
        (SELECT COUNT(*) FROM project_funding_counts WHERE funding_count > 1) as repeat_funded,
        (SELECT COUNT(*) FROM project_funding_counts WHERE funding_count = 2) as funded_twice,
        (SELECT COUNT(*) FROM project_funding_counts WHERE funding_count = 3) as funded_thrice,
        (SELECT COUNT(*) FROM project_funding_counts WHERE funding_count = 4) as funded_four_times,
        (SELECT COUNT(*) FROM project_funding_counts WHERE funding_count >= 5) as funded_five_plus
    `, []);

    // Cohort analysis: Rounds with repeat-funded projects vs total funded
    const cohortAnalysis = await query(`
      WITH project_funding_counts AS (
        SELECT 
          "io.scf.project" as project_name,
          COUNT(*) as funding_count
        FROM silver_scf_grant_applications
        WHERE "io.scf.totalPaidUSD" > 0 AND "io.scf.project" IS NOT NULL AND "io.scf.project" != ''
        GROUP BY "io.scf.project"
      ),
      repeat_projects AS (
        SELECT project_name FROM project_funding_counts WHERE funding_count > 1
      ),
      round_totals AS (
        SELECT 
          gp."name" as round_name,
          CAST(REGEXP_REPLACE(gp."name", '[^0-9]', '', 'g') AS INTEGER) as round_num,
          COUNT(a.id) as total_funded_in_round
        FROM silver_scf_grant_applications a
        JOIN silver_scf_grant_pools gp ON a."grantPoolId" = gp.id
        WHERE a."io.scf.totalPaidUSD" > 0
        GROUP BY gp."name"
      ),
      repeat_counts AS (
        SELECT 
          gp."name" as round_name,
          COUNT(DISTINCT a."io.scf.project") as repeat_funded_projects
        FROM silver_scf_grant_applications a
        JOIN silver_scf_grant_pools gp ON a."grantPoolId" = gp.id
        WHERE a."io.scf.totalPaidUSD" > 0 
          AND a."io.scf.project" IN (SELECT project_name FROM repeat_projects)
        GROUP BY gp."name"
      )
      SELECT 
        rt.round_name,
        rt.round_num,
        COALESCE(rc.repeat_funded_projects, 0) as repeat_funded_projects,
        rt.total_funded_in_round
      FROM round_totals rt
      LEFT JOIN repeat_counts rc ON rt.round_name = rc.round_name
      ORDER BY rt.round_num
    `, []);

    res.status(200).json({
      metadata: metadata[0] || null,
      summary: summary,
      quarterlyData,
      categoryData,
      rounds: roundsBreakdown,
      trancheMetrics: trancheMetrics[0] || {},
      trancheByStatus,
      topProjects,
      milestoneProjects,
      fundingEfficiency,
      categoryPerformance,
      repeatFundingStats: repeatFundingStats[0] || {},
      cohortAnalysis
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
