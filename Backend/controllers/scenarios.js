const scenarioService = require('../services/scenarioService');

/**
 * GET /api/scenarios
 * Returns all scenarios sorted by algorithmTilesRemoved desc.
 */
const list = async (req, res, next) => {
    try {
        const scenarios = await scenarioService.listScenarios();
        res.status(200).json({ success: true, data: scenarios });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/scenarios/:id
 * Returns a single scenario with full rack + board data.
 */
const getOne = async (req, res, next) => {
    try {
        const scenario = await scenarioService.getScenario(req.params.id);
        if (!scenario) {
            return res.status(404).json({ success: false, error: { message: 'Scenario not found' } });
        }
        res.status(200).json({ success: true, data: scenario });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/scenarios/:id/attempt
 * Body: { submittedBoard: RummikubTile[][] }
 * Validates the board, counts placed rack tiles, updates record if new high.
 */
const submitAttempt = async (req, res, next) => {
    try {
        const { submittedBoard } = req.body;

        if (!Array.isArray(submittedBoard) || !submittedBoard.every(g => Array.isArray(g))) {
            return res.status(400).json({
                success: false,
                error: { type: 'ValidationError', message: 'submittedBoard must be an array of arrays' },
            });
        }

        const userEmail = req.user?.email || 'unknown';
        const result = await scenarioService.submitAttempt(req.params.id, userEmail, submittedBoard);

        res.status(200).json({ success: true, data: result });
    } catch (err) {
        if (err.type === 'ValidationError') {
            return res.status(err.statusCode || 400).json({
                success: false,
                error: { type: err.type, message: err.message },
            });
        }
        if (err.statusCode === 404) {
            return res.status(404).json({ success: false, error: { message: err.message } });
        }
        next(err);
    }
};

module.exports = { list, getOne, submitAttempt };
