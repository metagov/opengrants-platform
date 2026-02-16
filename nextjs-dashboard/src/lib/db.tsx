import fs from "fs";
import path from "path";
import { Pool, PoolConfig } from "pg";

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

// Determine SSL config
let sslConfig: any = false;
if (isProduction) {
  // Try reading CA cert from file in repo root
  const certPath = path.join(process.cwd(), "ca-certificate.crt");
  let caCert: string | null = null;

  try {
    caCert = fs.readFileSync(certPath, "utf-8");
    console.log("✅ Using CA certificate from", certPath);
  } catch {
    console.warn("⚠️ CA certificate not found at", certPath);
  }

  // Fallback: try env variable
  if (!caCert && process.env.DATABASE_CA_CERT) {
    caCert = process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n");
    console.log("✅ Using CA certificate from DATABASE_CA_CERT env variable");
  }

  if (caCert) {
    sslConfig = {
      ca: caCert,
      rejectUnauthorized: true,
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
  max: 5,
  ssl: sslConfig,
};

const pool = new Pool(config);

export async function query(text: string, params: any[] = []) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    if (isProduction) {
      console.error(
        "Database query error occurred +error",
        error instanceof Error ? error.message : error
      );
    } else {
      console.error("Database query error:", error);
    }
    throw new Error("Database query failed");
  } finally {
    if (client) {
      client.release();
    }
  }
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