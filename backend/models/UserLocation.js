import { query } from "../config/database.js";

export class UserLocation {
  static async getByUser(userId) {
    const result = await query(
      `SELECT * FROM user_locations WHERE user_id = $1 ORDER BY is_primary DESC, created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async getPrimary(userId) {
    const result = await query(
      `SELECT * FROM user_locations WHERE user_id = $1 AND is_primary = true LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  static async hasLocation(userId) {
    const result = await query(
      `SELECT EXISTS (SELECT 1 FROM user_locations WHERE user_id = $1) AS has_location`,
      [userId]
    );
    return Boolean(result.rows[0]?.has_location);
  }

  static async create(userId, location) {
    const {
      label = "Primary",
      city = null,
      fullAddress = null,
      latitude,
      longitude,
      radiusKm = 20,
      isPrimary = false,
    } = location;

    if (latitude === undefined || longitude === undefined) {
      throw new Error("Latitude and longitude are required");
    }

    // Determine primary flag: if requested or no existing primary
    const shouldBePrimary = isPrimary || !(await this.getPrimary(userId));

    try {
      await query("BEGIN");

      if (shouldBePrimary) {
        await query(`UPDATE user_locations SET is_primary = false WHERE user_id = $1`, [userId]);
      }

      const result = await query(
        `INSERT INTO user_locations (
          user_id, label, city, full_address, latitude, longitude, radius_km, is_primary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [userId, label, city, fullAddress, latitude, longitude, radiusKm, shouldBePrimary]
      );

      await query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  static async update(locationId, userId, updates) {
    const existingResult = await query(
      `SELECT * FROM user_locations WHERE id = $1 AND user_id = $2`,
      [locationId, userId]
    );
    const existing = existingResult.rows[0];
    if (!existing) return null;

    const label = updates.label ?? existing.label;
    const city = updates.city ?? existing.city;
    const fullAddress = updates.full_address ?? updates.fullAddress ?? existing.full_address;
    const latitude = updates.latitude ?? existing.latitude;
    const longitude = updates.longitude ?? existing.longitude;
    const radiusKm = updates.radius_km ?? updates.radiusKm ?? existing.radius_km;
    const isPrimary = updates.is_primary ?? updates.isPrimary ?? existing.is_primary;

    try {
      await query("BEGIN");

      if (isPrimary) {
        await query(`UPDATE user_locations SET is_primary = false WHERE user_id = $1`, [userId]);
      }

      const result = await query(
        `UPDATE user_locations
         SET label = $3,
             city = $4,
             full_address = $5,
             latitude = $6,
             longitude = $7,
             radius_km = $8,
             is_primary = $9,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [locationId, userId, label, city, fullAddress, latitude, longitude, radiusKm, isPrimary]
      );

      // Ensure at least one primary remains
      const primary = await this.getPrimary(userId);
      if (!primary) {
        await query(
          `UPDATE user_locations
           SET is_primary = true
           WHERE id IN (
             SELECT id FROM user_locations
             WHERE user_id = $1
             ORDER BY updated_at DESC
             LIMIT 1
           )`,
          [userId]
        );
      }

      await query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  static async setPrimary(locationId, userId) {
    try {
      await query("BEGIN");
      await query(`UPDATE user_locations SET is_primary = false WHERE user_id = $1`, [userId]);
      const result = await query(
        `UPDATE user_locations SET is_primary = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *`,
        [locationId, userId]
      );
      await query("COMMIT");
      return result.rows[0] || null;
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  static async delete(locationId, userId) {
    const toDelete = await query(
      `DELETE FROM user_locations WHERE id = $1 AND user_id = $2 RETURNING *`,
      [locationId, userId]
    );
    if (toDelete.rowCount === 0) return null;

    // If primary was removed, promote the latest location
    if (toDelete.rows[0].is_primary) {
      await query(
        `UPDATE user_locations
         SET is_primary = true
         WHERE id IN (
           SELECT id FROM user_locations
           WHERE user_id = $1
           ORDER BY updated_at DESC
           LIMIT 1
         )`,
        [userId]
      );
    }

    return toDelete.rows[0];
  }
}

export default UserLocation;
