/**
 * Commission Service
 * Handles commission calculations and tracking for the rental platform
 */

import db from '../config/database.js';

class CommissionService {
  /**
   * Get active commission settings
   */
  async getActiveSettings() {
    try {
      const result = await db.query(
        `SELECT * FROM commission_settings 
         WHERE is_active = TRUE 
         ORDER BY effective_from DESC 
         LIMIT 1`
      );
      
      return result.rows[0] || {
        commission_type: 'percentage',
        commission_rate: 7.00,
        minimum_commission: 500.00
      };
    } catch (error) {
      console.error('Error fetching commission settings:', error);
      throw error;
    }
  }

  /**
   * Calculate commission for a given rent amount
   */
  async calculateCommission(rentAmount) {
    try {
      const result = await db.query(
        'SELECT * FROM calculate_commission($1)',
        [rentAmount]
      );
      
      return result.rows[0] || {
        commission_rate: 7.00,
        commission_amount: Math.max(rentAmount * 0.07, 500)
      };
    } catch (error) {
      console.error('Error calculating commission:', error);
      
      // Fallback calculation
      const amount = Math.max(rentAmount * 0.07, 500);
      return {
        commission_rate: 7.00,
        commission_amount: Math.round(amount * 100) / 100
      };
    }
  }

  /**
   * Create commission transaction for a booking
   */
  async createCommissionTransaction(bookingData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Check if commission already exists
      const existing = await client.query(
        'SELECT id FROM commission_transactions WHERE booking_id = $1',
        [bookingData.booking_id]
      );
      
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return existing.rows[0];
      }
      
      // Calculate rental months from dates (or use provided value)
      let rentalMonths = bookingData.rental_months;
      if (!rentalMonths && bookingData.start_date && bookingData.end_date) {
        const startDate = new Date(bookingData.start_date);
        const endDate = new Date(bookingData.end_date);
        const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                          (endDate.getMonth() - startDate.getMonth()) + 1;
        rentalMonths = Math.max(1, monthsDiff);
      } else {
        rentalMonths = rentalMonths || 1;
      }
      
      // Calculate total rental amount (monthly rent × number of months)
      const totalRentAmount = bookingData.rent_amount * rentalMonths;
      
      console.log(`[COMMISSION] Calculating for ${rentalMonths} months: Rs. ${bookingData.rent_amount} × ${rentalMonths} = Rs. ${totalRentAmount}`);
      
      // Calculate commission on total rental amount
      const commission = await this.calculateCommission(totalRentAmount);
      
      console.log(`[COMMISSION] Commission: ${commission.commission_rate}% of Rs. ${totalRentAmount} = Rs. ${commission.commission_amount}`);
      
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}-${bookingData.booking_id.substring(0, 8)}`;
      
      // Create commission transaction
      const result = await client.query(
        `INSERT INTO commission_transactions (
          booking_id, landlord_id, listing_id, rent_amount, 
          commission_rate, commission_amount, payment_status,
          due_date, invoice_number, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          bookingData.booking_id,
          bookingData.landlord_id,
          bookingData.listing_id,
          totalRentAmount, // Store total rent for full period
          commission.commission_rate,
          commission.commission_amount,
          'pending',
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Due in 30 days
          invoiceNumber,
          `Commission for ${rentalMonths} month(s) rental - Booking ${bookingData.booking_id}`
        ]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating commission transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all commission transactions (for admin)
   */
  async getAllTransactions(filters = {}) {
    try {
      let query = `
        SELECT 
          ct.*,
          b.start_date, b.end_date, b.status as booking_status,
          l.title as listing_title, l.address, l.city,
          u.name as landlord_name, u.email as landlord_email, u.phone as landlord_phone
        FROM commission_transactions ct
        JOIN bookings b ON ct.booking_id = b.id
        JOIN listings l ON ct.listing_id = l.id
        JOIN users u ON ct.landlord_id = u.id
        WHERE 1=1
      `;
      
      const params = [];
      let paramCount = 1;
      
      if (filters.payment_status) {
        query += ` AND ct.payment_status = $${paramCount}`;
        params.push(filters.payment_status);
        paramCount++;
      }
      
      if (filters.landlord_id) {
        query += ` AND ct.landlord_id = $${paramCount}`;
        params.push(filters.landlord_id);
        paramCount++;
      }
      
      if (filters.from_date) {
        query += ` AND ct.created_at >= $${paramCount}`;
        params.push(filters.from_date);
        paramCount++;
      }
      
      if (filters.to_date) {
        query += ` AND ct.created_at <= $${paramCount}`;
        params.push(filters.to_date);
        paramCount++;
      }
      
      query += ' ORDER BY ct.created_at DESC';
      
      if (filters.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
        paramCount++;
      }
      
      const result = await db.query(query, params);
      return result.rows;
      
    } catch (error) {
      console.error('Error fetching commission transactions:', error);
      throw error;
    }
  }

  /**
   * Get commission transactions for a specific landlord
   */
  async getLandlordTransactions(landlordId, filters = {}) {
    try {
      let query = `
        SELECT 
          ct.*,
          b.start_date, b.end_date, b.status as booking_status,
          l.title as listing_title, l.address, l.city,
          t.name as tenant_name
        FROM commission_transactions ct
        JOIN bookings b ON ct.booking_id = b.id
        JOIN listings l ON ct.listing_id = l.id
        LEFT JOIN users t ON b.tenant_id = t.id
        WHERE ct.landlord_id = $1
      `;
      
      const params = [landlordId];
      let paramCount = 2;
      
      if (filters.payment_status) {
        query += ` AND ct.payment_status = $${paramCount}`;
        params.push(filters.payment_status);
        paramCount++;
      }
      
      query += ' ORDER BY ct.created_at DESC';
      
      const result = await db.query(query, params);
      return result.rows;
      
    } catch (error) {
      console.error('Error fetching landlord transactions:', error);
      throw error;
    }
  }

  /**
   * Get admin revenue summary
   */
  async getRevenueSummary() {
    try {
      const result = await db.query('SELECT * FROM admin_revenue_summary');
      return result.rows[0] || {
        total_transactions: 0,
        total_revenue: 0,
        pending_revenue: 0,
        overdue_revenue: 0,
        paid_count: 0,
        pending_count: 0,
        overdue_count: 0
      };
    } catch (error) {
      console.error('Error fetching revenue summary:', error);
      throw error;
    }
  }

  /**
   * Get landlord commission summary
   */
  async getLandlordSummary(landlordId) {
    try {
      const result = await db.query(
        'SELECT * FROM landlord_commission_summary WHERE landlord_id = $1',
        [landlordId]
      );
      
      return result.rows[0] || {
        total_commissions: 0,
        total_commission_amount: 0,
        paid_amount: 0,
        pending_amount: 0,
        overdue_amount: 0,
        paid_count: 0,
        pending_count: 0,
        overdue_count: 0
      };
    } catch (error) {
      console.error('Error fetching landlord summary:', error);
      throw error;
    }
  }

  /**
   * Get monthly revenue trends
   */
  async getMonthlyTrends(months = 12) {
    try {
      const result = await db.query(
        `SELECT * FROM monthly_revenue_trends
         WHERE month >= NOW() - INTERVAL '${months} months'
         ORDER BY month DESC`
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error fetching monthly trends:', error);
      throw error;
    }
  }

  /**
   * Update commission payment status
   */
  async updatePaymentStatus(commissionId, paymentData) {
    try {
      const result = await db.query(
        `UPDATE commission_transactions 
         SET 
           payment_status = $1,
           payment_date = $2,
           payment_method = $3,
           payment_reference = $4,
           notes = COALESCE($5, notes),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [
          paymentData.payment_status,
          paymentData.payment_date || new Date(),
          paymentData.payment_method,
          paymentData.payment_reference,
          paymentData.notes,
          commissionId
        ]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Commission transaction not found');
      }
      
      return result.rows[0];
      
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  /**
   * Mark overdue commissions
   */
  async markOverdueCommissions() {
    try {
      await db.query('SELECT mark_overdue_commissions()');
      return { success: true };
    } catch (error) {
      console.error('Error marking overdue commissions:', error);
      throw error;
    }
  }

  /**
   * Update commission settings (admin only)
   */
  async updateSettings(settingsData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Deactivate old settings
      await client.query(
        'UPDATE commission_settings SET is_active = FALSE WHERE is_active = TRUE'
      );
      
      // Create new settings
      const result = await client.query(
        `INSERT INTO commission_settings (
          commission_type, commission_rate, minimum_commission,
          maximum_commission, notes, is_active, effective_from
        ) VALUES ($1, $2, $3, $4, $5, TRUE, $6)
        RETURNING *`,
        [
          settingsData.commission_type || 'percentage',
          settingsData.commission_rate,
          settingsData.minimum_commission,
          settingsData.maximum_commission,
          settingsData.notes,
          settingsData.effective_from || new Date()
        ]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating commission settings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get commission by booking ID
   */
  async getCommissionByBooking(bookingId) {
    try {
      const result = await db.query(
        'SELECT * FROM commission_transactions WHERE booking_id = $1',
        [bookingId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching commission by booking:', error);
      throw error;
    }
  }

  /**
   * Generate commission invoice data
   */
  async generateInvoice(commissionId) {
    try {
      const result = await db.query(
        `SELECT 
          ct.*,
          b.start_date, b.end_date, b.monthly_rent,
          l.title as listing_title, l.address as listing_address, l.city,
          ll.name as landlord_name, ll.email as landlord_email, 
          ll.phone as landlord_phone,
          t.name as tenant_name,
          GREATEST(1, EXTRACT(MONTH FROM AGE(b.end_date, b.start_date))::INTEGER + 1) as calculated_rental_months,
          b.monthly_rent * GREATEST(1, EXTRACT(MONTH FROM AGE(b.end_date, b.start_date))::INTEGER + 1) as total_rent_amount
        FROM commission_transactions ct
        JOIN bookings b ON ct.booking_id = b.id
        JOIN listings l ON ct.listing_id = l.id
        JOIN users ll ON ct.landlord_id = ll.id
        LEFT JOIN users t ON b.tenant_id = t.id
        WHERE ct.id = $1`,
        [commissionId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Commission transaction not found');
      }
      
      return result.rows[0];
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      throw error;
    }
  }
}

export default new CommissionService();
