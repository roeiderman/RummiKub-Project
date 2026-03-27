const { recordCorrection, getStats, deleteTrainingImage } = require('../services/trainingService');

const submitCorrection = async (req, res, next) => {
    try {
        const { detectionId, isRack, correctedTiles, imageWidth, imageHeight } = req.body;
        console.log(`[Retraining] POST /correction received — detectionId: ${detectionId}, isRack: ${isRack}, tiles: ${correctedTiles?.length}`);

        if (!detectionId || correctedTiles === undefined || !imageWidth || !imageHeight) {
            const error = new Error('detectionId, correctedTiles, imageWidth and imageHeight are required');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        const result = await recordCorrection({ detectionId, isRack, correctedTiles, imageWidth, imageHeight });

        res.status(201).json({
            success: true,
            data: result,
            message: 'Correction uploaded successfully',
        });
    } catch (error) {
        next(error);
    }
};

const getTrainingStats = async (req, res, next) => {
    try {
        const stats = await getStats();
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

const deleteImage = (req, res, next) => {
    try {
        const { detectionId } = req.params;
        deleteTrainingImage(detectionId);
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

module.exports = { submitCorrection, getTrainingStats, deleteImage };
