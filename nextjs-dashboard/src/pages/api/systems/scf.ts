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
    // Platform metadata
    const metadata = await safeQuery(`
      SELECT platform, last_indexed_at, data_source, notes
      FROM platform_metadata
      WHERE platform = 'scf'
    `, []);

    // Summary stats - get accurate totals from silver tables (only count completed rounds with payments)
    const summaryTotals = await safeQuery(`
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
    const quarterlyData = await safeQuery(`
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
    const categoryData = await safeQuery(`
      SELECT 
        "org.stellar.communityfund.category" as category,
        COUNT(*) as project_count,
        SUM("org.stellar.communityfund.totalAwardedUSD") as total_awarded_usd,
        SUM("org.stellar.communityfund.totalPaidUSD") as total_paid_usd
      FROM silver_scf_projects
      WHERE "org.stellar.communityfund.category" IS NOT NULL
      GROUP BY "org.stellar.communityfund.category"
      ORDER BY total_awarded_usd DESC
    `, []);

    // All active rounds (with payments OR projects) - no limit for lazy loading
    const roundsBreakdown = await safeQuery(`
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
    const trancheMetrics = await safeQuery(`
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN "org.stellar.communityfund.trancheCompletionPercent" = 100 THEN 1 END) as completed_tranches,
        COUNT(CASE WHEN "org.stellar.communityfund.trancheCompletionPercent" > 0 AND "org.stellar.communityfund.trancheCompletionPercent" < 100 THEN 1 END) as in_progress_tranches,
        COUNT(CASE WHEN "org.stellar.communityfund.trancheCompletionPercent" = 0 OR "org.stellar.communityfund.trancheCompletionPercent" IS NULL THEN 1 END) as not_started_tranches,
        AVG("org.stellar.communityfund.trancheCompletionPercent") as avg_completion_percent,
        SUM("org.stellar.communityfund.totalAwardedUSD") as total_awarded_usd,
        SUM("org.stellar.communityfund.totalPaidUSD") as total_paid_usd
      FROM silver_scf_grant_applications
      WHERE "org.stellar.communityfund.totalPaidUSD" > 0 OR "org.stellar.communityfund.totalAwardedUSD" > 0
    `, []);

    // Tranche completion by status
    const trancheByStatus = await safeQuery(`
      SELECT 
        "org.stellar.communityfund.trancheCompletion" as tranche_status,
        COUNT(*) as count,
        SUM("org.stellar.communityfund.totalAwardedUSD") as total_awarded_usd,
        SUM("org.stellar.communityfund.totalPaidUSD") as total_paid_usd
      FROM silver_scf_grant_applications
      WHERE "org.stellar.communityfund.trancheCompletion" IS NOT NULL AND "org.stellar.communityfund.trancheCompletion" != ''
      GROUP BY "org.stellar.communityfund.trancheCompletion"
      ORDER BY count DESC
    `, []);

    // Top projects by paid amount
    const topProjects = await safeQuery(`
      SELECT
        name as project_name,
        "org.stellar.communityfund.round" as round_name,
        "org.stellar.communityfund.totalAwardedUSD" as total_awarded_usd,
        "org.stellar.communityfund.totalPaidUSD" as total_paid_usd,
        "org.stellar.communityfund.category" as category,
        "org.stellar.communityfund.awardType" as award_type,
        "org.stellar.communityfund.trancheCompletionPercent" as tranche_completion,
        "org.stellar.communityfund.mostRecentPaymentDate" as most_recent_payment_date
      FROM silver_scf_grant_applications
      WHERE "org.stellar.communityfund.totalPaidUSD" > 0 OR "org.stellar.communityfund.totalAwardedUSD" > 0
      ORDER BY "org.stellar.communityfund.totalPaidUSD" DESC
      LIMIT 10
    `, []);

    // Milestone projects with dates for milestones tab
    const milestoneProjects = await safeQuery(`
      SELECT
        name as project_name,
        "org.stellar.communityfund.round" as round_name,
        "org.stellar.communityfund.totalAwardedUSD" as total_awarded_usd,
        "org.stellar.communityfund.totalPaidUSD" as total_paid_usd,
        "org.stellar.communityfund.trancheCompletion" as tranche_status,
        "org.stellar.communityfund.trancheCompletionPercent" as tranche_completion_percent,
        "org.stellar.communityfund.mostRecentPaymentDate" as most_recent_payment_date
      FROM silver_scf_grant_applications
      WHERE ("org.stellar.communityfund.totalPaidUSD" > 0 OR "org.stellar.communityfund.totalAwardedUSD" > 0)
        AND "org.stellar.communityfund.trancheCompletion" IS NOT NULL AND "org.stellar.communityfund.trancheCompletion" != ''
      ORDER BY "org.stellar.communityfund.mostRecentPaymentDate" DESC NULLS LAST, "org.stellar.communityfund.totalPaidUSD" DESC
      LIMIT 20
    `, []);

    // Funding efficiency by round (awarded vs paid with payment rate)
    const fundingEfficiency = await safeQuery(`
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
    const categoryPerformance = await safeQuery(`
      SELECT 
        "org.stellar.communityfund.category" as category,
        COUNT(*) as total_projects,
        SUM("org.stellar.communityfund.totalAwardedUSD") as total_awarded,
        SUM("org.stellar.communityfund.totalPaidUSD") as total_paid,
        AVG("org.stellar.communityfund.trancheCompletionPercent") as avg_completion,
        COUNT(CASE WHEN "org.stellar.communityfund.trancheCompletionPercent" = 100 THEN 1 END) as fully_completed
      FROM silver_scf_grant_applications
      WHERE "org.stellar.communityfund.category" IS NOT NULL AND "org.stellar.communityfund.totalAwardedUSD" > 0
      GROUP BY "org.stellar.communityfund.category"
      ORDER BY total_awarded DESC
      LIMIT 5
    `, []);

    // Repeat funding statistics - use grant pools total for consistency with summary
    const repeatFundingStats = await safeQuery(`
      WITH project_funding_counts AS (
        SELECT 
          "org.stellar.communityfund.project" as project_name,
          COUNT(*) as funding_count
        FROM silver_scf_grant_applications
        WHERE "org.stellar.communityfund.totalPaidUSD" > 0 AND "org.stellar.communityfund.project" IS NOT NULL AND "org.stellar.communityfund.project" != ''
        GROUP BY "org.stellar.communityfund.project"
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
    const cohortAnalysis = await safeQuery(`
      WITH project_funding_counts AS (
        SELECT 
          "org.stellar.communityfund.project" as project_name,
          COUNT(*) as funding_count
        FROM silver_scf_grant_applications
        WHERE "org.stellar.communityfund.totalPaidUSD" > 0 AND "org.stellar.communityfund.project" IS NOT NULL AND "org.stellar.communityfund.project" != ''
        GROUP BY "org.stellar.communityfund.project"
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
        WHERE a."org.stellar.communityfund.totalPaidUSD" > 0
        GROUP BY gp."name"
      ),
      repeat_counts AS (
        SELECT 
          gp."name" as round_name,
          COUNT(DISTINCT a."org.stellar.communityfund.project") as repeat_funded_projects
        FROM silver_scf_grant_applications a
        JOIN silver_scf_grant_pools gp ON a."grantPoolId" = gp.id
        WHERE a."org.stellar.communityfund.totalPaidUSD" > 0 
          AND a."org.stellar.communityfund.project" IN (SELECT project_name FROM repeat_projects)
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

    // Soroban adoption by quarter (Stellar-specific metric)
    const sorobanAdoption = await safeQuery(`
      SELECT
        gp."org.stellar.communityfund.quarterYear" as quarter,
        gp."org.stellar.communityfund.year" as year,
        COUNT(DISTINCT a.id) as total_applications,
        COUNT(DISTINCT a.id) FILTER (WHERE a."org.stellar.communityfund.useSoroban" = true) as soroban_count,
        ROUND(
          COUNT(DISTINCT a.id) FILTER (WHERE a."org.stellar.communityfund.useSoroban" = true)::numeric /
          NULLIF(COUNT(DISTINCT a.id), 0) * 100, 1
        ) as soroban_pct
      FROM silver_scf_grant_applications a
      JOIN silver_scf_grant_pools gp ON a."grantPoolId" = gp.id
      WHERE a."org.stellar.communityfund.totalAwardedUSD" > 0
        AND gp."org.stellar.communityfund.quarterYear" IS NOT NULL
      GROUP BY gp."org.stellar.communityfund.quarterYear", gp."org.stellar.communityfund.year"
      ORDER BY gp."org.stellar.communityfund.year", gp."org.stellar.communityfund.quarterYear"
    `, []);

    // Geographic distribution of funded projects
    // Regions of Operation is a multi-select in Airtable, stored as comma-separated string.
    // Unnest to count each region individually.
    const geoDistribution = await safeQuery(`
      SELECT
        TRIM(region) as region,
        COUNT(*) as project_count,
        COALESCE(SUM("org.stellar.communityfund.totalAwardedUSD"), 0) as total_awarded_usd
      FROM silver_scf_projects,
        UNNEST(STRING_TO_ARRAY("org.stellar.communityfund.regionsOfOperation", ',')) as region
      WHERE "org.stellar.communityfund.regionsOfOperation" IS NOT NULL
        AND "org.stellar.communityfund.regionsOfOperation" != ''
        AND "org.stellar.communityfund.totalAwardedUSD" > 0
      GROUP BY TRIM(region)
      ORDER BY project_count DESC
    `, []);

    // Award type distribution
    const awardTypeDistribution = await safeQuery(`
      SELECT
        "org.stellar.communityfund.awardType" as award_type,
        COUNT(*) as count,
        COALESCE(SUM("org.stellar.communityfund.totalAwardedUSD"), 0) as total_awarded_usd,
        COALESCE(SUM("org.stellar.communityfund.totalPaidUSD"), 0) as total_paid_usd,
        ROUND(
          COALESCE(SUM("org.stellar.communityfund.totalPaidUSD"), 0)::numeric / NULLIF(COALESCE(SUM("org.stellar.communityfund.totalAwardedUSD"), 0), 0) * 100,
        1) as payment_rate_pct
      FROM silver_scf_grant_applications
      WHERE "org.stellar.communityfund.awardType" IS NOT NULL AND "org.stellar.communityfund.awardType" != ''
        AND "org.stellar.communityfund.totalAwardedUSD" > 0
      GROUP BY "org.stellar.communityfund.awardType"
      ORDER BY total_awarded_usd DESC
    `, []);

    // Open source + Soroban scalar stats
    const projectStats = await safeQuery(`
      SELECT
        COUNT(*) as total_projects,
        COUNT(*) FILTER (WHERE "org.stellar.communityfund.openSource" = true) as open_source_count,
        ROUND(
          COUNT(*) FILTER (WHERE "org.stellar.communityfund.openSource" = true)::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ) as open_source_pct,
        COUNT(*) FILTER (WHERE "org.stellar.communityfund.sorobanUsed" = true) as soroban_project_count,
        ROUND(
          COUNT(*) FILTER (WHERE "org.stellar.communityfund.sorobanUsed" = true)::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ) as soroban_project_pct,
        COALESCE(
          (SELECT SUM("org.stellar.communityfund.totalPaidXLM")
           FROM silver_scf_grant_applications
           WHERE ("org.stellar.communityfund.totalPaidXLM" IS NOT NULL AND "org.stellar.communityfund.totalPaidXLM" > 0)),
          0
        ) as total_paid_xlm
      FROM silver_scf_projects
      WHERE "org.stellar.communityfund.totalAwardedUSD" > 0
    `, []);

    // Average phase durations across historical rounds (dates stored as 'Month DD, YYYY' strings)
    // avg_round_days = true end-to-end: submission open → panel review close
    const phaseDurations = await safeQuery(`
      SELECT
        ROUND(AVG(CASE
          WHEN sub_close ~ E'^\\\\w+ \\\\d+, \\\\d{4}$' AND sub_open ~ E'^\\\\w+ \\\\d+, \\\\d{4}$'
          THEN TO_DATE(sub_close, 'Month DD, YYYY') - TO_DATE(sub_open, 'Month DD, YYYY')
          ELSE NULL END)) as avg_submission_days,
        ROUND(AVG(CASE
          WHEN review_close ~ E'^\\\\w+ \\\\d+, \\\\d{4}$' AND review_open ~ E'^\\\\w+ \\\\d+, \\\\d{4}$'
          THEN TO_DATE(review_close, 'Month DD, YYYY') - TO_DATE(review_open, 'Month DD, YYYY')
          ELSE NULL END)) as avg_initial_review_days,
        ROUND(AVG(CASE
          WHEN vote_close ~ E'^\\\\w+ \\\\d+, \\\\d{4}$' AND vote_open ~ E'^\\\\w+ \\\\d+, \\\\d{4}$'
          THEN TO_DATE(vote_close, 'Month DD, YYYY') - TO_DATE(vote_open, 'Month DD, YYYY')
          ELSE NULL END)) as avg_vote_days,
        ROUND(AVG(CASE
          WHEN panel_close ~ E'^\\\\w+ \\\\d+, \\\\d{4}$' AND panel_open ~ E'^\\\\w+ \\\\d+, \\\\d{4}$'
          THEN TO_DATE(panel_close, 'Month DD, YYYY') - TO_DATE(panel_open, 'Month DD, YYYY')
          ELSE NULL END)) as avg_panel_days,
        ROUND(AVG(CASE
          WHEN panel_close ~ E'^\\\\w+ \\\\d+, \\\\d{4}$' AND sub_open ~ E'^\\\\w+ \\\\d+, \\\\d{4}$'
          THEN TO_DATE(panel_close, 'Month DD, YYYY') - TO_DATE(sub_open, 'Month DD, YYYY')
          ELSE NULL END)) as avg_round_days,
        COUNT(*) as rounds_with_dates
      FROM (
        SELECT
          "org.stellar.communityfund.submissionOpenDate"   as sub_open,
          "org.stellar.communityfund.submissionCloseDate"  as sub_close,
          "org.stellar.communityfund.initialReviewOpenDate" as review_open,
          "org.stellar.communityfund.initialReviewCloseDate" as review_close,
          "org.stellar.communityfund.communityVoteOpenDate" as vote_open,
          "org.stellar.communityfund.communityVoteCloseDate" as vote_close,
          "org.stellar.communityfund.panelReviewOpenDate"  as panel_open,
          "org.stellar.communityfund.panelReviewCloseDate" as panel_close
        FROM silver_scf_grant_pools
        WHERE "org.stellar.communityfund.totalPaidUSD" > 0
      ) t
    `, []);

    // Round phase dates — all date fields per round for live phase computation
    const roundPhases = await safeQuery(`
      SELECT
        id as round_id,
        name as round_name,
        "org.stellar.communityfund.phase" as phase_raw,
        "org.stellar.communityfund.submissionOpenDate"         as submission_open,
        "org.stellar.communityfund.submissionCloseDate"        as submission_close,
        "org.stellar.communityfund.initialReviewOpenDate"      as initial_review_open,
        "org.stellar.communityfund.initialReviewCloseDate"     as initial_review_close,
        "org.stellar.communityfund.communityVoteOpenDate"      as vote_open,
        "org.stellar.communityfund.communityVoteCloseDate"     as vote_close,
        "org.stellar.communityfund.awardSubmissionOpenDate"    as award_sub_open,
        "org.stellar.communityfund.awardSubmissionCloseDate"   as award_sub_close,
        "org.stellar.communityfund.panelReviewOpenDate"        as panel_open,
        "org.stellar.communityfund.panelReviewCloseDate"       as panel_close,
        "org.stellar.communityfund.notificationOpenDate"       as notification_open,
        "org.stellar.communityfund.notificationCloseDate"      as notification_close,
        "org.stellar.communityfund.cohortOpenDate"             as cohort_open,
        "org.stellar.communityfund.cohortCloseDate"            as cohort_close
      FROM silver_scf_grant_pools
      ORDER BY "org.stellar.communityfund.year" DESC, name DESC
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
      cohortAnalysis,
      sorobanAdoption,
      geoDistribution,
      awardTypeDistribution,
      projectStats: projectStats[0] || {},
      phaseDurations: phaseDurations[0] || {},
      roundPhases,
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
