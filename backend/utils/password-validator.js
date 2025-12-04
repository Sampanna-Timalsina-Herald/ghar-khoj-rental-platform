// Validate password strength
export const validatePasswordStrength = (password) => {
  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChar: /[@$!%*?&]/.test(password),
  }

  const score = Object.values(requirements).filter((req) => req).length
  const isStrong = score >= 3 // At least 3 of 5 requirements

  return {
    isStrong,
    requirements,
    score,
  }
}

// Get password strength message
export const getPasswordStrengthMessage = (score) => {
  switch (score) {
    case 5:
      return "Very Strong"
    case 4:
      return "Strong"
    case 3:
      return "Medium"
    case 2:
      return "Weak"
    default:
      return "Very Weak"
  }
}

export default { validatePasswordStrength, getPasswordStrengthMessage }
