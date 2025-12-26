import express from "express"
import { db, query } from "../config/database.js"
import { authMiddleware, adminMiddleware } from "../middleware/auth.js"

const router = express.Router()

// Approve listing
router.put("/listings/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const listing = await db.updateListing(req.params.id, { is_verified: true })
    res.json({ success: true, data: listing })
  } catch (error) {
    console.error("[v0] Error approving listing:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Reject listing
router.put("/listings/:id/reject", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const listing = await db.updateListing(req.params.id, { status: "inactive" })
    res.json({ success: true, data: listing })
  } catch (error) {
    console.error("[v0] Error rejecting listing:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Verify user
router.put("/users/:id/verify", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await db.updateUser(req.params.id, { is_verified: true })
    res.json({ success: true, data: user })
  } catch (error) {
    console.error("[v0] Error verifying user:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get analytics
router.get("/analytics", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalUsersRes = await query("SELECT COUNT(*) as count FROM users")
    const totalListingsRes = await query("SELECT COUNT(*) as count FROM listings")
    const activeListingsRes = await query("SELECT COUNT(*) as count FROM listings WHERE status = $1", ["active"])

    const totalUsers = Number.parseInt(totalUsersRes.rows[0].count)
    const totalListings = Number.parseInt(totalListingsRes.rows[0].count)
    const activeListings = Number.parseInt(activeListingsRes.rows[0].count)

    res.json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        activeListings,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching analytics:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
