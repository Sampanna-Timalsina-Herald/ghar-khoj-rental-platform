import nodemailer from "nodemailer"
import { config } from "../config/environment.js"

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASSWORD,
  },
})

export const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: config.EMAIL_FROM,
      to,
      subject,
      html,
    }

    await transporter.sendMail(mailOptions)
    return { success: true, message: "Email sent successfully" }
  } catch (error) {
    console.error("[EMAIL ERROR]", error)
    throw new Error("Failed to send email")
  }
}

export const emailService = {
  // Send OTP email
  async sendOTPEmail(email, otp, userName) {
    try {
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: email,
        subject: "GharKhoj - Email Verification OTP",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to GharKhoj, ${userName}!</h2>
            <p style="color: #666; font-size: 16px;">Your OTP for email verification is:</p>
            <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="color: #007bff; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      }

      await transporter.sendMail(mailOptions)
      return { success: true, message: "OTP sent successfully" }
    } catch (error) {
      console.error("Error sending OTP email:", error)
      throw new Error("Failed to send OTP email")
    }
  },

  // Send verification success email
  async sendVerificationSuccessEmail(email, userName) {
    try {
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: email,
        subject: "GharKhoj - Email Verified Successfully",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Email Verified Successfully!</h2>
            <p style="color: #666; font-size: 16px;">Hi ${userName},</p>
            <p style="color: #666; font-size: 16px;">Your email has been verified. You can now access all features of GharKhoj.</p>
            <p style="color: #666; font-size: 16px;">Happy searching for your perfect rental!</p>
          </div>
        `,
      }

      await transporter.sendMail(mailOptions)
      return { success: true }
    } catch (error) {
      console.error("Error sending verification email:", error)
    }
  },

  // Send login notification
  async sendLoginNotificationEmail(email, userName, ipAddress) {
    try {
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: email,
        subject: "GharKhoj - New Login Detected",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Login Detected</h2>
            <p style="color: #666; font-size: 16px;">Hi ${userName},</p>
            <p style="color: #666; font-size: 16px;">A new login to your account was detected from IP: ${ipAddress}</p>
            <p style="color: #666; font-size: 14px;">If this wasn't you, please change your password immediately.</p>
          </div>
        `,
      }

      await transporter.sendMail(mailOptions)
    } catch (error) {
      console.error("Error sending login notification:", error)
    }
  },

  // Send password reset email
  async sendPasswordResetEmail(email, resetToken, userName) {
    try {
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: email,
        subject: "GharKhoj - Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="color: #666; font-size: 16px;">Hi ${userName},</p>
            <p style="color: #666; font-size: 16px;">Click the link below to reset your password:</p>
            <a href="${resetLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
            <p style="color: #999; font-size: 12px;">This link will expire in 1 hour.</p>
          </div>
        `,
      }

      await transporter.sendMail(mailOptions)
      return { success: true }
    } catch (error) {
      console.error("Error sending password reset email:", error)
      throw new Error("Failed to send password reset email")
    }
  },
}
