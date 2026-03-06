/**
 * Detection Routes
 */

const express = require('express');
const router = express.Router();
const optimizeController = require('../controllers/optimize');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// Optimization routes
router.post('/', optimizeController.optimize);

module.exports = router;
