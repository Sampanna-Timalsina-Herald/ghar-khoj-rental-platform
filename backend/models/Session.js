import { query } from "../config/database.js"
import { v4 as uuidv4 } from "uuid"

export class Session {
  static async create(sessionData) {
    const { userId, token, refreshToken, expiresAt, refreshTokenExpiresAt, ipAddress, userAgent } = sessionData

    const text = `
      INSERT INTO sessions (id, user_id, token, expires_at, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, token, expires_at, is_active, created_at
    `

    const values = [uuidv4(), userId, token, expiresAt, true]

    const result = await query(text, values)
    return result.rows[0]
  }

  static async findByToken(token) {
    const text = `
      SELECT s.*, u.id as user_id, u.role, u.is_active
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP AND s.is_active = true
      LIMIT 1
    `
    const result = await query(text, [token])
    return result.rows[0] || null
  }

  static async findByUserId(userId) {
    const text = `
      SELECT id, user_id, token, expires_at, is_active, created_at
      FROM sessions
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `
    const result = await query(text, [userId])
    return result.rows
  }

  static async revokeToken(token) {
    const text = `
      UPDATE sessions
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE token = $1
    `
    await query(text, [token])
  }

  static async revokeAllUserSessions(userId) {
    const text = `
      UPDATE sessions
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `
    await query(text, [userId])
  }

  static async deleteExpiredSessions() {
    const text = "DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP"
    await query(text)
  }
}

export default Session
