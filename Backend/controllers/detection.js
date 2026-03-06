/**
 * Detection Controller
 */

const detectionService = require('../services/detection');

/**
 * Detect tiles in uploaded image
 * POST /api/detection
 */
const detectTiles = async (req, res, next) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            const error = new Error('No image file provided');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        // Get options from request body
        const annotate = req.body.annotate === 'true' || req.body.annotate === true;
        const analyzeSeries = req.body.analyzeSeries === 'true' || req.body.analyzeSeries === true;
        /**
         * @param {number} [threshold] - Optional proximity threshold (px)
         *   - If not provided: auto-calculated based on tile density
         *   - If provided: used as exact value (expert override)
         *   - Typical values: 60-120px depending on layout density
         */
        const threshold = req.body.threshold ? parseInt(req.body.threshold) : null;
        const purpose = req.body.purpose || 'general';

        // Perform detection (with or without series analysis)
        const result = await detectionService.performDetectionWithAnalysis(req.file.buffer, {
            annotate,
            analyzeSeries,
            threshold,
            purpose
        });

        const message = analyzeSeries
            ? `Detected ${result.numTilesDetected} tiles and ${result.numSeriesDetected} series`
            : `Detected ${result.numTilesDetected} tiles`;

        res.status(200).json({
            success: true,
            data: result,
            message: message
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    detectTiles
};
