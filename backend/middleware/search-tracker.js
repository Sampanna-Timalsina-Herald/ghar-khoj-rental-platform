import { SearchHistory } from "../models/SearchHistory.js"
import { UserSearchPreferences } from "../models/UserSearchPreferences.js"
import { ListingView } from "../models/ListingView.js"

export async function trackSearch(req, res, next) {
  try {
    if (req.user && req.user.userId) {
      const userId = req.user.userId
      const { search, filters } = req.query

      // Record search
      if (search || Object.keys(filters || {}).length > 0) {
        SearchHistory.create(userId, {
          searchQuery: search || "filtered_search",
          filters: filters || {},
          resultsCount: res.locals.resultCount || 0,
          searchType: "listing",
        }).catch((err) => console.error("[v0] Error tracking search:", err))

        // Increment search count
        UserSearchPreferences.incrementSearchCount(userId).catch((err) =>
          console.error("[v0] Error incrementing search count:", err),
        )
      }
    }
  } catch (error) {
    console.error("[v0] Error in search tracker middleware:", error)
  }
  next()
}

export async function trackListingView(req, res, next) {
  try {
    if (req.user && req.user.userId && req.params.id) {
      const userId = req.user.userId
      const listingId = req.params.id
      const viewDuration = req.query.viewDuration || 0
      const deviceType = req.query.deviceType || "web"

      ListingView.track(userId, listingId, {
        viewDurationSeconds: Number.parseInt(viewDuration),
        interactionType: "view",
        deviceType,
      }).catch((err) => console.error("[v0] Error tracking view:", err))
    }
  } catch (error) {
    console.error("[v0] Error in view tracker middleware:", error)
  }
  next()
}
