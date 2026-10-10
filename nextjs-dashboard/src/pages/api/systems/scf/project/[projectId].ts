import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../../lib/db';
import { toProjectId } from '../../../../../lib/scfIds';

const EXT = 'org.stellar.communityfund.';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const projectId = toProjectId(String(req.query.projectId || ''));

  try {
    const projectRows = await query(`
      SELECT
        id AS project_id,
        name AS project_name,
        description,
        image,
        "${EXT}category" AS category,
        "${EXT}website" AS website,
        "${EXT}github" AS github,
        "${EXT}x" AS x,
        "${EXT}discord" AS discord,
        "${EXT}linkedin" AS linkedin,
        "${EXT}integrationStatus" AS integration_status,
        "${EXT}regionsOfOperation" AS regions,
        "${EXT}openSource" AS open_source,
        "${EXT}sorobanUsed" AS soroban_used
      FROM silver_scf_projects
      WHERE id = $1
      LIMIT 1
    `, [projectId]);

    // Awards are read by projectId even when the project row is missing, so a project
    // whose Airtable link is broken still shows its funding history.
    const awards = await query(`
      SELECT
        a.id AS application_id,
        a."grantPoolName" AS round_name,
        gp."${EXT}quarterYear" AS quarter_year,
        a."${EXT}submissionTitle" AS submission_title,
        a."${EXT}oneSentenceDescription" AS one_sentence_description,
        a."${EXT}awardType" AS award_type,
        a."${EXT}totalAwardedUSD" AS total_awarded_usd,
        a."${EXT}totalPaidUSD" AS total_paid_usd,
        a."${EXT}trancheCompletionPercent" AS tranche_completion,
        a."${EXT}trancheCompletion" AS tranche_status,
        a."${EXT}mostRecentPaymentDate" AS last_payment_date,
        a."${EXT}submissionURL" AS submission_url
      FROM silver_scf_grant_applications a
      LEFT JOIN silver_scf_grant_pools gp ON gp.id = a."grantPoolId"
      WHERE a."projectId" = $1
        AND COALESCE(a."${EXT}totalAwardedUSD", 0) > 0
    `, [projectId]);

    if (projectRows.length === 0 && awards.length === 0) {
      return res.status(404).json({ message: 'Project not found', projectId });
    }

    const roundNum = (name: string) => Number((name || '').match(/#\s*(\d+)/)?.[1] ?? 0);
    awards.sort((a: any, b: any) => roundNum(a.round_name) - roundNum(b.round_name));

    const num = (v: unknown) => Number(v) || 0;
    const build = awards.filter((a: any) => a.award_type === 'Build' && a.tranche_completion !== null);
    const summary = {
      award_count: awards.length,
      total_awarded_usd: awards.reduce((s: number, a: any) => s + num(a.total_awarded_usd), 0),
      total_paid_usd: awards.reduce((s: number, a: any) => s + num(a.total_paid_usd), 0),
      first_round: awards[0]?.round_name ?? null,
      latest_round: awards[awards.length - 1]?.round_name ?? null,
      avg_tranche_completion: build.length
        ? build.reduce((s: number, a: any) => s + num(a.tranche_completion), 0) / build.length
        : null,
    };

    const metadata = await query(
      `SELECT platform, last_indexed_at, data_source FROM platform_metadata WHERE platform = 'scf'`,
      [],
    ).catch(() => []);

    res.status(200).json({
      metadata: metadata[0] || null,
      project: projectRows[0] || { project_id: projectId, project_name: null },
      projectRecordMissing: projectRows.length === 0,
      summary,
      awards,
    });
  } catch (error: any) {
    const pgCode = error?.code;
    console.error(`SCF project ${projectId} query failed [code=${pgCode ?? 'n/a'}]:`, error?.message ?? error);
    if (pgCode === '42703' || pgCode === '42P01') {
      return res.status(503).json({
        message: 'Schema mismatch — API column names are out of sync with the database. Check recent silver-table migrations.',
        code: pgCode,
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
}
