const optimizeService = require('../services/optimize');
const { reconstructMoves } = require('../services/moveReconstructor');

/**
 * Get the rack json and the groups array (board tiles), and calculate the optimal move
 * POST /api/optimize
 */
const optimize = async (req, res, next) => {
    try {
        const { groups, rack } = req.body;

        // Validate required fields.
        if (!groups || !rack) {
            const error = new Error('Groups and rack are required');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        // Validate types.
        if (!Array.isArray(groups) || !Array.isArray(rack)) {
            const error = new Error('Groups and rack must be arrays');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        // Validate groups structure.
        if (!groups.every(g => Array.isArray(g))) {
            const error = new Error('Each group must be an array of tiles');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        const formattedBoard = groups.map((group, groupIndex) => {            
            return group.map(tile => ({
                ...tile,
                _source: 'board',
                _sourceGroupIndex: groupIndex 
            }));
        });

        const formattedRack = rack.map(tile => ({
            ...tile,
            _source: 'rack', 
            _sourceGroupIndex: null 
        }));

        // Call service to find optimal move.
        const result = await optimizeService.getRummikubSolution(formattedRack, formattedBoard);
        console.log(result)
        console.log('Optimal move result:', result.finalBoard ? result.finalBoard : 'No final board state available'); // Log the final board state for debugging.

        const optimizerSucceeded = result.success === true || result.success === 'true';
        const finalBoard = Array.isArray(result.finalBoard) ? result.finalBoard : [];
        const rackTilesPlayed = finalBoard
            .flat()
            .filter(tile => tile.isRack === true);
        const tilesUsed = rackTilesPlayed.length;
        const noMoves = tilesUsed === 0;

        // Reconstruct the sequence of moves from initial state → final board.
        // Use rackTilesPlayed (not the full rack) so only actually-played rack tiles
        // are attributed as 'rack' source; everything else maps back to the board.
        if (optimizerSucceeded && !noMoves && finalBoard.length > 0) {
            result.moves = reconstructMoves(groups, finalBoard);
        } else {
            result.moves = null;
        }
        result.success = optimizerSucceeded;
        result.noMoves = noMoves;
        result.tilesUsed = tilesUsed;
        result.rackTilesPlayed = rackTilesPlayed;

        // Auto-save as a training challenge scenario if algorithm removed >= 4 tiles
        if (optimizerSucceeded && tilesUsed >= 4) {
            const { maybeSaveScenario } = require('../services/scenarioService');
            const strip = t => ({ id: t.id, tile: t.tile, color: t.color, number: t.number, isJoker: t.isJoker });
            const cleanRack = rack.map(strip);
            const cleanBoard = groups.map(g => g.map(strip));
            maybeSaveScenario(cleanRack, cleanBoard, tilesUsed)
                .catch(err => console.error('[Scenario] Auto-save failed:', err.message));
        }

        // Success response.
        res.status(200).json({
            success: true,
            data: result,
            message: noMoves
                ? 'No valid moves available with your current tiles.'
                : `Found optimal move: ${tilesUsed} tile(s) played`
        });
    } catch (error) {
        // Handle board validation errors.
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

        // Handle validation errors.
        if (error.type === 'ValidationError') {
            return res.status(error.statusCode || 400).json({
                success: false,
                error: {
                    type: error.type,
                    message: error.message
                }
            });
        }

        // Pass other errors to error handler middleware.
        next(error);
    }
};

module.exports = { optimize };
