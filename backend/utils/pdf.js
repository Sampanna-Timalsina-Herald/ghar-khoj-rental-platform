import PDFDocument from "pdfkit"

export const generateAgreementPDF = async (agreement) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 })
      const buffers = []

      doc.on("data", (chunk) => buffers.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(buffers)))
      doc.on("error", reject)

      // Title
      doc.fontSize(24).font('Helvetica-Bold').text('RENTAL AGREEMENT', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Agreement ID: ${agreement.id}`, { align: 'center' })
      doc.fontSize(10).text(`Date: ${new Date(agreement.created_at).toLocaleDateString()}`, { align: 'center' })

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(1)

      // Party Information
      doc.fontSize(12).font('Helvetica-Bold').text('PARTIES TO THE AGREEMENT')
      doc.moveDown(0.3)

      doc.fontSize(10).font('Helvetica-Bold').text('Landlord:')
      doc.fontSize(10).font('Helvetica').text(agreement.landlord?.name || 'N/A')
      doc.text(`Email: ${agreement.landlord?.email || 'N/A'}`)
      doc.text(`Phone: ${agreement.landlord?.phone || 'N/A'}`)
      doc.moveDown(0.5)

      doc.fontSize(10).font('Helvetica-Bold').text('Tenant:')
      doc.fontSize(10).font('Helvetica').text(agreement.tenant?.name || 'N/A')
      doc.text(`Email: ${agreement.tenant?.email || 'N/A'}`)
      doc.text(`Phone: ${agreement.tenant?.phone || 'N/A'}`)

      doc.moveDown(0.5)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(1)

      // Property Information
      doc.fontSize(12).font('Helvetica-Bold').text('PROPERTY DETAILS')
      doc.moveDown(0.3)

      doc.fontSize(10).font('Helvetica-Bold').text('Property Name:', { continued: true })
      doc.font('Helvetica').text(` ${agreement.listing?.title || 'N/A'}`)

      doc.fontSize(10).font('Helvetica-Bold').text('Address:', { continued: true })
      doc.font('Helvetica').text(` ${agreement.listing?.address || 'N/A'}`)

      doc.fontSize(10).font('Helvetica-Bold').text('City:', { continued: true })
      doc.font('Helvetica').text(` ${agreement.listing?.city || 'N/A'}`)

      doc.moveDown(0.5)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(1)

      // Financial Terms
      doc.fontSize(12).font('Helvetica-Bold').text('FINANCIAL TERMS')
      doc.moveDown(0.3)

      doc.fontSize(10).font('Helvetica-Bold').text('Monthly Rent:', { continued: true })
      doc.font('Helvetica').text(` Rs. ${agreement.monthly_rent || 0}`)

      doc.fontSize(10).font('Helvetica-Bold').text('Security Deposit:', { continued: true })
      doc.font('Helvetica').text(` Rs. ${agreement.deposit || 0}`)

      doc.moveDown(0.5)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(1)

      // Lease Period
      doc.fontSize(12).font('Helvetica-Bold').text('LEASE PERIOD')
      doc.moveDown(0.3)

      const startDate = new Date(agreement.start_date)
      const endDate = new Date(agreement.end_date)
      const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      const durationMonths = (durationDays / 30).toFixed(1)

      doc.fontSize(10).font('Helvetica-Bold').text('Move-in Date:', { continued: true })
      doc.font('Helvetica').text(` ${agreement.start_date}`)

      doc.fontSize(10).font('Helvetica-Bold').text('Move-out Date:', { continued: true })
      doc.font('Helvetica').text(` ${agreement.end_date}`)

      doc.fontSize(10).font('Helvetica-Bold').text('Duration:', { continued: true })
      doc.font('Helvetica').text(` ${durationDays} days (~${durationMonths} months)`)

      doc.moveDown(0.5)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(1)

      // Terms and Conditions
      if (agreement.terms) {
        doc.fontSize(12).font('Helvetica-Bold').text('ADDITIONAL TERMS & CONDITIONS')
        doc.moveDown(0.3)
        doc.fontSize(10).font('Helvetica').text(agreement.terms, { align: 'justify' })
        doc.moveDown(0.5)
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
        doc.moveDown(1)
      }

      // Status Information
      doc.fontSize(12).font('Helvetica-Bold').text('AGREEMENT STATUS')
      doc.moveDown(0.3)

      const statusText = agreement.status.replace(/_/g, ' ').toUpperCase()
      const statusDate = agreement.approved_at ? new Date(agreement.approved_at).toLocaleDateString() : 'Pending'

      doc.fontSize(10).font('Helvetica-Bold').text('Status:', { continued: true })
      doc.font('Helvetica').text(` ${statusText}`)

      if (agreement.status === 'approved') {
        doc.fontSize(10).font('Helvetica-Bold').text('Approval Date:', { continued: true })
        doc.font('Helvetica').text(` ${statusDate}`)
      }

      if (agreement.status === 'rejected') {
        doc.fontSize(10).font('Helvetica-Bold').text('Rejected By:', { continued: true })
        doc.font('Helvetica').text(` ${agreement.rejected_by === agreement.landlord_id ? 'Landlord' : 'Tenant'}`)
        doc.fontSize(10).font('Helvetica-Bold').text('Reason:', { continued: true })
        doc.font('Helvetica').text(` ${agreement.rejection_reason || 'N/A'}`)
      }

      doc.moveDown(1)
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
      doc.moveDown(1)

      // Footer
      doc.fontSize(9).font('Helvetica').text('This is an electronic agreement generated by KhojGhar Platform.', {
        align: 'center',
      })
      doc.text('For legal purposes, both parties should sign the printed version of this agreement.', {
        align: 'center',
      })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
