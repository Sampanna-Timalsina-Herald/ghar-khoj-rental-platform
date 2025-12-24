import express from "express";
import { query } from "../config/database.js";
import { authMiddleware } from "../middleware/auth-enhanced.js";
import { asyncHandler } from "../utils/error-handler.js";

const router = express.Router();

// Get all listings with filters (Public)
router.get("/", asyncHandler(async (req, res) => {
  try {
    const { city, location, minPrice, maxPrice, bedrooms, bathrooms, furnished, type, limit, sort } = req.query;
    
    let sqlQuery = `
      SELECT 
        l.*,
        u.name as landlord_name,
        u.email as landlord_email,
        u.phone as landlord_phone
      FROM listings l
      LEFT JOIN users u ON l.landlord_id = u.id
      WHERE l.status = 'active'
    `;
    
    const params = [];
    let paramIndex = 1;

    if (city) {
      sqlQuery += ` AND LOWER(l.city) LIKE LOWER($${paramIndex++})`;
      params.push(`%${city}%`);
    }
    
    if (location) {
      sqlQuery += ` AND (LOWER(l.city) LIKE LOWER($${paramIndex++}) OR LOWER(l.address) LIKE LOWER($${paramIndex}))`;
      params.push(`%${location}%`);
      params.push(`%${location}%`);
      paramIndex++;
    }
    
    if (minPrice) {
      sqlQuery += ` AND l.rent_amount >= $${paramIndex++}`;
      params.push(Number(minPrice));
    }
    
    if (maxPrice) {
      sqlQuery += ` AND l.rent_amount <= $${paramIndex++}`;
      params.push(Number(maxPrice));
    }
    
    if (bedrooms) {
      sqlQuery += ` AND l.bedrooms >= $${paramIndex++}`;
      params.push(Number(bedrooms));
    }
    
    if (bathrooms) {
      sqlQuery += ` AND l.bathrooms >= $${paramIndex++}`;
      params.push(Number(bathrooms));
    }
    
    if (furnished && furnished !== 'all') {
      sqlQuery += ` AND l.furnished = $${paramIndex++}`;
      params.push(furnished);
    }
    
    if (type && type !== 'all') {
      sqlQuery += ` AND l.type = $${paramIndex++}`;
      params.push(type);
    }

    // Order by
    if (sort === 'trending') {
      sqlQuery += ` ORDER BY l.created_at DESC, l.id DESC`;
    } else {
      sqlQuery += ` ORDER BY l.created_at DESC`;
    }

    // Limit
    if (limit) {
      sqlQuery += ` LIMIT $${paramIndex++}`;
      params.push(Number(limit));
    }

    const result = await query(sqlQuery, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("[listings] Error fetching listings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Get listing by ID (Public)
router.get("/:id", asyncHandler(async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        l.*,
        u.name as landlord_name,
        u.email as landlord_email,
        u.phone as landlord_phone,
        u.rating as landlord_rating
      FROM listings l
      LEFT JOIN users u ON l.landlord_id = u.id
      WHERE l.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[listings] Error fetching listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Create listing (Landlord only)
router.post("/", authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      title,
      description,
      address,
      city,
      college_name,
      rent_amount,
      deposit_amount,
      bedrooms,
      bathrooms,
      amenities,
      images,
      furnished,
      type,
    } = req.body;

    // Check if user is landlord
    const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
    if (userCheck.rows[0]?.role !== 'landlord') {
      return res.status(403).json({ success: false, error: "Only landlords can create listings" });
    }

    const result = await query(`
      INSERT INTO listings (
        landlord_id, title, description, address, city, college_name,
        rent_amount, deposit_amount, bedrooms, bathrooms, amenities, images,
        furnished, type, status, is_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', false)
      RETURNING *
    `, [
      userId,
      title,
      description,
      address,
      city,
      college_name || null,
      rent_amount,
      deposit_amount || null,
      bedrooms,
      bathrooms,
      amenities ? JSON.stringify(amenities) : null,
      images ? JSON.stringify(images) : null,
      furnished || 'semi',
      type || 'apartment',
    ]);

    res.status(201).json({
      success: true,
      message: "Listing created successfully. Waiting for admin approval.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("[listings] Error creating listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Update listing (Landlord only - own listings)
router.put("/:id", authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;
    const listingId = req.params.id;
    const updates = req.body;

    // Check if listing belongs to user
    const listingCheck = await query("SELECT landlord_id FROM listings WHERE id = $1", [listingId]);
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    if (listingCheck.rows[0].landlord_id !== userId) {
      return res.status(403).json({ success: false, error: "You can only update your own listings" });
    }

    const allowedFields = ['title', 'description', 'address', 'city', 'college_name', 'rent_amount', 
                           'deposit_amount', 'bedrooms', 'bathrooms', 'amenities', 'images', 
                           'furnished', 'type'];
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'amenities' || key === 'images') {
          updateFields.push(`${key} = $${paramIndex++}`);
          values.push(Array.isArray(value) ? JSON.stringify(value) : value);
        } else {
          updateFields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(listingId);

    const result = await query(
      `UPDATE listings SET ${updateFields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[listings] Error updating listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Delete listing (Landlord only - own listings)
router.delete("/:id", authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;
    const listingId = req.params.id;

    // Check if listing belongs to user
    const listingCheck = await query("SELECT landlord_id FROM listings WHERE id = $1", [listingId]);
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    if (listingCheck.rows[0].landlord_id !== userId) {
      return res.status(403).json({ success: false, error: "You can only delete your own listings" });
    }

    await query("DELETE FROM listings WHERE id = $1", [listingId]);

    res.json({ success: true, message: "Listing deleted successfully" });
  } catch (error) {
    console.error("[listings] Error deleting listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

export default router;
