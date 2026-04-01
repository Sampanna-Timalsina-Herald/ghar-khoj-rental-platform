/**
 * ML Recommendation Model
 * Stores and retrieves ML-generated property recommendations
 */

import { query } from "../config/database.js";

export class MLRecommendation {
  /**
   * Save recommendation
   */
  static async create(userId, listingId, recommendationData) {
    try {
      // Validate inputs
      if (!userId) {
        console.warn('[ML-Recommendation] Skipping create: No userId provided');
        return null;
      }
      
      if (!listingId) {
        console.warn('[ML-Recommendation] Skipping create: No listingId provided');
        return null;
      }
      
      console.log('[ML-Recommendation] Creating recommendation for userId:', userId, 'listingId:', listingId);
      
      const text = `
        INSERT INTO ml_recommendations (
          user_id, listing_id, recommendation_type, confidence_score,
          similarity_score, matching_features, explanation, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, listing_id, recommendation_type)
        DO UPDATE SET
          confidence_score = EXCLUDED.confidence_score,
          similarity_score = EXCLUDED.similarity_score,
          matching_features = EXCLUDED.matching_features,
          explanation = EXCLUDED.explanation,
          generated_at = CURRENT_TIMESTAMP,
          expires_at = EXCLUDED.expires_at
        RETURNING *
      `;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const values = [
        userId,
        listingId,
        recommendationData.type || 'content_based',
        recommendationData.confidenceScore || 0,
        recommendationData.similarityScore || 0,
        JSON.stringify(recommendationData.matchingFeatures || {}),
        recommendationData.explanation || '',
        expiresAt,
      ];

      const result = await query(text, values);
      console.log('[ML-Recommendation] Successfully created recommendation');
      return result.rows[0];
    } catch (error) {
      console.error('[ML-Recommendation] Error creating recommendation:', error);
      throw error;
    }
  }

  /**
   * Get user recommendations
   */
  static async getUserRecommendations(userId, limit = 20, type = null) {
    try {
      let text = `
        SELECT mr.*, l.*, u.name AS landlord_name
        FROM ml_recommendations mr
        JOIN listings l ON mr.listing_id = l.id
        JOIN users u ON l.landlord_id = u.id
        WHERE mr.user_id = $1 
          AND mr.dismissed = false
          AND (mr.expires_at IS NULL OR mr.expires_at > CURRENT_TIMESTAMP)
          AND l.status = 'active'
      `;

      const values = [userId];
      let paramCount = 1;

      if (type) {
        paramCount++;
        text += ` AND mr.recommendation_type = $${paramCount}`;
        values.push(type);
      }

      paramCount++;
      text += ` ORDER BY mr.confidence_score DESC, mr.generated_at DESC LIMIT $${paramCount}`;
      values.push(limit);

      const result = await query(text, values);
      console.log('[ML-Recommendation] Found', result.rows.length, 'recommendations for user', userId);
      
      // Log location data for debugging
      result.rows.forEach(row => {
        console.log('[ML-Recommendation] Rec ID:', row.listing_id, 'Lat:', row.latitude, 'Lng:', row.longitude);
      });
      
      return result.rows;
    } catch (error) {
      console.error('[ML-Recommendation] Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Mark recommendation as viewed
   */
  static async markAsViewed(recommendationId) {
    try {
      const text = `
        UPDATE ml_recommendations
        SET viewed = true
        WHERE id = $1
        RETURNING *
      `;

      const result = await query(text, [recommendationId]);
      return result.rows[0];
    } catch (error) {
      console.error('[ML-Recommendation] Error marking as viewed:', error);
      return null;
    }
  }

  /**
   * Mark recommendation as clicked
   */
  static async markAsClicked(userId, listingId) {
    try {
      const text = `
        UPDATE ml_recommendations
        SET clicked = true, viewed = true
        WHERE user_id = $1 AND listing_id = $2
        RETURNING *
      `;

      const result = await query(text, [userId, listingId]);
      return result.rows;
    } catch (error) {
      console.error('[ML-Recommendation] Error marking as clicked:', error);
      return null;
    }
  }

  /**
   * Dismiss recommendation
   */
  static async dismiss(recommendationId) {
    try {
      const text = `
        UPDATE ml_recommendations
        SET dismissed = true
        WHERE id = $1
        RETURNING *
      `;

      const result = await query(text, [recommendationId]);
      return result.rows[0];
    } catch (error) {
      console.error('[ML-Recommendation] Error dismissing recommendation:', error);
      return null;
    }
  }

  /**
   * Delete old recommendations
   */
  static async deleteExpired() {
    try {
      const text = `
        DELETE FROM ml_recommendations
        WHERE expires_at < CURRENT_TIMESTAMP
      `;

      const result = await query(text);
      return { deleted_count: result.rowCount };
    } catch (error) {
      console.error('[ML-Recommendation] Error deleting expired:', error);
      return null;
    }
  }

  /**
   * Get recommendation statistics
   */
  static async getStats(userId) {
    try {
      const text = `
        SELECT 
          recommendation_type,
          COUNT(*) as total,
          COUNT(CASE WHEN viewed = true THEN 1 END) as viewed_count,
          COUNT(CASE WHEN clicked = true THEN 1 END) as clicked_count,
          ROUND(AVG(confidence_score), 4) as avg_confidence
        FROM ml_recommendations
        WHERE user_id = $1
        GROUP BY recommendation_type
      `;

      const result = await query(text, [userId]);
      return result.rows;
    } catch (error) {
      console.error('[ML-Recommendation] Error getting stats:', error);
      return [];
    }
  }
}

export default MLRecommendation;
