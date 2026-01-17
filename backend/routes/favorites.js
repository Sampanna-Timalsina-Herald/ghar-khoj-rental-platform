import express from "express"
import { query, db } from "../config/database.js"
import { authMiddleware } from "../middleware/auth-enhanced.js"
import { NotificationService } from "../services/notification-service.js"

const router = express.Router()

router.get("/", authMiddleware, async (req, res) => {
  try {
    const favorites = await db.getUserFavorites(req.user.userId)
    res.json({
      success: true,
      count: favorites.length,
      data: favorites,
    })
  } catch (error) {
    console.error("[v0] Error fetching favorites:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

router.post("/:listingId", authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.params
    const userId = req.user.userId

    console.log(`[Favorites] Adding favorite - userId: ${userId}, listingId: ${listingId}`)

    const listing = await db.getListingById(listingId)
    if (!listing) {
      console.log(`[Favorites] Listing not found: ${listingId}`)
      return res.status(404).json({
        success: false,
        error: "Listing not found",
      })
    }

    const existingFavorite = await query("SELECT * FROM favorites WHERE user_id = $1 AND listing_id = $2", [
      userId,
      listingId,
    ])

    if (existingFavorite.rows.length > 0) {
      console.log(`[Favorites] Already favorited - userId: ${userId}, listingId: ${listingId}`)
      return res.status(400).json({
        success: false,
        error: "Listing already in favorites",
      })
    }

    const favorite = await db.addFavorite(userId, listingId)
    console.log(`[Favorites] Successfully added - userId: ${userId}, listingId: ${listingId}`)

    // Get tenant name and notify landlord
    const tenantResult = await query("SELECT name FROM users WHERE id = $1", [userId]);
    const tenantName = tenantResult.rows[0]?.name || 'A user';
    
    await NotificationService.notifyLandlordFavorited(
      listing.landlord_id,
      tenantName,
      listing.title,
      listingId
    );

    res.status(201).json({
      success: true,
      message: "Added to favorites",
      data: favorite,
    })
  } catch (error) {
    console.error("[Favorites] Error adding to favorites:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

router.delete("/:listingId", authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.params
    const userId = req.user.userId

    console.log(`[Favorites] Removing favorite - userId: ${userId}, listingId: ${listingId}`)

    const result = await db.removeFavorite(userId, listingId)

    if (!result) {
      console.log(`[Favorites] Favorite not found - userId: ${userId}, listingId: ${listingId}`)
      return res.status(404).json({
        success: false,
        error: "Favorite not found",
      })
    }

    console.log(`[Favorites] Successfully removed - userId: ${userId}, listingId: ${listingId}`)

    res.json({
      success: true,
      message: "Removed from favorites",
    })
  } catch (error) {
    console.error("[Favorites] Error removing from favorites:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

router.get("/check/:listingId", authMiddleware, async (req, res) => {
  try {
    const { listingId } = req.params
    const userId = req.user.userId

    const res2 = await db.query("SELECT * FROM favorites WHERE user_id = $1 AND listing_id = $2", [userId, listingId])

    res.json({
      success: true,
      isFavorited: res2.rows.length > 0,
    })
  } catch (error) {
    console.error("[v0] Error checking favorite:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router
