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
        const purpose = req.body.purpose || 'general';

        // Perform detection
        const result = await detectionService.performDetection(req.file.buffer, {
            annotate,
            purpose
        });

        res.status(200).json({
            success: true,
            data: result,
            message: `Detected ${result.numTilesDetected} tiles`
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    detectTiles
};
