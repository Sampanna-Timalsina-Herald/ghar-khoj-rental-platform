import { db } from "../config/database.js"
import { v4 as uuidv4 } from "uuid"

export class ListingView {
  static async track(userId, listingId, viewData) {
    const { viewDurationSeconds = 0, interactionType = "view", deviceType = "web" } = viewData

    const query = `
      INSERT INTO listing_views (id, user_id, listing_id, view_duration_seconds, interaction_type, device_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `

    const values = [uuidv4(), userId, listingId, viewDurationSeconds, interactionType, deviceType]
    const result = await db.query(query, values)
    return result.rows[0]
  }

  static async getListingPopularity(listingId, days = 7) {
    const query = `
      SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT user_id) as unique_views,
        AVG(view_duration_seconds) as avg_duration,
        COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) as likes_count
      FROM listing_views
      WHERE listing_id = $1
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $2;
    `
    const result = await db.query(query, [listingId, days])
    return result.rows[0]
  }

  static async getUserViewHistory(userId, limit = 50) {
    const query = `
      SELECT lv.*, l.title, l.address, l.rent_amount
      FROM listing_views lv
      JOIN listings l ON lv.listing_id = l.id
      WHERE lv.user_id = $1
      ORDER BY lv.created_at DESC
      LIMIT $2;
    `
    const result = await db.query(query, [userId, limit])
    return result.rows
  }
}
