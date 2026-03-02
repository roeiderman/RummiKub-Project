/**
 * Detection Service - Wraps detect.js module
 */

const { detectTiles, saveAnnotatedImage } = require('../detect');
const path = require('path');
const fs = require('fs');

/**
 * Perform tile detection on uploaded image
 * No database storage - just returns results
 */
const performDetection = async (imageBuffer, options = {}) => {
    const { annotate = false } = options;

    try {
        // Call existing detect.js module with Buffer
        const result = await detectTiles(imageBuffer, { annotate });

        // Return detection results
        return {
            success: true,
            imageWidth: result.image_width,
            imageHeight: result.image_height,
            numTilesDetected: result.num_tiles_detected,
            tiles: result.tiles,
            ...(result.annotatedImagePath && { annotatedImagePath: result.annotatedImagePath })
        };
    } catch (error) {
        console.error('Detection error:', error);
        throw error;
    }
};

module.exports = {
    performDetection
};
