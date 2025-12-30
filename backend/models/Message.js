// models/Message.js
import pool from '../db/pool.js'; // PostgreSQL pool connection

/**
 * Message model for CRUD operations
 */
class Message {
  constructor({ id, sender, text, created_at }) {
    this.id = id;
    this.sender = sender;
    this.text = text;
    this.created_at = created_at || new Date();
  }

  // Save a new message to the database
  static async create({ sender, text }) {
    const query = `
      INSERT INTO messages (sender, text, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *;
    `;
    const values = [sender, text];
    const result = await pool.query(query, values);
    return new Message(result.rows[0]);
  }

  // Get all messages
  static async getAll() {
    const result = await pool.query('SELECT * FROM messages ORDER BY created_at ASC;');
    return result.rows.map(row => new Message(row));
  }

  // Get a message by ID
  static async getById(id) {
    const result = await pool.query('SELECT * FROM messages WHERE id = $1;', [id]);
    if (result.rows.length === 0) return null;
    return new Message(result.rows[0]);
  }

  // Delete a message by ID
  static async delete(id) {
    const result = await pool.query('DELETE FROM messages WHERE id = $1 RETURNING *;', [id]);
    if (result.rows.length === 0) return null;
    return new Message(result.rows[0]);
  }
}

export default Message;
