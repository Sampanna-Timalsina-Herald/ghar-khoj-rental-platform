import { db } from "../config/database.js"
import { SearchHistory } from "../models/SearchHistory.js"
import { UserSearchPreferences } from "../models/UserSearchPreferences.js"
import { Recommendation } from "../models/Recommendation.js"
import { ListingView } from "../models/ListingView.js"

export class AIRecommendationService {
  // Algorithm 1: Similar to Previous Searches
  static async generateSearchBasedRecommendations(userId, topN = 10) {
    try {
      const searches = await SearchHistory.getSearchesByTimeRange(userId, 30)
      if (searches.length === 0) return []

      const recommendations = []
      const recommendedListingIds = new Set()

      for (const search of searches.slice(0, 5)) {
        const filters = JSON.parse(search.filters || "{}")

        let query = `SELECT id, title, rent_amount, bedrooms, bathrooms FROM listings WHERE status = 'active' AND is_verified = true`
        const params = []
        let paramIndex = 1

        if (filters.city) {
          query += ` AND city = $${paramIndex++}`
          params.push(filters.city)
        }
        if (filters.college) {
          query += ` AND college_name = $${paramIndex++}`
          params.push(filters.college)
        }
        if (filters.minRent) {
          query += ` AND rent_amount >= $${paramIndex++}`
          params.push(filters.minRent)
        }
        if (filters.maxRent) {
          query += ` AND rent_amount <= $${paramIndex++}`
          params.push(filters.maxRent)
        }
        if (filters.bedrooms) {
          query += ` AND bedrooms >= $${paramIndex++}`
          params.push(filters.bedrooms)
        }

        query += ` LIMIT $${paramIndex++}`
        params.push(5)

        const result = await db.query(query, params)

        result.rows.forEach((listing) => {
          if (!recommendedListingIds.has(listing.id)) {
            recommendedListingIds.add(listing.id)
            recommendations.push({
              listingId: listing.id,
              type: "similar_to_searches",
              score: 0.85,
              reasons: [
                `Matches your previous search for ${filters.city || "properties"}`,
                `Budget friendly - Rs. ${listing.rent_amount}`,
                `${listing.bedrooms} bed, ${listing.bathrooms} bath`,
              ],
            })
          }
        })
      }

      // Save recommendations to database
      for (const rec of recommendations.slice(0, topN)) {
        await Recommendation.create(userId, rec.listingId, {
          recommendationType: rec.type,
          matchScore: rec.score,
          reasons: rec.reasons,
        })
      }

      return recommendations.slice(0, topN)
    } catch (error) {
      console.error("[v0] Error in search-based recommendations:", error)
      return []
    }
  }

  // Algorithm 2: Preference-Based Recommendations
  static async generatePreferenceBasedRecommendations(userId, topN = 10) {
    try {
      const prefs = await UserSearchPreferences.getOrCreate(userId)
      const recommendations = []

      if (!prefs.avg_min_rent && !prefs.preferred_cities) {
        return []
      }

      let query = `
        SELECT id, title, rent_amount, bedrooms, bathrooms, city, college_name
        FROM listings
        WHERE status = 'active' AND is_verified = true
      `
      const params = []
      let paramIndex = 1

      if (prefs.preferred_cities && prefs.preferred_cities.length > 0) {
        query += ` AND city = ANY($${paramIndex++})`
        params.push(prefs.preferred_cities)
      }
      if (prefs.avg_min_rent) {
        query += ` AND rent_amount >= $${paramIndex++}`
        params.push(prefs.avg_min_rent * 0.9) // 90% of average
      }
      if (prefs.avg_max_rent) {
        query += ` AND rent_amount <= $${paramIndex++}`
        params.push(prefs.avg_max_rent * 1.1) // 110% of average
      }
      if (prefs.avg_bedrooms) {
        query += ` AND bedrooms >= $${paramIndex++}`
        params.push(Math.floor(prefs.avg_bedrooms))
      }

      query += ` LIMIT $${paramIndex++}`
      params.push(topN + 5)

      const result = await db.query(query, params)

      result.rows.forEach((listing) => {
        const reasons = [
          `Located in ${listing.city} - your preferred city`,
          `Rs. ${listing.rent_amount}/month fits your budget`,
          `${listing.bedrooms} bed, ${listing.bathrooms} bath as per preference`,
        ]

        recommendations.push({
          listingId: listing.id,
          type: "match_preferences",
          score: 0.9,
          reasons,
        })

        // Save to database
        Recommendation.create(userId, listing.id, {
          recommendationType: "match_preferences",
          matchScore: 0.9,
          reasons,
        }).catch((err) => console.error("[v0] Error saving recommendation:", err))
      })

      return recommendations.slice(0, topN)
    } catch (error) {
      console.error("[v0] Error in preference-based recommendations:", error)
      return []
    }
  }

  // Algorithm 3: Trending Properties
  static async generateTrendingRecommendations(userId, topN = 5) {
    try {
      const query = `
        SELECT t.listing_id, t.trend_score, l.title, l.rent_amount, l.bedrooms, l.bathrooms, l.city
        FROM trending_listings t
        JOIN listings l ON t.listing_id = l.id
        WHERE l.status = 'active'
        ORDER BY t.trend_score DESC
        LIMIT $1;
      `

      const result = await db.query(query, [topN])
      const recommendations = []

      result.rows.forEach((listing) => {
        const reasons = [
          `Popular in ${listing.city} - viewed by many users`,
          `Trending trend score: ${listing.trend_score}`,
        ]

        recommendations.push({
          listingId: listing.listing_id,
          type: "trending",
          score: Math.min(0.95, listing.trend_score / 100),
          reasons,
        })

        Recommendation.create(userId, listing.listing_id, {
          recommendationType: "trending",
          matchScore: Math.min(0.95, listing.trend_score / 100),
          reasons,
        }).catch((err) => console.error("[v0] Error saving trending rec:", err))
      })

      return recommendations
    } catch (error) {
      console.error("[v0] Error in trending recommendations:", error)
      return []
    }
  }

  // Algorithm 4: Collaborative Filtering
  static async generateCollaborativeRecommendations(userId, topN = 10) {
    try {
      // Find similar users based on search history
      const userViews = await ListingView.getUserViewHistory(userId, 50)

      if (userViews.length === 0) return []

      const viewedListingIds = userViews.map((v) => v.listing_id)

      // Find users with similar view patterns
      const query = `
        SELECT DISTINCT lv2.listing_id, COUNT(*) as similarity_score
        FROM listing_views lv1
        JOIN listing_views lv2 ON lv1.listing_id = lv2.listing_id
        WHERE lv1.user_id = $1
        AND lv2.user_id != $1
        AND lv2.listing_id != ALL($2::uuid[])
        GROUP BY lv2.listing_id
        ORDER BY similarity_score DESC
        LIMIT $3;
      `

      const result = await db.query(query, [userId, viewedListingIds, topN])
      const recommendations = []

      result.rows.forEach((item) => {
        recommendations.push({
          listingId: item.listing_id,
          type: "collaborative_filter",
          score: Math.min(0.92, item.similarity_score / 10),
          reasons: ["Users with similar interests viewed this", "Recommended by our AI based on similar searches"],
        })

        Recommendation.create(userId, item.listing_id, {
          recommendationType: "collaborative_filter",
          matchScore: Math.min(0.92, item.similarity_score / 10),
          reasons: ["Users with similar interests viewed this"],
        }).catch((err) => console.error("[v0] Error saving collaborative rec:", err))
      })

      return recommendations
    } catch (error) {
      console.error("[v0] Error in collaborative recommendations:", error)
      return []
    }
  }

  // Master function: Generate all recommendations
  static async generateAllRecommendations(userId) {
    console.log(`[v0] Generating recommendations for user ${userId}`)

    try {
      const [searchBased, preferenceBased, trending, collaborative] = await Promise.all([
        this.generateSearchBasedRecommendations(userId, 8),
        this.generatePreferenceBasedRecommendations(userId, 8),
        this.generateTrendingRecommendations(userId, 5),
        this.generateCollaborativeRecommendations(userId, 8),
      ])

      const allRecommendations = [...searchBased, ...preferenceBased, ...trending, ...collaborative]

      // Remove duplicates and sort by score
      const uniqueRecs = Array.from(new Map(allRecommendations.map((r) => [r.listingId, r])).values()).sort(
        (a, b) => b.score - a.score,
      )

      console.log(`[v0] Generated ${uniqueRecs.length} recommendations for user ${userId}`)
      return uniqueRecs
    } catch (error) {
      console.error("[v0] Error generating all recommendations:", error)
      return []
    }
  }

  // Update trending listings cache
  static async updateTrendingListings() {
    try {
      const query = `
        INSERT INTO trending_listings (id, listing_id, trend_score, views_last_7_days, favorites_last_7_days, inquiries_last_7_days)
        SELECT uuid_generate_v4(), lv.listing_id, 
               (COUNT(lv.id) * 0.5 + COUNT(DISTINCT f.id) * 1.5 + COUNT(DISTINCT m.id) * 2) / 10 as trend_score,
               COUNT(lv.id) as views,
               COUNT(DISTINCT f.id) as favorites,
               COUNT(DISTINCT m.id) as inquiries
        FROM listing_views lv
        LEFT JOIN favorites f ON lv.listing_id = f.listing_id AND f.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
        LEFT JOIN messages m ON lv.listing_id = m.listing_id AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
        WHERE lv.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
        GROUP BY lv.listing_id
        ON CONFLICT (listing_id) DO UPDATE SET 
          trend_score = EXCLUDED.trend_score,
          views_last_7_days = EXCLUDED.views_last_7_days,
          favorites_last_7_days = EXCLUDED.favorites_last_7_days,
          inquiries_last_7_days = EXCLUDED.inquiries_last_7_days,
          updated_at = CURRENT_TIMESTAMP;
      `

      await db.query(query, [])
      console.log("[v0] Updated trending listings cache")
    } catch (error) {
      console.error("[v0] Error updating trending listings:", error)
    }
  }
}
