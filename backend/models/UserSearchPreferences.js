import { db } from "../config/database.js"
import { v4 as uuidv4 } from "uuid"

export class UserSearchPreferences {
  static async getOrCreate(userId) {
    let query = `
      SELECT * FROM user_search_preferences WHERE user_id = $1;
    `
    let result = await db.query(query, [userId])

    if (result.rows.length > 0) {
      return result.rows[0]
    }

    // Create if doesn't exist
    query = `
      INSERT INTO user_search_preferences (id, user_id)
      VALUES ($1, $2)
      RETURNING *;
    `
    result = await db.query(query, [uuidv4(), userId])
    return result.rows[0]
  }

  static async updatePreferences(userId, preferences) {
    const {
      preferredCities,
      preferredColleges,
      avgMinRent,
      avgMaxRent,
      avgBedrooms,
      avgBathrooms,
      preferredAmenities,
    } = preferences

    const query = `
      UPDATE user_search_preferences
      SET 
        preferred_cities = COALESCE($2, preferred_cities),
        preferred_colleges = COALESCE($3, preferred_colleges),
        avg_min_rent = COALESCE($4, avg_min_rent),
        avg_max_rent = COALESCE($5, avg_max_rent),
        avg_bedrooms = COALESCE($6, avg_bedrooms),
        avg_bathrooms = COALESCE($7, avg_bathrooms),
        preferred_amenities = COALESCE($8, preferred_amenities),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *;
    `

    const values = [
      userId,
      preferredCities ? JSON.stringify(preferredCities) : null,
      preferredColleges ? JSON.stringify(preferredColleges) : null,
      avgMinRent,
      avgMaxRent,
      avgBedrooms,
      avgBathrooms,
      preferredAmenities ? JSON.stringify(preferredAmenities) : null,
    ]

    const result = await db.query(query, values)
    return result.rows[0]
  }

  static async incrementSearchCount(userId) {
    const query = `
      UPDATE user_search_preferences
      SET total_searches = total_searches + 1
      WHERE user_id = $1
      RETURNING *;
    `
    const result = await db.query(query, [userId])
    return result.rows[0]
  }
}
