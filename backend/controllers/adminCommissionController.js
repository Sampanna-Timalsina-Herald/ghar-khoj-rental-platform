/**
 * Admin Commission Controller
 * Handles all commission-related operations for administrators
 */

import commissionService from '../services/commissionService.js';

/**
 * Get admin revenue dashboard summary
 */
export const getRevenueDashboard = async (req, res) => {
  try {
    const summary = await commissionService.getRevenueSummary();
    const monthlyTrends = await commissionService.getMonthlyTrends(12);
    const recentTransactions = await commissionService.getAllTransactions({ limit: 10 });
    const commissionEnabled = await commissionService.isCommissionEnabled();
    
    res.json({
      success: true,
      data: {
        summary,
        monthlyTrends,
        recentTransactions,
        commission_enabled: commissionEnabled
      }
    });
  } catch (error) {
    console.error('Error fetching revenue dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue dashboard'
    });
  }
};

/**
 * Get all commission transactions with filters
 */
export const getAllCommissions = async (req, res) => {
  try {
    const { payment_status, landlord_id, from_date, to_date, limit } = req.query;
    
    const filters = {};
    if (payment_status) filters.payment_status = payment_status;
    if (landlord_id) filters.landlord_id = landlord_id;
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;
    if (limit) filters.limit = parseInt(limit);
    
    const transactions = await commissionService.getAllTransactions(filters);
    
    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission transactions'
    });
  }
};

/**
 * Get specific commission transaction details
 */
export const getCommissionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await commissionService.generateInvoice(id);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Commission transaction not found'
      });
    }
    
    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching commission details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission details'
    });
  }
};

/**
 * Update commission payment status
 */
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_method, payment_reference, payment_date, notes } = req.body;
    
    if (!payment_status) {
      return res.status(400).json({
        success: false,
        error: 'Payment status is required'
      });
    }
    
    const validStatuses = ['pending', 'paid', 'overdue', 'waived'];
    if (!validStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const paymentData = {
      payment_status,
      payment_method,
      payment_reference,
      payment_date: payment_date || new Date(),
      notes
    };
    
    const updated = await commissionService.updatePaymentStatus(id, paymentData);
    
    res.json({
      success: true,
      message: 'Payment status updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update payment status'
    });
  }
};

/**
 * Mark payment as paid
 */
export const markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, payment_reference, notes } = req.body;
    
    const paymentData = {
      payment_status: 'paid',
      payment_method: payment_method || 'bank_transfer',
      payment_reference,
      payment_date: new Date(),
      notes
    };
    
    const updated = await commissionService.updatePaymentStatus(id, paymentData);
    
    res.json({
      success: true,
      message: 'Commission marked as paid successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error marking commission as paid:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark commission as paid'
    });
  }
};

/**
 * Get monthly revenue trends
 */
export const getMonthlyTrends = async (req, res) => {
  try {
    const { months = 12 } = req.query;
    
    const trends = await commissionService.getMonthlyTrends(parseInt(months));
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error fetching monthly trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monthly revenue trends'
    });
  }
};

/**
 * Get commission settings
 */
export const getCommissionSettings = async (req, res) => {
  try {
    const settings = await commissionService.getActiveSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission settings'
    });
  }
};

/**
 * Update commission settings
 */
export const updateCommissionSettings = async (req, res) => {
  try {
    const { commission_type, commission_rate, minimum_commission, maximum_commission, notes, effective_from } = req.body;
    
    if (!commission_rate || commission_rate < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid commission rate is required'
      });
    }
    
    const settingsData = {
      commission_type: commission_type || 'percentage',
      commission_rate,
      minimum_commission,
      maximum_commission,
      notes,
      effective_from: effective_from || new Date()
    };
    
    const updated = await commissionService.updateSettings(settingsData);
    
    res.json({
      success: true,
      message: 'Commission settings updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update commission settings'
    });
  }
};

/**
 * Generate commission report
 */
export const generateReport = async (req, res) => {
  try {
    const { from_date, to_date, payment_status, format = 'json' } = req.query;
    
    const filters = {};
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;
    if (payment_status) filters.payment_status = payment_status;
    
    const transactions = await commissionService.getAllTransactions(filters);
    const summary = await commissionService.getRevenueSummary();
    
    // Calculate totals
    const reportData = {
      period: {
        from: from_date || 'All time',
        to: to_date || 'Present'
      },
      summary: {
        total_transactions: transactions.length,
        total_commission: transactions.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0),
        paid_amount: transactions.filter(t => t.payment_status === 'paid')
          .reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0),
        pending_amount: transactions.filter(t => t.payment_status === 'pending')
          .reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0),
        overdue_amount: transactions.filter(t => t.payment_status === 'overdue')
          .reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0)
      },
      transactions,
      generated_at: new Date(),
      generated_by: req.user?.name || 'Admin'
    };
    
    if (format === 'csv') {
      // Generate CSV format
      const csvRows = [
        ['Invoice Number', 'Landlord', 'Property', 'Rent Amount', 'Commission Rate', 'Commission Amount', 'Status', 'Due Date', 'Payment Date', 'Payment Method'].join(',')
      ];
      
      transactions.forEach(t => {
        csvRows.push([
          t.invoice_number,
          t.landlord_name,
          t.listing_title,
          t.rent_amount,
          `${t.commission_rate}%`,
          t.commission_amount,
          t.payment_status,
          t.due_date,
          t.payment_date || 'N/A',
          t.payment_method || 'N/A'
        ].join(','));
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=commission-report-${Date.now()}.csv`);
      res.send(csvRows.join('\n'));
    } else {
      res.json({
        success: true,
        data: reportData
      });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate commission report'
    });
  }
};

/**
 * Get pending commissions (overdue check)
 */
export const getPendingCommissions = async (req, res) => {
  try {
    // Mark overdue commissions
    await commissionService.markOverdueCommissions();
    
    // Get pending and overdue commissions
    const pending = await commissionService.getAllTransactions({ payment_status: 'pending' });
    const overdue = await commissionService.getAllTransactions({ payment_status: 'overdue' });
    
    res.json({
      success: true,
      data: {
        pending,
        overdue,
        pending_count: pending.length,
        overdue_count: overdue.length,
        pending_amount: pending.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0),
        overdue_amount: overdue.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching pending commissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending commissions'
    });
  }
};

/**
 * Calculate commission preview (for testing)
 */
export const calculateCommissionPreview = async (req, res) => {
  try {
    const { rent_amount } = req.query;
    
    if (!rent_amount || rent_amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid rent amount is required'
      });
    }
    
    const commission = await commissionService.calculateCommission(parseFloat(rent_amount));
    const settings = await commissionService.getActiveSettings();
    
    res.json({
      success: true,
      data: {
        rent_amount: parseFloat(rent_amount),
        commission_rate: commission.commission_rate,
        commission_amount: commission.commission_amount,
        settings
      }
    });
  } catch (error) {
    console.error('Error calculating commission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate commission'
    });
  }
};

/**
 * Get commission enabled/disabled status
 */
export const getCommissionStatus = async (req, res) => {
  try {
    const enabled = await commissionService.isCommissionEnabled();
    
    res.json({
      success: true,
      data: { commission_enabled: enabled }
    });
  } catch (error) {
    console.error('Error fetching commission status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission status'
    });
  }
};

/**
 * Toggle commission system on/off
 */
export const toggleCommission = async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean'
      });
    }
    
    await commissionService.toggleCommissionEnabled(enabled);
    
    res.json({
      success: true,
      message: `Commission system ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: { commission_enabled: enabled }
    });
  } catch (error) {
    console.error('Error toggling commission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle commission status'
    });
  }
};

export default {
  getRevenueDashboard,
  getAllCommissions,
  getCommissionDetails,
  updatePaymentStatus,
  markAsPaid,
  getMonthlyTrends,
  getCommissionSettings,
  updateCommissionSettings,
  generateReport,
  getPendingCommissions,
  calculateCommissionPreview,
  getCommissionStatus,
  toggleCommission
};
