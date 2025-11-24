import express from "express"
import { authController } from "../controllers/auth-controller.js"
import { authMiddleware } from "../middleware/auth.js"
import {
  validateRegister,
  validateLogin,
  validateOTPVerification,
  validateResendOTP,
} from "../middleware/validation.js"

const router = express.Router()

// Public routes
router.post("/register", validateRegister, authController.register)
router.post("/verify-otp", validateOTPVerification, authController.verifyOTP)
router.post("/resend-otp", validateResendOTP, authController.resendOTP)
router.post("/login", validateLogin, authController.login)
router.post("/refresh-token", authController.refreshToken)

// Protected routes
router.get("/me", authMiddleware, authController.getCurrentUser)
router.post("/logout", authMiddleware, authController.logout)

export default router
