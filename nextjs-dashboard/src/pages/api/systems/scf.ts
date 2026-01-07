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
        "io.scf.trancheCompletionPercent" as tranche_completion
      FROM silver_scf_grant_applications
      WHERE "io.scf.totalPaidUSD" > 0 OR "io.scf.totalAwardedUSD" > 0
      ORDER BY "io.scf.totalPaidUSD" DESC
      LIMIT 10
    `, []);

    res.status(200).json({
      metadata: metadata[0] || null,
      summary: summary,
      quarterlyData,
      categoryData,
      rounds: roundsBreakdown,
      trancheMetrics: trancheMetrics[0] || {},
      trancheByStatus,
      topProjects
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
