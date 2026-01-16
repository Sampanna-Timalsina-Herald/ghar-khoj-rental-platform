import { query } from '../config/database.js';

export class Notification {
  /**
   * Create a new notification
   */
  static async create({ userId, type, title, message, link, metadata }) {
    console.log('[NOTIFICATION MODEL] Creating notification:', { userId, type, title });
    
    try {
      const result = await query(
        `INSERT INTO notifications (user_id, type, title, message, link, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, type, title, message, link, JSON.stringify(metadata || {})]
      );
      
      console.log('[NOTIFICATION MODEL] Notification created successfully:', result.rows[0]?.id);
      return result.rows[0];
    } catch (error) {
      console.error('[NOTIFICATION MODEL] Error creating notification:', error.message);
      throw error;
    }
  }

  /**
   * Get all notifications for a user
   */
  static async getByUserId(userId, limit = 50) {
    const result = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /**
   * Get unread notifications count
   */
  static async getUnreadCount(userId) {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM notifications 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const result = await query(
      `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [notificationId, userId]
    );
    return result.rows[0];
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId) {
    await query(
      `UPDATE notifications 
       SET is_read = true, read_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
  }

  /**
   * Delete a notification
   */
  static async delete(notificationId, userId) {
    await query(
      `DELETE FROM notifications 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  }

  /**
   * Delete all notifications for a user
   */
  static async deleteAll(userId) {
    await query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [userId]
    );
  }
}
