/**
 * Detection Service - Wraps detect.js module
 */

const { detectTiles, saveAnnotatedImage } = require('../utils/detect');
const gameLogic = require('../utils/gameLogic');
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

/**
 * Perform tile detection WITH series analysis
 * @param {Buffer} imageBuffer - Image data
 * @param {Object} options - Detection options
 * @returns {Object} Detection results with series information
 */
const performDetectionWithAnalysis = async (imageBuffer, options = {}) => {
    const { annotate = false, analyzeSeries = false, threshold = 110 } = options;

    try {
        // 1. Perform basic tile detection
        const result = await detectTiles(imageBuffer, { annotate });

        // 2. If series analysis requested, detect series
        if (analyzeSeries && result.tiles && result.tiles.length > 0) {
            const series = gameLogic.detectSeries(result.tiles, {
                threshold,
                imageWidth: result.image_width,
                imageHeight: result.image_height
            });
            const tilesWithSeries = gameLogic.assignSeriesToTiles(result.tiles, series);

            return {
                success: true,
                imageWidth: result.image_width,
                imageHeight: result.image_height,
                numTilesDetected: result.num_tiles_detected,
                tiles: tilesWithSeries,
                series: series,
                numSeriesDetected: series.length,
                numValidSeries: series.filter(s => s.isValid).length,
                numInvalidSeries: series.filter(s => !s.isValid).length,
                ...(result.annotatedImagePath && { annotatedImagePath: result.annotatedImagePath })
            };
        }

        // 3. Return basic detection if no series analysis
        return {
            success: true,
            imageWidth: result.image_width,
            imageHeight: result.image_height,
            numTilesDetected: result.num_tiles_detected,
            tiles: result.tiles,
            ...(result.annotatedImagePath && { annotatedImagePath: result.annotatedImagePath })
        };
    } catch (error) {
        console.error('Detection with analysis error:', error);
        throw error;
    }
};

module.exports = {
    performDetection,
    performDetectionWithAnalysis
};
