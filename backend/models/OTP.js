import { query } from "../config/database.js"
import { v4 as uuidv4 } from "uuid"

export class OTP {
  static async create(otpData) {
    const { email, otp, expiresAt } = otpData

    const text = `
      INSERT INTO otps (id, email, otp, attempts, max_attempts, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, otp, attempts, max_attempts, expires_at, created_at
    `

    const values = [uuidv4(), email.toLowerCase(), otp, 0, 5, expiresAt]

    const result = await query(text, values)
    return result.rows[0]
  }

  static async findByEmailAndOTP(email, otp) {
    const text = `
      SELECT * FROM otps 
      WHERE email = $1 AND otp = $2 AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `
    const result = await query(text, [email.toLowerCase(), otp])
    return result.rows[0] || null
  }

  static async incrementAttempts(otpId) {
    const text = `
      UPDATE otps 
      SET attempts = attempts + 1
      WHERE id = $1
      RETURNING id, email, attempts, max_attempts
    `
    const result = await query(text, [otpId])
    return result.rows[0]
  }

  static async deleteByEmail(email) {
    const text = "DELETE FROM otps WHERE email = $1"
    await query(text, [email.toLowerCase()])
  }

  static async findLatestByEmail(email) {
    const text = `
      SELECT * FROM otps 
      WHERE email = $1
      ORDER BY created_at DESC
      LIMIT 1
    `
    const result = await query(text, [email.toLowerCase()])
    return result.rows[0] || null
  }

  static async deleteExpiredOTPs() {
    const text = "DELETE FROM otps WHERE expires_at < CURRENT_TIMESTAMP"
    await query(text)
  }
}

export default OTP
