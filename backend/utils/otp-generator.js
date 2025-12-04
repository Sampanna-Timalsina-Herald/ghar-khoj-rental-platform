// Generate random 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Generate expiry time (10 minutes from now)
export const getOTPExpiry = () => {
  const now = new Date()
  return new Date(now.getTime() + 10 * 60000) // 10 minutes
}

// Validate OTP format
export const isValidOTP = (otp) => {
  return /^\d{6}$/.test(otp)
}
