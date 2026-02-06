import dotenv from "dotenv"
dotenv.config()
import express from "express"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"

import { query } from "./config/database.js"
import { config } from "./config/environment.js"
import { createServer } from "http"
import { Server } from "socket.io"
import { socketAuthMiddleware } from "./middleware/socket-auth.js"
import { setupSocketEvents } from "./events/socket-events.js"
import socketService from "./services/socket-service.js"
import cookieParser from "cookie-parser"
import upload from "./config/upload.js"

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)



// Load environment variables


// Import routes
import authRoutes from "./routes/auth.js"
import listingsRoutes from "./routes/listings.js"
import favoritesRoutes from "./routes/favorites.js"
import conversationsRoutes from "./routes/conversations.js"
import messagesRoutes from "./routes/messages.js"
import agreementsRoutes from "./routes/agreements.js"
import ratingsRoutes from "./routes/ratings.js"
import adminRoutes from "./routes/admin.js"
import preferencesRoutes from "./routes/preferences.js"
import notificationsRoutes from "./routes/notifications.js"
import recommendationRoutes from "./routes/recommendations.js"
import bookingsRoutes from "./routes/bookings.js"
import adminCommissionRoutes from "./routes/adminCommission.js"
import landlordCommissionRoutes from "./routes/landlordCommission.js"
import mlScheduler from "./services/ml-scheduler.js"

const app = express()
const httpServer = createServer(app)
const PORT = config.PORT

// CORS configuration - allow multiple origins in development
const allowedOrigins = config.NODE_ENV === "production" 
  ? [config.FRONTEND_URL] // Single origin in production
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      config.FRONTEND_URL
    ].filter(Boolean); // Remove any undefined values

// Socket.IO CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: config.NODE_ENV === "production" 
      ? config.FRONTEND_URL 
      : allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Middleware
// CSP Header - allow unsafe-eval for Socket.IO in development
app.use((req, res, next) => {
  if (config.NODE_ENV === "development") {
    res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-eval' 'unsafe-inline'");
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development, allow all localhost origins
      if (config.NODE_ENV === "development") {
        if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
          return callback(null, true);
        }
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true, // allow cookies to be sent
  })
);

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser());

// Serve uploads folder as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Initialize database and test connection
const initializeDB = async () => {
  try {
    const result = await query("SELECT NOW()")
    console.log()
    console.log(`[DATABASE] PostgreSQL Connected: ${result.rows[0].now}`)
  } catch (error) {
    console.error(`[DATABASE] Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDB()

io.use(socketAuthMiddleware)

io.on("connection", (socket) => {
  console.log(`[SOCKET] New connection: ${socket.id}`)

  // Register user socket
  const userId = socket.userId
  socketService.registerUserSocket(userId, socket.id)

  // Setup socket events
  setupSocketEvents(io, socket)
})

// Make io instance available to routes
app.set('io', io)

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/listings", listingsRoutes)
app.use("/api/favorites", favoritesRoutes)
app.use("/api/conversations", conversationsRoutes)
app.use("/api/messages", messagesRoutes)
app.use("/api/agreements", agreementsRoutes)
app.use("/api/ratings", ratingsRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/preferences", preferencesRoutes)
app.use("/api/notifications", notificationsRoutes)
app.use("/api/recommendations", recommendationRoutes)
app.use("/api/bookings", bookingsRoutes)
app.use("/api/admin/commissions", adminCommissionRoutes)
app.use("/api/landlord/commissions", landlordCommissionRoutes)

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
  console.log(`[DB] PostgreSQL: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`)
  console.log(`[SOCKET.IO] WebSocket server initialized`)
  
  // Start ML scheduler for automatic model training and recommendation generation
  mlScheduler.start()
  console.log(`[ML SCHEDULER] Started - Will train models and generate recommendations automatically`)
})
