/**
 * Payment Controller
 * Handles payment gateway operations for subscriptions and commissions
 */

import paymentGatewayService from '../services/paymentGatewayService.js';
import Payment from '../models/Payment.js';
import subscriptionService from '../services/subscriptionService.js';
import { v4 as uuidv4 } from 'uuid';
import { generatePaymentReceiptPDF, saveReceiptPDF } from '../utils/paymentReceiptPDF.js';
import { sendPaymentReceiptEmail, sendAdminPaymentNotification } from '../utils/paymentReceiptEmail.js';
import path from 'path';
import fs from 'fs';

/**
 * Initiate payment for subscription or commission
 */
export const initiatePayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      payment_type, // 'subscription' or 'commission'
      reference_id, // subscription plan_id or commission_transaction_id
      gateway, // 'khalti' or 'esewa'
      amount,
      customer_info,
      purchase_order_name,
      billing_cycle, // For subscriptions: 'monthly' or 'annual'
      auto_renew // For subscriptions: true/false
    } = req.body;

    // Validate required fields
    if (!payment_type || !reference_id || !gateway || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: payment_type, reference_id, gateway, and amount are required'
      });
    }

    // Validate payment gateway
    if (!['khalti', 'esewa'].includes(gateway.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment gateway. Supported gateways: khalti, esewa'
      });
    }

    // For subscription payments, validate user can subscribe
    if (payment_type === 'subscription') {
      try {
        // Check if user already has an active subscription
        const existingSub = await subscriptionService.getUserSubscription(userId);
        if (existingSub && existingSub.has_subscription) {
          const sub = existingSub.subscription;
          
          // Get the new plan details to compare
          const Subscription = (await import('../models/Subscription.js')).default;
          const newPlan = await Subscription.getPlanById(reference_id);
          const currentTier = sub.plan_tier;
          const newTier = newPlan.tier;
          
          // Check if trying to buy the same plan
          if (sub.plan_id === parseInt(reference_id)) {
            return res.status(400).json({
              success: false,
              error: `You already have an active subscription to this plan. Your current plan expires on ${new Date(sub.end_date).toLocaleDateString()}. Please wait until it expires before renewing, or upgrade to a different plan.`,
              code: 'DUPLICATE_PLAN'
            });
          }
          
          // Check for downgrade (higher tier number = better plan)
          if (newTier < currentTier) {
            return res.status(400).json({
              success: false,
              error: `You cannot downgrade from ${sub.plan_display_name} (Tier ${currentTier}) to ${newPlan.display_name} (Tier ${newTier}). Please cancel your current subscription first if you wish to downgrade.`,
              code: 'DOWNGRADE_NOT_ALLOWED',
              currentPlan: sub.plan_display_name,
              newPlan: newPlan.display_name
            });
          }
          
          // If upgrading, return info for confirmation (but don't block)
          if (newTier > currentTier) {
            // Allow upgrade but this will replace current subscription
            console.log(`[PAYMENT] User upgrading from ${sub.plan_display_name} to ${newPlan.display_name}`);
          }
        }
      } catch (err) {
        console.log('[PAYMENT] Error checking subscription:', err.message);
        // Continue with payment if we can't check subscription
      }
    }

    // Generate unique transaction UUID
    const transactionUuid = `${payment_type.toUpperCase()}-${uuidv4()}`;
    const purchaseOrderId = transactionUuid;

    let paymentResponse;

    // Initiate payment based on selected gateway
    if (gateway.toLowerCase() === 'khalti') {
      paymentResponse = await paymentGatewayService.initiateKhaltiPayment({
        amount: parseFloat(amount),
        purchaseOrderId,
        purchaseOrderName: purchase_order_name || `${payment_type} Payment`,
        customerInfo: customer_info || {
          name: req.user.name || 'Customer',
          email: req.user.email || 'customer@example.com',
          phone: req.user.phone || '9800000000'
        }
      });
    } else if (gateway.toLowerCase() === 'esewa') {
      paymentResponse = await paymentGatewayService.initiateEsewaPayment({
        amount: parseFloat(amount),
        transactionUuid,
        productName: purchase_order_name || `${payment_type} Payment`
      });
    }

    // Create payment record in database with metadata
    const payment = await Payment.createPayment({
      user_id: userId,
      payment_type,
      reference_id,
      gateway: gateway.toLowerCase(),
      amount: parseFloat(amount),
      transaction_uuid: transactionUuid,
      gateway_payment_id: paymentResponse.pidx || transactionUuid,
      status: 'pending',
      gateway_response: {
        // Store metadata for later use during verification
        metadata: {
          billing_cycle: billing_cycle || 'monthly',
          auto_renew: auto_renew || false,
          purchase_order_name: purchase_order_name
        },
        // Store initial payment response
        initiation_response: paymentResponse
      }
    });

    res.json({
      success: true,
      data: {
        payment_id: payment.id,
        transaction_uuid: transactionUuid,
        ...paymentResponse
      }
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate payment'
    });
  }
};

/**
 * Verify payment after redirect from gateway
 */
export const verifyPayment = async (req, res) => {
  try {
    console.log('[PAYMENT VERIFY] Received query params:', req.query);

    // eSewa v2 sends callback payload as base64 encoded JSON in `data`
    let esewaData = null;
    if (req.query.data) {
      try {
        const decoded = Buffer.from(req.query.data, 'base64').toString('utf-8');
        esewaData = JSON.parse(decoded);
        console.log('[PAYMENT VERIFY] Decoded eSewa callback data:', esewaData);
      } catch (decodeError) {
        console.warn('[PAYMENT VERIFY] Failed to decode eSewa callback data:', decodeError.message);
      }
    }
    
    const {
      // Khalti sends back purchase_order_id = our transaction_uuid
      transaction_uuid,
      purchase_order_id,
      pidx,
      gateway,
      total_amount,
      product_code
    } = req.query;

    // Khalti returns purchase_order_id; eSewa returns transaction_uuid (often inside base64 `data`)
    const txnUuid = transaction_uuid || purchase_order_id || esewaData?.transaction_uuid;
    
    console.log('[PAYMENT VERIFY] Transaction UUID:', txnUuid);
    console.log('[PAYMENT VERIFY] Gateway PIDX:', pidx);

    if (!txnUuid) {
      console.log('[PAYMENT VERIFY] ERROR: No transaction UUID found');
      return res.status(400).json({
        success: false,
        error: 'Transaction UUID is required'
      });
    }

    // Get payment from database
    console.log('[PAYMENT VERIFY] Looking up payment in DB...');
    const payment = await Payment.getPaymentByTransactionUuid(txnUuid);
    
    console.log('[PAYMENT VERIFY] Payment found:', payment ? `ID: ${payment.id}, Type: ${payment.payment_type}, Status: ${payment.status}` : 'NOT FOUND');

    if (!payment) {
      console.log('[PAYMENT VERIFY] ERROR: Payment not found for UUID:', txnUuid);
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Check if already verified
    if (payment.status === 'completed') {
      console.log('[PAYMENT VERIFY] Payment already verified');
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          payment,
          verification: null
        }
      });
    }

    // Parse gateway_response if stored as a JSON string
    const storedResponse = typeof payment.gateway_response === 'string'
      ? JSON.parse(payment.gateway_response)
      : (payment.gateway_response || {});
      
    console.log('[PAYMENT VERIFY] Stored metadata:', storedResponse.metadata);

    let verificationResponse;

    // Verify payment based on gateway stored in DB (not from query — Khalti doesn't return it)
    console.log('[PAYMENT VERIFY] Verifying with gateway:', payment.gateway);
    
    if (payment.gateway === 'khalti') {
      if (!pidx) {
        console.log('[PAYMENT VERIFY] ERROR: Missing pidx for Khalti');
        return res.status(400).json({
          success: false,
          error: 'Khalti payment index (pidx) is required'
        });
      }
      console.log('[PAYMENT VERIFY] Calling Khalti verification for pidx:', pidx);
      verificationResponse = await paymentGatewayService.verifyKhaltiPayment(pidx);
      console.log('[PAYMENT VERIFY] Khalti verification result:', verificationResponse);
    } else if (payment.gateway === 'esewa') {
      const amount = total_amount || esewaData?.total_amount || payment.amount;
      const resolvedProductCode = product_code || esewaData?.product_code;
      console.log('[PAYMENT VERIFY] Calling eSewa verification');
      verificationResponse = await paymentGatewayService.verifyEsewaPayment(
        txnUuid,
        amount,
        resolvedProductCode
      );
      console.log('[PAYMENT VERIFY] eSewa verification result:', verificationResponse);
    }

    console.log('[PAYMENT VERIFY] Updating payment status to:', verificationResponse.success ? 'completed' : 'failed');
    
    // Update payment status
    const updatedPayment = await Payment.updatePaymentStatus(payment.id, {
      status: verificationResponse.success ? 'completed' : 'failed',
      gateway_transaction_id: verificationResponse.transaction_id,
      gateway_response: verificationResponse,
      verified_at: new Date()
    });
    
    console.log('[PAYMENT VERIFY] Payment updated successfully');

    // If payment is successful, update the related entity (subscription or commission)
    if (verificationResponse.success) {
      console.log('[PAYMENT VERIFY] Payment successful, processing post-payment actions...');
      
      if (payment.payment_type === 'subscription') {
        try {
          // Extract metadata stored during initiation
          const metadata = storedResponse.metadata || {};
          const billingCycle = metadata.billing_cycle || 'monthly';
          const autoRenew = metadata.auto_renew || false;

          console.log(`[PAYMENT VERIFY] Creating subscription:`);
          console.log(`  - User ID: ${payment.user_id}`);
          console.log(`  - Plan ID: ${payment.reference_id}`);
          console.log(`  - Billing: ${billingCycle}`);
          console.log(`  - Auto-renew: ${autoRenew}`);

          await subscriptionService.subscribe(
            payment.user_id,
            payment.reference_id, // plan_id
            billingCycle,
            {
              payment_method: payment.gateway,
              payment_reference: verificationResponse.transaction_id || payment.transaction_uuid,
              auto_renew: autoRenew
            }
          );

          console.log(`[PAYMENT VERIFY] ✓ Subscription activated successfully`);
        } catch (subscriptionError) {
          console.error(`[PAYMENT VERIFY] ✗ Failed to activate subscription:`, subscriptionError);
          console.error(`[PAYMENT VERIFY] Error stack:`, subscriptionError.stack);
          // Don't fail the payment verification response, log the error
        }
      } else if (payment.payment_type === 'commission') {
        console.log(`[PAYMENT VERIFY] Commission payment completed: ${payment.reference_id}`);
      }

      // Generate and send payment receipt
      try {
        console.log('[PAYMENT VERIFY] Generating payment receipt...');
        
        // Get payment with user details
        const paymentWithDetails = await Payment.getPaymentWithUserDetails(updatedPayment.id);
        
        if (paymentWithDetails) {
          // Prepare user data for receipt
          const userData = {
            id: paymentWithDetails.user_id,
            name: paymentWithDetails.user_name,
            email: paymentWithDetails.user_email,
            phone: paymentWithDetails.user_phone
          };

          // Prepare payment data for receipt
          const receiptPaymentData = {
            ...updatedPayment,
            plan_name: paymentWithDetails.reference_name,
            invoice_number: paymentWithDetails.reference_name,
            subscription_details: paymentWithDetails.subscription_details
          };

          // Generate PDF receipt
          const receiptPDF = await generatePaymentReceiptPDF(receiptPaymentData, userData);
          
          // Save receipt to file system
          const receiptUrl = await saveReceiptPDF(receiptPDF, updatedPayment.transaction_uuid);
          
          // Update payment with receipt URL
          await Payment.updatePaymentReceipt(updatedPayment.id, {
            receipt_url: receiptUrl,
            receipt_sent_at: new Date()
          });
          
          console.log(`[PAYMENT VERIFY] ✓ Receipt generated and saved: ${receiptUrl}`);

          // Send receipt email to landlord
          try {
            await sendPaymentReceiptEmail(userData, receiptPaymentData, receiptPDF);
            console.log(`[PAYMENT VERIFY] ✓ Receipt email sent to: ${userData.email}`);
          } catch (emailError) {
            console.error(`[PAYMENT VERIFY] ✗ Failed to send receipt email:`, emailError);
            // Don't fail the verification if email fails
          }

          // Send notification to admin (only if admin email is different from user email)
          const adminEmail = config.ADMIN_EMAIL || config.EMAIL_USER;
          if (adminEmail && adminEmail.toLowerCase() !== userData.email.toLowerCase()) {
            try {
              await sendAdminPaymentNotification(receiptPaymentData, userData);
              console.log(`[PAYMENT VERIFY] ✓ Admin notification sent to: ${adminEmail}`);
            } catch (adminEmailError) {
              console.error(`[PAYMENT VERIFY] ✗ Failed to send admin notification:`, adminEmailError);
            }
          } else {
            console.log(`[PAYMENT VERIFY] Skipping admin notification (same as user email)`);
          }
        }
      } catch (receiptError) {
        console.error(`[PAYMENT VERIFY] ✗ Failed to generate receipt:`, receiptError);
        console.error(`[PAYMENT VERIFY] Receipt error stack:`, receiptError.stack);
        // Don't fail the payment verification if receipt generation fails
      }
    } else {
      console.log('[PAYMENT VERIFY] Payment verification failed, skipping post-payment actions');
    }

    console.log('[PAYMENT VERIFY] Sending response to client');
    
    res.json({
      success: true,
      data: {
        payment: updatedPayment,
        verification: verificationResponse
      }
    });
  } catch (error) {
    console.error('[PAYMENT VERIFY] EXCEPTION:', error);
    console.error('[PAYMENT VERIFY] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify payment'
    });
  }
};

/**
 * Get payment details
 */
export const getPaymentDetails = async (req, res) => {
  try {
    const { payment_id, transaction_uuid } = req.params;
    
    let payment;
    if (payment_id) {
      payment = await Payment.getPaymentByGatewayId(payment_id);
    } else if (transaction_uuid) {
      payment = await Payment.getPaymentByTransactionUuid(transaction_uuid);
    }

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    // Check if user has access to this payment
    if (payment.user_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to payment details'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment details'
    });
  }
};

/**
 * Get user's payment history
 */
export const getMyPayments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { payment_type, status, gateway, limit } = req.query;

    const filters = {};
    if (payment_type) filters.payment_type = payment_type;
    if (status) filters.status = status;
    if (gateway) filters.gateway = gateway;
    if (limit) filters.limit = parseInt(limit);

    const payments = await Payment.getPaymentsByUser(userId, filters);
    const stats = await Payment.getPaymentStats(userId);

    res.json({
      success: true,
      data: {
        payments,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching user payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
};

/**
 * Get all payments (Admin only)
 */
export const getAllPayments = async (req, res) => {
  try {
    const { limit } = req.query;
    const payments = await Payment.getRecentPayments(limit ? parseInt(limit) : 50);

    res.json({
      success: true,
      data: payments,
      count: payments.length
    });
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments'
    });
  }
};

/**
 * Get payment analytics (Admin only)
 */
export const getPaymentAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const endDate = end_date || new Date();

    const analytics = await Payment.getPaymentAnalytics(startDate, endDate);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching payment analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment analytics'
    });
  }
};

/**
 * Refund payment (Admin only, Khalti only)
 */
export const refundPayment = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const { amount, remarks } = req.body;

    const payment = await Payment.getPaymentByGatewayId(payment_id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Only completed payments can be refunded'
      });
    }

    if (payment.gateway !== 'khalti') {
      return res.status(400).json({
        success: false,
        error: 'Refunds are only supported for Khalti payments'
      });
    }

    const refundAmount = amount || payment.amount;

    const refundResponse = await paymentGatewayService.refundKhaltiPayment(
      payment.gateway_payment_id,
      refundAmount,
      remarks || 'Refund initiated by admin'
    );

    // Update payment status
    await Payment.updatePaymentStatus(payment.id, {
      status: 'refunded',
      gateway_response: refundResponse
    });

    res.json({
      success: true,
      message: 'Refund initiated successfully',
      data: refundResponse
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process refund'
    });
  }
};

/**
 * Download payment receipt
 */
export const downloadReceipt = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    console.log(`[RECEIPT] Download request for payment_id: ${payment_id}`);

    // Try to get payment by transaction UUID first (most common)
    let payment = await Payment.getPaymentByTransactionUuid(payment_id);
    
    if (!payment) {
      // If not found, try as numeric/UUID ID (wrap in try-catch for type errors)
      try {
        payment = await Payment.getPaymentById(payment_id);
      } catch (err) {
        console.log(`[RECEIPT] Failed to query by ID (likely not a valid UUID): ${err.message}`);
      }
    }

    if (!payment) {
      console.log(`[RECEIPT] Payment not found: ${payment_id}`);
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    console.log(`[RECEIPT] Payment found: ${payment.id}, receipt_url: ${payment.receipt_url}`);

    // Check authorization - user must own the payment or be admin
    if (payment.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to payment receipt'
      });
    }

    // Check if receipt exists
    if (!payment.receipt_url) {
      console.log(`[RECEIPT] No receipt URL for payment: ${payment.id}`);
      return res.status(404).json({
        success: false,
        error: 'Receipt not available for this payment. Please try viewing it first to generate.'
      });
    }

    // Send file for download
    const filePath = path.join(process.cwd(), payment.receipt_url);
    
    console.log(`[RECEIPT] Attempting to download from: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`[RECEIPT] File not found at: ${filePath}`);
      return res.status(404).json({
        success: false,
        error: 'Receipt file not found. Please regenerate the receipt.'
      });
    }
    
    res.download(filePath, `receipt_${payment.transaction_uuid}.pdf`, (err) => {
      if (err) {
        console.error('[RECEIPT] Error downloading receipt:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to download receipt'
          });
        }
      } else {
        console.log(`[RECEIPT] Receipt downloaded successfully`);
      }
    });
  } catch (error) {
    console.error('[RECEIPT] Error downloading receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download receipt'
    });
  }
};

/**
 * View receipt PDF in browser
 */
export const viewReceipt = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    console.log(`[RECEIPT] View request for payment_id: ${payment_id}`);

    // Try to get payment by transaction UUID first (most common)
    let payment = await Payment.getPaymentByTransactionUuid(payment_id);
    
    if (!payment) {
      // If not found, try as numeric/UUID ID (wrap in try-catch for type errors)
      try {
        payment = await Payment.getPaymentById(payment_id);
      } catch (err) {
        console.log(`[RECEIPT] Failed to query by ID (likely not a valid UUID): ${err.message}`);
      }
    }

    if (!payment) {
      console.log(`[RECEIPT] Payment not found: ${payment_id}`);
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    console.log(`[RECEIPT] Payment found: ${payment.id}, receipt_url: ${payment.receipt_url}`);

    // Check authorization - user must own the payment or be admin
    if (payment.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to payment receipt'
      });
    }

    // Check if receipt exists
    if (!payment.receipt_url) {
      console.log(`[RECEIPT] No receipt URL for payment: ${payment.id}`);
      return res.status(404).json({
        success: false,
        error: 'Receipt not available for this payment. Please click "Generate Receipt" to create one.'
      });
    }

    // Send file for viewing in browser
    const filePath = path.join(process.cwd(), payment.receipt_url);
    
    console.log(`[RECEIPT] Attempting to view from: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`[RECEIPT] File not found at: ${filePath}`);
      return res.status(404).json({
        success: false,
        error: 'Receipt file not found. Please regenerate the receipt.'
      });
    }

    // Set headers for inline PDF viewing
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt_${payment.transaction_uuid}.pdf"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log(`[RECEIPT] Receipt streaming for viewing`);
  } catch (error) {
    console.error('[RECEIPT] Error viewing receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to view receipt'
    });
  }
};

/**
 * Regenerate receipt for a payment (Admin only or user's own payment)
 */
export const regenerateReceipt = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    console.log(`[RECEIPT] Regenerate request for payment_id: ${payment_id}`);

    // Get payment with user details - try transaction UUID first
    let paymentWithDetails;
    
    try {
      paymentWithDetails = await Payment.getPaymentByTransactionUuidWithDetails(payment_id);
      console.log(`[RECEIPT] Found by transaction UUID: ${paymentWithDetails ? 'Yes' : 'No'}`);
    } catch (err) {
      console.log(`[RECEIPT] Transaction UUID lookup failed: ${err.message}`);
    }
    
    if (!paymentWithDetails) {
      try {
        paymentWithDetails = await Payment.getPaymentWithUserDetails(payment_id);
        console.log(`[RECEIPT] Found by payment ID: ${paymentWithDetails ? 'Yes' : 'No'}`);
      } catch (err) {
        console.log(`[RECEIPT] Payment ID lookup failed: ${err.message}`);
      }
    }

    if (!paymentWithDetails) {
      console.log(`[RECEIPT] Payment not found: ${payment_id}`);
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    console.log(`[RECEIPT] Payment found: ID=${paymentWithDetails.id}, Status=${paymentWithDetails.status}`);

    // Check authorization
    if (paymentWithDetails.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access'
      });
    }

    // Check if payment is completed
    if (paymentWithDetails.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Receipt can only be generated for completed payments'
      });
    }

    // Prepare user data
    const userData = {
      id: paymentWithDetails.user_id,
      name: paymentWithDetails.user_name || 'N/A',
      email: paymentWithDetails.user_email || 'no-email@example.com',
      phone: paymentWithDetails.user_phone || 'N/A'
    };

    console.log(`[RECEIPT] User data: ${userData.name}, ${userData.email}`);

    // Prepare payment data
    const receiptPaymentData = {
      ...paymentWithDetails,
      plan_name: paymentWithDetails.reference_name || 'Service Payment',
      invoice_number: paymentWithDetails.reference_name || paymentWithDetails.transaction_uuid,
      subscription_details: paymentWithDetails.subscription_details || null
    };

    console.log(`[RECEIPT] Generating PDF...`);

    // Generate PDF receipt
    const receiptPDF = await generatePaymentReceiptPDF(receiptPaymentData, userData);
    
    console.log(`[RECEIPT] PDF generated, saving...`);
    
    // Save receipt
    const receiptUrl = await saveReceiptPDF(receiptPDF, paymentWithDetails.transaction_uuid);
    
    console.log(`[RECEIPT] Saved to: ${receiptUrl}`);
    
    // Update payment
    await Payment.updatePaymentReceipt(paymentWithDetails.id, {
      receipt_url: receiptUrl,
      receipt_sent_at: new Date()
    });

    // Optionally resend email
    const { send_email } = req.body || req.query;
    if (send_email === true || send_email === 'true') {
      try {
        await sendPaymentReceiptEmail(userData, receiptPaymentData, receiptPDF);
        console.log(`[RECEIPT] Email sent after regeneration to: ${userData.email}`);
      } catch (emailError) {
        console.error('[RECEIPT] Failed to send receipt email:', emailError);
      }
    }

    console.log(`[RECEIPT] Receipt regenerated successfully: ${receiptUrl}`);

    res.json({
      success: true,
      message: 'Receipt regenerated successfully',
      data: {
        receipt_url: receiptUrl
      }
    });
  } catch (error) {
    console.error('[RECEIPT] Error regenerating receipt:', error);
    console.error('[RECEIPT] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to regenerate receipt'
    });
  }
};

export default {
  initiatePayment,
  verifyPayment,
  getPaymentDetails,
  getMyPayments,
  getAllPayments,
  getPaymentAnalytics,
  refundPayment,
  downloadReceipt,
  viewReceipt,
  regenerateReceipt
};
