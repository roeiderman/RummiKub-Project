/**
 * JWT Token Manager Utilities
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1h';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

/**
 * Generate access token
 */
const generateAccessToken = (userId, email) => {
    return jwt.sign(
        { userId, email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
    );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId },
        JWT_REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRE }
    );
};

/**
 * Verify token
 */
const verifyToken = (token, secret = JWT_SECRET) => {
    try {
        return jwt.verify(token, secret);
    } catch (error) {
        throw error;
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyToken
};
