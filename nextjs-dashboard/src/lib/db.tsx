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
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result.rows;
  } catch (error: any) {
    const pgCode = error?.code;
    const pgMessage = error?.message ?? String(error);
    console.error(
      `Database query error [code=${pgCode ?? "n/a"}]: ${pgMessage}`,
      isProduction ? "" : { query: text, params }
    );
    const wrapped: any = new Error(pgMessage);
    wrapped.code = pgCode;
    wrapped.pgError = true;
    throw wrapped;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// SQLSTATE classes/codes and Node network errors meaning the database itself is
// unusable (bad credentials, unreachable, shutting down) rather than one query
// being wrong. Callers that fall back to empty results must rethrow these so the
// route returns 500 instead of a 200 with no data.
const CONNECTION_SQLSTATE_PREFIXES = ["08", "28"];
const CONNECTION_SQLSTATES = new Set(["3D000", "53300", "57P01", "57P02", "57P03"]);
const CONNECTION_NODE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
]);

export function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") {
    if (CONNECTION_NODE_CODES.has(code) || CONNECTION_SQLSTATES.has(code)) return true;
    if (code.length === 5 && CONNECTION_SQLSTATE_PREFIXES.includes(code.slice(0, 2))) return true;
  }
  const message = (err as { message?: unknown }).message;
  return (
    typeof message === "string" &&
    /timeout exceeded when trying to connect|Connection terminated|self[- ]signed certificate|unable to verify the first certificate|does not support SSL|no pg_hba\.conf entry/i.test(
      message
    )
  );
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