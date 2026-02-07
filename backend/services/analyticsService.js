/**
 * Analytics Service
 * Comprehensive analytics and reporting service for admin dashboard
 */

import db from '../config/database.js';

class AnalyticsService {
  /**
   * Get overall platform statistics
   */
  async getOverallStats() {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') AS new_users_30d,
          (SELECT COUNT(*)::int FROM listings) AS total_listings,
          (SELECT COUNT(*)::int FROM listings WHERE status = 'active' AND is_verified = true) AS active_listings,
          (SELECT COUNT(*)::int FROM listings WHERE status = 'active' AND (is_verified = false OR is_verified IS NULL)) AS pending_listings,
          (SELECT COUNT(*)::int FROM conversations) AS total_conversations,
          (SELECT COUNT(*)::int FROM bookings) AS total_bookings,
          (SELECT COUNT(*)::int FROM bookings WHERE status = 'confirmed') AS confirmed_bookings,
          (SELECT COALESCE(SUM(commission_amount), 0)::numeric FROM commission_transactions WHERE payment_status = 'paid') AS total_revenue,
          (SELECT COALESCE(SUM(commission_amount), 0)::numeric FROM commission_transactions WHERE payment_status = 'pending') AS pending_revenue,
          (SELECT COUNT(DISTINCT city) FROM listings WHERE city IS NOT NULL) AS cities_count,
          (SELECT COUNT(DISTINCT landlord_id) FROM listings) AS landlords_count
      `);

      return stats.rows[0];
    } catch (error) {
      console.error('[Analytics] Error fetching overall stats:', error);
      throw error;
    }
  }

  /**
   * Get monthly trends for users, listings, and conversations
   */
  async getMonthlyTrends(months = 6) {
    try {
      const result = await db.query(`
        WITH months AS (
          SELECT 
            generate_series(
              date_trunc('month', CURRENT_DATE - INTERVAL '${parseInt(months) - 1} months'),
              date_trunc('month', CURRENT_DATE),
              '1 month'::interval
            ) AS month
        ),
        user_counts AS (
          SELECT 
            date_trunc('month', created_at) AS month,
            COUNT(*)::int AS count
          FROM users
          WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
          GROUP BY date_trunc('month', created_at)
        ),
        listing_counts AS (
          SELECT 
            date_trunc('month', created_at) AS month,
            COUNT(*)::int AS count
          FROM listings
          WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
          GROUP BY date_trunc('month', created_at)
        ),
        conversation_counts AS (
          SELECT 
            date_trunc('month', created_at) AS month,
            COUNT(*)::int AS count
          FROM conversations
          WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
          GROUP BY date_trunc('month', created_at)
        ),
        booking_counts AS (
          SELECT 
            date_trunc('month', created_at) AS month,
            COUNT(*)::int AS count
          FROM bookings
          WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
          GROUP BY date_trunc('month', created_at)
        ),
        revenue_totals AS (
          SELECT 
            date_trunc('month', created_at) AS month,
            COALESCE(SUM(commission_amount), 0)::numeric AS revenue
          FROM commission_transactions
          WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(months)} months'
            AND payment_status = 'paid'
          GROUP BY date_trunc('month', created_at)
        )
        SELECT 
          TO_CHAR(m.month, 'Mon') AS month,
          COALESCE(u.count, 0) AS users,
          COALESCE(l.count, 0) AS listings,
          COALESCE(c.count, 0) AS conversations,
          COALESCE(b.count, 0) AS bookings,
          COALESCE(r.revenue, 0) AS revenue
        FROM months m
        LEFT JOIN user_counts u ON m.month = u.month
        LEFT JOIN listing_counts l ON m.month = l.month
        LEFT JOIN conversation_counts c ON m.month = c.month
        LEFT JOIN booking_counts b ON m.month = b.month
        LEFT JOIN revenue_totals r ON m.month = r.month
        ORDER BY m.month;
      `);

      return result.rows;
    } catch (error) {
      console.error('[Analytics] Error fetching monthly trends:', error);
      throw error;
    }
  }

  /**
   * Get category distribution
   */
  async getCategoryDistribution() {
    try {
      const result = await db.query(`
        SELECT 
          COALESCE(type, 'Other') AS name,
          COUNT(*)::int AS value,
          ROUND((COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM listings WHERE status = 'active'), 0)), 1)::numeric AS percentage
        FROM listings
        WHERE status = 'active'
        GROUP BY type
        ORDER BY value DESC;
      `);

      return result.rows;
    } catch (error) {
      console.error('[Analytics] Error fetching category distribution:', error);
      throw error;
    }
  }

  /**
   * Get user growth data (daily for last 30 days)
   */
  async getUserGrowth(days = 30) {
    try {
      const result = await db.query(`
        WITH daily_users AS (
          SELECT 
            DATE(created_at) AS date,
            COUNT(*)::int AS new_users
          FROM users
          WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
          GROUP BY DATE(created_at)
        )
        SELECT 
          to_char(date, 'YYYY-MM-DD') AS date,
          new_users,
          SUM(new_users) OVER (ORDER BY date)::int AS total_users
        FROM daily_users
        ORDER BY date;
      `);

      return result.rows;
    } catch (error) {
      console.error('[Analytics] Error fetching user growth:', error);
      throw error;
    }
  }

  /**
   * Get listing statistics
   */
  async getListingStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active' AND is_verified = true)::int AS active_listings,
          COUNT(*) FILTER (WHERE status = 'active' AND (is_verified = false OR is_verified IS NULL))::int AS pending_listings,
          COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive_listings,
          ROUND(AVG(rent_amount), 2)::numeric AS avg_rent,
          MIN(rent_amount)::numeric AS min_rent,
          MAX(rent_amount)::numeric AS max_rent,
          COUNT(DISTINCT city)::int AS cities_count,
          COUNT(DISTINCT landlord_id)::int AS landlords_count,
          COUNT(*) FILTER (WHERE bedrooms = 1)::int AS one_bedroom,
          COUNT(*) FILTER (WHERE bedrooms = 2)::int AS two_bedroom,
          COUNT(*) FILTER (WHERE bedrooms = 3)::int AS three_bedroom,
          COUNT(*) FILTER (WHERE bedrooms >= 4)::int AS four_plus_bedroom
        FROM listings;
      `);

      return result.rows[0];
    } catch (error) {
      console.error('[Analytics] Error fetching listing stats:', error);
      throw error;
    }
  }

  /**
   * Get top cities by listing count
   */
  async getTopCities(limit = 10) {
    try {
      const result = await db.query(`
        SELECT 
          city,
          COUNT(*)::int AS listing_count,
          ROUND(AVG(rent_amount), 2)::numeric AS avg_rent,
          COUNT(DISTINCT landlord_id)::int AS landlord_count,
          MIN(rent_amount)::numeric AS min_rent,
          MAX(rent_amount)::numeric AS max_rent
        FROM listings
        WHERE city IS NOT NULL AND city != ''
        GROUP BY city
        ORDER BY listing_count DESC
        LIMIT $1;
      `, [parseInt(limit)]);

      return result.rows;
    } catch (error) {
      console.error('[Analytics] Error fetching top cities:', error);
      throw error;
    }
  }

  /**
   * Get activity logs
   */
  async getActivityLogs(limit = 20) {
    try {
      const result = await db.query(`
        SELECT 
          al.*,
          u.name AS user_name,
          u.email AS user_email,
          u.role AS user_role
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT $1;
      `, [parseInt(limit)]);

      return result.rows;
    } catch (error) {
      console.error('[Analytics] Error fetching activity logs:', error);
      // Return empty array if audit_logs table doesn't exist
      return [];
    }
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats() {
    try {
      const result = await db.query(`
        SELECT 
          COALESCE(SUM(commission_amount) FILTER (WHERE payment_status = 'paid'), 0)::numeric AS total_paid,
          COALESCE(SUM(commission_amount) FILTER (WHERE payment_status = 'pending'), 0)::numeric AS total_pending,
          COALESCE(SUM(commission_amount) FILTER (WHERE payment_status = 'overdue'), 0)::numeric AS total_overdue,
          COALESCE(SUM(commission_amount) FILTER (WHERE payment_status = 'waived'), 0)::numeric AS total_waived,
          COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_count,
          COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS pending_count,
          COUNT(*) FILTER (WHERE payment_status = 'overdue')::int AS overdue_count,
          ROUND(AVG(commission_amount), 2)::numeric AS avg_commission,
          ROUND(AVG(commission_rate), 2)::numeric AS avg_commission_rate
        FROM commission_transactions;
      `);

      return result.rows[0] || {
        total_paid: 0,
        total_pending: 0,
        total_overdue: 0,
        total_waived: 0,
        paid_count: 0,
        pending_count: 0,
        overdue_count: 0,
        avg_commission: 0,
        avg_commission_rate: 0
      };
    } catch (error) {
      console.error('[Analytics] Error fetching revenue stats:', error);
      // Return default values if commission_transactions table doesn't exist
      return {
        total_paid: 0,
        total_pending: 0,
        total_overdue: 0,
        total_waived: 0,
        paid_count: 0,
        pending_count: 0,
        overdue_count: 0,
        avg_commission: 0,
        avg_commission_rate: 0
      };
    }
  }

  /**
   * Get landlord performance stats
   */
  async getLandlordStats(limit = 10) {
    try {
      const result = await db.query(`
        SELECT 
          u.id,
          u.name,
          u.email,
          COUNT(DISTINCT l.id)::int AS listing_count,
          COUNT(DISTINCT b.id)::int AS booking_count,
          COALESCE(SUM(ct.commission_amount), 0)::numeric AS total_commission_generated,
          ROUND(AVG(l.rent_amount), 2)::numeric AS avg_listing_rent
        FROM users u
        LEFT JOIN listings l ON u.id = l.landlord_id
        LEFT JOIN bookings b ON l.id = b.listing_id
        LEFT JOIN commission_transactions ct ON u.id = ct.landlord_id
        WHERE u.role = 'landlord'
        GROUP BY u.id, u.name, u.email
        HAVING COUNT(DISTINCT l.id) > 0
        ORDER BY total_commission_generated DESC
        LIMIT $1;
      `, [parseInt(limit)]);

      return result.rows;
    } catch (error) {
      console.error('[Analytics] Error fetching landlord stats:', error);
      return [];
    }
  }

  /**
   * Get booking statistics
   */
  async getBookingStats() {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*)::int AS total_bookings,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_bookings,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_bookings,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_bookings,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_bookings,
          ROUND(AVG(EXTRACT(EPOCH FROM (end_date - start_date)) / 86400), 1)::numeric AS avg_booking_duration_days
        FROM bookings;
      `);

      return result.rows[0] || {
        total_bookings: 0,
        confirmed_bookings: 0,
        pending_bookings: 0,
        cancelled_bookings: 0,
        completed_bookings: 0,
        avg_booking_duration_days: 0
      };
    } catch (error) {
      console.error('[Analytics] Error fetching booking stats:', error);
      return {
        total_bookings: 0,
        confirmed_bookings: 0,
        pending_bookings: 0,
        cancelled_bookings: 0,
        completed_bookings: 0,
        avg_booking_duration_days: 0
      };
    }
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData() {
    try {
      const [
        overallStats,
        monthlyTrends,
        categoryDistribution,
        listingStats,
        topCities,
        revenueStats,
        bookingStats
      ] = await Promise.all([
        this.getOverallStats(),
        this.getMonthlyTrends(6),
        this.getCategoryDistribution(),
        this.getListingStats(),
        this.getTopCities(5),
        this.getRevenueStats(),
        this.getBookingStats()
      ]);

      return {
        overallStats,
        monthlyTrends,
        categoryDistribution,
        listingStats,
        topCities,
        revenueStats,
        bookingStats
      };
    } catch (error) {
      console.error('[Analytics] Error fetching dashboard data:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();
