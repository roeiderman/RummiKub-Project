/**
 * Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Require authentication - protect routes
 */
const requireAuth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: {
                    type: 'AuthenticationError',
                    message: 'No token provided. Please login.'
                }
            });
        }

        // Extract token
        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get user from database
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    type: 'AuthenticationError',
                    message: 'User not found'
                }
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = user._id;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: {
                    type: 'AuthenticationError',
                    message: 'Invalid token'
                }
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: {
                    type: 'AuthenticationError',
                    message: 'Token expired. Please login again.'
                }
            });
        }

        return res.status(500).json({
            success: false,
            error: {
                type: 'InternalError',
                message: 'Authentication failed'
            }
        });
    }
};

module.exports = {
    requireAuth,
};
