const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

router.get('/shops', recommendationController.getRankedShops);
router.get('/ranked', recommendationController.getRankedShops);
router.get('/route/:shopId', recommendationController.getRouteToShop);

module.exports = router;
