import { AIRecommendationService } from "../services/ai-recommendation-service.js"
import { Recommendation } from "../models/Recommendation.js"
import { UserSearchPreferences } from "../models/UserSearchPreferences.js"
import { SearchHistory } from "../models/SearchHistory.js"
import { ListingView } from "../models/ListingView.js"

export class RecommendationController {
  // Get personalized recommendations for user
  static async getRecommendations(req, res) {
    try {
      const userId = req.user.userId
      const { type = "all", limit = 20 } = req.query

      let recommendations

      if (type === "all") {
        recommendations = await Recommendation.getUserRecommendations(userId, limit)
      } else {
        recommendations = await Recommendation.getRecommendationsByType(userId, type, limit)
      }

      res.json({
        success: true,
        count: recommendations.length,
        type,
        data: recommendations,
      })
    } catch (error) {
      console.error("[v0] Error fetching recommendations:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Generate fresh recommendations (trigger manually)
  static async generateRecommendations(req, res) {
    try {
      const userId = req.user.userId
      const recommendations = await AIRecommendationService.generateAllRecommendations(userId)

      res.json({
        success: true,
        message: "Recommendations generated successfully",
        count: recommendations.length,
        data: recommendations.slice(0, 20),
      })
    } catch (error) {
      console.error("[v0] Error generating recommendations:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Dismiss a recommendation
  static async dismissRecommendation(req, res) {
    try {
      const { recommendationId } = req.params
      const updated = await Recommendation.dismissRecommendation(recommendationId)

      res.json({
        success: true,
        message: "Recommendation dismissed",
        data: updated,
      })
    } catch (error) {
      console.error("[v0] Error dismissing recommendation:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Track recommendation click
  static async trackRecommendationClick(req, res) {
    try {
      const { recommendationId } = req.params
      const updated = await Recommendation.trackRecommendationClick(recommendationId)

      res.json({
        success: true,
        message: "Click tracked",
        data: updated,
      })
    } catch (error) {
      console.error("[v0] Error tracking click:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Get user search preferences
  static async getUserPreferences(req, res) {
    try {
      const userId = req.user.userId
      const prefs = await UserSearchPreferences.getOrCreate(userId)

      res.json({
        success: true,
        data: prefs,
      })
    } catch (error) {
      console.error("[v0] Error fetching preferences:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Update user search preferences
  static async updateUserPreferences(req, res) {
    try {
      const userId = req.user.userId
      const preferences = req.body

      const updated = await UserSearchPreferences.updatePreferences(userId, preferences)

      res.json({
        success: true,
        message: "Preferences updated",
        data: updated,
      })
    } catch (error) {
      console.error("[v0] Error updating preferences:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Get search history
  static async getSearchHistory(req, res) {
    try {
      const userId = req.user.userId
      const { limit = 50, days = 30 } = req.query

      let history
      if (days) {
        history = await SearchHistory.getSearchesByTimeRange(userId, days)
      } else {
        history = await SearchHistory.getUserSearchHistory(userId, limit)
      }

      res.json({
        success: true,
        count: history.length,
        data: history,
      })
    } catch (error) {
      console.error("[v0] Error fetching search history:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Get popular searches
  static async getPopularSearches(req, res) {
    try {
      const { limit = 10 } = req.query
      const searches = await SearchHistory.getPopularSearches(limit)

      res.json({
        success: true,
        count: searches.length,
        data: searches,
      })
    } catch (error) {
      console.error("[v0] Error fetching popular searches:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Get listing view history
  static async getListingViewHistory(req, res) {
    try {
      const userId = req.user.userId
      const { limit = 50 } = req.query
      const history = await ListingView.getUserViewHistory(userId, limit)

      res.json({
        success: true,
        count: history.length,
        data: history,
      })
    } catch (error) {
      console.error("[v0] Error fetching view history:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Get trending listings
  static async getTrendingListings(req, res) {
    try {
      const { limit = 10 } = req.query
      const query = `
        SELECT t.*, l.title, l.address, l.rent_amount, l.bedrooms, l.bathrooms, l.city
        FROM trending_listings t
        JOIN listings l ON t.listing_id = l.id
        ORDER BY t.trend_score DESC
        LIMIT $1;
      `

      const { db } = await import("../config/database.js")
      const result = await db.query(query, [limit])

      res.json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      })
    } catch (error) {
      console.error("[v0] Error fetching trending listings:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
}
