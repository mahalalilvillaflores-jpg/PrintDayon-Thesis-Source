const notificationService = require('../services/notificationService');

const notificationController = {
  getMyNotifications: async (req, res, next) => {
    try {
      const notifications = await notificationService.getUserNotifications(req.user._id);
      const unreadCount = await notificationService.getUnreadCount(req.user._id);
      res.status(200).json({
        success: true,
        data: { notifications, unreadCount },
        notifications,
        unreadCount,
      });
    } catch (err) {
      next(err);
    }
  },

  getNotificationById: async (req, res, next) => {
    try {
      const notification = await notificationService.getNotificationById(req.params.id, req.user._id);
      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      res.status(200).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  },

  getUnreadCount: async (req, res, next) => {
    try {
      const unreadCount = await notificationService.getUnreadCount(req.user._id);
      res.status(200).json({
        success: true,
        data: { unreadCount },
        unreadCount,
      });
    } catch (err) {
      next(err);
    }
  },

  markRead: async (req, res, next) => {
    try {
      const notif = await notificationService.markRead(req.params.id, req.user._id);
      res.status(200).json({ success: true, data: notif });
    } catch (err) {
      next(err);
    }
  },

  markAllRead: async (req, res, next) => {
    try {
      await notificationService.markAllRead(req.user._id);
      res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
      next(err);
    }
  },

  deleteNotification: async (req, res, next) => {
    try {
      const deleted = await notificationService.deleteNotification(req.params.id, req.user._id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      res.status(200).json({ success: true, message: 'Notification deleted successfully' });
    } catch (err) {
      next(err);
    }
  },

  deleteAllNotifications: async (req, res, next) => {
    try {
      await notificationService.deleteAllNotifications(req.user._id);
      res.status(200).json({ success: true, message: 'All notifications deleted successfully' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = notificationController;
