import { Pool, PoolConfig } from "pg";

const connectionString = process.env.DATABASE_URL;
const isLocalhost = connectionString?.includes("localhost");

const config: PoolConfig = {
  connectionString,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
};

if (!isLocalhost && connectionString) {
  config.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(config);

export async function query(text: string, params: any[] = []) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
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
    return { success: false, error: error.message };
  }
}
