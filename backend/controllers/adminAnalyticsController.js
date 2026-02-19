/**
 * Admin Analytics Controller
 * Handles all analytics and reporting endpoints for admin dashboard
 */

import analyticsService from '../services/analyticsService.js';
import advancedAnalyticsService from '../services/advancedAnalyticsService.js';
import exportService from '../services/exportService.js';

/**
 * Get overall platform statistics
 */
export const getOverallStats = async (req, res) => {
  try {
    const stats = await analyticsService.getOverallStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching overall stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform statistics'
    });
  }
};

/**
 * Get monthly trends
 */
export const getMonthlyTrends = async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const trends = await analyticsService.getMonthlyTrends(parseInt(months));
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching monthly trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly trends'
    });
  }
};

/**
 * Get category distribution
 */
export const getCategoryDistribution = async (req, res) => {
  try {
    const categories = await analyticsService.getCategoryDistribution();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching category distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category distribution'
    });
  }
};

/**
 * Get user growth data
 */
export const getUserGrowth = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const growth = await analyticsService.getUserGrowth(parseInt(days));
    
    res.json({
      success: true,
      data: growth
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching user growth:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user growth data'
    });
  }
};

/**
 * Get listing statistics
 */
export const getListingStats = async (req, res) => {
  try {
    const stats = await analyticsService.getListingStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching listing stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listing statistics'
    });
  }
};

/**
 * Get top cities
 */
export const getTopCities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const cities = await analyticsService.getTopCities(parseInt(limit));
    
    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching top cities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top cities'
    });
  }
};

/**
 * Get activity logs
 */
export const getActivityLogs = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const logs = await analyticsService.getActivityLogs(parseInt(limit));
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activity logs'
    });
  }
};

/**
 * Get revenue statistics
 */
export const getRevenueStats = async (req, res) => {
  try {
    const stats = await analyticsService.getRevenueStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching revenue stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue statistics'
    });
  }
};

/**
 * Get landlord performance stats
 */
export const getLandlordStats = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stats = await analyticsService.getLandlordStats(parseInt(limit));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching landlord stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch landlord statistics'
    });
  }
};

/**
 * Get booking statistics
 */
export const getBookingStats = async (req, res) => {
  try {
    const stats = await analyticsService.getBookingStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking statistics'
    });
  }
};

/**
 * Get comprehensive dashboard data
 */
export const getDashboardData = async (req, res) => {
  try {
    const data = await analyticsService.getDashboardData();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Admin Analytics] Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
};

/**
 * Export analytics report
 */
export const exportReport = async (req, res) => {
  try {
    const { format = 'csv', reportType = 'comprehensive', ...filters } = req.query;
    
    let data;
    
    // Fetch data based on report type
    switch (reportType) {
      case 'comprehensive':
        data = await advancedAnalyticsService.getComprehensiveDashboard(filters);
        break;
      case 'listings':
        data = await advancedAnalyticsService.getListingOverview(filters);
        break;
      case 'users':
        data = await advancedAnalyticsService.getUserStats(filters);
        break;
      case 'financial':
        data = await advancedAnalyticsService.getFinancialReports(filters);
        break;
      case 'rental-activity':
        data = await advancedAnalyticsService.getRentalActivity(filters);
        break;
      default:
        data = await advancedAnalyticsService.getComprehensiveDashboard(filters);
    }
    
    if (format === 'json') {
      res.json({
        success: true,
        data,
        generatedAt: new Date().toISOString()
      });
    } else if (format === 'csv') {
      const csv = exportService.exportToCSV(data, reportType);
      const filename = exportService.generateFilename(reportType, 'csv');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } else if (format === 'pdf') {
      const pdfBuffer = await exportService.exportToPDF(data, reportType);
      const filename = exportService.generateFilename(reportType, 'pdf');
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Supported formats: json, csv, pdf'
      });
    }
  } catch (error) {
    console.error('[Admin Analytics] Error exporting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics report'
    });
  }
};

export default {
  getOverallStats,
  getMonthlyTrends,
  getCategoryDistribution,
  getUserGrowth,
  getListingStats,
  getTopCities,
  getActivityLogs,
  getRevenueStats,
  getLandlordStats,
  getBookingStats,
  getDashboardData,
  exportReport,
  // Advanced Analytics Endpoints
  getListingOverview,
  getListingsByPropertyType,
  getListingsByLocation,
  getPriceReports,
  getRentalActivity,
  getVacancyRate,
  getTimeToRent,
  getUserStats,
  getUserActivity,
  getFinancialReports,
  getHeatmapData,
  getDemandSupplyAnalysis,
  getPriceElasticity,
  getComprehensiveDashboard
};

// ==================== ADVANCED ANALYTICS ENDPOINTS ====================

/**
 * Get comprehensive listing overview
 */
export async function getListingOverview(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      city: req.query.city,
      propertyType: req.query.propertyType,
      status: req.query.status
    };
    
    const data = await advancedAnalyticsService.getListingOverview(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching listing overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch listing overview'
    });
  }
}

/**
 * Get listings by property type with trends
 */
export async function getListingsByPropertyType(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      city: req.query.city,
      propertyType: req.query.propertyType,
      status: req.query.status
    };
    
    const data = await advancedAnalyticsService.getListingsByPropertyType(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching property type data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property type data'
    });
  }
}

/**
 * Get listings by location
 */
export async function getListingsByLocation(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      city: req.query.city,
      propertyType: req.query.propertyType,
      status: req.query.status
    };
    
    const data = await advancedAnalyticsService.getListingsByLocation(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching location data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location data'
    });
  }
}

/**
 * Get comprehensive price reports
 */
export async function getPriceReports(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      propertyType: req.query.propertyType,
      city: req.query.city
    };
    
    const data = await advancedAnalyticsService.getPriceReports(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching price reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price reports'
    });
  }
}

/**
 * Get rental activity reports
 */
export async function getRentalActivity(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      city: req.query.city,
      propertyType: req.query.propertyType,
      status: req.query.status
    };
    
    const data = await advancedAnalyticsService.getRentalActivity(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching rental activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rental activity'
    });
  }
}

/**
 * Get vacancy rate analysis
 */
export async function getVacancyRate(req, res) {
  try {
    const data = await advancedAnalyticsService.getVacancyRate();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching vacancy rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vacancy rate'
    });
  }
}

/**
 * Get average time to rent
 */
export async function getTimeToRent(req, res) {
  try {
    const data = await advancedAnalyticsService.getTimeToRent();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching time to rent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch time to rent'
    });
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      role: req.query.role
    };
    
    const data = await advancedAnalyticsService.getUserStats(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics'
    });
  }
}

/**
 * Get user activity reports
 */
export async function getUserActivity(req, res) {
  try {
    const data = await advancedAnalyticsService.getUserActivity();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching user activity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activity'
    });
  }
}

/**
 * Get financial reports
 */
export async function getFinancialReports(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status || req.query.paymentStatus // Support both status and paymentStatus
    };
    
    const data = await advancedAnalyticsService.getFinancialReports(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching financial reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch financial reports'
    });
  }
}

/**
 * Get heatmap data
 */
export async function getHeatmapData(req, res) {
  try {
    const data = await advancedAnalyticsService.getHeatmapData();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching heatmap data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch heatmap data'
    });
  }
}

/**
 * Get demand vs supply analysis
 */
export async function getDemandSupplyAnalysis(req, res) {
  try {
    const data = await advancedAnalyticsService.getDemandSupplyAnalysis();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching demand supply analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch demand supply analysis'
    });
  }
}

/**
 * Get price elasticity analysis
 */
export async function getPriceElasticity(req, res) {
  try {
    const data = await advancedAnalyticsService.getPriceElasticity();
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching price elasticity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch price elasticity'
    });
  }
}

/**
 * Get comprehensive dashboard (all analytics in one call)
 */
export async function getComprehensiveDashboard(req, res) {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      city: req.query.city,
      propertyType: req.query.propertyType,
      status: req.query.status || req.query.paymentStatus, // Support both status and paymentStatus
      role: req.query.role
    };
    
    const data = await advancedAnalyticsService.getComprehensiveDashboard(filters);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Advanced Analytics] Error fetching comprehensive dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comprehensive dashboard'
    });
  }
}

