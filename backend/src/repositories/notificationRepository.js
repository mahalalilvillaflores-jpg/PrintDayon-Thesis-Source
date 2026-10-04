const Notification = require('../models/Notification');

const notificationRepository = {
  create: async (data) => {
    const notif = new Notification(data);
    return notif.save();
  },

  createMany: async (notifications) => {
    return Notification.insertMany(notifications);
  },

  findByUser: async (userId, options = {}) => {
    const { limit = 60 } = options;
    return Notification.find({ userId })
      .populate({
        path: 'relatedRequestId',
        select: 'claimCode status shopId estimatedCost queuePosition estimatedCompletionTime delayNotice printingSpecifications documentId submittedAt acceptedAt queuedAt printingStartedAt readyAt pickedUpAt completedAt',
        populate: [
          { path: 'shopId', select: 'shopName address contactNumber' },
          { path: 'documentId', select: 'originalName fileName fileType fileSize totalPages' },
        ],
      })
      .populate('relatedShopId', 'shopName address contactNumber storefrontPhotoUrl rating')
      .sort({ createdAt: -1 })
      .limit(limit);
  },

  findById: async (id, userId) => {
    return Notification.findOne({ _id: id, userId })
      .populate({
        path: 'relatedRequestId',
        select: 'claimCode status shopId estimatedCost queuePosition estimatedCompletionTime delayNotice printingSpecifications documentId submittedAt acceptedAt queuedAt printingStartedAt readyAt pickedUpAt completedAt',
        populate: [
          { path: 'shopId', select: 'shopName address contactNumber' },
          { path: 'documentId', select: 'originalName fileName fileType fileSize totalPages' },
        ],
      })
      .populate('relatedShopId', 'shopName address contactNumber storefrontPhotoUrl rating');
  },

  markRead: async (id, userId) => {
    return Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );
  },

  markAllRead: async (userId) => {
    return Notification.updateMany({ userId, isRead: false }, { isRead: true });
  },

  countUnread: async (userId) => {
    return Notification.countDocuments({ userId, isRead: false });
  },

  deleteById: async (id, userId) => {
    return Notification.findOneAndDelete({ _id: id, userId });
  },

  deleteAllByUser: async (userId) => {
    return Notification.deleteMany({ userId });
  },
};

module.exports = notificationRepository;
