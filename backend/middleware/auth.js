import { tokenManager } from "../utils/token-manager.js"
import User from "../models/User.js"

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ error: "No token provided" })
    }

    // Verify token
    const decoded = tokenManager.verifyAccessToken(token)
    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" })
    }

    // Check if session is active
    const isActive = await tokenManager.isSessionActive(token)
    if (!isActive) {
      return res.status(401).json({ error: "Session expired" })
    }

    // Get user from database
    const user = await User.findById(decoded.userId)
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" })
    }

    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    }
    req.token = token

    next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    res.status(500).json({ error: "Authentication failed" })
  }
}

export const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" })
  }
  next()
}

export const landlordMiddleware = (req, res, next) => {
  if (req.user?.role !== "landlord" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Landlord access required" })
  }
  next()
}

export const studentMiddleware = (req, res, next) => {
  if (req.user?.role !== "student" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Student access required" })
  }
  next()
}
