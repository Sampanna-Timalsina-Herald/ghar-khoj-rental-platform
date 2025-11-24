// import express from "express"
// import { db } from "../config/database.js"
// //import { authMiddleware, adminMiddleware } from "../middleware/auth.js"
// import { User } from "../models/User.js"
// //import { Listing } from "../models/Listing.js"

// const router = express.Router()

// // Approve listing
// router.put("/listings/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
//   try {
//     const listing = await db.updateListing(req.params.id, { isVerified: true })
//     res.json({ success: true, data: listing })
//   } catch (error) {
//     console.error("[v0] Error approving listing:", error)
//     res.status(500).json({ success: false, error: error.message })
//   }
// })

// // Reject listing
// router.put("/listings/:id/reject", authMiddleware, adminMiddleware, async (req, res) => {
//   try {
//     const listing = await db.updateListing(req.params.id, { status: "inactive" })
//     res.json({ success: true, data: listing })
//   } catch (error) {
//     console.error("[v0] Error rejecting listing:", error)
//     res.status(500).json({ success: false, error: error.message })
//   }
// })

// // Verify user
// router.put("/users/:id/verify", authMiddleware, adminMiddleware, async (req, res) => {
//   try {
//     const user = await db.updateUser(req.params.id, { isVerified: true })
//     res.json({ success: true, data: user })
//   } catch (error) {
//     console.error("[v0] Error verifying user:", error)
//     res.status(500).json({ success: false, error: error.message })
//   }
// })

// // Get analytics
// router.get("/analytics", authMiddleware, adminMiddleware, async (req, res) => {
//   try {
//     const totalUsers = await User.countDocuments()
//     const totalListings = await Listing.countDocuments()
//     const activeListings = await Listing.countDocuments({ status: "active" })

//     res.json({
//       success: true,
//       data: {
//         totalUsers,
//         totalListings,
//         activeListings,
//       },
//     })
//   } catch (error) {
//     console.error("[v0] Error fetching analytics:", error)
//     res.status(500).json({ success: false, error: error.message })
//   }
// })

// export default router
