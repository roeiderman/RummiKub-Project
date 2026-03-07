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

        // Perform detection (with or without series analysis)
        const result = await detectionService.performDetection(req.file.buffer, { annotate, groupFlag });

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
