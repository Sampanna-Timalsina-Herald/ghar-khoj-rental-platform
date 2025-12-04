import { AuditLog } from "../models/AuditLog.js"

export const auditLogger = {
  async logAction(userId, action, details, ipAddress) {
    try {
      const log = new AuditLog({
        userId,
        action,
        details,
        ipAddress,
      })
      await log.save()
    } catch (error) {
      console.error("[v0] Error logging audit action:", error)
    }
  },

  async logRegistration(userId, email, ipAddress) {
    await this.logAction(userId, "USER_REGISTRATION", { email }, ipAddress)
  },

  async logLogin(userId, ipAddress) {
    await this.logAction(userId, "USER_LOGIN", {}, ipAddress)
  },

  async logOTPVerification(userId, ipAddress) {
    await this.logAction(userId, "OTP_VERIFICATION", {}, ipAddress)
  },

  async logFailedLogin(email, ipAddress) {
    await this.logAction(null, "FAILED_LOGIN_ATTEMPT", { email }, ipAddress)
  },

  async logPasswordChange(userId, ipAddress) {
    await this.logAction(userId, "PASSWORD_CHANGED", {}, ipAddress)
  },
}
