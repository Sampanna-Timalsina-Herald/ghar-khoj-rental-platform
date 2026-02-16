import { AIRecommendationService } from "../services/ai-recommendation-service.js"
import { Recommendation } from "../models/Recommendation.js"
import { UserSearchPreferences } from "../models/UserSearchPreferences.js"
import { SearchHistory } from "../models/SearchHistory.js"
import { ListingView } from "../models/ListingView.js"
import mlRecommendationService from "../services/ml-recommendation-service.js"
import { MLRecommendation } from "../models/MLRecommendation.js"
import { MLUserInteraction } from "../models/MLUserInteraction.js"

export class RecommendationController {
  // Get personalized recommendations for user (includes ML recommendations)
  static async getRecommendations(req, res) {
    try {
      const userId = req.user.id
      const { type = "all", limit = 20, algorithm = "hybrid" } = req.query

      let recommendations

      // Use ML recommendations if specified
      if (algorithm === "ml" || algorithm === "content_based" || algorithm === "cold_start") {
        recommendations = await MLRecommendation.getUserRecommendations(userId, limit, algorithm === "ml" ? null : algorithm)
      } else if (type === "all") {
        recommendations = await Recommendation.getUserRecommendations(userId, limit)
      } else {
        recommendations = await Recommendation.getRecommendationsByType(userId, type, limit)
      }

      res.json({
        success: true,
        count: recommendations.length,
        type,
        algorithm,
        data: recommendations,
      })
    } catch (error) {
      console.error("[Recommendation] Error fetching recommendations:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Generate fresh recommendations (trigger manually)
  static async generateRecommendations(req, res) {
    try {
      const userId = req.user.id
      const { algorithm = "hybrid", userPreferences = {} } = req.body

      let recommendations

      if (algorithm === "ml") {
        // Generate ML-based recommendations
        recommendations = await mlRecommendationService.generateRecommendations(userId, userPreferences)
      } else {
        // Use existing AI service
        recommendations = await AIRecommendationService.generateAllRecommendations(userId)
      }

      res.json({
        success: true,
        message: "Recommendations generated successfully",
        algorithm,
        count: recommendations.length,
        data: recommendations.slice(0, 20),
      })
    } catch (error) {
      console.error("[Recommendation] Error generating recommendations:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Train ML models (admin only)
  static async trainMLModels(req, res) {
    try {
      console.log('[Recommendation] Training ML models...')
      const success = await mlRecommendationService.trainModels()

      if (success) {
        res.json({
          success: true,
          message: "ML models trained successfully",
          modelsTrained: ['TF-IDF Vectorizer', 'K-Means Clusterer'],
        })
      } else {
        res.status(500).json({
          success: false,
          error: "Model training failed. Check logs for details.",
        })
      }
    } catch (error) {
      console.error("[Recommendation] Error training ML models:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Track search interaction for ML
  static async trackSearch(req, res) {
    try {
      const userId = req.user.id
      const searchFilters = req.body

      // Track in ML table for recommendations
      await MLUserInteraction.trackSearch(userId, searchFilters)

      // Also track in search_history for user history display
      await SearchHistory.create(userId, {
        searchQuery: searchFilters.search_query || searchFilters.city || 'Search',
        filters: searchFilters,
        resultsCount: 0, // Can be updated later if needed
        searchType: 'listing'
      })

      res.json({
        success: true,
        message: "Search tracked successfully",
      })
    } catch (error) {
      console.error("[Recommendation] Error tracking search:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Track property view for ML
  static async trackPropertyView(req, res) {
    try {
      const userId = req.user.id
      const { listingId, property_id, engagement = {} } = req.body
      
      // Support both naming conventions
      const propertyId = listingId || property_id

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: "Property ID is required"
        })
      }

      // Fetch property details to get city
      const { query } = await import("../config/database.js")
      const propertyResult = await query(
        'SELECT city, address, area, rent_amount, bedrooms, bathrooms, type, title FROM listings WHERE id = $1',
        [propertyId]
      )

      if (propertyResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Property not found"
        })
      }

      const property = propertyResult.rows[0]

      // Track property view in listing_views table (for admin analytics)
      await ListingView.track(userId, propertyId, {
        viewDurationSeconds: engagement.duration_seconds || 0,
        interactionType: 'view',
        deviceType: engagement.device_type || 'desktop'
      })

      // Track property view in ML table (for recommendations)
      await MLUserInteraction.trackPropertyView(userId, propertyId, engagement)

      // Also track as an implicit search with property's city
      if (property.city) {
        const locationText = property.address || property.area || property.title || property.city
        await MLUserInteraction.trackSearch(userId, {
          search_query: `Viewed: ${locationText}`,
          city: property.city,
          min_rent: property.rent_amount ? property.rent_amount * 0.8 : null,
          max_rent: property.rent_amount ? property.rent_amount * 1.2 : null,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          property_type: property.type
        })
      }

      // Also mark ML recommendation as clicked if exists
      await MLRecommendation.markAsClicked(userId, propertyId)

      res.json({
        success: true,
        message: "Property view tracked successfully",
      })
    } catch (error) {
      console.error("[Recommendation] Error tracking property view:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Update engagement metrics for property view
  static async updateEngagement(req, res) {
    try {
      const userId = req.user.id
      const { listingId } = req.params
      const { duration_seconds, viewed_images, clicked_contact, added_to_favorites } = req.body

      if (!listingId) {
        return res.status(400).json({
          success: false,
          error: "Listing ID is required"
        })
      }

      const engagement = {
        viewDuration: duration_seconds || 0,
        viewedImages: viewed_images || false,
        clickedContact: clicked_contact || false,
        addedToFavorites: added_to_favorites || false
      }

      await MLUserInteraction.updateEngagement(userId, listingId, engagement)

      res.json({
        success: true,
        message: "Engagement updated successfully"
      })
    } catch (error) {
      console.error('[Recommendation] Error updating engagement:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Build user preference profile for ML
  static async buildUserProfile(req, res) {
    try {
      const userId = req.user.id

      const vector = await mlRecommendationService.buildUserPreferenceProfile(userId)

      if (vector) {
        res.json({
          success: true,
          message: "User preference profile built successfully",
          vectorDimension: vector.length,
        })
      } else {
        res.json({
          success: false,
          message: "Insufficient interaction history to build profile",
        })
      }
    } catch (error) {
      console.error("[Recommendation] Error building user profile:", error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // Get ML recommendation statistics
  static async getMLStats(req, res) {
    try {
      const userId = req.user.id
      
      const stats = await MLRecommendation.getStats(userId)
      const interactionCount = await MLUserInteraction.getUserInteractionCount(userId)

      res.json({
        success: true,
        data: {
          recommendations: stats,
          interactions: interactionCount,
        },
      })
    } catch (error) {
      console.error("[Recommendation] Error getting ML stats:", error)
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
      const userId = req.user.id
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
      const userId = req.user.id
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
      const userId = req.user.id
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
      const userId = req.user.id
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
