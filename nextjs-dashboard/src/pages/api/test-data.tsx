import { query } from '../../lib/db'
// --- nextjs-dashboard/src/pages/api/test-data.tsx
export default async function handler(req, res) {
  try {
    // Use existing tables from your database
    const [platformData, temporalData, fundingData, crossPlatformData] = await Promise.all([
      query('SELECT * FROM gold__ecosystem_overview', []),
      query('SELECT * FROM gold__temporal_metrics', []),
      query('SELECT * FROM gold__funding_metrics', []),
      query('SELECT * FROM gold__cross_platform LIMIT 5', [])
    ])

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        ecosystemOverview: platformData,
        temporalMetrics: temporalData,
        fundingMetrics: fundingData,
        crossPlatform: crossPlatformData
      },
      counts: {
        ecosystemRecords: platformData.length,
        temporalRecords: temporalData.length,
        fundingRecords: fundingData.length,
        crossPlatformRecords: crossPlatformData.length
      }
    })
  } catch (error) {
    console.error('Database test error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}