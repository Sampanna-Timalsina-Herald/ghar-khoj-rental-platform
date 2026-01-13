// import { tokenManager } from "../utils/token-manager.js"

// export const authMiddleware = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1]

//     if (!token) {
//       return res.status(401).json({ error: "No token provided" })
//     }

//     // Check if token is blacklisted
//     const isBlacklisted = await tokenManager.isTokenBlacklisted(token)
//     if (isBlacklisted) {
//       return res.status(401).json({ error: "Token has been revoked" })
//     }

//     const decoded = tokenManager.verifyToken(token)
//     if (!decoded) {
//       return res.status(401).json({ error: "Invalid or expired token" })
//     }

//     req.user = decoded
//     next()
//   } catch (error) {
//     res.status(401).json({ error: "Authentication failed" })
//   }
// }

// export const requireRole = (allowedRoles) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({ error: "Authentication required" })
//     }

//     if (!allowedRoles.includes(req.user.role)) {
//       return res.status(403).json({
//         error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
//       })
//     }

//     next()
//   }
// }

// export const adminMiddleware = requireRole(["admin"])
// export const landlordMiddleware = requireRole(["landlord", "admin"])
// export const tenantMiddleware = requireRole(["tenant"])
// export const studentMiddleware = tenantMiddleware // backward compatibility alias
import { tokenManager } from "../utils/token-manager.js";

export const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // 1️⃣ Try reading token from httpOnly cookie
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
      console.log("[AUTH] Token from cookie");
    }

    // 2️⃣ Fallback to Authorization header
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
      console.log("[AUTH] Token from Authorization header");
    }

    if (!token) {
      console.log("[AUTH] No token provided");
      return res.status(401).json({ error: "No token provided" });
    }

    // 3️⃣ Check blacklist
    const isBlacklisted = await tokenManager.isTokenBlacklisted(token);
    if (isBlacklisted) {
      console.log("[AUTH] Token is blacklisted");
      return res.status(401).json({ error: "Token has been revoked" });
    }

    // 4️⃣ Verify token (expiry handled here)
    const decoded = tokenManager.verifyToken(token);
    if (!decoded) {
      console.log("[AUTH] Token verification failed");
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    console.log("[AUTH] Token verified successfully. UserId:", decoded.userId, "Role:", decoded.role);

    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

export const adminMiddleware = requireRole(["admin"]);
export const landlordMiddleware = requireRole(["landlord", "admin"]);
export const tenantMiddleware = requireRole(["tenant"]);
export const studentMiddleware = tenantMiddleware;

// Optional auth middleware - sets req.user if token exists, but doesn't fail if missing
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // Try reading token from httpOnly cookie
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    // Fallback to Authorization header
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // If no token, just continue without setting req.user
    if (!token) {
      return next();
    }

    // Check blacklist
    const isBlacklisted = await tokenManager.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next();
    }

    // Verify token
    const decoded = tokenManager.verifyToken(token);
    if (!decoded) {
      return next();
    }

    // Set user info if token is valid
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // On error, just continue without setting req.user
    console.error("[OPTIONAL-AUTH] Error:", error.message);
    next();
  }
};
