/**
 * Subscription Controller
 * Handles subscription-related HTTP requests
 */

import subscriptionService from '../services/subscriptionService.js';

/**
 * Get all available subscription plans
 */
export const getPlans = async (req, res) => {
  try {
    const plans = await subscriptionService.getAllPlans();
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error in getPlans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription plans'
    });
  }
};

/**
 * Get user's current subscription
 */
export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log('[SUBSCRIPTION] Fetching subscription for user:', userId);
    const result = await subscriptionService.getUserSubscription(userId);
    console.log('[SUBSCRIPTION] Result:', JSON.stringify(result, null, 2));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getMySubscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
};

/**
 * Get subscription usage details
 */
export const getUsage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const usage = await subscriptionService.getUsageDetails(userId);
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error in getUsage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage details'
    });
  }
};

/**
 * Create a new subscription
 */
export const createSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { plan_id, billing_cycle, payment_method, payment_reference, auto_renew } = req.body;

    // Validate required fields
    if (!plan_id || !billing_cycle) {
      return res.status(400).json({
        success: false,
        error: 'Plan ID and billing cycle are required'
      });
    }

    if (billing_cycle !== 'monthly' && billing_cycle !== 'annual') {
      return res.status(400).json({
        success: false,
        error: 'Billing cycle must be either monthly or annual'
      });
    }

    // Validate payment data
    subscriptionService.validatePaymentData({ payment_method, payment_reference });

    const result = await subscriptionService.subscribe(
      userId,
      plan_id,
      billing_cycle,
      { payment_method, payment_reference, auto_renew }
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error in createSubscription:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create subscription'
    });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscription_id } = req.params;

    const result = await subscriptionService.cancelSubscription(userId, subscription_id);

    res.json(result);
  } catch (error) {
    console.error('Error in cancelSubscription:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to cancel subscription'
    });
  }
};

/**
 * Renew subscription
 */
export const renewSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { payment_method, payment_reference, amount_paid } = req.body;

    // Validate payment data
    subscriptionService.validatePaymentData({ payment_method, payment_reference });

    if (!amount_paid) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount is required'
      });
    }

    const result = await subscriptionService.renewSubscription(userId, {
      payment_method,
      payment_reference,
      amount_paid
    });

    res.json(result);
  } catch (error) {
    console.error('Error in renewSubscription:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to renew subscription'
    });
  }
};

/**
 * Change subscription plan (upgrade/downgrade)
 */
export const changeSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { new_plan_id, payment_method, payment_reference, amount_paid } = req.body;

    if (!new_plan_id) {
      return res.status(400).json({
        success: false,
        error: 'New plan ID is required'
      });
    }

    // Validate payment data
    subscriptionService.validatePaymentData({ payment_method, payment_reference });

    if (!amount_paid) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount is required'
      });
    }

    const result = await subscriptionService.changeSubscription(userId, new_plan_id, {
      payment_method,
      payment_reference,
      amount_paid
    });

    res.json(result);
  } catch (error) {
    console.error('Error in changeSubscription:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to change subscription'
    });
  }
};

/**
 * Toggle auto-renew
 */
export const toggleAutoRenew = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscription_id } = req.params;
    const { auto_renew } = req.body;

    if (typeof auto_renew !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'auto_renew must be a boolean value'
      });
    }

    const result = await subscriptionService.toggleAutoRenew(userId, subscription_id, auto_renew);

    res.json(result);
  } catch (error) {
    console.error('Error in toggleAutoRenew:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update auto-renew setting'
    });
  }
};

/**
 * Check if user can create a listing
 */
export const checkEligibility = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await subscriptionService.checkListingEligibility(userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in checkEligibility:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check listing eligibility'
    });
  }
};

/**
 * Get subscription history
 */
export const getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const history = await subscriptionService.getSubscriptionHistory(userId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error in getHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription history'
    });
  }
};

/**
 * Calculate subscription price
 */
export const calculatePrice = async (req, res) => {
  try {
    const { plan_id, billing_cycle } = req.query;

    if (!plan_id || !billing_cycle) {
      return res.status(400).json({
        success: false,
        error: 'Plan ID and billing cycle are required'
      });
    }

    const priceDetails = await subscriptionService.calculatePrice(plan_id, billing_cycle);
    
    res.json({
      success: true,
      data: priceDetails
    });
  } catch (error) {
    console.error('Error in calculatePrice:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to calculate price'
    });
  }
};

// ============= ADMIN ENDPOINTS =============

/**
 * Admin: Get all active subscriptions
 */
export const adminGetAllSubscriptions = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const subscriptions = await subscriptionService.getAllActiveSubscriptions();
    
    res.json({
      success: true,
      data: subscriptions,
      count: subscriptions.length
    });
  } catch (error) {
    console.error('Error in adminGetAllSubscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions'
    });
  }
};

/**
 * Admin: Get subscription statistics
 */
export const adminGetStats = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const stats = await subscriptionService.getSubscriptionStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error in adminGetStats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription statistics'
    });
  }
};

/**
 * Admin: Run maintenance tasks
 */
export const adminRunMaintenance = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const result = await subscriptionService.runMaintenance();
    
    res.json({
      success: true,
      data: result,
      message: 'Maintenance tasks completed successfully'
    });
  } catch (error) {
    console.error('Error in adminRunMaintenance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run maintenance tasks'
    });
  }
};

/**
 * Admin: Cancel any user's subscription
 */
export const adminCancelSubscription = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const { subscription_id } = req.params;
    const { reason } = req.body;

    const result = await subscriptionService.adminCancelSubscription(subscription_id, reason);
    
    res.json(result);
  } catch (error) {
    console.error('Error in adminCancelSubscription:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to cancel subscription'
    });
  }
};

/**
 * Admin: Get all subscriptions history with filters
 */
export const adminGetSubscriptionsHistory = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const {
      search,
      status,
      plan,
      billing_cycle,
      from_date,
      to_date,
      limit,
    } = req.query;

    const history = await subscriptionService.getAllSubscriptionsHistory({
      search,
      status,
      plan,
      billing_cycle,
      from_date,
      to_date,
      limit,
    });

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error in adminGetSubscriptionsHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions history'
    });
  }
};

/**
 * Admin: Delete subscription (hard delete)
 */
export const adminDeleteSubscription = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const { subscription_id } = req.params;

    // Get subscription before deleting
    const subscription = await subscriptionService.getSubscriptionById(subscription_id);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Delete subscription
    await subscriptionService.deleteSubscription(subscription_id);

    res.json({
      success: true,
      message: 'Subscription deleted successfully',
      data: { subscription_id }
    });
  } catch (error) {
    console.error('Error in adminDeleteSubscription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete subscription'
    });
  }
};

export default {
  getPlans,
  getMySubscription,
  getUsage,
  createSubscription,
  cancelSubscription,
  renewSubscription,
  changeSubscription,
  toggleAutoRenew,
  checkEligibility,
  getHistory,
  calculatePrice,
  adminGetAllSubscriptions,
  adminGetStats,
  adminRunMaintenance,
  adminCancelSubscription,
  adminGetSubscriptionsHistory,
  adminDeleteSubscription
};
