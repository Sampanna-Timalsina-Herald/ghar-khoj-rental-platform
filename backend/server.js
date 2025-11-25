//Server.js - Main entry point for the Ghar Khoj Rental Platform backend server
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { connectDB } from "./config/mongodb.js"
import { config } from "./config/environment.js"
import { createServer } from "http"
import { Server } from "socket.io"
import { socketAuthMiddleware } from "./middleware/socket-auth.js"
import { setupSocketEvents } from "./events/socket-events.js"
import socketService from "./services/socket-service.js"

// Load environment variables
dotenv.config()

// Import routes for different modules
import authRoutes from "./routes/auth.js"
import listingsRoutes from "./routes/listings.js"
import favoritesRoutes from "./routes/favorites.js"
import conversationsRoutes from "./routes/conversations.js"
import messagesRoutes from "./routes/messages.js"
import agreementsRoutes from "./routes/agreements.js"
import ratingsRoutes from "./routes/ratings.js"
import adminRoutes from "./routes/admin.js"



const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
})

const PORT = config.PORT

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Connect to MongoDB
connectDB()

io.use(socketAuthMiddleware)

io.on("connection", (socket) => {
  console.log(`[SOCKET] New connection: ${socket.id}`)

  // Register user socket
  const userId = socket.userId
  socketService.registerUserSocket(userId, socket.id)

  // Setup socket events
  setupSocketEvents(io, socket)
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/listings", listingsRoutes)
app.use("/api/favorites", favoritesRoutes)
app.use("/api/conversations", conversationsRoutes)
app.use("/api/messages", messagesRoutes)
app.use("/api/agreements", agreementsRoutes)
app.use("/api/ratings", ratingsRoutes)
app.use("/api/admin", adminRoutes)

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "Server is running", timestamp: new Date() })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[ERROR]", {
    timestamp: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
  })

  const statusCode = err.statusCode || 500
  const message = err.message || "Internal server error"

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.NODE_ENV === "development" && { stack: err.stack }),
  })
})

httpServer.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`)
  console.log(`[ENV] Node environment: ${config.NODE_ENV}`)
  console.log(`[DB] MongoDB URI: ${config.MONGODB_URI}`)
  console.log(`[SOCKET.IO] WebSocket server initialized`)
})
