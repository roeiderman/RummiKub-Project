/**
 * Password Validation Utilities
 */

/**
 * Validate password strength
 */
const validatePasswordStrength = (password) => {
    if (!password || password.length < 6) {
        return {
            valid: false,
            message: 'Password must be at least 6 characters'
        };
    }
    return { valid: true };
};

module.exports = {
    validatePasswordStrength
};
