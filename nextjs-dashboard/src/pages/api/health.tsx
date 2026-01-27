// --- nextjs-dashboard/src/pages/api/health.tsx
import { query } from '../../lib/db'

export default async function handler(req, res) {
  try {
    // Simple query to test connection
    const result = await query('SELECT NOW() as current_time', [])

    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: result[0].current_time
    })
  } catch (error) {
    // Don't expose error details or system info
    console.error('Health check failed:', process.env.NODE_ENV === 'development' ? error : 'Error');
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    })
  }
}