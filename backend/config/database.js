import dotenv from "dotenv";
dotenv.config();

import pkg from "pg"
const { Pool } = pkg

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

// import { User } from "../models/User.js"
// import { Listing } from "../models/Listing.js"
// import { Favorite } from "../models/Favorite.js"
// import { Message } from "../models/Message.js"

export const db = {
  // Users
  async createUser(userData) {
    const text = "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *"
    const values = [userData.name, userData.email, userData.password]
    const res = await query(text, values)
    return res.rows[0]
  },

  async getUserById(id) {
    const text = "SELECT * FROM users WHERE id = $1"
    const values = [id]
    const res = await query(text, values)
    return res.rows[0]
  },

  async getUserByEmail(email) {
    const text = "SELECT * FROM users WHERE email = $1"
    const values = [email]
    const res = await query(text, values)
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
    const res = await query(text, values)
    return res.rows[0]
  },

  // Listings
  async createListing(listingData) {
    const text =
      "INSERT INTO listings (landlordId, city, collegeName, rentAmount, bedrooms, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *"
    const values = [
      listingData.landlordId,
      listingData.city,
      listingData.collegeName,
      listingData.rentAmount,
      listingData.bedrooms,
      listingData.status,
    ]
    const res = await query(text, values)
    return res.rows[0]
  },

  async getListingById(id) {
    const text =
      "SELECT listings.*, users.name, users.rating, users.profileImage FROM listings INNER JOIN users ON listings.landlordId = users.id WHERE listings.id = $1"
    const values = [id]
    const res = await query(text, values)
    return res.rows[0]
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
    const res = await query(text, values)
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
    const res = await query(text, values)
    return res.rows[0]
  },

  async deleteListing(id) {
    const text = "DELETE FROM listings WHERE id = $1 RETURNING *"
    const values = [id]
    const res = await query(text, values)
    return res.rows[0]
  },

  // Favorites
  async addFavorite(userId, listingId) {
    const text = "INSERT INTO favorites (userId, listingId) VALUES ($1, $2) RETURNING *"
    const values = [userId, listingId]
    const res = await query(text, values)
    return res.rows[0]
  },

  async removeFavorite(userId, listingId) {
    const text = "DELETE FROM favorites WHERE userId = $1 AND listingId = $2 RETURNING *"
    const values = [userId, listingId]
    const res = await query(text, values)
    return res.rows[0]
  },

  async getUserFavorites(userId) {
    const text =
      "SELECT listings.* FROM favorites INNER JOIN listings ON favorites.listingId = listings.id WHERE favorites.userId = $1"
    const values = [userId]
    const res = await query(text, values)
    return res.rows
  },

  // Messages
  async sendMessage(messageData) {
    const text = "INSERT INTO messages (senderId, receiverId, content) VALUES ($1, $2, $3) RETURNING *"
    const values = [messageData.senderId, messageData.receiverId, messageData.content]
    const res = await query(text, values)
    return res.rows[0]
  },

  async getConversation(userId1, userId2) {
    const text =
      "SELECT * FROM messages WHERE (senderId = $1 AND receiverId = $2) OR (senderId = $2 AND receiverId = $1) ORDER BY createdAt ASC"
    const values = [userId1, userId2]
    const res = await query(text, values)
    return res.rows
  },

  async getUserMessages(userId) {
    const text = "SELECT * FROM messages WHERE senderId = $1 OR receiverId = $2 ORDER BY createdAt DESC"
    const values = [userId, userId]
    const res = await query(text, values)
    return res.rows
  },

  async markMessageAsRead(messageId) {
    const text = "UPDATE messages SET isRead = $1 WHERE id = $2 RETURNING *"
    const values = [true, messageId]
    const res = await query(text, values)
    return res.rows[0]
  },
}
