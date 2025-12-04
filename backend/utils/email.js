import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

export const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    })
  } catch (error) {
    console.error("Email send error:", error)
  }
}

export const sendWelcomeEmail = async (email, name) => {
  const html = `
    <h1>Welcome to GharKhoj, ${name}!</h1>
    <p>Your account has been created successfully.</p>
    <p>Start exploring rental listings near your college today!</p>
  `
  await sendEmail(email, "Welcome to GharKhoj", html)
}

export const sendListingApprovedEmail = async (email, listingTitle) => {
  const html = `
    <h2>Your listing has been approved!</h2>
    <p>Your listing "${listingTitle}" has been verified and is now live on GharKhoj.</p>
  `
  await sendEmail(email, "Listing Approved", html)
}

export const sendAgreementEmail = async (email, agreementId) => {
  const html = `
    <h2>Rent Agreement Ready</h2>
    <p>Your rent agreement is ready for review. Agreement ID: ${agreementId}</p>
  `
  await sendEmail(email, "Rent Agreement Ready", html)
}
