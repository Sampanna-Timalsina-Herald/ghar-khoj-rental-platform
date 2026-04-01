import { query } from '../config/database.js';

export class Booking {
  static async getCompletedFirstPayment(bookingId, tenantId) {
    const result = await query(`
      SELECT *
      FROM payments
      WHERE reference_id = $1
        AND user_id = $2
        AND status = 'completed'
        AND payment_type = 'commission'
      ORDER BY verified_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `, [bookingId, tenantId]);

    return result.rows[0] || null;
  }

  // Create a new booking request
  static async create(bookingData) {
    const {
      listing_id,
      tenant_id,
      landlord_id,
      start_date,
      end_date,
      monthly_rent,
      security_deposit,
      message,
      full_name,
      permanent_address,
      current_address,
      phone_number,
      email,
      citizenship_number,
      citizenship_front_image,
      citizenship_back_image,
      occupation,
      emergency_contact_person,
      emergency_contact_phone
    } = bookingData;

    const result = await query(`
      INSERT INTO bookings (
        listing_id, tenant_id, landlord_id, start_date, end_date,
        monthly_rent, security_deposit, message, status,
        full_name, permanent_address, current_address, phone_number,
        email, citizenship_number, citizenship_front_image, citizenship_back_image,
        occupation, emergency_contact_person, emergency_contact_phone
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'pending',
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19
      )
      RETURNING *
    `, [
      listing_id,
      tenant_id,
      landlord_id,
      start_date,
      end_date,
      monthly_rent,
      security_deposit,
      message,
      full_name,
      permanent_address,
      current_address,
      phone_number,
      email,
      citizenship_number,
      citizenship_front_image,
      citizenship_back_image,
      occupation,
      emergency_contact_person,
      emergency_contact_phone
    ]);

    // Update listing status to pending
    await query(`
      UPDATE listings 
      SET booking_status = 'pending', current_booking_id = $1
      WHERE id = $2
    `, [result.rows[0].id, listing_id]);

    return result.rows[0];
  }

  // Get booking by ID with user details
  static async getById(bookingId) {
    const result = await query(`
      SELECT 
        b.*,
        t.name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone,
        t.profile_image as tenant_image,
        l.title as listing_title,
        l.address as listing_address,
        l.city as listing_city,
        l.images as listing_images
      FROM bookings b
      JOIN users t ON b.tenant_id = t.id
      JOIN listings l ON b.listing_id = l.id
      WHERE b.id = $1
    `, [bookingId]);

    return result.rows[0];
  }

  // Get all bookings for a landlord
  static async getByLandlordId(landlordId) {
    const result = await query(`
      SELECT 
        b.*,
        t.name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone,
        t.profile_image as tenant_image,
        l.title as listing_title,
        l.address as listing_address,
        l.city as listing_city,
        l.images as listing_images
      FROM bookings b
      JOIN users t ON b.tenant_id = t.id
      JOIN listings l ON b.listing_id = l.id
      WHERE b.landlord_id = $1
      ORDER BY b.created_at DESC
    `, [landlordId]);

    return result.rows;
  }

  // Get all bookings for a tenant
  static async getByTenantId(tenantId) {
    const result = await query(`
      SELECT 
        b.*,
        ll.name as landlord_name,
        ll.email as landlord_email,
        ll.phone as landlord_phone,
        l.title as listing_title,
        l.address as listing_address,
        l.city as listing_city,
        l.images as listing_images
      FROM bookings b
      JOIN users ll ON b.landlord_id = ll.id
      JOIN listings l ON b.listing_id = l.id
      WHERE b.tenant_id = $1
      ORDER BY b.created_at DESC
    `, [tenantId]);

    return result.rows;
  }

  // Get pending booking for a listing
  static async getPendingByListingId(listingId) {
    const result = await query(`
      SELECT 
        b.*,
        t.name as tenant_name,
        t.email as tenant_email,
        t.phone as tenant_phone
      FROM bookings b
      JOIN users t ON b.tenant_id = t.id
      WHERE b.listing_id = $1 AND b.status = 'pending'
      ORDER BY b.created_at DESC
      LIMIT 1
    `, [listingId]);

    return result.rows[0];
  }

  // Approve booking - creates draft agreement for tenant review
  static async approve(bookingId) {
    const result = await query(`
      UPDATE bookings
      SET status = 'approved', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [bookingId]);

    const booking = result.rows[0];

    // Update listing to pending approval status (waiting for tenant to accept agreement)
    await query(`
      UPDATE listings
      SET 
        booking_status = 'pending',
        current_booking_id = $1
      WHERE id = $2
    `, [bookingId, booking.listing_id]);

    // Generate proper rental agreement terms
    const startDate = new Date(booking.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const endDate = new Date(booking.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const agreementTerms = `RENTAL AGREEMENT TERMS & CONDITIONS

PROPERTY DETAILS:
This rental agreement is for the property listed on our platform with the following terms:

RENTAL PERIOD:
• Start Date: ${startDate}
• End Date: ${endDate}
• Monthly Rent: Rs. ${Number(booking.monthly_rent || 0).toLocaleString()}
• Security Deposit: Rs. ${Number(booking.security_deposit || 0).toLocaleString()}

TENANT RESPONSIBILITIES:
1. Pay monthly rent in full by the due date each month
2. Maintain the property in good condition and report any damages
3. Keep the property clean and hygienic
4. Not make permanent alterations without landlord permission
5. Allow landlord reasonable access for inspections and repairs
6. Comply with all local laws and regulations

LANDLORD RESPONSIBILITIES:
1. Provide a safe, habitable property
2. Maintain essential utilities and services
3. Make necessary repairs within 24-48 hours of notice
4. Respect tenant's privacy and right to peaceful enjoyment
5. Return security deposit (minus lawful deductions) within 30 days of checkout

PAYMENT TERMS:
• Rent Payment Method: As per agreement
• Late Payment: Subject to penalty as agreed
• Security Deposit: Held in trust and returned upon checkout

TERMINATION:
• Property must be vacated by end date in clean condition
• Tenant must provide 30 days notice for early termination
• Landlord may terminate for non-payment or breach of terms

By accepting this agreement, both parties agree to all terms and conditions stated above.`;

    // Create draft agreement for tenant to review and accept
    await query(`
      INSERT INTO agreements (
        id, listing_id, tenant_id, landlord_id, start_date, end_date,
        monthly_rent, deposit, status, terms, 
        tenant_signature, landlord_signature, tenant_signed_at, landlord_signed_at,
        created_at, updated_at
      )
      VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, 'pending_approval',
        $8, $9, $10, $11, $12,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      booking.listing_id,
      booking.tenant_id,
      booking.landlord_id,
      booking.start_date,
      booking.end_date,
      booking.monthly_rent,
      booking.security_deposit,
      agreementTerms,
      booking.tenant_signature || null,
      booking.landlord_signature || null,
      booking.tenant_signed_at || null,
      booking.landlord_signed_at || null
    ]);

    // Reject all other pending bookings for this listing
    await query(`
      UPDATE bookings
      SET status = 'rejected', rejection_reason = 'Property already rented to another tenant', updated_at = CURRENT_TIMESTAMP
      WHERE listing_id = $1 AND id != $2 AND status = 'pending'
    `, [booking.listing_id, bookingId]);

    return booking;
  }

  // Tenant accepts the agreement after first payment and signature
  static async acceptAgreement(bookingId, tenantId, tenantSignature, paymentTransactionUuid) {
    const result = await query(`
      UPDATE bookings
      SET
        status = 'tenant_accepted',
        tenant_signature = $3,
        tenant_signed_at = CURRENT_TIMESTAMP,
        first_payment_status = 'completed',
        first_payment_transaction_uuid = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 AND status = 'approved'
      RETURNING *
    `, [bookingId, tenantId, tenantSignature, paymentTransactionUuid || null]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or already processed');
    }

    const booking = result.rows[0];

    // Move agreement to accepted state and update with tenant signature; landlord will verify and start rent
    await query(`
      UPDATE agreements
      SET 
        status = 'accepted', 
        tenant_signature = $3,
        tenant_signed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE listing_id = $1 AND tenant_id = $2 AND status = 'pending_approval'
    `, [booking.listing_id, booking.tenant_id, tenantSignature]);

    return booking;
  }

  // Landlord verifies tenant acceptance and starts the rent
  static async landlordVerifyAndStartRental(bookingId, landlordId, landlordSignature) {
    const result = await query(`
      UPDATE bookings
      SET
        status = 'active',
        landlord_signature = $3,
        landlord_signed_at = CURRENT_TIMESTAMP,
        landlord_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND landlord_id = $2 AND status = 'tenant_accepted'
      RETURNING *
    `, [bookingId, landlordId, landlordSignature]);

    if (result.rows.length === 0) {
      throw new Error('Booking not found or not ready for landlord verification');
    }

    const booking = result.rows[0];

    // Update listing to rented status
    await query(`
      UPDATE listings
      SET 
        booking_status = 'rented',
        status = 'rented',
        current_tenant_id = $1,
        rent_start_date = $2,
        rent_end_date = $3,
        current_booking_id = $4
      WHERE id = $5
    `, [booking.tenant_id, booking.start_date, booking.end_date, bookingId, booking.listing_id]);

    // Activate the agreement and update with landlord signature
    await query(`
      UPDATE agreements
      SET 
        status = 'active', 
        landlord_signature = $3,
        landlord_signed_at = CURRENT_TIMESTAMP,
        approved_at = CURRENT_TIMESTAMP, 
        updated_at = CURRENT_TIMESTAMP
      WHERE listing_id = $1 AND tenant_id = $2 AND status IN ('pending_approval', 'accepted')
    `, [booking.listing_id, booking.tenant_id, landlordSignature]);

    return booking;
  }

  // Reject booking
  static async reject(bookingId, rejectionReason) {
    const result = await query(`
      UPDATE bookings
      SET status = 'rejected', rejection_reason = $1, rejected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [rejectionReason, bookingId]);

    const booking = result.rows[0];

    // Update listing back to available if this was the current booking
    await query(`
      UPDATE listings
      SET booking_status = 'available', current_booking_id = NULL
      WHERE id = $1 AND current_booking_id = $2
    `, [booking.listing_id, bookingId]);

    return booking;
  }

  // Cancel booking (by tenant)
  static async cancel(bookingId) {
    const result = await query(`
      UPDATE bookings
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [bookingId]);

    const booking = result.rows[0];

    // Update listing back to available if this was the current booking
    await query(`
      UPDATE listings
      SET booking_status = 'available', current_booking_id = NULL
      WHERE id = $1 AND current_booking_id = $2
    `, [booking.listing_id, bookingId]);

    return booking;
  }

  // Check and expire old rentals
  static async checkExpiredRentals() {
    await query(`SELECT check_expired_rentals()`);
  }
}
