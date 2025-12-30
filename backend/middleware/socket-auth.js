import jwt from "jsonwebtoken"
import { config } from "../config/environment.js"

export const socketAuthMiddleware = (socket, next) => {
  try {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error("Authentication error: No token provided"))
    }

    const decoded = jwt.verify(token, config.JWT_SECRET)
    socket.userId = decoded.userId
    socket.userRole = decoded.role
    socket.userEmail = decoded.email

    next()
  } catch (error) {
    console.error("[SOCKET AUTH ERROR]", error.message)
    next(new Error("Authentication error: Invalid token"))
  }
}
