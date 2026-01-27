import type { NextApiRequest, NextApiResponse } from "next";
import { testConnection } from "../../lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const result = await testConnection();

    if (result.success) {
      return res.status(200).json({
        status: "connected",
        message: "Database connection successful",
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        status: "failed",
        message: "Database connection failed",
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('DB test error:', process.env.NODE_ENV === 'development' ? error : 'Error');
    return res.status(500).json({
      status: "error",
      message: "Connection test failed",
      timestamp: new Date().toISOString()
    });
  }
}
