/**
 * Users Routes
 */

const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// User routes
router.get('/profile', usersController.getProfile);
router.put('/profile', usersController.updateProfile);

module.exports = router;