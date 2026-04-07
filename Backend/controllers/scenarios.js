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
        const { submittedBoard, tilesPlaced } = req.body;

        if (!Array.isArray(submittedBoard) || !submittedBoard.every(g => Array.isArray(g))) {
            return res.status(400).json({
                success: false,
                error: { type: 'ValidationError', message: 'submittedBoard must be an array of arrays' },
            });
        }

        if (typeof tilesPlaced !== 'number' || tilesPlaced < 0) {
            return res.status(400).json({
                success: false,
                error: { type: 'ValidationError', message: 'tilesPlaced must be a non-negative number' },
            });
        }

        const userEmail = req.user?.email || 'unknown';
        const result = await scenarioService.submitAttempt(req.params.id, userEmail, submittedBoard, tilesPlaced);

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

/**
 * GET /api/scenarios/:id/leaderboard
 * Returns all players' best scores for this scenario, with the AI injected at its rank.
 */
const getLeaderboard = async (req, res, next) => {
    try {
        const scenario = await scenarioService.getScenario(req.params.id);
        if (!scenario) {
            return res.status(404).json({ success: false, error: { message: 'Scenario not found' } });
        }

        const entries = await scenarioService.getScenarioLeaderboard(req.params.id);

        // Inject AI as a synthetic entry — never stored in DB, always at its natural rank
        const aiEntry = {
            email: 'AI',
            bestScore: scenario.algorithmTilesRemoved,
            isAI: true,
        };

        const ranked = [...entries.map(e => ({ ...e, isAI: false })), aiEntry]
            .sort((a, b) => b.bestScore - a.bestScore);

        res.status(200).json({ success: true, data: ranked });
    } catch (err) {
        next(err);
    }
};

module.exports = { list, getOne, submitAttempt, getLeaderboard };
