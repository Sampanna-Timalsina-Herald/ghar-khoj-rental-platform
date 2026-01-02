import dotenv from "dotenv";
dotenv.config();

import pkg from "pg"
const { Pool } = pkg

import { v4 as uuidv4 } from "uuid"

// Create connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
})

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err)
})

export const query = (text, params) => {
  return pool.query(text, params)
}

export const getClient = async () => {
  return pool.connect()
}

export default pool

// Create inline query function for use in db methods
const executeQuery = (text, params) => {
  return pool.query(text, params)
}

import { User } from "../models/User.js"
// import { Listing } from "../models/Listing.js"
// import { Favorite } from "../models/Favorite.js"
// import { Message } from "../models/Message.js"

export const db = {
  // Users
  async createUser(userData) {
    const text = "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *"
    const values = [userData.name, userData.email, userData.password]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  async getUserById(id) {
    const text = "SELECT * FROM users WHERE id = $1"
    const values = [id]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  async getUserByEmail(email) {
    const text = "SELECT * FROM users WHERE email = $1"
    const values = [email]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  async updateUser(id, updates) {
    let text = "UPDATE users SET"
    const values = [id]
    let index = 1

    for (const key in updates) {
      text += ` ${key} = $${index + 1},`
      values.push(updates[key])
      index++
    }

    text = text.slice(0, -1) + " WHERE id = $1 RETURNING *"
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  // Listings
  async createListing(listingData) {
    const text =
      "INSERT INTO listings (landlord_id, city, college_name, rent_amount, bedrooms, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"
    const values = [
      listingData.landlordId,
      listingData.city,
      listingData.collegeName,
      listingData.rentAmount,
      listingData.bedrooms,
      listingData.status,
    ]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  async getListingById(id) {
    try {
      const text =
        "SELECT listings.*, users.name, users.rating, users.profile_image FROM listings INNER JOIN users ON listings.landlord_id = users.id WHERE listings.id = $1"
      const values = [id]
      console.log(`[DB] Fetching listing - id: ${id}`)
      const res = await executeQuery(text, values)
      console.log(`[DB] Listing fetched successfully - id: ${id}, found: ${!!res.rows[0]}`)
      return res.rows[0]
    } catch (error) {
      console.error(`[DB] Error fetching listing - id: ${id}:`, error.message)
      throw error
    }
  },

  async getListings(filters = {}) {
    let text = "SELECT * FROM listings WHERE status = $1"
    const values = ["active"]
    let index = 2

    if (filters.city) {
      text += ` AND city = $${index}`
      values.push(filters.city)
      index++
    }
    if (filters.college) {
      text += ` AND collegeName = $${index}`
      values.push(filters.college)
      index++
    }
    if (filters.minRent) {
      text += ` AND rentAmount >= $${index}`
      values.push(filters.minRent)
      index++
    }
    if (filters.maxRent) {
      text += ` AND rentAmount <= $${index}`
      values.push(filters.maxRent)
      index++
    }
    if (filters.bedrooms) {
      text += ` AND bedrooms = $${index}`
      values.push(filters.bedrooms)
      index++
    }

    text += " ORDER BY createdAt DESC"
    const res = await executeQuery(text, values)
    return res.rows
  },

  async updateListing(id, updates) {
    let text = "UPDATE listings SET"
    const values = [id]
    let index = 1

    for (const key in updates) {
      text += ` ${key} = $${index + 1},`
      values.push(updates[key])
      index++
    }

    text = text.slice(0, -1) + " WHERE id = $1 RETURNING *"
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  async deleteListing(id) {
    const text = "DELETE FROM listings WHERE id = $1 RETURNING *"
    const values = [id]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  // Favorites
  async addFavorite(userId, listingId) {
    try {
      const text = "INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2) RETURNING *"
      const values = [userId, listingId]
      console.log(`[DB] Adding favorite - userId: ${userId}, listingId: ${listingId}`)
      const res = await executeQuery(text, values)
      console.log(`[DB] Favorite added successfully - userId: ${userId}, listingId: ${listingId}`)
      return res.rows[0]
    } catch (error) {
      console.error(`[DB] Error adding favorite - userId: ${userId}, listingId: ${listingId}:`, error)
      throw error
    }
  },

  async removeFavorite(userId, listingId) {
    try {
      const text = "DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2 RETURNING *"
      const values = [userId, listingId]
      console.log(`[DB] Removing favorite - userId: ${userId}, listingId: ${listingId}`)
      const res = await executeQuery(text, values)
      console.log(`[DB] Favorite removed successfully - userId: ${userId}, listingId: ${listingId}`)
      return res.rows[0]
    } catch (error) {
      console.error(`[DB] Error removing favorite - userId: ${userId}, listingId: ${listingId}:`, error)
      throw error
    }
  },

  async getUserFavorites(userId) {
    const text =
      "SELECT listings.* FROM favorites INNER JOIN listings ON favorites.listing_id = listings.id WHERE favorites.user_id = $1"
    const values = [userId]
    const res = await executeQuery(text, values)
    return res.rows
  },

  // Messages
  async getOrCreateConversation(userId1, userId2, listingId) {
    // First, try to find existing conversation
    const findText = "SELECT c.* FROM conversations c INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.listing_id = $3 LIMIT 1"
    const findValues = [userId1, userId2, listingId]
    const findRes = await executeQuery(findText, findValues)
    
    if (findRes.rows.length > 0) {
      return findRes.rows[0]
    }
    
    // Create new conversation
    const convId = uuidv4()
    const createText = "INSERT INTO conversations (id, listing_id, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW()) RETURNING *"
    const createValues = [convId, listingId]
    const createRes = await executeQuery(createText, createValues)
    
    // Add participants
    const participantText = "INSERT INTO conversation_participants (conversation_id, user_id, unread_count, created_at) VALUES ($1, $2, 0, NOW()), ($1, $3, 1, NOW())"
    const participantValues = [convId, userId1, userId2]
    await executeQuery(participantText, participantValues)
    
    return createRes.rows[0]
  },

  async sendMessage(messageData) {
    // Get or create conversation
    const conversation = await this.getOrCreateConversation(messageData.sender_id, messageData.receiver_id, messageData.listing_id)
    console.log("[DB] sendMessage - Conversation:", conversation.id)
    
    const text = "INSERT INTO messages (id, conversation_id, sender_id, receiver_id, listing_id, message, is_read, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW()) RETURNING *"
    const values = [messageData.id, conversation.id, messageData.sender_id, messageData.receiver_id, messageData.listing_id || null, messageData.message_text]
    const res = await executeQuery(text, values)
    const savedMessage = res.rows[0]
    console.log("[DB] Message saved:", savedMessage.id)

    // Update conversation with last message info
    const updateConvText = "UPDATE conversations SET last_message = $1, last_message_time = NOW(), last_message_sender_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *"
    const updateConvValues = [messageData.message_text, messageData.sender_id, conversation.id]
    const updateConvRes = await executeQuery(updateConvText, updateConvValues)
    console.log("[DB] Conversation updated with last_message:", updateConvRes.rows[0]?.last_message)

    // Increment unread count for receiver
    const incrementText = "UPDATE conversation_participants SET unread_count = unread_count + 1 WHERE conversation_id = $1 AND user_id = $2 RETURNING *"
    const incrementValues = [conversation.id, messageData.receiver_id]
    const incrementRes = await executeQuery(incrementText, incrementValues)
    console.log("[DB] Unread count for receiver:", incrementRes.rows[0]?.unread_count)

    return savedMessage
  },

  async getConversation(userId1, userId2, listingId) {
    // Get conversation ID first
    const convText = "SELECT c.* FROM conversations c INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id WHERE cp1.user_id = $1 AND cp2.user_id = $2 AND c.listing_id = $3 LIMIT 1"
    const convValues = [userId1, userId2, listingId]
    const convRes = await executeQuery(convText, convValues)
    
    if (convRes.rows.length === 0) {
      return []
    }
    
    // Get messages for this conversation
    const text = "SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC"
    const values = [convRes.rows[0].id]
    const res = await executeQuery(text, values)
    return res.rows
  },

  async getUserMessages(userId) {
    const text = "SELECT m.* FROM messages m INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id WHERE cp.user_id = $1 ORDER BY m.created_at DESC"
    const values = [userId]
    const res = await executeQuery(text, values)
    return res.rows
  },

  async markMessageAsRead(messageId) {
    const text = "UPDATE messages SET is_read = true, read_at = NOW() WHERE id = $1 RETURNING *"
    const values = [messageId]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  // Agreements
  async createAgreement(agreementData) {
    const text = `INSERT INTO agreements (id, listing_id, tenant_id, landlord_id, start_date, end_date, monthly_rent, deposit, terms, status) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`
    const values = [
      agreementData.id,
      agreementData.listing_id,
      agreementData.tenant_id,
      agreementData.landlord_id,
      agreementData.start_date,
      agreementData.end_date,
      agreementData.monthly_rent,
      agreementData.deposit,
      agreementData.terms || '',
      agreementData.status || 'pending'
    ]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  async getAgreementById(id) {
    const text = "SELECT * FROM agreements WHERE id = $1"
    const values = [id]
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  async getUserAgreements(userId) {
    const text = "SELECT * FROM agreements WHERE tenant_id = $1 OR landlord_id = $1 ORDER BY created_at DESC"
    const values = [userId]
    const res = await executeQuery(text, values)
    return res.rows
  },

  async updateAgreement(id, updates) {
    let text = "UPDATE agreements SET"
    const values = [id]
    let index = 1

    for (const key in updates) {
      text += ` ${key} = $${index + 1},`
      values.push(updates[key])
      index++
    }

    text = text.slice(0, -1) + " WHERE id = $1 RETURNING *"
    const res = await executeQuery(text, values)
    return res.rows[0]
  },

  // Generic query function for direct SQL queries
  async query(text, values) {
    return query(text, values)
  },
}
