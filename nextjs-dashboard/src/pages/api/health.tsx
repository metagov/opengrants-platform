// --- nextjs-dashboard/src/pages/api/health.tsx
import { query } from '../../lib/db'

export default async function handler(req, res) {
  try {
    // Simple query to test connection
    const result = await query('SELECT NOW() as current_time, version() as postgres_version', [])
    
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: result[0].current_time,
      postgresVersion: result[0].postgres_version,
      environment: process.env.NODE_ENV
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}