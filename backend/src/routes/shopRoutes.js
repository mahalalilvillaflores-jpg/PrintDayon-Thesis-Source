const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const recommendationController = require('../controllers/recommendationController');
const { protect, authorize, optionalProtect } = require('../middleware/authMiddleware');
const { upload, verifyFileSignature } = require('../middleware/uploadMiddleware');

// ──────────────────────────────────────────────
// PUBLIC routes  (no auth required)
// IMPORTANT: specific named paths must come BEFORE /:id wildcard
// ──────────────────────────────────────────────
router.get('/', optionalProtect, shopController.getAllShops);
router.get('/public-stats', shopController.getShopStats);
router.get('/nearby', shopController.getNearbyShops);
router.get('/recommendations', recommendationController.getRankedShops);

// ──────────────────────────────────────────────
// OWNER routes  (all must be above /:id wildcard)
// ──────────────────────────────────────────────
router.post('/', protect, authorize('shop_owner'), shopController.createShop);
router.get('/owner/my-shop', protect, authorize('shop_owner'), shopController.getMyShop);
router.get('/owner/dashboard', protect, authorize('shop_owner'), shopController.getMyShopDashboard);
router.get('/owner/sales', protect, authorize('shop_owner'), shopController.getShopSales);
router.get('/owner/reviews', protect, authorize('shop_owner'), shopController.getOwnerReviews);
router.post('/owner/documents/:docType/replace', protect, authorize('shop_owner'), upload.single('file'), verifyFileSignature, shopController.replaceBusinessDocument);
router.post('/owner/storefront-photo', protect, authorize('shop_owner'), upload.single('photo'), verifyFileSignature, shopController.uploadStorefrontPhoto);
router.delete('/owner/storefront-photo', protect, authorize('shop_owner'), shopController.deleteStorefrontPhoto);

// ──────────────────────────────────────────────
// PARAMETERISED routes  (must come AFTER named routes)
// ──────────────────────────────────────────────
router.get('/:id/public-reviews', shopController.getPublicReviews);
router.get('/:id/reviews', protect, authorize('shop_owner', 'admin'), shopController.getShopReviews);
router.get('/:id', optionalProtect, shopController.getShopById);
router.put('/:id', protect, authorize('shop_owner'), shopController.updateShop);
router.patch('/:id/status', protect, authorize('shop_owner'), shopController.updateStatus);
router.patch('/:id/printers', protect, authorize('shop_owner'), shopController.updatePrinters);
router.patch('/:id/walk-in-traffic', protect, authorize('shop_owner'), shopController.updateWalkInTraffic);
router.patch('/:id/walk-in-count', protect, authorize('shop_owner'), shopController.updateWalkInCount);
router.patch('/:id/operational-status', protect, authorize('shop_owner'), shopController.updateOperationalStatus);
router.post('/:id/temporary-closure', protect, authorize('shop_owner'), shopController.setTemporaryClosure);
router.post('/:id/reopen', protect, authorize('shop_owner'), shopController.reopenShop);

module.exports = router;
