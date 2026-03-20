const express = require('express');
const router = express.Router();
const { submitCorrection, getTrainingStats, deleteImage } = require('../controllers/training');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/correction', submitCorrection);
router.get('/stats', getTrainingStats);
router.delete('/image/:detectionId', deleteImage);

module.exports = router;
