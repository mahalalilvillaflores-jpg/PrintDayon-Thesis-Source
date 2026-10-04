const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

const adminOnly = [protect, authorize('admin')];

// Dashboard & Reports
router.get('/stats', ...adminOnly, adminController.getStats);
router.get('/reports', ...adminOnly, adminController.getReports);

// User Management
router.get('/users', ...adminOnly, adminController.getAllUsers);
router.post('/users', ...adminOnly, adminController.createUser);
router.patch('/users/:id/deactivate', ...adminOnly, adminController.deactivateUser);
router.patch('/users/:id/status', ...adminOnly, adminController.toggleUserStatus);
router.delete('/users/:id', ...adminOnly, adminController.deleteUser);

// Shop Management
router.get('/shops', ...adminOnly, adminController.getAllShops);
router.get('/shops/:id', ...adminOnly, adminController.getShopById);
router.patch('/shops/:id/verify', ...adminOnly, adminController.verifyShop);
router.patch('/shops/:id/status', ...adminOnly, adminController.updateShopStatus);
router.delete('/shops/:id', ...adminOnly, adminController.deleteShop);

// Business Verification
router.get('/documents', ...adminOnly, adminController.getAllDocuments);
router.patch('/shops/:id/documents/:docType/verify', ...adminOnly, adminController.verifyBusinessDocument);

// Orders & Transactions
router.get('/requests', ...adminOnly, adminController.getAllRequests);
router.get('/orders', ...adminOnly, adminController.getAllRequests);
router.patch('/orders/:id/hold', ...adminOnly, adminController.holdOrder);

// Audit Trail & Logs
router.get('/logs', ...adminOnly, adminController.getLogs);
router.delete('/logs', ...adminOnly, adminController.clearLogs);

module.exports = router;
