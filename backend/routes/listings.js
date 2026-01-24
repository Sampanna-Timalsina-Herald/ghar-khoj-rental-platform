import express from "express";
import { query } from "../config/database.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth-enhanced.js";
import { asyncHandler } from "../utils/error-handler.js";
import { notifyMatchingUsers } from "../utils/preference-matcher.js";
import { NotificationService } from "../services/notification-service.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed'))
    }
  }
})

router.get("/landlord/my-listings", authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log("[LISTINGS] Fetching listings for landlord:", userId);
    
    const result = await query(`
      SELECT 
        l.*,
        u.name as landlord_name,
        u.email as landlord_email,
        u.phone as landlord_phone,
        u.rating as landlord_rating
      FROM listings l
      LEFT JOIN users u ON l.landlord_id = u.id
      WHERE l.landlord_id = $1
      ORDER BY l.created_at DESC
    `, [userId]);

    console.log("[LISTINGS] Found", result.rows.length, "listings for landlord:", userId);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[listings] Error fetching landlord listings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Get listing suggestions for search bar - search by name, title, description, location, anything
router.get("/suggest", asyncHandler(async (req, res) => {
  try {
    const { q } = req.query;
    
    console.log("[listings/suggest] Query received:", q);
    
    if (!q || q.trim().length < 2) {
      console.log("[listings/suggest] Query too short, returning empty array");
      return res.json([]);
    }

    const searchTerm = q.trim();
    
    // Check if search term is a number (for rent amount search)
    const isNumericSearch = !isNaN(searchTerm) && searchTerm !== '';
    
    // Search across title, description, city, address, college_name, and rent_amount
    const result = await query(`
      SELECT 
        id,
        title,
        description,
        city,
        address,
        college_name,
        rent_amount,
        bedrooms,
        bathrooms,
        images,
        type,
        furnished,
        landlord_id,
        created_at
      FROM listings
      WHERE status = 'active' AND is_verified = true
        AND (
          LOWER(title) LIKE LOWER($1) 
          OR LOWER(description) LIKE LOWER($1)
          OR LOWER(city) LIKE LOWER($1)
          OR LOWER(address) LIKE LOWER($1)
          OR LOWER(college_name) LIKE LOWER($1)
          ${isNumericSearch ? 'OR rent_amount::text LIKE $2' : ''}
        )
      ORDER BY 
        CASE 
          WHEN LOWER(title) LIKE LOWER($1) THEN 0
          WHEN LOWER(address) LIKE LOWER($1) THEN 1
          WHEN LOWER(city) LIKE LOWER($1) THEN 2
          ${isNumericSearch ? 'WHEN rent_amount::text LIKE $2 THEN 1' : ''}
          ELSE 3 
        END,
        created_at DESC
      LIMIT 8
    `, isNumericSearch ? [`%${searchTerm}%`, `%${searchTerm}%`] : [`%${searchTerm}%`]);

    console.log("[listings/suggest] Results found:", result.rows.length);
    
    const suggestions = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.city || row.address,
      address: row.address,
      city: row.city,
      college_name: row.college_name,
      price: row.rent_amount,
      rent_amount: row.rent_amount,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      images: row.images,
      type: row.type,
      furnished: row.furnished,
      landlord_id: row.landlord_id,
      created_at: row.created_at
    }));

    console.log("[listings/suggest] Returning suggestions:", suggestions.length);
    res.json(suggestions);
  } catch (error) {
    console.error("[listings/suggest] Error fetching suggestions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Get all listings with filters (Public)
router.get("/", asyncHandler(async (req, res) => {
  try {
    const { city, location, minPrice, maxPrice, bedrooms, bathrooms, furnished, type, limit, sort, search } = req.query;
    
    let sqlQuery = `
      SELECT 
        l.*,
        u.name as landlord_name,
        u.email as landlord_email,
        u.phone as landlord_phone
      FROM listings l
      LEFT JOIN users u ON l.landlord_id = u.id
      WHERE l.status = 'active' AND l.is_verified = true
    `;
    
    const params = [];
    let paramIndex = 1;

    // Global search - search across title, description, city, address
    if (search) {
      sqlQuery += ` AND (LOWER(l.title) LIKE LOWER($${paramIndex}) OR LOWER(l.description) LIKE LOWER($${paramIndex}) OR LOWER(l.city) LIKE LOWER($${paramIndex}) OR LOWER(l.address) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

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

// Get listing by ID (Public - but checks auth to allow landlords to view their own unverified listings)
router.get("/:id", optionalAuthMiddleware, asyncHandler(async (req, res) => {
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

    const listing = result.rows[0];

    // Check if listing is verified or if user is the landlord
    const userId = req.user?.userId;
    if (!listing.is_verified && listing.landlord_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: "This listing is pending admin approval and is not yet publicly available" 
      });
    }

    res.json({ success: true, data: listing });
  } catch (error) {
    console.error("[listings] Error fetching listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Create listing (Landlord only)
router.post("/", authMiddleware, upload.array('images', 20), asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log("[CREATE-LISTING] Files received:", req.files ? req.files.length : 0);
    console.log("[CREATE-LISTING] File details:", req.files?.map(f => ({ originalname: f.originalname, filename: f.filename, size: f.size })));
    
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
      furnished,
      type,
    } = req.body;

    // Check if user is landlord
    const userCheck = await query("SELECT role FROM users WHERE id = $1", [userId]);
    if (userCheck.rows[0]?.role !== 'landlord') {
      return res.status(403).json({ success: false, error: "Only landlords can create listings" });
    }

    // Get image paths from multer
    const imagePaths = req.files && req.files.length > 0 
      ? req.files.map(file => `/uploads/${file.filename}`)
      : [];

    console.log("[CREATE-LISTING] Image paths:", imagePaths);

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
      amenities ? (Array.isArray(amenities) ? amenities : [amenities]) : null,
      imagePaths.length > 0 ? imagePaths : null,
      furnished || 'semi',
      type || 'apartment',
    ]);

    const newListing = result.rows[0];

    // Get landlord name for notification
    const landlordResult = await query("SELECT name FROM users WHERE id = $1", [userId]);
    const landlordName = landlordResult.rows[0]?.name || 'A landlord';

    // Notify admins about new listing
    await NotificationService.notifyAdminNewListing(
      newListing.id,
      landlordName,
      newListing.title
    );

    // Note: We don't notify matching users here because the listing isn't verified yet.
    // Users will be notified only when the admin approves the listing.

    res.status(201).json({
      success: true,
      message: "Listing created successfully. Waiting for admin approval.",
      data: newListing,
    });
  } catch (error) {
    console.error("[listings] Error creating listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

// Update listing (Landlord only - own listings)
router.put("/:id", authMiddleware, upload.array('images', 20), asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;
    const listingId = req.params.id;
    const updates = req.body;

    // Check if listing belongs to user
    const listingCheck = await query("SELECT landlord_id, images FROM listings WHERE id = $1", [listingId]);
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    if (listingCheck.rows[0].landlord_id !== userId) {
      return res.status(403).json({ success: false, error: "You can only update your own listings" });
    }

    const allowedFields = ['title', 'description', 'address', 'city', 'college_name', 'rent_amount', 
                           'deposit_amount', 'bedrooms', 'bathrooms', 'amenities',
                           'furnished', 'type'];
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    // Process regular fields
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'amenities') {
          updateFields.push(`${key} = $${paramIndex++}`);
          values.push(Array.isArray(value) ? value : (value ? [value] : null));
        } else {
          updateFields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      }
    }

    // Handle images
    let imagePaths = [];
    
    // Add existing images that user wants to keep
    if (updates.existingImages) {
      const existing = Array.isArray(updates.existingImages) 
        ? updates.existingImages 
        : [updates.existingImages];
      imagePaths = existing.filter(img => img); // Filter out empty values
    }
    
    // Add newly uploaded images
    if (req.files && req.files.length > 0) {
      const newImagePaths = req.files.map(file => `/uploads/${file.filename}`);
      imagePaths = [...imagePaths, ...newImagePaths];
    }
    
    // Update images if there are any
    if (imagePaths.length > 0) {
      updateFields.push(`images = $${paramIndex++}`);
      values.push(imagePaths);
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

/* =====================================================
   MARK ADMIN CHANGES AS SEEN (Landlord)
   When landlord views admin change request, mark it as seen
   and notify the admin
===================================================== */
router.put("/:id/mark-admin-changes-seen", authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userId;
    const listingId = req.params.id;
    
    console.log("[LISTINGS] Marking admin changes as seen for listing:", listingId, "by user:", userId);

    // Check if listing belongs to user and has admin notes
    const listingCheck = await query(
      `SELECT landlord_id, admin_notes, admin_id, admin_changes_details, title 
       FROM listings 
       WHERE id = $1`, 
      [listingId]
    );
    
    if (listingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    const listing = listingCheck.rows[0];

    if (listing.landlord_id !== userId) {
      return res.status(403).json({ success: false, error: "You can only update your own listings" });
    }

    if (!listing.admin_notes) {
      return res.status(400).json({ success: false, error: "No admin changes to mark as seen" });
    }

    // Update the listing to mark changes as seen
    const result = await query(
      `UPDATE listings 
       SET admin_changes_seen = true,
           admin_changes_seen_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [listingId]
    );

    // Send notification to admin who requested the changes
    if (listing.admin_id) {
      const landlordResult = await query(
        "SELECT name, email FROM users WHERE id = $1",
        [userId]
      );
      const landlord = landlordResult.rows[0];
      
      await NotificationService.notifyAdminChangesSeenByLandlord(
        listing.admin_id,
        landlord.name || landlord.email,
        listing.title,
        listingId
      );
    }

    console.log("[LISTINGS] Admin changes marked as seen for listing:", listingId);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[listings] Error marking admin changes as seen:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}));

export default router;

