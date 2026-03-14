/**
 * Leaderboard Controller
 */

const leaderboardService = require('../services/leaderboard');

/**
 * Record a turn for the authenticated user.
 * POST /api/leaderboard/turn
 * Body: { tilesPlayed: Number }
 */
const recordTurn = async (req, res, next) => {
    try {
        const { tilesPlayed } = req.body;

        if (typeof tilesPlayed !== 'number' || tilesPlayed < 0) {
            return res.status(400).json({
                success: false,
                error: {
                    type: 'ValidationError',
                    message: 'tilesPlayed must be a non-negative number'
                }
            });
        }

        await leaderboardService.recordTurn(req.userId, tilesPlayed);

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

/**
 * Get the leaderboard.
 * GET /api/leaderboard?sortBy=maxTilesInOneTurn|totalTurns
 */
const getLeaderboard = async (req, res, next) => {
    try {
        const { sortBy } = req.query;
        const entries = await leaderboardService.getLeaderboard(sortBy);

        res.status(200).json({
            success: true,
            data: entries
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    recordTurn,
    getLeaderboard
};
