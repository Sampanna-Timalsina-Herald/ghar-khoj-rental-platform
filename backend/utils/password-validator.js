// Validate password strength
export const validatePasswordStrength = (password) => {
    // 1. Define the boolean checks
    const checks = {
        minLength: password.length >= 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasLowerCase: /[a-z]/.test(password),
        hasNumbers: /\d/.test(password),
        hasSpecialChar: /[@$!%*?&]/.test(password),
    }

    // 2. Calculate Score
    const score = Object.values(checks).filter((req) => req).length

    // 3. Determine overall strength (used for isStrong and message)
    const isStrong = score >= 3 // At least 3 of 5 requirements for 'isStrong'

    // 4. Generate human-readable requirements list (for client display)
    const requirementsList = [
        { 
            message: "Minimum 8 characters long", 
            passed: checks.minLength 
        },
        { 
            message: "Contains an uppercase letter (A-Z)", 
            passed: checks.hasUpperCase 
        },
        { 
            message: "Contains a lowercase letter (a-z)", 
            passed: checks.hasLowerCase 
        },
        { 
            message: "Contains a number (0-9)", 
            passed: checks.hasNumbers 
        },
        { 
            message: "Contains a special character (@$!%*?&)", 
            passed: checks.hasSpecialChar 
        },
    ]

    // 5. Determine the strength label
    const strengthLabel = getPasswordStrengthMessage(score)

    return {
        isStrong,
        score,
        strength: strengthLabel, // The string: 'Very Strong', 'Strong', 'Medium', etc.
        // This is the list the client will map to show live status (✅/❌)
        requirements: requirementsList, 
    }
}

// Get password strength message (unchanged, but now a private helper)
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