const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/shops/:shopId', protect, requestController.getActiveQueue);

module.exports = router;
