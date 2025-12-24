import express from "express";
import { query } from "../config/database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth-enhanced.js";

const router = express.Router();

/* =====================================================
   GET ALL USERS (PostgreSQL)
===================================================== */
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await query("SELECT * FROM users ORDER BY id DESC");
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[admin] Error fetching users:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   GET ALL LISTINGS (This fixes your 404)
===================================================== */
router.get("/listings", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        l.*,
        u.name as owner_name,
        u.email as owner_email
      FROM listings l
      LEFT JOIN users u ON l.landlord_id = u.id
      ORDER BY l.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("[admin] Error fetching listings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   APPROVE LISTING
===================================================== */
router.put("/listings/:id/approve", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await query(
      "UPDATE listings SET is_verified = true, status = 'active' WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[admin] Error approving listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   REJECT LISTING
===================================================== */
router.put("/listings/:id/reject", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await query(
      "UPDATE listings SET status = 'inactive' WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[admin] Error rejecting listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   VERIFY USER
===================================================== */
router.put("/users/:id/verify", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await query(
      "UPDATE users SET isVerified = true WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[admin] Error verifying user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   UPDATE USER
===================================================== */
router.put("/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, college, city, role, is_active, is_email_verified } = req.body;
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (college !== undefined) {
      updateFields.push(`college = $${paramIndex++}`);
      values.push(college);
    }
    if (city !== undefined) {
      updateFields.push(`city = $${paramIndex++}`);
      values.push(city);
    }
    if (role !== undefined) {
      updateFields.push(`"role" = $${paramIndex++}`);
      values.push(role);
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }
    if (is_email_verified !== undefined) {
      updateFields.push(`is_email_verified = $${paramIndex++}`);
      values.push(is_email_verified);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: "No fields to update" });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[admin] Error updating user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   DELETE USER
===================================================== */
router.delete("/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Start a transaction to ensure all deletes happen together
    await query("BEGIN");
    
    try {
      // First delete all related data in order of dependencies
      // Delete audit logs for this user
      await query("DELETE FROM audit_logs WHERE user_id = $1", [id]);
      
      // Delete messages where user is sender or receiver
      await query("DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1", [id]);
      
      // Delete conversation participants
      await query("DELETE FROM conversation_participants WHERE user_id = $1", [id]);
      
      // Delete conversations where user was last message sender
      await query("DELETE FROM conversations WHERE last_message_sender_id = $1", [id]);
      
      // Delete ratings where user is rater or ratee
      await query("DELETE FROM ratings WHERE rater_id = $1 OR ratee_id = $1", [id]);
      
      // Delete agreements where user is landlord or tenant
      await query("DELETE FROM agreements WHERE landlord_id = $1 OR tenant_id = $1", [id]);
      
      // Delete favorites for this user
      await query("DELETE FROM favorites WHERE user_id = $1", [id]);
      
      // Delete listings owned by this user
      await query("DELETE FROM listings WHERE landlord_id = $1", [id]);
      
      // Delete search history
      await query("DELETE FROM search_history WHERE user_id = $1", [id]);
      
      // Delete user search preferences
      await query("DELETE FROM user_search_preferences WHERE user_id = $1", [id]);
      
      // Delete OTPs
      await query("DELETE FROM otps WHERE email = (SELECT email FROM users WHERE id = $1)", [id]);
      
      // Delete sessions
      await query("DELETE FROM sessions WHERE user_id = $1", [id]);
      
      // Finally delete the user
      const result = await query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);
      
      if (result.rows.length === 0) {
        await query("ROLLBACK");
        return res.status(404).json({ success: false, error: "User not found" });
      }
      
      // Commit the transaction
      await query("COMMIT");
      
      res.json({ success: true, message: "User and all related data deleted successfully", data: result.rows[0] });
    } catch (transactionError) {
      // Rollback on any error
      await query("ROLLBACK");
      throw transactionError;
    }
  } catch (error) {
    console.error("[admin] Error deleting user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   UPDATE LISTING
===================================================== */
router.put("/listings/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = ['title', 'description', 'price', 'location', 'bedrooms', 'bathrooms', 'area', 'furnished', 'type', 'status', 'is_verified'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE listings SET ${updateFields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("[admin] Error updating listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   DELETE LISTING
===================================================== */
router.delete("/listings/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM listings WHERE id = $1 RETURNING *", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    res.json({ success: true, message: "Listing deleted successfully", data: result.rows[0] });
  } catch (error) {
    console.error("[admin] Error deleting listing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* =====================================================
   ADMIN ANALYTICS
===================================================== */
router.get("/analytics", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const usersCount = await query("SELECT COUNT(*)::int as count FROM users");
    const listingsCount = await query("SELECT COUNT(*)::int as count FROM listings");
    const activeListingsCount = await query(
      "SELECT COUNT(*)::int as count FROM listings WHERE status = 'active' AND is_verified = true"
    );
    const pendingListingsCount = await query(
      "SELECT COUNT(*)::int as count FROM listings WHERE status = 'active' AND (is_verified = false OR is_verified IS NULL)"
    );
    
    // Also get conversations count
    const conversationsCount = await query("SELECT COUNT(*)::int as count FROM conversations").catch(() => ({ rows: [{ count: 0 }] }));

    res.json({
      success: true,
      data: {
        totalUsers: Number(usersCount.rows[0]?.count || 0),
        totalListings: Number(listingsCount.rows[0]?.count || 0),
        activeListings: Number(activeListingsCount.rows[0]?.count || 0),
        pendingListings: Number(pendingListingsCount.rows[0]?.count || 0),
        totalConversations: Number(conversationsCount.rows[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("[admin] Error loading analytics:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
