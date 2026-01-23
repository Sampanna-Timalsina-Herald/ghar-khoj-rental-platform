import { query } from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

export class UserPreferences {
  // Get user preferences
  static async getByUserId(userId) {
    const result = await query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  // Create or update user preferences
  static async upsert(userId, preferences) {
    const {
      locations = [],
      minPrice = null,
      maxPrice = null,
      bedrooms = null,
      propertyTypes = [],
      amenities = [],
      hasSetPreferences = true
    } = preferences;

    // Check if preferences exist
    const existing = await this.getByUserId(userId);

    if (existing) {
      // Update existing preferences
      const result = await query(
        `UPDATE user_preferences 
         SET locations = $2, min_price = $3, max_price = $4, 
             bedrooms = $5, property_types = $6, amenities = $7,
             has_set_preferences = $8, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING *`,
        [userId, locations, minPrice, maxPrice, bedrooms, propertyTypes, amenities, hasSetPreferences]
      );
      return result.rows[0];
    } else {
      // Create new preferences
      const result = await query(
        `INSERT INTO user_preferences 
         (id, user_id, locations, min_price, max_price, bedrooms, property_types, amenities, has_set_preferences)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [uuidv4(), userId, locations, minPrice, maxPrice, bedrooms, propertyTypes, amenities, hasSetPreferences]
      );
      return result.rows[0];
    }
  }

  // Check if user has set preferences
  static async hasSetPreferences(userId) {
    const result = await query(
      `SELECT has_set_preferences FROM user_preferences WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.has_set_preferences || false;
  }

  // Get all users with specific preferences for matching
  // Matches when 3 or more criteria match
  static async getUsersWithMatchingPreferences(listing) {
    const { city, rent_amount, bedrooms, type, amenities } = listing;

    // Convert rent_amount to number if it's a string
    const rentAmountNum = typeof rent_amount === 'string' ? parseFloat(rent_amount) : rent_amount;
    // Convert bedrooms to number if it's a string
    const bedroomsNum = typeof bedrooms === 'string' ? parseInt(bedrooms) : bedrooms;

    console.log('[USER-PREFERENCES] Matching listing:', { 
      city, 
      rent_amount: rentAmountNum, 
      bedrooms: bedroomsNum, 
      type 
    });

    const result = await query(
      `SELECT * FROM (
         SELECT DISTINCT 
           u.id, 
           u.email, 
           u.name, 
           up.locations,
           up.min_price,
           up.max_price,
           up.bedrooms,
           up.property_types,
           up.amenities,
           -- Calculate match score
           (
             CASE WHEN $1 = ANY(up.locations) OR array_length(up.locations, 1) IS NULL THEN 1 ELSE 0 END +
             CASE WHEN (up.min_price IS NULL OR $2 >= up.min_price) AND 
                       (up.max_price IS NULL OR $2 <= up.max_price) THEN 1 ELSE 0 END +
             CASE WHEN up.bedrooms IS NULL OR $3 >= up.bedrooms THEN 1 ELSE 0 END +
             CASE WHEN $4 = ANY(up.property_types) OR array_length(up.property_types, 1) IS NULL THEN 1 ELSE 0 END
           ) as match_score
         FROM users u
         JOIN user_preferences up ON u.id = up.user_id
         WHERE u.role = 'tenant'
           AND up.has_set_preferences = true
       ) AS matched_users
       WHERE match_score >= 3`,
      [city, rentAmountNum, bedroomsNum, type]
    );

    console.log('[USER-PREFERENCES] Query executed. Total rows:', result.rows.length);
    console.log('[USER-PREFERENCES] Found users with match_score >= 3:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('[USER-PREFERENCES] No matches found. Checking all tenants with preferences...');
      // Debug query to see all tenants
      const debugResult = await query(
        `SELECT u.id, u.email, u.name, up.locations, up.min_price, up.max_price, up.bedrooms, up.property_types
         FROM users u
         JOIN user_preferences up ON u.id = up.user_id
         WHERE u.role = 'tenant' AND up.has_set_preferences = true`
      );
      console.log('[USER-PREFERENCES] All tenants with preferences:', debugResult.rows);
    }
    
    result.rows.forEach(row => {
      console.log('[USER-PREFERENCES] Match:', {
        email: row.email,
        name: row.name,
        match_score: row.match_score,
        preferences: {
          locations: row.locations,
          price_range: `${row.min_price}-${row.max_price}`,
          bedrooms: row.bedrooms,
          types: row.property_types
        }
      });
    });

    return result.rows;
  }

  // Delete user preferences
  static async delete(userId) {
    const result = await query(
      `DELETE FROM user_preferences WHERE user_id = $1 RETURNING *`,
      [userId]
    );
    return result.rows[0] || null;
  }
}
