const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, notificationController.getMyNotifications);
router.get('/unread-count', protect, notificationController.getUnreadCount);
router.get('/:id', protect, notificationController.getNotificationById);
router.patch('/read-all', protect, notificationController.markAllRead);
router.patch('/:id/read', protect, notificationController.markRead);
router.delete('/', protect, notificationController.deleteAllNotifications);
router.delete('/:id', protect, notificationController.deleteNotification);

module.exports = router;
