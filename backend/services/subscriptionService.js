/**
 * Subscription Service
 * Business logic for subscription management
 */

import Subscription from '../models/Subscription.js';

class SubscriptionService {
  /**
   * Get all available subscription plans
   */
  async getAllPlans() {
    try {
      return await Subscription.getAllPlans();
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      throw error;
    }
  }

  /**
   * Get user's active subscription with usage details
   */
  async getUserSubscription(userId) {
    try {
      const subscription = await Subscription.getUserActiveSubscription(userId);
      
      if (!subscription) {
        return {
          has_subscription: false,
          message: 'No active subscription found'
        };
      }

      const usage = await Subscription.getSubscriptionUsage(userId);
      
      return {
        has_subscription: true,
        subscription,
        usage
      };
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async subscribe(userId, planId, billingCycle, paymentData) {
    try {
      // Check if user already has an active subscription
      const existingSubscription = await Subscription.getUserActiveSubscription(userId);
      
      if (existingSubscription) {
        // Check if trying to buy the same plan
        if (existingSubscription.plan_id === parseInt(planId)) {
          throw new Error('You already have an active subscription to this plan. Your current plan expires on ' + 
            new Date(existingSubscription.end_date).toLocaleDateString() + 
            '. Please wait until it expires before renewing, or upgrade to a different plan.');
        }
        
        // If different plan, this is an upgrade/downgrade - allow it but needs special handling
        // For now, reject and ask user to cancel first
        throw new Error('You already have an active subscription. Please cancel your current plan first, or use the upgrade option.');
      }

      // Get plan to calculate amount
      const plan = await Subscription.getPlanById(planId);
      if (!plan) {
        throw new Error('Invalid subscription plan');
      }

      const amount = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;

      const subscriptionData = {
        user_id: userId,
        plan_id: planId,
        billing_cycle: billingCycle,
        amount_paid: amount,
        payment_method: paymentData.payment_method,
        payment_reference: paymentData.payment_reference,
        auto_renew: paymentData.auto_renew || false
      };

      const subscription = await Subscription.createSubscription(subscriptionData);

      return {
        success: true,
        subscription,
        message: 'Subscription created successfully'
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userId, subscriptionId) {
    try {
      const subscription = await Subscription.cancelSubscription(subscriptionId, userId);
      
      if (!subscription) {
        throw new Error('Subscription not found or already cancelled');
      }

      return {
        success: true,
        subscription,
        message: 'Subscription cancelled successfully. It will remain active until the end of the billing period.'
      };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Renew a subscription
   */
  async renewSubscription(userId, paymentData) {
    try {
      const subscription = await Subscription.renewSubscription(userId, paymentData);

      return {
        success: true,
        subscription,
        message: 'Subscription renewed successfully'
      };
    } catch (error) {
      console.error('Error renewing subscription:', error);
      throw error;
    }
  }

  /**
   * Upgrade or downgrade subscription
   */
  async changeSubscription(userId, newPlanId, paymentData) {
    try {
      const subscription = await Subscription.changeSubscription(userId, newPlanId, paymentData);

      return {
        success: true,
        subscription,
        message: 'Subscription changed successfully'
      };
    } catch (error) {
      console.error('Error changing subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user can create a listing
   */
  async checkListingEligibility(userId) {
    try {
      const result = await Subscription.canCreateListing(userId);
      return result;
    } catch (error) {
      console.error('Error checking listing eligibility:', error);
      throw error;
    }
  }

  /**
   * Get subscription usage details
   */
  async getUsageDetails(userId) {
    try {
      return await Subscription.getSubscriptionUsage(userId);
    } catch (error) {
      console.error('Error fetching usage details:', error);
      throw error;
    }
  }

  /**
   * Toggle auto-renew
   */
  async toggleAutoRenew(userId, subscriptionId, autoRenew) {
    try {
      const subscription = await Subscription.toggleAutoRenew(subscriptionId, userId, autoRenew);
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      return {
        success: true,
        subscription,
        message: `Auto-renew ${autoRenew ? 'enabled' : 'disabled'} successfully`
      };
    } catch (error) {
      console.error('Error toggling auto-renew:', error);
      throw error;
    }
  }

  /**
   * Get subscription history
   */
  async getSubscriptionHistory(userId) {
    try {
      return await Subscription.getUserSubscriptionHistory(userId);
    } catch (error) {
      console.error('Error fetching subscription history:', error);
      throw error;
    }
  }

  /**
   * Admin: Get all active subscriptions
   */
  async getAllActiveSubscriptions() {
    try {
      return await Subscription.getAllActiveSubscriptions();
    } catch (error) {
      console.error('Error fetching all subscriptions:', error);
      throw error;
    }
  }

  /**
   * Admin: Get subscription statistics
   */
  async getSubscriptionStatistics() {
    try {
      return await Subscription.getSubscriptionStats();
    } catch (error) {
      console.error('Error fetching subscription statistics:', error);
      throw error;
    }
  }

  /**
   * Run maintenance tasks
   */
  async runMaintenance() {
    try {
      return await Subscription.runMaintenance();
    } catch (error) {
      console.error('Error running maintenance:', error);
      throw error;
    }
  }

  /**
   * Admin: Cancel any user's subscription
   */
  async adminCancelSubscription(subscriptionId, reason = 'Cancelled by admin') {
    try {
      const subscription = await Subscription.getSubscriptionById(subscriptionId);
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status === 'cancelled' || subscription.status === 'expired') {
        throw new Error(`Subscription is already ${subscription.status}`);
      }

      // Cancel using the user_id from the subscription
      const cancelled = await Subscription.cancelSubscription(subscriptionId, subscription.user_id, {
        reason,
        cancelledBy: 'admin'
      });

      return {
        success: true,
        subscription: cancelled,
        message: `Subscription cancelled successfully. Reason: ${reason}`
      };
    } catch (error) {
      console.error('Error in admin cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Admin: Get all subscriptions history with filters
   */
  async getAllSubscriptionsHistory(filters = {}) {
    try {
      return await Subscription.getAllSubscriptionsHistory(filters);
    } catch (error) {
      console.error('Error fetching admin subscriptions history:', error);
      throw error;
    }
  }

  /**
   * Validate payment data
   */
  validatePaymentData(paymentData) {
    if (!paymentData.payment_method) {
      throw new Error('Payment method is required');
    }

    if (!paymentData.payment_reference) {
      throw new Error('Payment reference is required');
    }

    return true;
  }

  /**
   * Calculate subscription price
   */
  async calculatePrice(planId, billingCycle) {
    try {
      const plan = await Subscription.getPlanById(planId);
      
      if (!plan) {
        throw new Error('Invalid subscription plan');
      }

      const price = billingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
      const discount = billingCycle === 'annual' 
        ? Math.round(((plan.monthly_price * 12) - plan.annual_price) / (plan.monthly_price * 12) * 100)
        : 0;

      return {
        plan: plan.display_name,
        billing_cycle: billingCycle,
        price,
        currency: 'NPR',
        discount_percentage: discount,
        monthly_equivalent: billingCycle === 'annual' 
          ? Math.round(plan.annual_price / 12)
          : plan.monthly_price
      };
    } catch (error) {
      console.error('Error calculating price:', error);
      throw error;
    }
  }
}

export default new SubscriptionService();
