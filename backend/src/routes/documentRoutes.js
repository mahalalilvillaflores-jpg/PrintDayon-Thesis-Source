const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload, verifyFileSignature } = require('../middleware/uploadMiddleware');

router.post('/', protect, authorize('customer'), upload.single('document'), verifyFileSignature, documentController.uploadDocument);
router.get('/my', protect, authorize('customer'), documentController.getMyDocuments);
router.get('/:id', protect, documentController.getDocument);
router.delete('/:id', protect, documentController.deleteDocument);

module.exports = router;
