//import Message from "../models/Message.js"
//import Conversation from "../models/Conversation.js"
//import OnlineStatus from "../models/OnlineStatus.js"
import User from "../models/User.js"
import { db, query } from "../config/database.js"
import { sendEmail } from "../utils/email-service.js"
import { v4 as uuidv4 } from "uuid"

class SocketService {
  constructor() {
    this.userSockets = new Map() // userId -> socketId mapping
  }

  // Register user socket connection
  async registerUserSocket(userId, socketId) {
    this.userSockets.set(userId, socketId)
    console.log(`[SOCKET] User ${userId} connected with socket ${socketId}`)
  }

  // Unregister user socket connection
  async unregisterUserSocket(userId) {
    this.userSockets.delete(userId)
    console.log(`[SOCKET] User ${userId} disconnected`)
  }

  // Get user's socket ID
  getUserSocket(userId) {
    return this.userSockets.get(userId)
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId)
  }

  // Save message to database
  async saveMessage(conversationId, senderId, receiverId, message, listingId = null) {
    try {
      // Save message via database method
      const savedMessage = await db.sendMessage({
        id: uuidv4(),
        sender_id: senderId,
        receiver_id: receiverId,
        listing_id: listingId,
        message_text: message,
      })

      return savedMessage
    } catch (error) {
      console.error("[SAVE MESSAGE ERROR]", error)
      throw error
    }
  }

  // Get or create conversation (PostgreSQL)
  async getOrCreateConversation(participant1Id, participant2Id, listingId = null) {
    try {
      // Check if conversation exists
      const result = await query(
        `SELECT * FROM messages 
         WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
         LIMIT 1`,
        [participant1Id, participant2Id]
      )

      // Return conversation object (PostgreSQL doesn't need explicit conversation table)
      return {
        id: `${participant1Id}-${participant2Id}`,
        participants: [participant1Id, participant2Id],
        listingId,
        lastMessage: result.rows[0]?.message_text || null,
      }
    } catch (error) {
      console.error("[GET/CREATE CONVERSATION ERROR]", error)
      throw error
    }
  }

  // Mark message as read
  async markMessageAsRead(messageId, userId) {
    try {
      const result = await query(
        `UPDATE messages SET is_read = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [messageId]
      )
      return result.rows[0]
    } catch (error) {
      console.error("[MARK READ ERROR]", error)
      throw error
    }
  }

  // Increment unread count for a conversation
  async incrementUnreadCount(conversationId, userId) {
    try {
      const result = await query(
        `UPDATE conversation_participants 
         SET unread_count = unread_count + 1
         WHERE conversation_id = $1 AND user_id = $2
         RETURNING *`,
        [conversationId, userId]
      )
      return result.rows[0]
    } catch (error) {
      console.error("[INCREMENT UNREAD ERROR]", error)
      // Don't throw - just log
    }
  }

  // Get user conversations
  async getUserConversations(userId) {
    try {
      const result = await query(
        `SELECT DISTINCT 
         CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id,
         MAX(created_at) as last_message_time
         FROM messages 
         WHERE sender_id = $1 OR receiver_id = $1
         GROUP BY other_user_id
         ORDER BY last_message_time DESC`,
        [userId]
      )
      return result.rows
    } catch (error) {
      console.error("[GET CONVERSATIONS ERROR]", error)
      throw error
    }
  }

  // Send email notification
  async sendMessageNotification(receiverId, senderName, message) {
    try {
      const result = await query(`SELECT email FROM users WHERE id = $1`, [receiverId])
      const receiver = result.rows[0]
      if (receiver && receiver.email) {
        await sendEmail(
          receiver.email,
          `New message from ${senderName}`,
          `You have a new message: "${message.substring(0, 100)}..."`,
        )
      }
    } catch (error) {
      console.error("[SEND NOTIFICATION ERROR]", error)
    }
  }
}

export default new SocketService()
