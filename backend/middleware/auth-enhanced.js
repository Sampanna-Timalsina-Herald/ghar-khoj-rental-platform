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
