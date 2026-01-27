import { Pool, PoolConfig } from "pg";

const connectionString = process.env.DATABASE_URL;

// Determine SSL config based on environment
const isProduction = process.env.NODE_ENV === "production";
const sslConfig = connectionString?.includes("sslmode=require")
  ? { rejectUnauthorized: true } // Secure: validate SSL certificates
  : false;

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
    // Log error without exposing sensitive details in production
    if (isProduction) {
      console.error("Database query error occurred");
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
  } catch (error: any) {
    // Don't expose actual error message
    return { success: false, error: "Connection test failed" };
  }
}
