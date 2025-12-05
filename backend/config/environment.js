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
  JWT_EXPIRE: "15m",
  JWT_REFRESH_EXPIRE: "7d",

  // OTP Configuration
  OTP_EXPIRE_MINUTES: Number.parseInt(process.env.OTP_EXPIRE_MINUTES) || 10,
  OTP_MAX_ATTEMPTS: Number.parseInt(process.env.OTP_MAX_ATTEMPTS) || 5,
  OTP_LENGTH: 6,

  // Email Configuration
  EMAIL_USER: process.env.EMAIL_USER || "your-email@gmail.com",
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || "your-app-specific-password",
  EMAIL_FROM: process.env.EMAIL_FROM || "noreply@gharkhoj.com",
  EMAIL_SUPPORT: process.env.EMAIL_SUPPORT || "support@gharkhoj.com",

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

  // Security
  BCRYPT_ROUNDS: 10,
}
