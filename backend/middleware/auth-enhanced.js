import { tokenManager } from "../utils/token-manager.js"

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]

    if (!token) {
      return res.status(401).json({ error: "No token provided" })
    }

    // Check if token is blacklisted
    const isBlacklisted = await tokenManager.isTokenBlacklisted(token)
    if (isBlacklisted) {
      return res.status(401).json({ error: "Token has been revoked" })
    }

    const decoded = tokenManager.verifyToken(token)
    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" })
    }

    req.user = decoded
    next()
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" })
  }
}

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      })
    }

    next()
  }
}

export const adminMiddleware = requireRole(["admin"])
export const landlordMiddleware = requireRole(["landlord", "admin"])
export const tenantMiddleware = requireRole(["tenant"])
export const studentMiddleware = tenantMiddleware // backward compatibility alias
