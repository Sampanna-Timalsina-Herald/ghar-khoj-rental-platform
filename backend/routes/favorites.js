import express from "express"
import { db } from "../config/database.js"
import { authMiddleware } from "../middleware/auth-enhanced.js"

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

    const listing = await db.getListingById(listingId)
    if (!listing) {
      return res.status(404).json({
        success: false,
        error: "Listing not found",
      })
    }

    const existingFavorite = await db.query("SELECT * FROM favorites WHERE user_id = $1 AND listing_id = $2", [
      userId,
      listingId,
    ])

    if (existingFavorite.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Listing already in favorites",
      })
    }

    const favorite = await db.addFavorite(userId, listingId)

    res.status(201).json({
      success: true,
      message: "Added to favorites",
      data: favorite,
    })
  } catch (error) {
    console.error("[v0] Error adding to favorites:", error)
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

    const result = await db.removeFavorite(userId, listingId)

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Favorite not found",
      })
    }

    res.json({
      success: true,
      message: "Removed from favorites",
    })
  } catch (error) {
    console.error("[v0] Error removing from favorites:", error)
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
