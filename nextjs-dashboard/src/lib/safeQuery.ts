/**
 * Wraps db.query() so a single failing SQL statement never crashes
 * the entire API route. Returns `fallback` (default: []) on any error
 * and logs the error server-side only.
 */
import { query } from './db';

export async function safeQuery<T = any>(
  sql: string,
  params: any[] = [],
  fallback: T = [] as unknown as T
): Promise<T> {
  try {
    return (await query(sql, params)) as unknown as T;
  } catch (err: any) {
    console.error('[safeQuery] query failed:', err?.message || err);
    return fallback;
  }
}
