/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiter for auth endpoints (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        success: false,
        error: {
            type: 'RateLimitError',
            message: 'Too many requests, please try again later'
        }
    }
});

// Public routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
