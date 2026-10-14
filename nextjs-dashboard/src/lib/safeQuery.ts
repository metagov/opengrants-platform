/**
 * Wraps db.query() so a single failing SQL statement never crashes
 * the entire API route. Returns `fallback` (default: []) on query-level
 * errors and logs the error server-side only.
 *
 * Connection-level errors (bad credentials, database unreachable) are
 * rethrown: if the database is unusable every query would fail, and
 * returning empty data with a 200 hides the outage. The route's own
 * try/catch turns them into a 500.
 */
import { isConnectionError, query } from './db';

export async function safeQuery<T = any>(
  sql: string,
  params: any[] = [],
  fallback: T = [] as unknown as T
): Promise<T> {
  try {
    return (await query(sql, params)) as unknown as T;
  } catch (err: any) {
    if (isConnectionError(err)) throw err;
    console.error('[safeQuery] query failed:', err?.message || err);
    return fallback;
  }
}
