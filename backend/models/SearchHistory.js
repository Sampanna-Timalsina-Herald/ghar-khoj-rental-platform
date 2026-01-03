import { db } from "../config/database.js"
import { v4 as uuidv4 } from "uuid"

export class SearchHistory {
  static async create(userId, searchData) {
    const { searchQuery, filters, resultsCount, searchType = "listing" } = searchData

    const query = `
      INSERT INTO search_history (id, user_id, search_query, filters, results_count, search_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `

    const values = [uuidv4(), userId, searchQuery, JSON.stringify(filters), resultsCount, searchType]

    const result = await db.query(query, values)
    return result.rows[0]
  }

  static async getUserSearchHistory(userId, limit = 50) {
    const query = `
      SELECT * FROM search_history 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2;
    `
    const result = await db.query(query, [userId, limit])
    return result.rows
  }

  static async getSearchesByTimeRange(userId, days = 30) {
    const query = `
      SELECT * FROM search_history 
      WHERE user_id = $1 
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $2
      ORDER BY created_at DESC;
    `
    const result = await db.query(query, [userId, days])
    return result.rows
  }

  static async getPopularSearches(limit = 10) {
    const query = `
      SELECT search_query, COUNT(*) as search_count
      FROM search_history
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY search_query
      ORDER BY search_count DESC
      LIMIT $1;
    `
    const result = await db.query(query, [limit])
    return result.rows
  }
}
