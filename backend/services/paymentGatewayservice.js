/**
 * Payment Gateway Service
 * Handles both Khalti and eSewa payment gateway integrations
 */

import axios from 'axios';
import crypto from 'crypto';

class PaymentGatewayService {
  constructor() {
    // Khalti Configuration
    this.khaltiConfig = {
      secretKey: process.env.KHALTI_SECRET_KEY || 'f76c30ceca294965968c82f3b881f7ac',
      publicKey: process.env.KHALTI_PUBLIC_KEY || '24901a0df35f41a78eca83338923d6ab',
      apiUrl: process.env.KHALTI_API_URL || 'https://dev.khalti.com/api/v2',
      returnUrl: process.env.KHALTI_RETURN_URL || 'http://localhost:5173/payment/verify',
      websiteUrl: process.env.WEBSITE_URL || 'http://localhost:5173'
    };

    // eSewa Configuration
    this.esewaConfig = {
      merchantId: process.env.ESEWA_MERCHANT_ID || 'EPAYTEST',
      secretKey: process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q',
      apiUrl: process.env.ESEWA_API_URL || 'https://rc.esewa.com.np/api/epay',
      successUrl: process.env.ESEWA_SUCCESS_URL || 'http://localhost:5173/payment/verify',
      failureUrl: process.env.ESEWA_FAILURE_URL || 'http://localhost:5173/payment/verify'
    };
  }

  /**
   * Initialize Khalti Payment
   * @param {Object} paymentData - Payment details
   * @returns {Object} Payment initiation response
   */
  async initiateKhaltiPayment(paymentData) {
    try {
      const {
        amount, // in paisa (e.g., 1000 paisa = Rs 10)
        purchaseOrderId,
        purchaseOrderName,
        customerInfo,
        amountBreakdown
      } = paymentData;

      console.log('[KHALTI] Initiating payment with config:');
      console.log('  - API URL:', this.khaltiConfig.apiUrl);
      console.log('  - Secret Key (first 20 chars):', this.khaltiConfig.secretKey.substring(0, 20) + '...');
      console.log('  - Return URL:', this.khaltiConfig.returnUrl);
      console.log('  - Amount (NPR):', amount, '→ (Paisa):', Math.round(amount * 100));

      const payload = {
        return_url: this.khaltiConfig.returnUrl,
        website_url: this.khaltiConfig.websiteUrl,
        amount: Math.round(amount * 100), // Convert to paisa
        purchase_order_id: purchaseOrderId,
        purchase_order_name: purchaseOrderName,
        customer_info: {
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone
        }
      };

      // Add optional amount breakdown if provided
      if (amountBreakdown) {
        payload.amount_breakdown = amountBreakdown;
      }

      const response = await axios.post(
        `${this.khaltiConfig.apiUrl}/epayment/initiate/`,
        payload,
        {
          headers: {
            'Authorization': `Key ${this.khaltiConfig.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        gateway: 'khalti',
        payment_url: response.data.payment_url,
        pidx: response.data.pidx,
        expires_at: response.data.expires_at,
        expires_in: response.data.expires_in
      };
    } catch (error) {
      console.error('Khalti payment initiation error:', error.response?.data || error.message);
      console.error('Khalti Secret Key being used:', this.khaltiConfig.secretKey.substring(0, 20) + '...');
      console.error('Khalti API URL:', this.khaltiConfig.apiUrl);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to initiate Khalti payment';
      throw new Error(errorMessage);
    }
  }

  /**
   * Verify Khalti Payment
   * @param {string} pidx - Payment index from Khalti
   * @returns {Object} Payment verification response
   */
  async verifyKhaltiPayment(pidx) {
    try {
      const response = await axios.post(
        `${this.khaltiConfig.apiUrl}/epayment/lookup/`,
        { pidx },
        {
          headers: {
            'Authorization': `Key ${this.khaltiConfig.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;

      return {
        success: data.status === 'Completed',
        gateway: 'khalti',
        transaction_id: data.transaction_id,
        status: data.status,
        amount: data.total_amount / 100, // Convert from paisa to rupees
        fee: data.fee / 100,
        refunded: data.refunded,
        purchase_order_id: data.purchase_order_id,
        purchase_order_name: data.purchase_order_name
      };
    } catch (error) {
      console.error('Khalti payment verification error:', error.response?.data || error.message);
      throw new Error('Failed to verify Khalti payment');
    }
  }

  /**
   * Generate eSewa Signature
   * @param {Object} params - Payment parameters
   * @returns {string} Generated signature
   */
  generateEsewaSignature(params) {
    const { total_amount, transaction_uuid, product_code } = params;
    const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
    
    const hash = crypto.createHmac('sha256', this.esewaConfig.secretKey)
      .update(message)
      .digest('base64');
    
    return hash;
  }

  /**
   * Initialize eSewa Payment
   * @param {Object} paymentData - Payment details
   * @returns {Object} Payment initiation response with form data
   */
  async initiateEsewaPayment(paymentData) {
    try {
      const {
        amount,
        transactionUuid,
        productName,
        productDeliveryCharge = 0,
        productServiceCharge = 0,
        taxAmount = 0
      } = paymentData;

      const totalAmount = parseFloat(amount) + 
                         parseFloat(productDeliveryCharge) + 
                         parseFloat(productServiceCharge) + 
                         parseFloat(taxAmount);

      const params = {
        amount: amount.toString(),
        tax_amount: taxAmount.toString(),
        total_amount: totalAmount.toString(),
        transaction_uuid: transactionUuid,
        product_code: this.esewaConfig.merchantId,
        product_service_charge: productServiceCharge.toString(),
        product_delivery_charge: productDeliveryCharge.toString(),
        success_url: this.esewaConfig.successUrl,
        failure_url: this.esewaConfig.failureUrl,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: ''
      };

      // Generate signature
      params.signature = this.generateEsewaSignature({
        total_amount: params.total_amount,
        transaction_uuid: params.transaction_uuid,
        product_code: params.product_code
      });

      return {
        success: true,
        gateway: 'esewa',
        payment_url: `${this.esewaConfig.apiUrl}/main/v2/form`,
        form_data: params,
        transaction_uuid: transactionUuid
      };
    } catch (error) {
      console.error('eSewa payment initiation error:', error.message);
      throw new Error('Failed to initiate eSewa payment');
    }
  }

  /**
   * Verify eSewa Payment
   * @param {string} transactionUuid - Transaction UUID
   * @param {number} totalAmount - Total amount
   * @param {string} productCode - Product code
   * @returns {Object} Payment verification response
   */
  async verifyEsewaPayment(transactionUuid, totalAmount, productCode = null) {
    try {
      const code = productCode || this.esewaConfig.merchantId;
      
      const response = await axios.get(
        `${this.esewaConfig.apiUrl}/transaction/status/`,
        {
          params: {
            product_code: code,
            total_amount: totalAmount,
            transaction_uuid: transactionUuid
          }
        }
      );

      const data = response.data;

      return {
        success: data.status === 'COMPLETE',
        gateway: 'esewa',
        transaction_id: data.ref_id,
        status: data.status,
        amount: parseFloat(data.total_amount),
        transaction_uuid: data.transaction_uuid,
        product_code: data.product_code
      };
    } catch (error) {
      console.error('eSewa payment verification error:', error.response?.data || error.message);
      throw new Error('Failed to verify eSewa payment');
    }
  }

  /**
   * Process refund for Khalti payment
   * @param {string} pidx - Payment index
   * @param {number} amount - Amount to refund in paisa
   * @param {string} remarks - Refund remarks
   * @returns {Object} Refund response
   */
  async refundKhaltiPayment(pidx, amount, remarks = 'Refund') {
    try {
      const response = await axios.post(
        `${this.khaltiConfig.apiUrl}/epayment/refund/`,
        {
          pidx,
          amount: Math.round(amount * 100), // Convert to paisa
          remarks
        },
        {
          headers: {
            'Authorization': `Key ${this.khaltiConfig.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        refund_id: response.data.idx,
        status: response.data.status,
        amount: response.data.amount / 100
      };
    } catch (error) {
      console.error('Khalti refund error:', error.response?.data || error.message);
      throw new Error('Failed to process Khalti refund');
    }
  }

  /**
   * Get payment method specific details
   * @param {string} gateway - Payment gateway (khalti/esewa)
   * @returns {Object} Gateway configuration
   */
  getGatewayConfig(gateway) {
    switch (gateway.toLowerCase()) {
      case 'khalti':
        return {
          name: 'Khalti',
          type: 'redirect',
          supports_refund: true,
          currency: 'NPR'
        };
      case 'esewa':
        return {
          name: 'eSewa',
          type: 'form',
          supports_refund: false,
          currency: 'NPR'
        };
      default:
        throw new Error('Unsupported payment gateway');
    }
  }
}

export default new PaymentGatewayService();
