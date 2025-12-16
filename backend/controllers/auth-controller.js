import User from "../models/User.js"
import OTP from "../models/OTP.js"
import AuditLog from "../models/AuditLog.js"
import { emailService } from "../utils/email-service.js"
import { generateOTP, getOTPExpiry } from "../utils/otp-generator.js"
import { tokenManager } from "../utils/token-manager.js"
import { validatePasswordStrength } from "../utils/password-validator.js"
import { registrationCacheManager } from "../utils/registration-cache.js"
import crypto from 'crypto' // Essential for generating and hashing reset tokens

// Helper function to extract client IP address
const getClientIP = (req) => {
  return req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress
}

// Helper function to extract user agent
const getUserAgent = (req) => {
  return req.headers["user-agent"] || "Unknown"
}

export const authController = {
  // ---------------------------------------------------------------------
  // --- 1. Registration & OTP ---
  // ---------------------------------------------------------------------
  // Register user with OTP
//   async register(req, res, next) {
//     try {
//       const { email, password, name, role } = req.body
//       const ipAddress = getClientIP(req)
//       const userAgent = getUserAgent(req)

//       console.log("[AUTH] Registration attempt for:", email, "Role:", role)

//       // Check if user exists
//       const existingUser = await User.findByEmail(email)
//       if (existingUser) {
//         await AuditLog.create({
//           userId: null,
//           action: "REGISTER",
//           email,
//           ipAddress,
//           userAgent,
//           status: "FAILED",
//           details: "Email already exists",
//         })
//         return res.status(400).json({
//           success: false,
//           error: "Email already registered",
//         })
//       }

//       // Validate password strength
//       const passwordStrength = validatePasswordStrength(password)
//       if (!passwordStrength.isStrong) {
//         return res.status(400).json({
//           success: false,
//           error: "Password does not meet security requirements",
//           requirements: passwordStrength.requirements,
//         })
//       }

//       // Create user
//       const user = await User.create({
//         name,
//         email: email.toLowerCase(),
//         password,
//         role: role || "tenant",
//       })

//       console.log("[AUTH] User created:", user.id)

//       // Generate and send OTP
//       const otp = generateOTP()
//       const expiresAt = getOTPExpiry()

//       await OTP.create({
//         email: email.toLowerCase(),
//         otp,
//         expiresAt,
//       })

//       console.log("[AUTH] OTP generated for:", email)

//       // Send OTP email
//       await emailService.sendOTPEmail(email, otp, name)

//       // Log registration
//       await AuditLog.create({
//         userId: user.id,
//         action: "REGISTER",
//         email,
//         ipAddress,
//         userAgent,
//         status: "SUCCESS",
//       })

//       res.status(201).json({
//         success: true,
//         message: "Registration successful. Please verify your email with OTP.",
//         userId: user.id,
//         email: user.email,
//         role: user.role,
//         requiresOTPVerification: true,
//       })
//     } catch (error) {
//       console.error("[AUTH] Register error:", error.message)
//       next(error)
//     }
//   },
  async register(req, res, next) {
    try {
      // 🟢 CHANGE: Added 'phone' to the destructuring
      const { email, password, name, role, phone } = req.body
      const ipAddress = getClientIP(req)
      const userAgent = getUserAgent(req)

      console.log("[AUTH] Registration attempt for:", email, "Role:", role)

      // Check if user exists
      const existingUser = await User.findByEmail(email)
      if (existingUser) {
        await AuditLog.create({
          userId: null,
          action: "REGISTER",
          email,
          ipAddress,
          userAgent,
          status: "FAILED",
          details: "Email already exists",
        })
        return res.status(400).json({
          success: false,
          error: "Email already registered",
        })
      }

      // 🟢 CHANGE: Enhanced Password Validation Response
      const passwordStrength = validatePasswordStrength(password)
      if (!passwordStrength.isStrong) {
        return res.status(400).json({
          success: false,
          error: "Password does not meet security requirements",
          requirements: passwordStrength.requirements,
          strength: passwordStrength.strength || 'Weak',
        })
      }

      // 🟢 CHANGE: Don't create user yet - store registration data in memory cache
      // Generate and send OTP
      const otp = generateOTP()
      const expiresAt = getOTPExpiry()

      // Store registration data temporarily in memory cache (expires with OTP)
      const registrationData = {
        name,
        email: email.toLowerCase(),
        password,
        role: role || "tenant",
        phone,
      }

      // Store in memory cache with expiration matching OTP expiry
      registrationCacheManager.set(email.toLowerCase(), registrationData, expiresAt)

      // Delete any existing OTP for this email first
      await OTP.deleteByEmail(email.toLowerCase())

      await OTP.create({
        email: email.toLowerCase(),
        otp,
        expiresAt,
      })

      console.log("[AUTH] OTP generated for registration:", email)

      // Send OTP email
      await emailService.sendOTPEmail(email, otp, name)

      // Log registration attempt (no user ID yet)
      await AuditLog.create({
        userId: null,
        action: "REGISTER",
        email,
        ipAddress,
        userAgent,
        status: "PENDING",
        details: "Registration data stored in cache, awaiting OTP verification",
      })

      res.status(201).json({
        success: true,
        message: "OTP sent to your email. Please verify to complete registration.",
        email: email.toLowerCase(),
        requiresOTPVerification: true,
      })
    } catch (error) {
      console.error("[AUTH] Register error:", error.message)
      next(error)
    }
  },
  // Verify OTP
  async verifyOTP(req, res, next) {
    try {
      const { email, otp } = req.body
      const ipAddress = getClientIP(req)
      const userAgent = getUserAgent(req)

      console.log("[AUTH] OTP verification attempt for:", email)

      // Get OTP record with registration data
      const otpRecord = await OTP.findByEmailAndOTP(email.toLowerCase(), otp)

      if (!otpRecord) {
        await AuditLog.create({
          userId: null,
          action: "OTP_VERIFY",
          email,
          ipAddress,
          userAgent,
          status: "FAILED",
          details: "Invalid OTP",
        })
        return res.status(400).json({
          success: false,
          error: "Invalid or expired OTP",
        })
      }

      // Check attempts
      if (otpRecord.attempts >= otpRecord.max_attempts) {
        await AuditLog.create({
          userId: null,
          action: "OTP_VERIFY",
          email,
          ipAddress,
          userAgent,
          status: "FAILED",
          details: "Max attempts exceeded",
        })
        return res.status(400).json({
          success: false,
          error: "Too many attempts. Request a new OTP.",
        })
      }

      // 🟢 NEW: Check if this is a new registration (has data in cache) or existing user verification
      const registrationData = registrationCacheManager.get(email.toLowerCase())
      
      if (registrationData) {
        // New registration - create user now
        // Check if user was created in the meantime (race condition)
        let user = await User.findByEmail(email)
        
        if (!user) {
          // Create the user
          user = await User.create({
            name: registrationData.name,
            email: registrationData.email,
            password: registrationData.password,
            role: registrationData.role,
            phone: registrationData.phone,
          })
          console.log("[AUTH] User created after OTP verification:", user.id)
          
          // Remove registration data from cache
          registrationCacheManager.delete(email.toLowerCase())
        } else {
          // User exists but not verified - mark as verified
          if (!user.is_email_verified) {
            await User.updateEmailVerification(user.id)
          }
          // Remove registration data from cache
          registrationCacheManager.delete(email.toLowerCase())
        }

        // Delete OTP record
        await OTP.deleteByEmail(email.toLowerCase())

        // Send verification success email
        await emailService.sendVerificationSuccessEmail(email, user.name)

        // Log verification
        await AuditLog.create({
          userId: user.id,
          action: "OTP_VERIFY",
          email,
          ipAddress,
          userAgent,
          status: "SUCCESS",
          details: "User created and verified",
        })

        // Generate tokens for auto-login
        const accessToken = tokenManager.generateAccessToken(user.id, user.role)
        const refreshToken = tokenManager.generateRefreshToken(user.id)

        // Create session
        await tokenManager.createSession(
          user.id,
          accessToken,
          refreshToken,
          ipAddress,
          userAgent
        )

        // Set cookies
        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 15 * 60 * 1000,
          path: "/",
        })
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/",
        })

        return res.json({
          success: true,
          message: "Email verified successfully. Your account has been created.",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profile_image,
            college: user.college,
            city: user.city,
          },
          accessToken,
          autoLogin: true,
        })
      } else {
        // Existing user - just verify email
        const user = await User.findByEmail(email)
        if (!user) {
          return res.status(404).json({
            success: false,
            error: "User not found",
          })
        }

        if (user.is_email_verified) {
          return res.status(400).json({
            success: false,
            error: "Email already verified",
          })
        }

        // Mark user as verified
        await User.updateEmailVerification(user.id)
        await OTP.deleteByEmail(email.toLowerCase())

      console.log("[AUTH] Email verified for:", email)

        // Send verification success email
        await emailService.sendVerificationSuccessEmail(email, user.name)

        // Log verification
        await AuditLog.create({
          userId: user.id,
          action: "OTP_VERIFY",
          email,
          ipAddress,
          userAgent,
          status: "SUCCESS",
        })

        // Generate tokens for auto-login after verification
        const accessToken = tokenManager.generateAccessToken(user.id, user.role)
        const refreshToken = tokenManager.generateRefreshToken(user.id)

        // Create session
        await tokenManager.createSession(
          user.id,
          accessToken,
          refreshToken,
          ipAddress,
          userAgent
        )

        // Set cookies
        res.cookie("accessToken", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 15 * 60 * 1000,
          path: "/",
        })
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: "/",
        })

        return res.json({
          success: true,
          message: "Email verified successfully.",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profile_image,
            college: user.college,
            city: user.city,
          },
          accessToken,
          autoLogin: true,
        })
      }
    } catch (error) {
      console.error("[AUTH] Verify OTP error:", error.message)
      next(error)
    }
  },

  // Resend OTP
  async resendOTP(req, res, next) {
    try {
      const { email } = req.body
      const ipAddress = getClientIP(req)
      const userAgent = getUserAgent(req)

      console.log("[AUTH] OTP resend attempt for:", email)

      // Check if this is a new registration (has data in cache) or existing user verification
      const registrationData = registrationCacheManager.get(email.toLowerCase())

      // If no registration data in cache, check if user exists (for email verification resend)
      if (!registrationData) {
        const user = await User.findByEmail(email)
        if (!user) {
          return res.status(404).json({
            success: false,
            error: "No pending registration or user found",
          })
        }

        // Check if already verified
        if (user.is_email_verified) {
          return res.status(400).json({
            success: false,
            error: "Email already verified",
          })
        }
      }

      // Delete old OTP
      await OTP.deleteByEmail(email.toLowerCase())

      // Generate new OTP
      const otp = generateOTP()
      const expiresAt = getOTPExpiry()

      // If this is a new registration, update cache with new expiry
      if (registrationData) {
        registrationCacheManager.set(email.toLowerCase(), registrationData, expiresAt)
      }

      await OTP.create({
        email: email.toLowerCase(),
        otp,
        expiresAt,
      })

      // Send OTP email - use name from registration data or user
      const name = registrationData?.name || (await User.findByEmail(email))?.name || email
      await emailService.sendOTPEmail(email, otp, name)

      // Log OTP resent
      await AuditLog.create({
        userId: user.id,
        action: "OTP_RESEND",
        email,
        ipAddress,
        userAgent,
        status: "SUCCESS",
      })

      console.log("[AUTH] OTP resent for:", email)

      res.json({
        success: true,
        message: "OTP resent successfully. Check your email.",
        email: user.email,
      })
    } catch (error) {
      console.error("[AUTH] Resend OTP error:", error.message)
      next(error)
    }
  },

  // ---------------------------------------------------------------------
  // --- 2. Login & Role Check ---
  // ---------------------------------------------------------------------

  async getUserRoleByEmail(req, res, next) {
    try {
      const { email } = req.query;

      console.log("[AUTH] Get user role attempt for:", email);

      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        role: user.role,
      });
    } catch (error) {
      console.error("[AUTH] Get user role error:", error.message);
      next(error);
    }
  },

  // Login with role-based session
  async login(req, res, next) {
  try {
    const { email, password, role } = req.body
    const ipAddress = getClientIP(req)
    const userAgent = getUserAgent(req)

    console.log("[AUTH] Login attempt for:", email, "Role:", role)

    // 1️⃣ Find user
    const user = await User.findByEmail(email)
    if (!user) {
      await AuditLog.create({
        userId: null,
        action: "LOGIN",
        email,
        ipAddress,
        userAgent,
        status: "FAILED",
        details: "User not found",
      })
      return res.status(401).json({ success: false, error: "Invalid email or password" })
    }

    // 2️⃣ Check role
    if (user.role !== role) {
      await AuditLog.create({
        userId: user.id,
        action: "LOGIN",
        email,
        ipAddress,
        userAgent,
        status: "FAILED",
        details: `Role mismatch. Expected: ${user.role}, Got: ${role}`,
      })
      return res.status(401).json({
        success: false,
        error: `This account is registered as a ${user.role}, not a ${role}`,
      })
    }

    // 3️⃣ Check active and verified
    if (!user.is_active) {
      return res.status(401).json({ success: false, error: "Account is deactivated" })
    }
    if (!user.is_email_verified) {
      return res.status(401).json({
        success: false,
        error: "Email not verified. Please verify with OTP first.",
        requiresOTPVerification: true,
        email: user.email,
      })
    }

    // 4️⃣ Verify password
    const userWithPassword = await User.findByIdWithPassword(user.id)
    const isPasswordValid = await User.verifyPassword(password, userWithPassword.password)
    if (!isPasswordValid) {
      await AuditLog.create({
        userId: user.id,
        action: "LOGIN",
        email,
        ipAddress,
        userAgent,
        status: "FAILED",
        details: "Invalid password",
      })
      return res.status(401).json({ success: false, error: "Invalid email or password" })
    }

    // 5️⃣ Generate tokens first
    const accessToken = tokenManager.generateAccessToken(user.id, user.role)
    const refreshToken = tokenManager.generateRefreshToken(user.id)

    // 6️⃣ Create session with tokens
    const session = await tokenManager.createSession(
      user.id,
      accessToken,
      refreshToken,
      ipAddress,
      userAgent
    )

    // 7️⃣ Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
      path: "/",
    })
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    })

    // 8️⃣ Log login success
    await AuditLog.create({
      userId: user.id,
      action: "LOGIN",
      email,
      ipAddress,
      userAgent,
      status: "SUCCESS",
    })

    // 9️⃣ Return user info and access token (refresh token is in cookie)
    res.json({
      success: true,
      message: "Login successful",
      accessToken: accessToken, // Also return in response for frontend to store
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profile_image,
        college: user.college,
        city: user.city,
        phone: user.phone,
      },
    })
  } catch (error) {
    console.error("[AUTH] Login error:", error.message)
    next(error)
  }
},

  // ---------------------------------------------------------------------
  // --- 3. Password Reset Flow (NEW) ---
  // ---------------------------------------------------------------------

  async forgotPassword(req, res, next) {
    try {
        const { email } = req.body
        const ipAddress = getClientIP(req)
        const userAgent = getUserAgent(req)

        console.log("[AUTH] Forgot password attempt for:", email)

        // 1. Find user
        const user = await User.findByEmail(email)
        if (!user) {
            await AuditLog.create({
                userId: null,
                action: "FORGOT_PASSWORD",
                email,
                ipAddress,
                userAgent,
                status: "FAILED",
                details: "Email not found (handled generically)",
            })
            // Generic response to prevent email enumeration
            return res.status(200).json({
                success: true,
                message: "If a user with that email exists, a password reset link has been sent.",
            })
        }

        // 2. Generate secure token
        const resetToken = crypto.randomBytes(32).toString("hex")
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex")
        const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

        // 3. Save hashed token and expiry safely
        await User.setResetToken(user.id, hashedToken, expiry)

        // 4. Send email with UNHASHED token
        await emailService.sendPasswordResetEmail(user.email, resetToken, user.name)

        // 5. Log the action
        await AuditLog.create({
            userId: user.id,
            action: "FORGOT_PASSWORD",
            email: user.email,
            ipAddress,
            userAgent,
            status: "SUCCESS",
        })

        res.status(200).json({
            success: true,
            message: "A password reset link has been sent to your email address.",
        })
    } catch (error) {
        console.error("[AUTH] Forgot password error:", error)
        next(error)
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body
      const ipAddress = getClientIP(req)
      const userAgent = getUserAgent(req)

      console.log("[AUTH] Reset password attempt via token.")

      if (!token || !newPassword) {
        return res.status(400).json({ success: false, error: "Token and new password are required." })
      }

      // 1. Hash the incoming token for database lookup
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

      // 2. Find user by HASHED token and check for expiration
      const user = await User.findByResetToken(hashedToken)

      if (!user) {
        // Log failure
        await AuditLog.create({
          userId: null, // No user ID if token is bad/expired
          action: "RESET_PASSWORD",
          email: "Unknown",
          ipAddress,
          userAgent,
          status: "FAILED",
          details: "Invalid or expired token",
        })
        return res.status(400).json({
          success: false,
          error: "Invalid or expired password reset link.",
        })
      }

      // 3. Validate new password strength
      const passwordStrength = validatePasswordStrength(newPassword)
      if (!passwordStrength.isStrong) {
        await AuditLog.create({
          userId: user.id,
          action: "RESET_PASSWORD",
          email: user.email,
          ipAddress,
          userAgent,
          status: "FAILED",
          details: "Password failed strength requirements",
        })
        return res.status(400).json({
          success: false,
          error: "Password does not meet security requirements",
          requirements: passwordStrength.requirements,
        })
      }

      // 4. Update password and CLEAR tokens
      await User.updatePassword(user.id, newPassword)
      console.log(`[AUTH] Password successfully reset for: ${user.email}`)

      // 5. Log Success
      await AuditLog.create({
        userId: user.id,
        action: "RESET_PASSWORD",
        email: user.email,
        ipAddress,
        userAgent,
        status: "SUCCESS",
      })

      res.status(200).json({
        success: true,
        message: "Password has been successfully reset. You can now log in.",
      })

    } catch (error) {
      console.error("[AUTH] Reset password error:", error.message)
      next(error)
    }
  },

  // ---------------------------------------------------------------------
  // --- 4. Session Management ---
  // ---------------------------------------------------------------------

  // Get current user
  async getCurrentUser(req, res, next) {
    try {
      const user = await User.findById(req.user.userId)
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.is_email_verified,
          isActive: user.is_active,
          profileImage: user.profile_image,
          college: user.college,
          city: user.city,
          rating: user.rating,
          totalRatings: user.total_ratings,
          createdAt: user.created_at,
        },
      })
    } catch (error) {
      console.error("[AUTH] Get current user error:", error.message)
      next(error)
    }
  },
async logout(req, res, next) {
    try {
      const token = req.token
      const ipAddress = getClientIP(req)
      const userAgent = getUserAgent(req)

      if (token) {
        await tokenManager.revokeSession(token)
      }

      // Clear cookies
      res.clearCookie("accessToken", { path: "/" })
      res.clearCookie("refreshToken", { path: "/" })

      // Log logout
      await AuditLog.create({
        userId: req.user?.userId || null,
        action: "LOGOUT",
        email: req.user?.email || null,
        ipAddress,
        userAgent,
        status: "SUCCESS",
      })

      console.log("[AUTH] Logout for user:", req.user?.userId)

      res.json({
        success: true,
        message: "Logout successful",
      })
    } catch (error) {
      console.error("[AUTH] Logout error:", error.message)
      next(error)
    }
  },

  // Update user profile
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.userId
      const updates = req.body
      const ipAddress = getClientIP(req)
      const userAgent = getUserAgent(req)

      console.log("[AUTH] Profile update attempt for user:", userId)

      // Update user
      const updatedUser = await User.update(userId, updates)

      if (!updatedUser) {
        return res.status(400).json({
          success: false,
          error: "No valid fields to update",
        })
      }

      // Log profile update
      await AuditLog.create({
        userId,
        action: "UPDATE_PROFILE",
        email: updatedUser.email,
        ipAddress,
        userAgent,
        status: "SUCCESS",
        details: `Updated fields: ${Object.keys(updates).join(", ")}`,
      })

      res.json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          phone: updatedUser.phone,
          college: updatedUser.college,
          city: updatedUser.city,
          profileImage: updatedUser.profile_image,
          rating: updatedUser.rating,
          totalRatings: updatedUser.total_ratings,
        },
      })
    } catch (error) {
      console.error("[AUTH] Update profile error:", error.message)
      next(error)
    }
  },

  // Refresh token
  // Refresh token
async refreshToken(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if (!refreshToken)
      return res.status(400).json({ success: false, error: "Refresh token required" })

    const decoded = tokenManager.verifyRefreshToken(refreshToken)
    if (!decoded || !decoded.sessionId)
      return res.status(401).json({ success: false, error: "Invalid or expired refresh token" })

    // Get session
    const session = await tokenManager.getSession(decoded.sessionId)
    if (!session)
      return res.status(401).json({ success: false, error: "Session not found" })

    // Get user
    const user = await User.findById(decoded.userId)
    if (!user || !user.is_active)
      return res.status(404).json({ success: false, error: "User not found or inactive" })

    // Generate new access token WITH sessionId
    const newAccessToken = tokenManager.generateAccessToken(user.id, user.role, session._id)

    // Save new access token in session
    session.token = newAccessToken
    await session.save()

    // Set cookie
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: "/",
    })

    console.log("[AUTH] Token refreshed for user:", user.id)

    res.json({ success: true, accessToken: newAccessToken })
  } catch (error) {
    console.error("[AUTH] Refresh token error:", error.message)
    next(error)
  }
},
}

export default authController