import type { NextApiRequest, NextApiResponse } from "next";
import { testConnection } from "../../lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await testConnection();
    
    if (result.success) {
      return res.status(200).json({
        status: "connected",
        message: "Database connection successful",
        serverTime: result.time,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        status: "failed",
        message: "Database connection failed",
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      message: "Unexpected error during connection test",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
