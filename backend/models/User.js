import { query } from "../config/database.js";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export class User {
  // --- CREATE USER ---
  static async create(userData) {
    const {
      name,
      email,
      password,
      role = "tenant",
      phone = null,
      college = null,
      city = null,
      profileImage = null,
    } = userData;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const text = `
      INSERT INTO users 
        (id, name, email, password, "role", phone, college, city, profile_image, is_email_verified, is_active)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING 
        id, name, email, "role", phone, college, city, profile_image, is_email_verified, is_active, created_at, updated_at
    `;

    const values = [
      uuidv4(),
      name,
      email.toLowerCase(),
      hashedPassword,
      role,
      phone,
      college,
      city,
      profileImage,
      false,
      true,
    ];

    console.log("Creating user with values:", values);

    const result = await query(text, values);
    return result.rows[0];
  }

  // --- FIND USER ---
  static async findByEmail(email) {
    const text = `SELECT * FROM users WHERE email = $1`;
    const result = await query(text, [email.toLowerCase()]);
    return result.rows[0] || null;
  }

  static async findById(id) {
    const text = `
      SELECT id, name, email, "role", phone, college, city, profile_image, is_email_verified, is_active,
             rating, total_ratings, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const result = await query(text, [id]);
    return result.rows[0] || null;
  }

  static async findByIdWithPassword(id) {
    const text = `SELECT * FROM users WHERE id = $1`;
    const result = await query(text, [id]);
    return result.rows[0] || null;
  }

  // --- UPDATE EMAIL VERIFICATION ---
  static async updateEmailVerification(userId) {
    const text = `
      UPDATE users
      SET is_email_verified = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, email, "role", is_email_verified
    `;
    const result = await query(text, [userId]);
    return result.rows[0];
  }

  // --- UPDATE USER INFO ---
  static async update(userId, updates) {
    const allowedFields = ["name", "phone", "college", "city", "profile_image", "rating", "total_ratings"];
    const fields = [];
    const values = [userId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      const snakeCase = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (allowedFields.includes(snakeCase)) {
        fields.push(`${snakeCase} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (fields.length === 0) return null;

    const text = `
      UPDATE users
      SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, email, "role", phone, college, city, profile_image, is_email_verified, is_active,
                rating, total_ratings, created_at, updated_at
    `;

    const result = await query(text, values);
    return result.rows[0];
  }

  // --- PASSWORD RESET METHODS ---
  static async setResetToken(userId, hashedToken, expiry) {
  const text = `
    UPDATE users
    SET reset_password_token = $2,
        reset_password_expire = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, email
  `;

  const result = await query(text, [userId, hashedToken, expiry]);
  return result.rows[0];
}


  static async findByResetToken(hashedToken) {
    const text = `
      SELECT id, email
      FROM users
      WHERE reset_password_token = $1
        AND reset_password_expire > NOW()
    `;
    const result = await query(text, [hashedToken]);
    return result.rows[0] || null;
  }

  static async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const text = `
      UPDATE users
      SET password = $2,
          reset_password_token = NULL,
          reset_password_expire = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email
    `;
    const result = await query(text, [userId, hashedPassword]);
    return result.rows[0];
  }

  static async clearResetToken(userId) {
    const text = `
      UPDATE users
      SET reset_password_token = NULL,
          reset_password_expire = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await query(text, [userId]);
  }

  static async updateProfileImage(userId, imageData) {
    const text = `
      UPDATE users
      SET profile_image = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, profile_image
    `;
    const result = await query(text, [userId, imageData]);
    return result.rows[0];
  }

  // --- UTILITY METHODS ---
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async deactivateAccount(userId) {
    const text = `
      UPDATE users
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, email, "role"
    `;
    const result = await query(text, [userId]);
    return result.rows[0];
  }

  static async checkEmailExists(email) {
    const text = `SELECT id FROM users WHERE email = $1`;
    const result = await query(text, [email.toLowerCase()]);
    return result.rows.length > 0;
  }
}

export default User;
