import fs from "fs";
import path from "path";
import { Pool, PoolConfig } from "pg";

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";
//const isProduction = true; // Force production mode for testing SSL config locally

// Determine SSL config
let sslConfig: any = false;
if (isProduction) {
  // Try reading CA cert from file in repo root
  const certPath = path.join(process.cwd(), "ca.crt");
  let caCert: string | null = null;

  try {
    caCert = fs.readFileSync(certPath, "utf-8");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("isProduction:", isProduction);
    console.log("✅ Using CA certificate from", certPath);
  } catch {
    console.warn("⚠️ CA certificate not found at", certPath);
  }


  if (caCert) {
    sslConfig = {
      ca: caCert,
      rejectUnauthorized: true
    };
  } else {
    sslConfig = { rejectUnauthorized: false };
    console.warn(
      "⚠️ No CA certificate found, using SSL without certificate validation"
    );
  }
}

const config: PoolConfig = {
  connectionString,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
  max: 10,
  ssl: sslConfig,
};

const pool = new Pool(config);

export async function query(text: string, params: any[] = []) {
  let client;
  let connected = false;
  let brokenConnection = false;
  try {
    client = await pool.connect();
    connected = true;
    const result = await client.query(text, params);
    return result.rows;
  } catch (error: any) {
    const pgCode = error?.code;
    // AggregateError (e.g. dual-stack connect refused) has an empty message; use its parts
    const pgMessage =
      error?.message ||
      (Array.isArray(error?.errors) ? error.errors.map((e: any) => e?.message).join("; ") : "") ||
      String(error);
    console.error(
      `Database query error [code=${pgCode ?? "n/a"}]: ${pgMessage}`,
      isProduction ? "" : { query: text, params }
    );
    const wrapped: any = new Error(pgMessage);
    wrapped.code = pgCode;
    wrapped.pgError = true;
    wrapped.cause = error;
    // Any failure while connecting means the database is unusable, whatever the error says.
    // After connecting, fall back to the code/message checks (e.g. server restarted mid-query).
    wrapped.connectionError = !connected || isConnectionError(error);
    brokenConnection = connected && wrapped.connectionError;
    throw wrapped;
  } finally {
    if (client) {
      // Destroy a client whose connection broke instead of returning it to the pool
      client.release(brokenConnection || undefined);
    }
  }
}

// SQLSTATE classes/codes and Node network/TLS errors meaning the database itself is
// unusable (bad credentials, unreachable, shutting down) rather than one query
// being wrong. Callers that fall back to empty results must rethrow these so the
// route returns 500 instead of a 200 with no data.
const CONNECTION_SQLSTATE_PREFIXES = ["08", "28"];
const CONNECTION_SQLSTATES = new Set(["3D000", "53300", "57P01", "57P02", "57P03"]);
const CONNECTION_NODE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);
const CONNECTION_MESSAGE =
  /timeout exceeded when trying to connect|Connection terminated|not queryable|does not support SSL|no pg_hba\.conf entry/i;

export function isConnectionError(err: unknown, depth = 0): boolean {
  if (!err || typeof err !== "object" || depth > 3) return false;
  const e = err as { connectionError?: unknown; code?: unknown; message?: unknown; cause?: unknown; errors?: unknown };
  if (e.connectionError === true) return true;
  if (typeof e.code === "string") {
    if (CONNECTION_NODE_CODES.has(e.code) || CONNECTION_SQLSTATES.has(e.code)) return true;
    if (e.code.length === 5 && CONNECTION_SQLSTATE_PREFIXES.includes(e.code.slice(0, 2))) return true;
  }
  if (typeof e.message === "string" && CONNECTION_MESSAGE.test(e.message)) return true;
  if (Array.isArray(e.errors) && e.errors.some((inner) => isConnectionError(inner, depth + 1))) return true;
  return isConnectionError(e.cause, depth + 1);
}

export async function testConnection() {
  try {
    const result = await query("SELECT NOW() as current_time");
    return { success: true, time: result[0]?.current_time };
  } catch {
    return { success: false, error: "Connection test failed" };
  }
}

pool.on("connect", () => {
  console.log("✅ Database pool connected");
});

pool.on("error", (err) => {
  console.error("❌ Database pool error:", err.message);
});

export default pool;