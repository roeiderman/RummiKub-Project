const express = require('express');
const router = express.Router();
const scenariosController = require('../controllers/scenarios');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', scenariosController.list);
router.get('/:id', scenariosController.getOne);
router.post('/:id/attempt', scenariosController.submitAttempt);

module.exports = router;
