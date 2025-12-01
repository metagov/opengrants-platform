// --- nextjs-dashboard/src/lib/db.tsx
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@0.tcp.eu.ngrok.io:16940/opengrants',
})

//connectionString: 'postgresql://postgres:postgres@localhost:5433/opengrants',

export async function query(text: any, params: any) {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result.rows
  } finally {
    client.release()
  }
}