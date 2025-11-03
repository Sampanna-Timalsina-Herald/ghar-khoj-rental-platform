import { body, validationResult } from "express-validator"

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    })
  }
  next()
}

export const validateRegister = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage("Password must contain uppercase, lowercase, number, and special character"),
  body("role").isIn(["student", "landlord"]).withMessage("Role must be either 'student' or 'landlord'"),
  validateRequest,
]

export const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("password").notEmpty().withMessage("Password is required"),
  body("role").isIn(["student", "landlord", "admin"]).withMessage("Invalid role"),
  validateRequest,
]

export const validateOTPVerification = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  body("otp")
    .matches(/^\d{6}$/)
    .withMessage("OTP must be exactly 6 digits"),
  validateRequest,
]

export const validateResendOTP = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
  validateRequest,
]

export const validateListing = [
  body("title").notEmpty().trim(),
  body("description").notEmpty().trim(),
  body("address").notEmpty().trim(),
  body("city").notEmpty().trim(),
  body("rent_amount").isFloat({ min: 0 }),
  body("bedrooms").isInt({ min: 1 }),
  body("bathrooms").isInt({ min: 1 }),
  validateRequest,
]
