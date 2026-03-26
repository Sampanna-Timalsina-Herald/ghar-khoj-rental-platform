/**
 * Admin Analytics Routes
 * Advanced analytics and reporting endpoints
 */

import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth-enhanced.js';
import adminAnalyticsController from '../controllers/adminAnalyticsController.js';

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authMiddleware, adminMiddleware);

/**
 * GET /api/admin/analytics/dashboard
 * Get comprehensive dashboard data (all analytics in one call)
 */
router.get('/dashboard', adminAnalyticsController.getDashboardData);

/**
 * GET /api/admin/analytics/stats
 * Get overall platform statistics
 */
router.get('/stats', adminAnalyticsController.getOverallStats);

/**
 * GET /api/admin/analytics/trends
 * Get monthly trends (users, listings, conversations, bookings, revenue)
 * Query params: months (default: 6)
 */
router.get('/trends', adminAnalyticsController.getMonthlyTrends);

/**
 * GET /api/admin/analytics/categories
 * Get listing category distribution
 */
router.get('/categories', adminAnalyticsController.getCategoryDistribution);

/**
 * GET /api/admin/analytics/user-growth
 * Get daily user growth data
 * Query params: days (default: 30)
 */
router.get('/user-growth', adminAnalyticsController.getUserGrowth);

/**
 * GET /api/admin/analytics/listing-stats
 * Get detailed listing statistics
 */
router.get('/listing-stats', adminAnalyticsController.getListingStats);

/**
 * GET /api/admin/analytics/top-cities
 * Get top cities by listing count
 * Query params: limit (default: 10)
 */
router.get('/top-cities', adminAnalyticsController.getTopCities);

/**
 * GET /api/admin/analytics/activities
 * Get recent activity logs
 * Query params: limit (default: 20)
 */
router.get('/activities', adminAnalyticsController.getActivityLogs);

/**
 * GET /api/admin/analytics/revenue-stats
 * Get revenue statistics
 */
router.get('/revenue-stats', adminAnalyticsController.getRevenueStats);

/**
 * GET /api/admin/analytics/landlord-stats
 * Get landlord performance statistics
 * Query params: limit (default: 10)
 */
router.get('/landlord-stats', adminAnalyticsController.getLandlordStats);

/**
 * GET /api/admin/analytics/booking-stats
 * Get booking statistics
 */
router.get('/booking-stats', adminAnalyticsController.getBookingStats);

/**
 * GET /api/admin/analytics/export
 * Export analytics report
 * Query params: format (json/csv), include (all/specific sections)
 */
router.get('/export', adminAnalyticsController.exportReport);

// ==================== ADVANCED ANALYTICS ROUTES ====================

/**
 * GET /api/admin/analytics/comprehensive
 * Get all analytics data in one call (comprehensive dashboard)
 * Query params: startDate, endDate
 */
router.get('/comprehensive', adminAnalyticsController.getComprehensiveDashboard);

/**
 * GET /api/admin/analytics/listings/overview
 * Get comprehensive listing overview
 * Stats: total, active, inactive, rented, verified, unverified, deleted, reported, expired
 * Query params: startDate, endDate
 */
router.get('/listings/overview', adminAnalyticsController.getListingOverview);

/**
 * GET /api/admin/analytics/listings/by-property-type
 * Get listings distribution by property type with trends
 * Returns: count, percentage, avg rent, monthly trends
 * Query params: startDate, endDate
 */
router.get('/listings/by-property-type', adminAnalyticsController.getListingsByPropertyType);

/**
 * GET /api/admin/analytics/listings/by-location
 * Get listings by location (city, area, college proximity)
 * Query params: startDate, endDate
 */
router.get('/listings/by-location', adminAnalyticsController.getListingsByLocation);

/**
 * GET /api/admin/analytics/price-reports
 * Get comprehensive price-based reports
 * Returns: min, max, avg, median rent, distributions, trends, growth rate
 * Query params: startDate, endDate, propertyType, city
 */
router.get('/price-reports', adminAnalyticsController.getPriceReports);

/**
 * GET /api/admin/analytics/rental-activity
 * Get rented properties statistics
 * Returns: rented this month, last 15/30 days, by type and location
 * Query params: startDate, endDate
 */
router.get('/rental-activity', adminAnalyticsController.getRentalActivity);

/**
 * GET /api/admin/analytics/vacancy-rate
 * Get vacancy rate analysis
 * Returns: overall vacancy rate, by location and property type
 */
router.get('/vacancy-rate', adminAnalyticsController.getVacancyRate);

/**
 * GET /api/admin/analytics/time-to-rent
 * Get average time to rent analysis
 * Returns: avg days, fastest, slowest by property type and location
 */
router.get('/time-to-rent', adminAnalyticsController.getTimeToRent);

/**
 * GET /api/admin/analytics/users/stats
 * Get user registration and engagement statistics
 * Returns: total users, new users (7/30 days), active users, role distribution
 * Query params: startDate, endDate
 */
router.get('/users/stats', adminAnalyticsController.getUserStats);

/**
 * GET /api/admin/analytics/users/activity
 * Get user activity reports
 * Returns: most active landlords, searched locations/prices, viewed/favorited properties
 */
router.get('/users/activity', adminAnalyticsController.getUserActivity);

/**
 * GET /api/admin/analytics/financial
 * Get financial reports (commission and revenue)
 * Returns: total revenue, by property type, by landlord, trends, periodic reports
 * Query params: startDate, endDate, status
 */
router.get('/financial', adminAnalyticsController.getFinancialReports);

/**
 * GET /api/admin/analytics/heatmap
 * Get heatmap data for demand analysis
 * Returns: most searched areas, most rented areas, high demand zones
 */
router.get('/heatmap', adminAnalyticsController.getHeatmapData);

/**
 * GET /api/admin/analytics/demand-supply
 * Get demand vs supply analysis
 * Returns: supply vs demand ratio, market status by location and type
 */
router.get('/demand-supply', adminAnalyticsController.getDemandSupplyAnalysis);

/**
 * GET /api/admin/analytics/price-elasticity
 * Get price elasticity analysis
 * Returns: price vs rental speed correlation
 */
router.get('/price-elasticity', adminAnalyticsController.getPriceElasticity);

export default router;
