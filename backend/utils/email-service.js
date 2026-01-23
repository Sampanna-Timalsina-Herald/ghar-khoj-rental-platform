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

  // Send new listing notification to users with matching preferences
  async sendNewListingNotification(email, userName, listing) {
    try {
      console.log('[EMAIL-SERVICE] Preparing to send email to:', email);
      console.log('[EMAIL-SERVICE] Listing data:', {
        id: listing.id,
        title: listing.title,
        has_images: listing.images && listing.images.length > 0
      });

      const listingLink = `${config.FRONTEND_URL || 'http://localhost:5173'}/listing/${listing.id}`
      const imageUrl = listing.images && listing.images.length > 0 
        ? `${config.FRONTEND_URL || 'http://localhost:5173'}${listing.images[0]}`
        : 'https://via.placeholder.com/600x400?text=Property+Image'
      
      // Format amenities if available
      const amenitiesList = listing.amenities && listing.amenities.length > 0
        ? listing.amenities.map(a => `<span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 12px; margin: 4px; font-size: 13px;">✓ ${a}</span>`).join('')
        : '<span style="color: #999;">No amenities listed</span>'

      console.log('[EMAIL-SERVICE] Email config:', {
        from: config.EMAIL_FROM,
        to: email,
        has_user: !!config.EMAIL_USER,
        has_password: !!config.EMAIL_PASSWORD
      });

      const mailOptions = {
        from: config.EMAIL_FROM,
        to: email,
        subject: "🏠 GharKhoj - New Property Matching Your Preferences!",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f7fa;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 40px 20px;">
                  <!-- Main Container -->
                  <table role="presentation" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 3px; border-radius: 16px;">
                    <tr>
                      <td style="background: white; border-radius: 14px; padding: 0;">
                        
                        <!-- Header Section -->
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 14px 14px 0 0; text-align: center;">
                              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                                🏠 New Property Alert!
                              </h1>
                              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.95); font-size: 16px;">
                                A property matching your preferences is now available
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Greeting Section -->
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="padding: 30px 30px 20px 30px;">
                              <p style="margin: 0; color: #333; font-size: 18px; line-height: 1.6;">
                                Hi <strong style="color: #667eea;">${userName}</strong>,
                              </p>
                              <p style="margin: 15px 0 0 0; color: #666; font-size: 16px; line-height: 1.6;">
                                Great news! We found a property that matches your preferences. Check it out below:
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Property Image -->
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="padding: 0 30px;">
                              <img src="${imageUrl}" alt="${listing.title}" style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px; display: block; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" />
                            </td>
                          </tr>
                        </table>

                        <!-- Property Details Card -->
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="padding: 30px;">
                              <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                                
                                <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: bold;">
                                  ${listing.title}
                                </h2>
                                
                                <!-- Key Details Grid -->
                                <table role="presentation" style="width: 100%; margin-bottom: 20px;">
                                  <tr>
                                    <td style="padding: 12px; background: white; border-radius: 8px; margin-bottom: 10px; width: 48%; vertical-align: top;">
                                      <span style="font-size: 20px;">📍</span>
                                      <strong style="color: #475569; font-size: 14px;">Location</strong>
                                      <div style="color: #1e293b; font-size: 15px; margin-top: 5px; font-weight: 600;">
                                        ${listing.address}, ${listing.city}
                                      </div>
                                    </td>
                                    <td style="width: 4%;"></td>
                                    <td style="padding: 12px; background: white; border-radius: 8px; width: 48%; vertical-align: top;">
                                      <span style="font-size: 20px;">💰</span>
                                      <strong style="color: #475569; font-size: 14px;">Monthly Rent</strong>
                                      <div style="color: #16a34a; font-size: 18px; margin-top: 5px; font-weight: bold;">
                                        Rs. ${listing.rent_amount?.toLocaleString()}/mo
                                      </div>
                                    </td>
                                  </tr>
                                </table>

                                <!-- Property Features -->
                                <table role="presentation" style="width: 100%; margin-bottom: 20px;">
                                  <tr>
                                    <td style="padding: 12px; background: white; border-radius: 8px; width: 32%; text-align: center; vertical-align: top;">
                                      <div style="font-size: 24px; margin-bottom: 5px;">🛏️</div>
                                      <div style="color: #1e293b; font-size: 18px; font-weight: bold;">${listing.bedrooms}</div>
                                      <div style="color: #64748b; font-size: 13px;">Bedrooms</div>
                                    </td>
                                    <td style="width: 2%;"></td>
                                    <td style="padding: 12px; background: white; border-radius: 8px; width: 32%; text-align: center; vertical-align: top;">
                                      <div style="font-size: 24px; margin-bottom: 5px;">🚿</div>
                                      <div style="color: #1e293b; font-size: 18px; font-weight: bold;">${listing.bathrooms}</div>
                                      <div style="color: #64748b; font-size: 13px;">Bathrooms</div>
                                    </td>
                                    <td style="width: 2%;"></td>
                                    <td style="padding: 12px; background: white; border-radius: 8px; width: 32%; text-align: center; vertical-align: top;">
                                      <div style="font-size: 24px; margin-bottom: 5px;">🏢</div>
                                      <div style="color: #1e293b; font-size: 16px; font-weight: bold;">${listing.type}</div>
                                      <div style="color: #64748b; font-size: 13px;">Property Type</div>
                                    </td>
                                  </tr>
                                </table>

                                ${listing.college_name ? `
                                <div style="padding: 12px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 8px; margin-bottom: 20px;">
                                  <span style="font-size: 18px;">🎓</span>
                                  <strong style="color: #1e40af; margin-left: 8px;">Near ${listing.college_name}</strong>
                                </div>
                                ` : ''}

                                <!-- Amenities -->
                                ${listing.amenities && listing.amenities.length > 0 ? `
                                <div style="margin-top: 20px;">
                                  <strong style="color: #475569; font-size: 14px; display: block; margin-bottom: 10px;">✨ Amenities:</strong>
                                  <div style="line-height: 2;">
                                    ${amenitiesList}
                                  </div>
                                </div>
                                ` : ''}

                              </div>
                            </td>
                          </tr>
                        </table>

                        <!-- CTA Button -->
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="padding: 0 30px 30px 30px; text-align: center;">
                              <a href="${listingLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                                🏠 View Property Details
                              </a>
                              <p style="margin: 20px 0 0 0; color: #64748b; font-size: 14px;">
                                Act fast! Properties matching your preferences are in high demand.
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Footer -->
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td style="padding: 25px 30px; background: #f8fafc; border-radius: 0 0 14px 14px; border-top: 1px solid #e2e8f0;">
                              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                                <strong>💡 Quick Tip:</strong> Contact the landlord soon to schedule a viewing and secure this property!
                              </p>
                              <p style="margin: 15px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                                You're receiving this email because you've set up property preferences on GharKhoj. 
                                You can update your preferences anytime in your <a href="${config.FRONTEND_URL}/tenant/profile" style="color: #667eea; text-decoration: none;">profile settings</a>.
                              </p>
                              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                                <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                                  © 2026 GharKhoj - Your trusted rental platform
                                </p>
                              </div>
                            </td>
                          </tr>
                        </table>

                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }

      console.log('[EMAIL-SERVICE] Attempting to send email...');
      const result = await transporter.sendMail(mailOptions);
      console.log('[EMAIL-SERVICE] ✅ Email sent successfully to:', email);
      console.log('[EMAIL-SERVICE] Message ID:', result.messageId);
      return { success: true }
    } catch (error) {
      console.error("[EMAIL-SERVICE] ❌ Error sending new listing notification:", error);
      console.error("[EMAIL-SERVICE] Error message:", error.message);
      console.error("[EMAIL-SERVICE] Error code:", error.code);
      throw new Error("Failed to send listing notification: " + error.message);
    }
  },
}
