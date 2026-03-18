export const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // PostgreSQL Configuration
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME,
  DB_SSL: process.env.DB_SSL === "true",

  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production",
  JWT_EXPIRE: "2h",  // Changed from "15m" to "2h" to prevent frequent logouts
  JWT_REFRESH_EXPIRE: "30d",  // Changed from "7d" to "30d" for better UX

  // OTP Configuration
  OTP_EXPIRE_MINUTES: Number.parseInt(process.env.OTP_EXPIRE_MINUTES) || 10,
  OTP_MAX_ATTEMPTS: Number.parseInt(process.env.OTP_MAX_ATTEMPTS) || 5,
  OTP_LENGTH: 6,

  // Email Configuration
  EMAIL_USER: process.env.EMAIL_USER || "your-email@gmail.com",
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || "your-app-specific-password",
  EMAIL_FROM: process.env.EMAIL_FROM || "noreply@gharkhoj.com",
  EMAIL_SUPPORT: process.env.EMAIL_SUPPORT || "support@gharkhoj.com",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "admin@gharkhoj.com",

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

  // Security
  BCRYPT_ROUNDS: 10,

  // Payment Gateways
  // Khalti Configuration
  KHALTI_SECRET_KEY: process.env.KHALTI_SECRET_KEY || "f76c30ceca294965968c82f3b881f7ac",
  KHALTI_PUBLIC_KEY: process.env.KHALTI_PUBLIC_KEY || "24901a0df35f41a78eca83338923d6ab",
  KHALTI_API_URL: process.env.KHALTI_API_URL || "https://dev.khalti.com/api/v2",
  KHALTI_RETURN_URL: process.env.KHALTI_RETURN_URL || `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/verify`,
  KHALTI_API_URL: process.env.KHALTI_API_URL || "https://dev.khalti.com/api/v2",
  KHALTI_RETURN_URL: process.env.KHALTI_RETURN_URL || `${process.env.FRONTEND_URL || "http://localhost:5173"}/epayment/initiate`,

  // eSewa Configuration
  ESEWA_MERCHANT_ID: process.env.ESEWA_MERCHANT_ID || "EPAYTEST",
  ESEWA_SECRET_KEY: process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q",
  ESEWA_API_URL: process.env.ESEWA_API_URL || "https://rc.esewa.com.np/api/epay",
  ESEWA_SUCCESS_URL: process.env.ESEWA_SUCCESS_URL || `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/verify`,
  ESEWA_FAILURE_URL: process.env.ESEWA_FAILURE_URL || `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/verify`,
  WEBSITE_URL: process.env.WEBSITE_URL || process.env.FRONTEND_URL || "http://localhost:5173",
}
