import express from "express"
import { db, query } from "../config/database.js"
import { authMiddleware } from "../middleware/auth-enhanced.js"
import { v4 as uuidv4 } from "uuid"
import { generateAgreementPDF } from "../utils/pdf.js"
import { sendAgreementEmail } from "../utils/emailService.js"
import { NotificationService } from "../services/notification-service.js"

const router = express.Router()

// Request rent agreement (from tenant)
router.post("/request-rent", authMiddleware, async (req, res) => {
  try {
    const { listing_id, start_date, end_date, monthly_rent, deposit, terms } = req.body
    const tenant_id = req.user.id || req.user.userId

    // Validate required fields
    if (!listing_id || !start_date || !end_date || !monthly_rent) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    // Validate date range
    const sDate = new Date(start_date)
    const eDate = new Date(end_date)
    if (eDate <= sDate) {
      return res.status(400).json({ message: 'End date must be after start date' })
    }

    const listing = await db.getListingById(listing_id)
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' })
    }

    const agreement = await db.createAgreement({
      id: uuidv4(),
      listing_id,
      tenant_id,
      landlord_id: listing.landlord_id,
      start_date,
      end_date,
      monthly_rent,
      deposit: deposit || Math.round(monthly_rent * 2),
      terms: terms || '',
      status: 'pending'
    })

    console.log('[AGREEMENT REQUEST] Created agreement:', agreement.id, 'Landlord:', listing.landlord_id);

    // Get tenant name and notify landlord
    const tenantResult = await query(`SELECT name FROM users WHERE id = $1`, [tenant_id]);
    const tenantName = tenantResult.rows[0]?.name || 'A tenant';
    
    console.log('[AGREEMENT REQUEST] Sending notification to landlord:', listing.landlord_id, 'from tenant:', tenantName);
    
    await NotificationService.notifyLandlordAgreementRequest(
      listing.landlord_id,
      tenantName,
      listing.title,
      agreement.id
    );

    console.log('[AGREEMENT REQUEST] Notification sent successfully');

    res.status(201).json(agreement)
  } catch (error) {
    console.error('Request rent agreement error:', error)
    res.status(500).json({ message: error.message })
  }
})

// Create rent agreement
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { listing_id, tenant_id, start_date, end_date, monthly_rent, deposit, terms } = req.body

    const listing = await db.getListingById(listing_id)
    const agreement = await db.createAgreement({
      id: uuidv4(),
      listing_id,
      tenant_id,
      landlord_id: listing.landlord_id,
      start_date,
      end_date,
      monthly_rent,
      deposit,
      terms,
    })

    // Notify both landlord and tenant
    await NotificationService.notifyAgreementCreated(
      listing.landlord_id,
      tenant_id,
      listing.title,
      agreement.id
    );

    res.status(201).json(agreement)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get agreement by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const agreement = await db.getAgreementById(req.params.id)
    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' })
    }

    // Fetch related data
    const tenant = await db.getUserById(agreement.tenant_id)
    const landlord = await db.getUserById(agreement.landlord_id)
    const listing = await db.getListingById(agreement.listing_id)

    res.json({
      ...agreement,
      tenant,
      landlord,
      listing
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get user's agreements
router.get("/", authMiddleware, async (req, res) => {
  try {
    const agreements = await db.getUserAgreements(req.user.userId || req.user.id)
    
    // Fetch related data for each agreement
    const enrichedAgreements = await Promise.all(
      agreements.map(async (agreement) => {
        const tenant = await db.getUserById(agreement.tenant_id)
        const landlord = await db.getUserById(agreement.landlord_id)
        const listing = await db.getListingById(agreement.listing_id)
        
        return {
          ...agreement,
          tenant,
          landlord,
          listing
        }
      })
    )
    
    res.json(enrichedAgreements)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Update agreement status
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body
    const agreement = await db.updateAgreement(req.params.id, { status })
    res.json(agreement)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Generate PDF agreement
router.post("/:id/generate-pdf", authMiddleware, async (req, res) => {
  try {
    const agreement = await db.getAgreementById(req.params.id)
    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' })
    }

    // Fetch enriched data for PDF
    const tenant = await db.getUserById(agreement.tenant_id)
    const landlord = await db.getUserById(agreement.landlord_id)
    const listing = await db.getListingById(agreement.listing_id)

    const enrichedAgreement = {
      ...agreement,
      tenant,
      landlord,
      listing
    }

    const pdfBuffer = await generateAgreementPDF(enrichedAgreement)
    res.contentType("application/pdf")
    res.send(pdfBuffer)
  } catch (error) {
    console.error('PDF generation error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Landlord sends agreement for review
router.put("/:id/send-for-review", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const landlord_id = req.user.id || req.user.userId

    const agreement = await db.getAgreementById(id)
    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' })
    }

    if (agreement.landlord_id !== landlord_id) {
      return res.status(403).json({ message: 'Only landlord can send for review' })
    }

    const updatedAgreement = await db.updateAgreement(id, { status: 'for_review' })

    // Send email to tenant (don't block if email fails)
    try {
      await sendAgreementEmail(updatedAgreement, 'for_review')
    } catch (emailError) {
      console.error('Email send failed:', emailError)
      // Don't fail the request if email fails
    }

    res.json(updatedAgreement)
  } catch (error) {
    console.error('Send for review error:', error)
    res.status(500).json({ message: error.message })
  }
})

// Tenant requests final approval
router.put("/:id/request-approval", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const tenant_id = req.user.id || req.user.userId

    const agreement = await db.getAgreementById(id)
    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' })
    }

    if (agreement.tenant_id !== tenant_id) {
      return res.status(403).json({ message: 'Only tenant can request approval' })
    }

    if (agreement.status !== 'for_review') {
      return res.status(400).json({ message: 'Agreement must be in for_review status' })
    }

    const updatedAgreement = await db.updateAgreement(id, { status: 'pending_approval' })

    // Send email to landlord
    await sendAgreementEmail(updatedAgreement, 'pending_approval')

    res.json(updatedAgreement)
  } catch (error) {
    console.error('Request approval error:', error)
    res.status(500).json({ message: error.message })
  }
})

// Landlord approves agreement
router.put("/:id/approve", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const landlord_id = req.user.id || req.user.userId

    const agreement = await db.getAgreementById(id)
    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' })
    }

    if (agreement.landlord_id !== landlord_id) {
      return res.status(403).json({ message: 'Only landlord can approve' })
    }

    if (agreement.status !== 'pending_approval') {
      return res.status(400).json({ message: 'Agreement must be in pending_approval status' })
    }

    const updatedAgreement = await db.updateAgreement(id, { 
      status: 'approved',
      approved_at: new Date()
    })

    // Get listing details for notification
    const listing = await db.getListingById(agreement.listing_id);
    
    // Notify tenant about approval
    await NotificationService.notifyTenantAgreementApproved(
      agreement.tenant_id,
      listing.title,
      agreement.id
    );

    // Send confirmation email to both parties (don't block if email fails)
    try {
      await sendAgreementEmail(updatedAgreement, 'approved')
    } catch (emailError) {
      console.error('Email send failed:', emailError)
      // Don't fail the request if email fails
    }

    res.json(updatedAgreement)
  } catch (error) {
    console.error('Approve error:', error)
    res.status(500).json({ message: error.message })
  }
})

// Reject agreement (either party)
router.put("/:id/reject", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const user_id = req.user.id || req.user.userId

    const agreement = await db.getAgreementById(id)
    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' })
    }

    if (agreement.landlord_id !== user_id && agreement.tenant_id !== user_id) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    const updatedAgreement = await db.updateAgreement(id, { 
      status: 'rejected',
      rejection_reason: reason || '',
      rejected_by: user_id,
      rejected_at: new Date()
    })

    // Get listing details for notification
    const listing = await db.getListingById(agreement.listing_id);
    
    // Notify the other party about rejection
    const otherPartyId = user_id === agreement.landlord_id ? agreement.tenant_id : agreement.landlord_id;
    await NotificationService.notifyAgreementRejected(
      otherPartyId,
      listing.title,
      reason,
      agreement.id
    );

    // Send rejection email (don't block if email fails)
    try {
      await sendAgreementEmail(updatedAgreement, 'rejected')
    } catch (emailError) {
      console.error('Email send failed:', emailError)
      // Don't fail the request if email fails
    }

    res.json(updatedAgreement)
  } catch (error) {
    console.error('Reject error:', error)
    res.status(500).json({ message: error.message })
  }
})

// Delete rejected or draft agreement
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const user_id = req.user.id || req.user.userId

    const agreement = await db.getAgreementById(id)
    if (!agreement) {
      return res.status(404).json({ message: 'Agreement not found' })
    }

    // Check if user is tenant or landlord
    if (agreement.landlord_id !== user_id && agreement.tenant_id !== user_id) {
      return res.status(403).json({ message: 'Unauthorized to delete this agreement' })
    }

    // Only allow deletion of rejected or pending agreements
    if (agreement.status !== 'rejected' && agreement.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Only rejected or pending agreements can be deleted',
        status: agreement.status 
      })
    }

    // Delete the agreement
    await query('DELETE FROM agreements WHERE id = $1', [id])

    res.json({
      success: true,
      message: 'Agreement deleted successfully'
    })
  } catch (error) {
    console.error('Delete agreement error:', error)
    res.status(500).json({ message: error.message })
  }
})

export default router
