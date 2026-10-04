const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload, verifyFileSignature } = require('../middleware/uploadMiddleware');

router.post('/upload-proof', protect, authorize('customer'), upload.single('proof'), verifyFileSignature, requestController.uploadPaymentProof);
router.post('/', protect, authorize('customer'), requestController.submitRequest);
router.get('/my', protect, authorize('customer'), requestController.getMyRequests);
router.patch('/:id/cancel', protect, authorize('customer'), requestController.cancelRequest);
router.post('/:id/review', protect, authorize('customer'), requestController.submitReview);
router.patch('/:id/payment-proof', protect, authorize('customer'), requestController.attachPaymentProof);

router.get('/:id', protect, requestController.getRequestById);
router.get('/:id/history', protect, requestController.getOrderStatusHistory);
router.get('/:id/payment-proof', protect, requestController.getPaymentProof);

router.get('/shop/:shopId', protect, authorize('shop_owner', 'admin'), requestController.getShopRequests);
router.patch('/:id/status', protect, authorize('shop_owner'), requestController.updateStatus);
router.patch('/:id/verify-payment', protect, authorize('shop_owner', 'admin'), requestController.verifyPayment);
router.post('/:id/notes', protect, authorize('shop_owner'), requestController.addShopNote);
router.post('/shop/:shopId/broadcast-delay', protect, authorize('shop_owner'), requestController.broadcastShopDelay);
router.post('/shop/:shopId/clear-delay', protect, authorize('shop_owner'), requestController.clearShopDelay);

module.exports = router;
