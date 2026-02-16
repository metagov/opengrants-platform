import { Pool, PoolConfig } from "pg";
import fs from 'fs';
import path from 'path';

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";

// Determine SSL config
let sslConfig: any = false;

if (isProduction) {
  // Check if we have a custom CA certificate
  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  
  if (caPath && fs.existsSync(caPath)) {
    // Use custom CA certificate
    sslConfig = {
      ca: fs.readFileSync(caPath, 'utf8'),
      rejectUnauthorized: true
    };
    console.log(`✅ Using custom CA certificate from: ${caPath}`);
  } else if (connectionString?.includes("sslmode=require")) {
    // Use standard SSL validation
    sslConfig = { rejectUnauthorized: true };
    console.log('✅ Using standard SSL validation');
  } else {
    // Fallback for development
    sslConfig = { rejectUnauthorized: false };
    console.log('⚠️ Using SSL without certificate validation');
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

// Optional: Add connection pool event handlers
pool.on('connect', () => {
  console.log('✅ Database pool connected');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

export default pool;