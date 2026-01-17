import express from "express"
import { query } from "../config/database.js"
import { authMiddleware } from "../middleware/auth-enhanced.js"
import { v4 as uuidv4 } from "uuid"

const router = express.Router()

// Get all conversations for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId
    console.log("[GET CONVERSATIONS] User ID:", userId)
    
    // First, get all conversations for this user
    const text = `
      SELECT DISTINCT
        c.id,
        c.listing_id,
        c.last_message,
        c.last_message_time,
        c.last_message_sender_id,
        c.is_active,
        c.created_at,
        c.updated_at
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = $1
      ORDER BY c.updated_at DESC
    `
    const convRes = await query(text, [userId])
    
    // For each conversation, get the other user and unread count
    const conversationsWithDetails = await Promise.all(
      convRes.rows.map(async (conv) => {
        // Get other user
        const userText = `
          SELECT u.id, u.name FROM users u
          INNER JOIN conversation_participants cp ON u.id = cp.user_id
          WHERE cp.conversation_id = $1 AND cp.user_id != $2
          LIMIT 1
        `
        const userRes = await query(userText, [conv.id, userId])
        const otherUser = userRes.rows[0]
        
        // Get unread count for current user
        const unreadText = `
          SELECT COALESCE(unread_count, 0) as unread_count FROM conversation_participants
          WHERE conversation_id = $1 AND user_id = $2
        `
        const unreadRes = await query(unreadText, [conv.id, userId])
        const unreadCount = parseInt(unreadRes.rows[0]?.unread_count || 0)
        
        return {
          ...conv,
          other_user_id: otherUser?.id,
          other_user_name: otherUser?.name || 'Unknown User',
          unread_count: unreadCount,
        }
      })
    )
    
    console.log("[GET CONVERSATIONS] Found conversations:", conversationsWithDetails.length)
    conversationsWithDetails.forEach(row => {
      console.log(`[CONV] ID: ${row.id}, User: ${row.other_user_name}, Unread: ${row.unread_count}, LastMsg: "${row.last_message}"`)
    })

    res.json({
      success: true,
      data: conversationsWithDetails,
    })
  } catch (error) {
    console.error("[GET CONVERSATIONS ERROR]", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get conversation messages
router.get("/:conversationId/messages", authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params
    const { limit = 50, skip = 0 } = req.query

    const text = `
      SELECT * FROM messages 
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `
    const res2 = await query(text, [conversationId, Number.parseInt(limit), Number.parseInt(skip)])

    res.json({
      success: true,
      data: res2.rows,
    })
  } catch (error) {
    console.error("[GET MESSAGES ERROR]", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Create conversation
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { participantId, listingId } = req.body
    const userId = req.user.userId

    // Check if conversation exists between these users for this listing
    const existingText = `
      SELECT c.* FROM conversations c
      INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
      INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
      WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.listing_id = $3
      LIMIT 1
    `
    const existing = await query(existingText, [userId, participantId, listingId])

    let conversation
    if (existing.rows.length > 0) {
      conversation = existing.rows[0]
    } else {
      // Create new conversation using db.getOrCreateConversation
      const { db } = await import("../config/database.js")
      conversation = await db.getOrCreateConversation(userId, participantId, listingId)
    }

    res.status(201).json({
      success: true,
      data: conversation,
    })
  } catch (error) {
    console.error("[CREATE CONVERSATION ERROR]", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Get unread count
router.get("/:conversationId/unread", authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params

    const text = `
      SELECT COUNT(*) as unread_count FROM messages
      WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = false
    `
    const res2 = await query(text, [conversationId, req.user.userId])

    const unreadCount = Number.parseInt(res2.rows[0].unread_count)

    res.json({
      success: true,
      data: { unreadCount },
    })
  } catch (error) {
    console.error("[GET UNREAD ERROR]", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Mark conversation as read
router.put("/:conversationId/mark-read", authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params
    const userId = req.user.userId

    // Mark all unread messages as read for this conversation
    const text = `
      UPDATE messages
      SET is_read = true, read_at = NOW()
      WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = false
      RETURNING *
    `
    const result = await query(text, [conversationId, userId])

    // Update unread_count in conversation_participants
    const updateText = `
      UPDATE conversation_participants
      SET unread_count = 0
      WHERE conversation_id = $1 AND user_id = $2
      RETURNING *
    `
    const updateResult = await query(updateText, [conversationId, userId])

    res.json({
      success: true,
      data: {
        markedAsRead: result.rows.length,
        participant: updateResult.rows[0],
      },
    })
  } catch (error) {
    console.error("[MARK READ ERROR]", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

export default router


