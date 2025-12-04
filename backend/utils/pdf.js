import PDFDocument from "pdfkit"

export const generateAgreementPDF = async (agreement) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument()
      const chunks = []

      doc.on("data", (chunk) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))

      // Title
      doc.fontSize(20).text("RENT AGREEMENT", { align: "center" })
      doc.moveDown()

      // Agreement details
      doc.fontSize(12)
      doc.text(`Agreement ID: ${agreement.id}`)
      doc.text(`Start Date: ${agreement.start_date}`)
      doc.text(`End Date: ${agreement.end_date}`)
      doc.text(`Monthly Rent: ₹${agreement.monthly_rent}`)
      doc.text(`Deposit: ₹${agreement.deposit}`)
      doc.moveDown()

      // Terms
      doc.fontSize(14).text("Terms and Conditions", { underline: true })
      doc.fontSize(12).text(agreement.terms || "Standard rental terms apply")
      doc.moveDown()

      // Signature section
      doc.text("Landlord Signature: ________________")
      doc.text("Tenant Signature: ________________")
      doc.text("Date: ________________")

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}
