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
        const groupFlag = req.body.groupFlag === 'true' || req.body.groupFlag === true;
        /**
         * @param {number} [threshold] - Optional proximity threshold (px)
         *   - If not provided: auto-calculated based on tile density
         *   - If provided: used as exact value (expert override)
         *   - Typical values: 60-120px depending on layout density
         */
        // Perform detection (with or without series analysis)
        const result = await detectionService.performDetectionWithGroups(req.file.buffer, { annotate, groupFlag });

        const message = groupFlag
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
