const optimizeService = require('../services/optimize');

/**
 * Get the rack json and the groups array (board tiles), and calculate the optimal move
 * POST /api/optimize
 */
const optimize = async (req, res, next) => {
    try {
        const { groups, rack } = req.body;

        // Validate required fields
        if (!groups || !rack) {
            const error = new Error('Groups and rack are required');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        // Validate types
        if (!Array.isArray(groups) || !Array.isArray(rack)) {
            const error = new Error('Groups and rack must be arrays');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        // Validate groups structure
        if (!groups.every(g => Array.isArray(g))) {
            const error = new Error('Each group must be an array of tiles');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        // Call service to find optimal move
        const result = await optimizeService.findOptimalMove(groups, rack);

        // Success response
        res.status(200).json({
            success: true,
            data: result,
            message: result.tilesPlayed > 0
                ? `Found optimal move: ${result.tilesPlayed} tile(s) played`
                : 'No valid move found'
        });
    } catch (error) {
        // Handle board validation errors
        if (error.type === 'BoardInvalidError') {
            return res.status(error.statusCode || 400).json({
                success: false,
                error: {
                    type: error.type,
                    message: error.message,
                    details: error.details
                }
            });
        }

        // Handle validation errors
        if (error.type === 'ValidationError') {
            return res.status(error.statusCode || 400).json({
                success: false,
                error: {
                    type: error.type,
                    message: error.message
                }
            });
        }

        // Pass other errors to error handler middleware
        next(error);
    }
};

module.exports = { optimize };

