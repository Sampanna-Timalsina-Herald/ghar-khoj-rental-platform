/**
 * ML User Interaction Model
 * Tracks user searches and property views for ML training
 */

import { query } from "../config/database.js";

export class MLUserInteraction {
  /**
   * Track a user search with filters
   */
  static async trackSearch(userId, searchFilters) {
    try {
      console.log('[ML-Interaction] Tracking search for user:', userId, 'filters:', searchFilters);
      
      const text = `
        INSERT INTO user_search_interactions (
          user_id, search_query, city, min_rent, max_rent,
          bedrooms, bathrooms, property_type, amenities, furnished, college_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const values = [
        userId,
        searchFilters.search_query || searchFilters.searchQuery || null,
        searchFilters.city || null,
        searchFilters.min_rent || searchFilters.minRent || null,
        searchFilters.max_rent || searchFilters.maxRent || null,
        searchFilters.bedrooms || null,
        searchFilters.bathrooms || null,
        searchFilters.property_type || searchFilters.propertyType || null,
        searchFilters.amenities || null,
        searchFilters.furnished || null,
        searchFilters.college_name || searchFilters.collegeName || null,
      ];

      const result = await query(text, values);
      console.log('[ML-Interaction] Search tracked successfully:', result.rows[0]?.id);
      return result.rows[0];
    } catch (error) {
      console.error('[ML-Interaction] Error tracking search:', error);
      throw error;
    }
  }

  /**
   * Track property view
   */
  static async trackPropertyView(userId, listingId, engagement = {}) {
    try {
      const text = `
        INSERT INTO property_views_ml (
          user_id, listing_id, view_duration, viewed_images,
          clicked_contact, added_to_favorites
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        userId,
        listingId,
        engagement.viewDuration || 0,
        engagement.viewedImages || false,
        engagement.clickedContact || false,
        engagement.addedToFavorites || false,
      ];

      const result = await query(text, values);
      return result.rows[0];
    } catch (error) {
      console.error('[ML-Interaction] Error tracking view:', error);
      throw error;
    }
  }

  /**
   * Update engagement metrics for a property view
   */
  static async updateEngagement(userId, listingId, engagement = {}) {
    try {
      const text = `
        UPDATE property_views_ml
        SET 
          view_duration = $3,
          viewed_images = $4,
          clicked_contact = $5,
          added_to_favorites = $6
        WHERE user_id = $1 AND listing_id = $2
        RETURNING *
      `;

      const values = [
        userId,
        listingId,
        engagement.viewDuration || 0,
        engagement.viewedImages || false,
        engagement.clickedContact || false,
        engagement.addedToFavorites || false,
      ];

      const result = await query(text, values);
      if (result.rows.length > 0) {
        console.log(`[ML-Interaction] Engagement updated for listing ${listingId}:`, engagement);
      }
      return result.rows[0];
    } catch (error) {
      console.error('[ML-Interaction] Error updating engagement:', error);
      throw error;
    }
  }

  /**
   * Get user search history
   */
  static async getUserSearchHistory(userId, limit = 50) {
    try {
      const text = `
        SELECT * FROM user_search_interactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await query(text, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('[ML-Interaction] Error getting search history:', error);
      return [];
    }
  }

  /**
   * Get user property views with listing details
   */
  static async getUserPropertyViews(userId, limit = 100) {
    try {
      const text = `
        SELECT pv.*, l.*
        FROM property_views_ml pv
        JOIN listings l ON pv.listing_id = l.id
        WHERE pv.user_id = $1
        ORDER BY pv.created_at DESC
        LIMIT $2
      `;

      const result = await query(text, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('[ML-Interaction] Error getting property views:', error);
      return [];
    }
  }

  /**
   * Get user interaction count
   */
  static async getUserInteractionCount(userId) {
    try {
      const text = `
        SELECT 
          (SELECT COUNT(*) FROM user_search_interactions WHERE user_id = $1) AS search_count,
          (SELECT COUNT(*) FROM property_views_ml WHERE user_id = $1) AS view_count,
          (SELECT COUNT(*) FROM favorites WHERE user_id = $1) AS favorite_count
      `;

      const result = await query(text, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('[ML-Interaction] Error getting interaction count:', error);
      return { search_count: 0, view_count: 0, favorite_count: 0 };
    }
  }

  /**
   * Check if user has sufficient interaction history
   */
  static async hasSufficientHistory(userId, minInteractions = 3) {
    const counts = await this.getUserInteractionCount(userId);
    const totalInteractions = 
      parseInt(counts.search_count || 0) + 
      parseInt(counts.view_count || 0) + 
      parseInt(counts.favorite_count || 0);

    return totalInteractions >= minInteractions;
  }
}

export default MLUserInteraction;
