// import { tokenManager } from "../utils/token-manager.js"
// import User from "../models/User.js"

// export const authMiddleware = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1]

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         error: "Authorization token required",
//       })
//     }

//     // Verify token signature
//     const decoded = tokenManager.verifyAccessToken(token)
//     if (!decoded) {
//       return res.status(401).json({
//         success: false,
//         error: "Invalid or expired token",
//       })
//     }

//     // Verify session is active in database
//     const session = await tokenManager.verifySession(token)
//     if (!session) {
//       return res.status(401).json({
//         success: false,
//         error: "Session not found or expired",
//       })
//     }

//     // Get user from database
//     const user = await User.findById(decoded.userId)
//     if (!user || !user.is_active) {
//       return res.status(401).json({
//         success: false,
//         error: "User not found or inactive",
//       })
//     }

//     req.user = {
//       userId: user.id,
//       email: user.email,
//       role: user.role,
//       name: user.name,
//     }
//     req.token = token

//     console.log("[AUTH] Authenticated user:", user.id, "Role:", user.role)
//     next()
//   } catch (error) {
//     console.error("[AUTH] Middleware error:", error.message)
//     res.status(401).json({
//       success: false,
//       error: "Authentication failed",
//     })
//   }
// }

// // Role-based middleware factories
// export const requireRole = (allowedRoles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         error: "Authentication required",
//       })
//     }

//     if (!allowedRoles.includes(req.user.role)) {
//       return res.status(403).json({
//         success: false,
//         error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
//       })
//     }

//     next()
//   }
// }

// // Predefined role middlewares
// export const adminOnly = requireRole(["admin"])
// export const landlordOnly = requireRole(["landlord", "admin"])
// export const tenantOnly = requireRole(["tenant", "admin"])
// export const tenantOrLandlord = requireRole(["tenant", "landlord", "admin"])

// // Backward compatibility alias
// export const studentMiddleware = tenantOnly

// export default authMiddleware
import { tokenManager } from "../utils/token-manager.js"

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken
    if (!token) return res.status(401).json({ error: "No token provided" })

    const decoded = tokenManager.verifyAccessToken(token)
    if (!decoded) return res.status(401).json({ error: "Invalid or expired token" })

    const session = await tokenManager.getSession(token) // ✅ pass token, not userId
    if (!session) return res.status(401).json({ error: "Session not found" })

    req.user = {
      id: session.user_id,
      role: session.role,
      isActive: session.is_active
    }

    next()
  } catch (err) {
    console.error("[AUTH ERROR]", err)
    res.status(401).json({ error: "Authentication failed" })
  }
}

// Role-based middlewares
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" })
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: `Access denied. Required roles: ${allowedRoles.join(", ")}` })
    next()
  }
}

export const adminMiddleware = requireRole(["admin"])
export const landlordMiddleware = requireRole(["landlord", "admin"])
export const tenantMiddleware = requireRole(["tenant"])
export const studentMiddleware = tenantMiddleware
