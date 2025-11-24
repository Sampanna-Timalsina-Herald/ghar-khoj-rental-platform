import express from "express"
import { authController } from "../controllers/auth-controller.js"
import { authMiddleware } from "../middleware/auth-enhanced.js"
import {
  validateRegister,
  validateLogin,
  validateOTPVerification,
  validateResendOTP,
} from "../middleware/validation.js"
import { asyncHandler } from "../utils/error-handler.js"

const router = express.Router()

// Public routes
router.post("/register", validateRegister, asyncHandler(authController.register))
router.post("/verify-otp", validateOTPVerification, asyncHandler(authController.verifyOTP))
router.post("/resend-otp", validateResendOTP, asyncHandler(authController.resendOTP))
router.post("/login", validateLogin, asyncHandler(authController.login))
router.post("/refresh-token", asyncHandler(authController.refreshToken))

// Protected routes
router.get("/me", authMiddleware, asyncHandler(authController.getCurrentUser))
router.post("/logout", authMiddleware, asyncHandler(authController.logout))

export default router
