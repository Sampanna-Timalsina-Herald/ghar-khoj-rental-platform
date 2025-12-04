import jwt from "jsonwebtoken"
import { config } from "../config/environment.js"
import Session from "../models/Session.js"

const JWT_SECRET = config.JWT_SECRET || "your-secret-key-change-in-production"
const JWT_REFRESH_SECRET = config.JWT_REFRESH_SECRET || "your-refresh-secret-key"

export const tokenManager = {
  // Generate access token (15 minutes)
  generateAccessToken(userId, role) {
    return jwt.sign({ userId, role, type: "access" }, JWT_SECRET, { expiresIn: "15m" })
  },

  // Generate refresh token (7 days)
  generateRefreshToken(userId) {
    return jwt.sign({ userId, type: "refresh" }, JWT_REFRESH_SECRET, { expiresIn: "7d" })
  },

  // Verify access token
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET)
    } catch (error) {
      console.error("[TOKEN] Access token verification failed:", error.message)
      return null
    }
  },

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET)
    } catch (error) {
      console.error("[TOKEN] Refresh token verification failed:", error.message)
      return null
    }
  },

  // Create session in database
  async createSession(userId, accessToken, refreshToken, ipAddress, userAgent) {
    try {
      const decoded = jwt.decode(accessToken)
      const expiresAt = new Date(decoded.exp * 1000)

      const session = await Session.create({
        userId,
        token: accessToken,
        refreshToken,
        expiresAt,
      })
      return session
    } catch (error) {
      console.error("[TOKEN] Error creating session:", error.message)
      throw error
    }
  },

  // Revoke session
  async revokeSession(token) {
    try {
      await Session.revokeToken(token)
    } catch (error) {
      console.error("[TOKEN] Error revoking session:", error.message)
    }
  },

  // Verify session is active
  async verifySession(token) {
    try {
      return await Session.findByToken(token)
    } catch (error) {
      console.error("[TOKEN] Error verifying session:", error.message)
      return null
    }
  },

  // Get user sessions
  async getUserSessions(userId) {
    try {
      return await Session.findByUserId(userId)
    } catch (error) {
      console.error("[TOKEN] Error getting user sessions:", error.message)
      return []
    }
  },
}

export default tokenManager
