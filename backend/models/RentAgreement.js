import { db } from '../config/database.js'

export class RentAgreement {
  // Agreement status constants
  static STATUS = {
    DRAFT: 'draft',
    TENANT_APPROVED: 'tenant_approved',
    LANDLORD_APPROVED: 'landlord_approved',
    ADMIN_CONFIRMED: 'admin_confirmed',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    TERMINATED: 'terminated'
  }

  // Create a new rent agreement (Draft stage - Tenant initiated)
  static async createDraft(agreementData) {
    const query = `
      INSERT INTO rent_agreements (
        id, listing_id, landlord_id, tenant_id, status, 
        start_date, end_date, monthly_rent, deposit,
        tenant_approved_at, landlord_approved_at, admin_approved_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `
    
    const values = [
      agreementData.id,
      agreementData.listing_id,
      agreementData.landlord_id,
      agreementData.tenant_id,
      this.STATUS.DRAFT,
      agreementData.start_date,
      agreementData.end_date,
      agreementData.monthly_rent,
      agreementData.deposit || 0,
      null, null, null
    ]

    const result = await db.query(query, values)
    return result.rows[0]
  }

  // Tenant approves agreement
  static async tenantApprove(agreementId) {
    const query = `
      UPDATE rent_agreements 
      SET status = $1, tenant_approved_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `
    
    const result = await db.query(query, [this.STATUS.TENANT_APPROVED, agreementId])
    return result.rows[0]
  }

  // Landlord approves and can edit agreement
  static async landlordApprove(agreementId, editedTerms) {
    const query = `
      UPDATE rent_agreements 
      SET 
        status = $1, 
        landlord_approved_at = NOW(),
        ${editedTerms ? 'start_date = $3, end_date = $4, terms = $5,' : ''}
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `
    
    const values = editedTerms 
      ? [this.STATUS.LANDLORD_APPROVED, agreementId, editedTerms.start_date, editedTerms.end_date, editedTerms.terms]
      : [this.STATUS.LANDLORD_APPROVED, agreementId]

    const result = await db.query(query, values)
    return result.rows[0]
  }

  // Admin confirms agreement and activates
  static async adminConfirm(agreementId) {
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')

      // Update agreement status
      const query = `
        UPDATE rent_agreements 
        SET status = $1, admin_approved_at = NOW(), updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `
      
      const result = await client.query(query, [this.STATUS.ACTIVE, agreementId])
      const agreement = result.rows[0]

      // Update listing status to 'rented'
      await client.query(
        'UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2',
        ['rented', agreement.listing_id]
      )

      await client.query('COMMIT')
      return agreement
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  // Get agreement by ID
  static async getById(agreementId) {
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

  // Get user's agreements
  static async getByUserId(userId) {
    const query = `
      SELECT a.*, 
        l.title as listing_title, l.address as property_address,
        u1.name as tenant_name, u1.email as tenant_email,
        u2.name as landlord_name, u2.email as landlord_email
      FROM rent_agreements a
      JOIN listings l ON a.listing_id = l.id
      JOIN users u1 ON a.tenant_id = u1.id
      JOIN users u2 ON a.landlord_id = u2.id
      WHERE a.tenant_id = $1 OR a.landlord_id = $1
      ORDER BY a.created_at DESC
    `
    
    const result = await db.query(query, [userId])
    return result.rows
  }

  // Get landlord's pending agreements
  static async getLandlordPending(landlordId) {
    const query = `
      SELECT a.*, 
        l.title as listing_title, l.address as property_address,
        u1.name as tenant_name, u1.email as tenant_email
      FROM rent_agreements a
      JOIN listings l ON a.listing_id = l.id
      JOIN users u1 ON a.tenant_id = u1.id
      WHERE a.landlord_id = $1 AND a.status = $2
      ORDER BY a.created_at DESC
    `
    
    const result = await db.query(query, [landlordId, this.STATUS.TENANT_APPROVED])
    return result.rows
  }

  // Get admin's pending confirmations
  static async getAdminPending() {
    const query = `
      SELECT a.*, 
        l.title as listing_title, l.address as property_address,
        u1.name as tenant_name, u1.email as tenant_email,
        u2.name as landlord_name, u2.email as landlord_email
      FROM rent_agreements a
      JOIN listings l ON a.listing_id = l.id
      JOIN users u1 ON a.tenant_id = u1.id
      JOIN users u2 ON a.landlord_id = u2.id
      WHERE a.status = $1
      ORDER BY a.created_at DESC
    `
    
    const result = await db.query(query, [this.STATUS.LANDLORD_APPROVED])
    return result.rows
  }

  // Request duration extension
  static async requestExtension(agreementId, newEndDate, reason) {
    const query = `
      INSERT INTO agreement_extension_requests (
        id, agreement_id, requested_end_date, reason, requested_by, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING *
    `
    
    const { v4: uuidv4 } = await import('uuid')
    const result = await db.query(query, [uuidv4(), agreementId, newEndDate, reason, null])
    return result.rows[0]
  }

  // Request early termination
  static async requestTermination(agreementId, reason) {
    const query = `
      INSERT INTO agreement_termination_requests (
        id, agreement_id, reason, requested_by, status, created_at
      ) VALUES ($1, $2, $3, $4, 'pending', NOW())
      RETURNING *
    `
    
    const { v4: uuidv4 } = await import('uuid')
    const result = await db.query(query, [uuidv4(), agreementId, reason, null])
    return result.rows[0]
  }

  // Auto-complete agreement on end date
  static async completeIfExpired(agreementId) {
    const query = `
      UPDATE rent_agreements 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND end_date <= CURRENT_DATE AND status = $3
      RETURNING *
    `
    
    const result = await db.query(query, [this.STATUS.COMPLETED, agreementId, this.STATUS.ACTIVE])
    return result.rows[0]
  }

  // Get active rentals for a property
  static async getActiveRentalForProperty(listingId) {
    const query = `
      SELECT a.*, 
        u.name as tenant_name, u.email as tenant_email
      FROM rent_agreements a
      JOIN users u ON a.tenant_id = u.id
      WHERE a.listing_id = $1 AND a.status = $2
      AND a.start_date <= CURRENT_DATE AND a.end_date >= CURRENT_DATE
      LIMIT 1
    `
    
    const result = await db.query(query, [listingId, this.STATUS.ACTIVE])
    return result.rows[0]
  }

  // Check if property has double booking
  static async checkDoubleBooking(listingId, startDate, endDate, excludeAgreementId = null) {
    const query = excludeAgreementId
      ? `
        SELECT COUNT(*) as count FROM rent_agreements 
        WHERE listing_id = $1 
        AND status = $2
        AND id != $3
        AND (
          (start_date <= $4 AND end_date >= $4) OR
          (start_date <= $5 AND end_date >= $5) OR
          (start_date >= $4 AND end_date <= $5)
        )
      `
      : `
        SELECT COUNT(*) as count FROM rent_agreements 
        WHERE listing_id = $1 
        AND status = $2
        AND (
          (start_date <= $3 AND end_date >= $3) OR
          (start_date <= $4 AND end_date >= $4) OR
          (start_date >= $3 AND end_date <= $4)
        )
      `
    
    const values = excludeAgreementId
      ? [listingId, this.STATUS.ACTIVE, excludeAgreementId, startDate, endDate]
      : [listingId, this.STATUS.ACTIVE, startDate, endDate]

    const result = await db.query(query, values)
    return parseInt(result.rows[0].count) > 0
  }
}

export default RentAgreement
