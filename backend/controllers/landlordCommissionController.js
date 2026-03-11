/**
 * Landlord Commission Controller
 * Handles commission-related operations for landlords
 */

import commissionService from '../services/commissionService.js';

/**
 * Get landlord's commission dashboard
 */
export const getCommissionDashboard = async (req, res) => {
  try {
    const landlordId = req.user.userId;
    
    const summary = await commissionService.getLandlordSummary(landlordId);
    const transactions = await commissionService.getLandlordTransactions(landlordId);
    const settings = await commissionService.getActiveSettings();
    const commissionEnabled = await commissionService.isCommissionEnabled();
    
    res.json({
      success: true,
      data: {
        summary,
        transactions,
        commission_enabled: commissionEnabled,
        commission_policy: {
          rate: `${settings.commission_rate}%`,
          minimum: settings.minimum_commission,
          type: settings.commission_type
        }
      }
    });
  } catch (error) {
    console.error('Error fetching commission dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission dashboard'
    });
  }
};

/**
 * Get landlord's commission transactions
 */
export const getMyCommissions = async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const { payment_status } = req.query;
    
    const filters = {};
    if (payment_status) filters.payment_status = payment_status;
    
    const transactions = await commissionService.getLandlordTransactions(landlordId, filters);
    
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
 * Get pending commissions (amounts owed)
 */
export const getPendingCommissions = async (req, res) => {
  try {
    const landlordId = req.user.userId;
    
    const pending = await commissionService.getLandlordTransactions(landlordId, { 
      payment_status: 'pending' 
    });
    const overdue = await commissionService.getLandlordTransactions(landlordId, { 
      payment_status: 'overdue' 
    });
    
    const pendingAmount = pending.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0);
    const overdueAmount = overdue.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0);
    
    res.json({
      success: true,
      data: {
        pending: {
          transactions: pending,
          count: pending.length,
          total_amount: pendingAmount
        },
        overdue: {
          transactions: overdue,
          count: overdue.length,
          total_amount: overdueAmount
        },
        total_owed: pendingAmount + overdueAmount
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
 * Get payment history (paid commissions)
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const landlordId = req.user.userId;
    
    const paid = await commissionService.getLandlordTransactions(landlordId, { 
      payment_status: 'paid' 
    });
    
    const totalPaid = paid.reduce((sum, t) => sum + parseFloat(t.commission_amount || 0), 0);
    
    res.json({
      success: true,
      data: {
        transactions: paid,
        count: paid.length,
        total_paid: totalPaid
      }
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
};

/**
 * Get commission summary
 */
export const getCommissionSummary = async (req, res) => {
  try {
    const landlordId = req.user.userId;
    
    const summary = await commissionService.getLandlordSummary(landlordId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching commission summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission summary'
    });
  }
};

/**
 * Get specific commission details (invoice)
 */
export const getCommissionInvoice = async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const { id } = req.params;
    
    console.log('[LANDLORD COMMISSION] Fetching invoice:', id, 'for landlord:', landlordId);
    
    const invoice = await commissionService.generateInvoice(id);
    
    console.log('[LANDLORD COMMISSION] Invoice found:', invoice ? 'Yes' : 'No');
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Commission invoice not found'
      });
    }
    
    // Verify landlord owns this commission
    console.log('[LANDLORD COMMISSION] Verifying ownership - Invoice landlord:', invoice.landlord_id, 'Request landlord:', landlordId);
    
    if (invoice.landlord_id !== landlordId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    console.log('[LANDLORD COMMISSION] Sending invoice data');
    
    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching commission invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission invoice',
      details: error.message
    });
  }
};

/**
 * Get commission by booking ID
 */
export const getCommissionByBooking = async (req, res) => {
  try {
    const landlordId = req.user.userId;
    const { bookingId } = req.params;
    
    const commission = await commissionService.getCommissionByBooking(bookingId);
    
    if (!commission) {
      return res.status(404).json({
        success: false,
        error: 'Commission not found for this booking'
      });
    }
    
    // Verify landlord owns this commission
    if (commission.landlord_id !== landlordId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: commission
    });
  } catch (error) {
    console.error('Error fetching commission by booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission'
    });
  }
};

/**
 * Get commission policy/settings (informational)
 */
export const getCommissionPolicy = async (req, res) => {
  try {
    const settings = await commissionService.getActiveSettings();
    
    res.json({
      success: true,
      data: {
        commission_type: settings.commission_type,
        commission_rate: settings.commission_rate,
        minimum_commission: settings.minimum_commission,
        maximum_commission: settings.maximum_commission,
        description: `Platform charges ${settings.commission_rate}% commission on rental bookings` +
          (settings.minimum_commission ? ` with a minimum of Rs. ${settings.minimum_commission}` : '') +
          (settings.maximum_commission ? ` and a maximum of Rs. ${settings.maximum_commission}` : ''),
        payment_terms: 'Payment due within 30 days of booking activation'
      }
    });
  } catch (error) {
    console.error('Error fetching commission policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch commission policy'
    });
  }
};

/**
 * Calculate commission for a rent amount (preview)
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
    const netEarnings = parseFloat(rent_amount) - commission.commission_amount;
    
    res.json({
      success: true,
      data: {
        rent_amount: parseFloat(rent_amount),
        commission_rate: commission.commission_rate,
        commission_amount: commission.commission_amount,
        net_earnings: netEarnings,
        breakdown: {
          monthly_rent: parseFloat(rent_amount),
          platform_commission: commission.commission_amount,
          you_receive: netEarnings
        }
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

export default {
  getCommissionDashboard,
  getMyCommissions,
  getPendingCommissions,
  getPaymentHistory,
  getCommissionSummary,
  getCommissionInvoice,
  getCommissionByBooking,
  getCommissionPolicy,
  calculateCommissionPreview
};
