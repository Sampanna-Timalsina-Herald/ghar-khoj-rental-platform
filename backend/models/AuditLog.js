import { query } from "../config/database.js"
import { v4 as uuidv4 } from "uuid"

export class AuditLog {
  static async create(logData) {
    const { userId = null, action, email = null, ipAddress, userAgent, status = "SUCCESS", details = null } = logData

    const text = `
      INSERT INTO audit_logs (id, user_id, action, entity_type, changes, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, action, entity_type, changes, ip_address, created_at
    `

    const changeDetails = {
      email,
      userAgent,
      status,
      details,
    }

    const values = [uuidv4(), userId, action, "AUTH", JSON.stringify(changeDetails), ipAddress]

    const result = await query(text, values)
    return result.rows[0]
  }

  static async findByUserId(userId, limit = 20) {
    const text = `
      SELECT id, user_id, action, changes, ip_address, created_at
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `
    const result = await query(text, [userId, limit])
    return result.rows
  }

  static async findByAction(action, limit = 50) {
    const text = `
      SELECT id, user_id, action, changes, ip_address, created_at
      FROM audit_logs
      WHERE action = $1
      ORDER BY created_at DESC
      LIMIT $2
    `
    const result = await query(text, [action, limit])
    return result.rows
  }
}

export default AuditLog
