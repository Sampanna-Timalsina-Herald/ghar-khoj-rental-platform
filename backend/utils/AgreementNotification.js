import { db } from '../config/database.js'
import nodemailer from 'nodemailer'

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

export class AgreementNotification {
  // Send notification via email and in-app
  static async send(type, agreementData, recipientId) {
    const notification = await this.createInAppNotification(type, agreementData, recipientId)
    
    // Get recipient details
    const userQuery = 'SELECT email, name FROM users WHERE id = $1'
    const userResult = await db.query(userQuery, [recipientId])
    const recipient = userResult.rows[0]

    if (recipient && recipient.email) {
      await this.sendEmail(type, agreementData, recipient)
    }

    return notification
  }

  // Create in-app notification
  static async createInAppNotification(type, agreementData, recipientId) {
    const query = `
      INSERT INTO notifications (
        id, user_id, type, title, message, agreement_id, read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())
      RETURNING *
    `

    const { v4: uuidv4 } = await import('uuid')
    const { title, message } = this.getNotificationText(type, agreementData)

    const result = await db.query(query, [
      uuidv4(),
      recipientId,
      type,
      title,
      message,
      agreementData.id
    ])

    return result.rows[0]
  }

  // Send email notification
  static async sendEmail(type, agreementData, recipient) {
    const { subject, html } = this.getEmailContent(type, agreementData, recipient)

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@gharkhoj.com',
        to: recipient.email,
        subject,
        html
      })
      console.log(`[EMAIL] Sent to ${recipient.email}: ${subject}`)
    } catch (error) {
      console.error(`[EMAIL ERROR] Failed to send to ${recipient.email}:`, error.message)
    }
  }

  // Get notification text
  static getNotificationText(type, data) {
    const notifications = {
      TENANT_APPROVED: {
        title: 'Agreement Sent to Landlord',
        message: `Your agreement for ${data.listing_title} has been sent to the landlord for verification.`
      },
      LANDLORD_RECEIVED: {
        title: 'New Rental Agreement',
        message: `${data.tenant_name} has requested to rent your property: ${data.listing_title}`
      },
      LANDLORD_APPROVED: {
        title: 'Agreement Sent to Admin',
        message: `Your agreement for ${data.listing_title} has been sent to admin for final confirmation.`
      },
      TENANT_RECEIVED_APPROVAL: {
        title: 'Landlord Approved Your Agreement',
        message: `The landlord has approved the rental agreement for ${data.listing_title}. Awaiting admin confirmation.`
      },
      ADMIN_PENDING: {
        title: 'Agreement Awaiting Confirmation',
        message: `New rental agreement for ${data.listing_title} requires your approval.`
      },
      ADMIN_CONFIRMED: {
        title: 'Rental Agreement Activated',
        message: `Your rental agreement for ${data.listing_title} is now active.`
      },
      RENT_STARTED: {
        title: 'Rent Period Started',
        message: `Your rental period for ${data.listing_title} has started today.`
      },
      RENT_30DAY_REMINDER: {
        title: 'Rent Ending Soon',
        message: `Your rental period for ${data.listing_title} ends in 30 days.`
      },
      RENT_7DAY_REMINDER: {
        title: 'Rent Ending Very Soon',
        message: `Your rental period for ${data.listing_title} ends in 7 days. Please contact your landlord if extending.`
      },
      RENT_COMPLETED: {
        title: 'Rental Period Completed',
        message: `Your rental agreement for ${data.listing_title} has been completed.`
      }
    }

    return notifications[type] || { title: 'Notification', message: 'New notification' }
  }

  // Get email content
  static getEmailContent(type, data, recipient) {
    const emailTemplates = {
      TENANT_APPROVED: {
        subject: `Agreement Submitted - ${data.listing_title}`,
        html: `
          <h2>Agreement Submitted to Landlord</h2>
          <p>Hi ${recipient.name},</p>
          <p>Your rental agreement for <strong>${data.listing_title}</strong> has been submitted to the landlord for verification.</p>
          <p><strong>Property Details:</strong></p>
          <ul>
            <li>Address: ${data.property_address}, ${data.city}</li>
            <li>Start Date: ${new Date(data.start_date).toLocaleDateString()}</li>
            <li>End Date: ${new Date(data.end_date).toLocaleDateString()}</li>
            <li>Monthly Rent: Rs. ${data.monthly_rent}</li>
          </ul>
          <p>You will be notified once the landlord approves the agreement.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      },
      LANDLORD_RECEIVED: {
        subject: `New Rental Request - ${data.listing_title}`,
        html: `
          <h2>New Rental Request</h2>
          <p>Hi ${recipient.name},</p>
          <p><strong>${data.tenant_name}</strong> has requested to rent your property: <strong>${data.listing_title}</strong></p>
          <p><strong>Tenant Details:</strong></p>
          <ul>
            <li>Name: ${data.tenant_name}</li>
            <li>Email: ${data.tenant_email}</li>
            <li>Phone: ${data.tenant_phone || 'N/A'}</li>
          </ul>
          <p><strong>Rental Terms:</strong></p>
          <ul>
            <li>Start Date: ${new Date(data.start_date).toLocaleDateString()}</li>
            <li>End Date: ${new Date(data.end_date).toLocaleDateString()}</li>
            <li>Monthly Rent: Rs. ${data.monthly_rent}</li>
            <li>Deposit: Rs. ${data.deposit}</li>
          </ul>
          <p>Please log in to your GHARKHOJ account to verify and approve the agreement.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      },
      LANDLORD_APPROVED: {
        subject: `Agreement Approved by Landlord - ${data.listing_title}`,
        html: `
          <h2>Agreement Approved by Landlord</h2>
          <p>Hi ${recipient.name},</p>
          <p>The landlord has approved your rental agreement for <strong>${data.listing_title}</strong>.</p>
          <p>Your agreement is now awaiting final confirmation from GHARKHOJ admin team.</p>
          <p>You will be notified once the admin confirms the agreement.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      },
      ADMIN_CONFIRMED: {
        subject: `Rental Agreement Activated - ${data.listing_title}`,
        html: `
          <h2>Rental Agreement Activated</h2>
          <p>Hi ${recipient.name},</p>
          <p>Your rental agreement for <strong>${data.listing_title}</strong> has been confirmed and is now active.</p>
          <p><strong>Agreement Details:</strong></p>
          <ul>
            <li>Property: ${data.property_address}, ${data.city}</li>
            <li>Start Date: ${new Date(data.start_date).toLocaleDateString()}</li>
            <li>End Date: ${new Date(data.end_date).toLocaleDateString()}</li>
            <li>Monthly Rent: Rs. ${data.monthly_rent}</li>
          </ul>
          <p>Welcome to your new home! If you have any questions, please contact us.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      },
      RENT_STARTED: {
        subject: `Rent Period Started - ${data.listing_title}`,
        html: `
          <h2>Rent Period Started</h2>
          <p>Hi ${recipient.name},</p>
          <p>Your rental period for <strong>${data.listing_title}</strong> has started today (${new Date(data.start_date).toLocaleDateString()}).</p>
          <p>For any issues or concerns, please contact your landlord or reach out to GHARKHOJ support.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      },
      RENT_30DAY_REMINDER: {
        subject: `Reminder: Rent Ending in 30 Days - ${data.listing_title}`,
        html: `
          <h2>Rental Period Reminder</h2>
          <p>Hi ${recipient.name},</p>
          <p>Your rental period for <strong>${data.listing_title}</strong> will end on ${new Date(data.end_date).toLocaleDateString()} (in 30 days).</p>
          <p>If you wish to extend your rental period, please contact your landlord as soon as possible.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      },
      RENT_7DAY_REMINDER: {
        subject: `URGENT: Rent Ending in 7 Days - ${data.listing_title}`,
        html: `
          <h2>Rental Period Ending Soon</h2>
          <p>Hi ${recipient.name},</p>
          <p>Your rental period for <strong>${data.listing_title}</strong> will end on ${new Date(data.end_date).toLocaleDateString()} (in 7 days).</p>
          <p>Please make arrangements with your landlord regarding lease extension or vacation.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      },
      RENT_COMPLETED: {
        subject: `Rental Period Completed - ${data.listing_title}`,
        html: `
          <h2>Rental Period Completed</h2>
          <p>Hi ${recipient.name},</p>
          <p>Your rental period for <strong>${data.listing_title}</strong> has been completed as of ${new Date(data.end_date).toLocaleDateString()}.</p>
          <p>Thank you for using GHARKHOJ. If you need to find another property, please visit our platform.</p>
          <p>Best regards,<br/>GHARKHOJ Team</p>
        `
      }
    }

    return emailTemplates[type] || {
      subject: 'GHARKHOJ Notification',
      html: '<p>You have a new notification from GHARKHOJ.</p>'
    }
  }

  // Bulk send notifications
  static async sendBulkNotification(type, agreementIds) {
    const promises = agreementIds.map(async (agreementId) => {
      const agreement = await this.getAgreementDetails(agreementId)
      // Send to appropriate recipients based on type
    })
    
    return Promise.all(promises)
  }

  // Get agreement details helper
  static async getAgreementDetails(agreementId) {
    const query = `
      SELECT a.*, 
        l.title as listing_title, l.address as property_address, l.city,
        u1.name as tenant_name, u1.email as tenant_email, u1.phone as tenant_phone,
        u2.name as landlord_name, u2.email as landlord_email
      FROM rent_agreements a
      JOIN listings l ON a.listing_id = l.id
      JOIN users u1 ON a.tenant_id = u1.id
      JOIN users u2 ON a.landlord_id = u2.id
      WHERE a.id = $1
    `
    
    const result = await db.query(query, [agreementId])
    return result.rows[0]
  }
}

export default AgreementNotification
