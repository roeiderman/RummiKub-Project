/**
 * Detection Routes
 */

const express = require('express');
const router = express.Router();
const detectionController = require('../controllers/detection');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(requireAuth);

// Detection routes
router.post('/', upload.single('image'), detectionController.detectTiles);

module.exports = router;
