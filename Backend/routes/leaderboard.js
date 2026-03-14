/**
 * Leaderboard Routes
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const leaderboardController = require('../controllers/leaderboard');

// POST /api/leaderboard/turn - Record a turn
router.post('/turn', requireAuth, leaderboardController.recordTurn);

// GET /api/leaderboard - Get leaderboard
router.get('/', requireAuth, leaderboardController.getLeaderboard);

module.exports = router;
