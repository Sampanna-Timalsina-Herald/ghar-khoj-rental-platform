import { Notification } from '../models/Notification.js';
import { query } from '../config/database.js';

export class NotificationService {
  /**
   * Notify admin when a new listing is created
   */
  static async notifyAdminNewListing(listingId, landlordName, propertyTitle) {
    try {
      // Get all admin users
      const result = await query(
        `SELECT id FROM users WHERE role = 'admin'`
      );
      
      const admins = result.rows;
      
      // Create notification for each admin
      for (const admin of admins) {
        await Notification.create({
          userId: admin.id,
          type: 'listing_created',
          title: '🏠 New Listing Created',
          message: `${landlordName} has created a new listing: "${propertyTitle}". Please review and approve.`,
          link: `/admin/listings`,
          metadata: { listingId }
        });
      }
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying admin:', error);
    }
  }

  /**
   * Notify landlord when listing is approved
   */
  static async notifyLandlordApproved(landlordId, propertyTitle, listingId) {
    try {
      await Notification.create({
        userId: landlordId,
        type: 'listing_approved',
        title: '✅ Listing Approved',
        message: `Your listing "${propertyTitle}" has been approved and is now live!`,
        link: `/landlord/listings`,
        metadata: { listingId }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying landlord:', error);
    }
  }

  /**
   * Notify landlord when changes are requested
   */
  static async notifyLandlordChangesRequested(landlordId, propertyTitle, adminMessage, listingId) {
    try {
      await Notification.create({
        userId: landlordId,
        type: 'changes_requested',
        title: '📝 Changes Requested',
        message: `Admin has requested changes to "${propertyTitle}": ${adminMessage}`,
        link: `/landlord/edit-listing/${listingId}`,
        metadata: { listingId, adminMessage }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying landlord:', error);
    }
  }

  /**
   * Notify landlord when listing is rejected
   */
  static async notifyLandlordRejected(landlordId, propertyTitle, reason, listingId) {
    try {
      await Notification.create({
        userId: landlordId,
        type: 'listing_rejected',
        title: '❌ Listing Rejected',
        message: `Your listing "${propertyTitle}" has been rejected. Reason: ${reason}`,
        link: `/landlord/listings`,
        metadata: { listingId, reason }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying landlord:', error);
    }
  }

  /**
   * Notify landlord when a tenant saves their listing as favorite
   */
  static async notifyLandlordFavorited(landlordId, tenantName, propertyTitle, listingId) {
    try {
      await Notification.create({
        userId: landlordId,
        type: 'listing_favorited',
        title: '❤️ Listing Favorited',
        message: `${tenantName} has saved your listing "${propertyTitle}" as a favorite!`,
        link: `/landlord/listings`,
        metadata: { listingId }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying landlord:', error);
    }
  }

  /**
   * Notify landlord when they receive a message
   */
  static async notifyNewMessage(recipientId, senderName, conversationId) {
    try {
      await Notification.create({
        userId: recipientId,
        type: 'new_message',
        title: '💬 New Message',
        message: `You have a new message from ${senderName}`,
        link: `/messages`,
        metadata: { conversationId }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying new message:', error);
    }
  }

  /**
   * Notify both parties when a rent agreement is created
   */
  static async notifyAgreementCreated(landlordId, tenantId, propertyTitle, agreementId) {
    try {
      // Notify landlord
      await Notification.create({
        userId: landlordId,
        type: 'agreement_created',
        title: '📄 Rent Agreement Created',
        message: `A rent agreement has been created for "${propertyTitle}"`,
        link: `/landlord/agreements`,
        metadata: { agreementId }
      });

      // Notify tenant
      await Notification.create({
        userId: tenantId,
        type: 'agreement_created',
        title: '📄 Rent Agreement Created',
        message: `Your rent agreement for "${propertyTitle}" has been created`,
        link: `/tenant/agreements`,
        metadata: { agreementId }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying agreement:', error);
    }
  }

  /**
   * Notify when viewing request is sent
   */
  static async notifyViewingRequest(landlordId, tenantName, propertyTitle, listingId) {
    try {
      await Notification.create({
        userId: landlordId,
        type: 'viewing_request',
        title: '👁️ Viewing Request',
        message: `${tenantName} is interested in viewing "${propertyTitle}"`,
        link: `/messages`,
        metadata: { listingId }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying viewing request:', error);
    }
  }

  /**
   * Notify landlord when tenant requests rent agreement
   */
  static async notifyLandlordAgreementRequest(landlordId, tenantName, propertyTitle, agreementId) {
    try {
      console.log('[NOTIFICATION SERVICE] Creating agreement request notification for landlord:', landlordId);
      
      const notification = await Notification.create({
        userId: landlordId,
        type: 'agreement_requested',
        title: '📝 Agreement Request',
        message: `${tenantName} has requested a rent agreement for "${propertyTitle}"`,
        link: `/landlord/agreements`,
        metadata: { agreementId }
      });
      
      console.log('[NOTIFICATION SERVICE] Agreement request notification created:', notification);
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying landlord agreement request:', error);
      console.error('[NOTIFICATION SERVICE] Error details:', error.message, error.stack);
    }
  }

  /**
   * Notify tenant when landlord approves agreement
   */
  static async notifyTenantAgreementApproved(tenantId, propertyTitle, agreementId) {
    try {
      await Notification.create({
        userId: tenantId,
        type: 'agreement_approved',
        title: '✅ Agreement Approved',
        message: `Your rent agreement for "${propertyTitle}" has been approved by the landlord`,
        link: `/tenant/agreements`,
        metadata: { agreementId }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying tenant agreement approved:', error);
    }
  }

  /**
   * Notify when agreement is rejected
   */
  static async notifyAgreementRejected(userId, propertyTitle, reason, agreementId) {
    try {
      await Notification.create({
        userId: userId,
        type: 'agreement_rejected',
        title: '❌ Agreement Rejected',
        message: `The rent agreement for "${propertyTitle}" has been rejected${reason ? `: ${reason}` : ''}`,
        link: `/agreements`,
        metadata: { agreementId, reason }
      });
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying agreement rejected:', error);
    }
  }

  /**
   * Notify admin when landlord views/sees admin change request
   */
  static async notifyAdminChangesSeenByLandlord(adminId, landlordName, propertyTitle, listingId) {
    try {
      console.log('[NOTIFICATION SERVICE] Creating notification for admin:', adminId, 'about landlord viewing changes');
      
      await Notification.create({
        userId: adminId,
        type: 'changes_seen',
        title: '👀 Landlord Viewed Changes',
        message: `${landlordName} has viewed your change request for "${propertyTitle}"`,
        link: `/admin/listings`,
        metadata: { 
          listingId, 
          landlordName,
          seenAt: new Date().toISOString()
        }
      });
      
      console.log('[NOTIFICATION SERVICE] Admin notification created successfully');
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying admin about changes seen:', error);
      console.error('[NOTIFICATION SERVICE] Error details:', error.message, error.stack);
    }
  }

  /**
   * Notify tenant when a new listing matches their preferences
   */
  static async notifyTenantMatchingListing(tenantId, propertyTitle, listingId) {
    try {
      console.log('[NOTIFICATION SERVICE] Creating matching listing notification for tenant:', tenantId);
      
      await Notification.create({
        userId: tenantId,
        type: 'listing_match',
        title: '🎯 Perfect Match Found!',
        message: `New property "${propertyTitle}" matches your preferences. Check it out!`,
        link: `/listing/${listingId}`,
        metadata: { 
          listingId,
          matchedAt: new Date().toISOString()
        }
      });
      
      console.log('[NOTIFICATION SERVICE] Matching listing notification created successfully');
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying tenant about matching listing:', error);
      console.error('[NOTIFICATION SERVICE] Error details:', error.message, error.stack);
    }
  }

  /**
   * Notify landlord when subscription is about to expire
   */
  static async notifySubscriptionExpiring(landlordId, planName, daysRemaining, subscriptionId) {
    try {
      console.log(`[NOTIFICATION SERVICE] Creating subscription expiry notification for landlord ${landlordId} - ${daysRemaining} days remaining`);
      
      let icon = '⏰';
      let urgency = 'warning';
      let message = '';

      if (daysRemaining === 1) {
        icon = '🚨';
        urgency = 'urgent';
        message = `Your ${planName} subscription expires in 24 hours! Renew now to avoid service interruption.`;
      } else if (daysRemaining <= 3) {
        icon = '⚠️';
        urgency = 'high';
        message = `Your ${planName} subscription expires in ${daysRemaining} days. Renew soon to continue enjoying premium features.`;
      } else if (daysRemaining <= 7) {
        urgency = 'medium';
        message = `Your ${planName} subscription expires in ${daysRemaining} days. Consider renewing to maintain uninterrupted service.`;
      } else {
        urgency = 'low';
        message = `Your ${planName} subscription expires in ${daysRemaining} days. Plan ahead and renew when convenient.`;
      }

      await Notification.create({
        userId: landlordId,
        type: 'subscription_expiring',
        title: `${icon} Subscription Expiring Soon`,
        message: message,
        link: `/landlord/subscription`,
        metadata: { 
          subscriptionId,
          daysRemaining,
          urgency,
          expiryWarningAt: new Date().toISOString()
        }
      });
      
      console.log(`[NOTIFICATION SERVICE] Subscription expiry notification created - ${daysRemaining} days warning`);
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying landlord about subscription expiry:', error);
      console.error('[NOTIFICATION SERVICE] Error details:', error.message, error.stack);
    }
  }

  /**
   * Notify landlord when subscription has expired
   */
  static async notifySubscriptionExpired(landlordId, planName, subscriptionId) {
    try {
      console.log(`[NOTIFICATION SERVICE] Creating subscription expired notification for landlord ${landlordId}`);
      
      await Notification.create({
        userId: landlordId,
        type: 'subscription_expired',
        title: '❌ Subscription Expired',
        message: `Your ${planName} subscription has expired. Renew now to restore access to premium features and keep your listings active.`,
        link: `/landlord/subscription`,
        metadata: { 
          subscriptionId,
          expiredAt: new Date().toISOString()
        }
      });
      
      console.log('[NOTIFICATION SERVICE] Subscription expired notification created');
    } catch (error) {
      console.error('[NOTIFICATION SERVICE] Error notifying landlord about subscription expired:', error);
      console.error('[NOTIFICATION SERVICE] Error details:', error.message, error.stack);
    }
  }
}

