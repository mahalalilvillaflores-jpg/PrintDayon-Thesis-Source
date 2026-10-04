const PrintingRequest = require('../models/PrintingRequest');

const requestRepository = {
  create: async (data) => {
    const request = new PrintingRequest(data);
    return request.save();
  },

  findById: async (id) => {
    return PrintingRequest.findById(id)
      .populate('customerId', 'name email contactNumber')
      .populate('shopId', 'shopName address latitude longitude contactNumber storefrontPhotoUrl')
      .populate('documentId');
  },

  findByCustomer: async (customerId, filter = {}, options = {}) => {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    const query = { customerId, ...filter };
    const [requests, total] = await Promise.all([
      PrintingRequest.find(query)
        .populate('shopId', 'shopName address contactNumber operatingHours storefrontPhotoUrl')
        .populate('documentId', 'originalFilename fileType pageCount fileSize')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PrintingRequest.countDocuments(query),
    ]);
    return { requests, total, page, totalPages: Math.ceil(total / limit) };
  },

  findByShop: async (shopId, filter = {}, options = {}) => {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;
    const query = { shopId, ...filter };
    const [requests, total] = await Promise.all([
      PrintingRequest.find(query)
        .populate('customerId', 'name email contactNumber')
        .populate('documentId')
        .sort({ isRush: -1, submittedAt: -1 })
        .skip(skip)
        .limit(limit),
      PrintingRequest.countDocuments(query),
    ]);
    return { requests, total, page, totalPages: Math.ceil(total / limit) };
  },

  findActiveByShop: async (shopId) => {
    return PrintingRequest.find({
      shopId,
      status: { $in: ['accepted', 'queued', 'printing'] },
    })
      .populate('customerId', 'name')
      .populate('documentId', 'originalFilename')
      .sort({ isRush: -1, acceptedAt: 1 });
  },

  findAllActive: async (shopIds) => {
    const activeRequests = await PrintingRequest.find({
      shopId: { $in: shopIds },
      status: { $in: ['accepted', 'queued', 'printing'] },
    });
    const map = {};
    for (const req of activeRequests) {
      const key = req.shopId.toString();
      if (!map[key]) map[key] = [];
      map[key].push(req);
    }
    return map;
  },

  updateStatus: async (id, status, extra = {}) => {
    const update = { status, ...extra };
    const now = new Date();
    if (status === 'accepted' && !update.acceptedAt) update.acceptedAt = now;
    if (status === 'queued' && !update.queuedAt) update.queuedAt = now;
    if (status === 'printing' && !update.printingStartedAt) update.printingStartedAt = now;
    if ((status === 'ready' || status === 'ready_for_pickup') && !update.readyAt) update.readyAt = now;
    if (status === 'picked_up' && !update.pickedUpAt) update.pickedUpAt = now;
    if (status === 'completed' && !update.completedAt) update.completedAt = now;
    if ((status === 'rejected' || status === 'declined') && !update.rejectedAt) update.rejectedAt = now;
    if (status === 'cancelled' && !update.cancelledAt) update.cancelledAt = now;
    if (status === 'on_hold' && !update.onHoldAt) update.onHoldAt = now;
    return PrintingRequest.findByIdAndUpdate(id, update, { new: true });
  },

  updateQueuePosition: async (id, queuePosition) => {
    return PrintingRequest.findByIdAndUpdate(id, { queuePosition }, { new: true });
  },

  findAll: async (filter = {}, options = {}) => {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      PrintingRequest.find(filter)
        .populate('customerId', 'name email contactNumber')
        .populate('shopId', 'shopName address contactNumber')
        .populate('documentId', 'originalFilename fileType fileSize')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PrintingRequest.countDocuments(filter),
    ]);
    return { requests, total, page, totalPages: Math.ceil(total / limit) };
  },

  getSystemStats: async () => {
    return PrintingRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  },

  countTodayCompleted: async (shopId) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return PrintingRequest.countDocuments({
      shopId,
      status: 'completed',
      completedAt: { $gte: startOfDay },
    });
  },

  getShopDashboardData: async (shopId) => {
    const mongoose = require('mongoose');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sId = new mongoose.Types.ObjectId(shopId);

    const [statusCounts, completedToday, activeQueue, recentRequests] = await Promise.all([
      PrintingRequest.aggregate([
        { $match: { shopId: sId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      PrintingRequest.countDocuments({
        shopId: sId,
        status: 'completed',
        completedAt: { $gte: startOfDay },
      }),
      PrintingRequest.find({
        shopId: sId,
        status: { $in: ['accepted', 'queued', 'printing'] },
      })
        .populate('customerId', 'name contactNumber email')
        .populate('documentId')
        .sort({ acceptedAt: 1 }),
      PrintingRequest.find({ shopId: sId })
        .populate('customerId', 'name contactNumber email')
        .populate('documentId')
        .sort({ submittedAt: -1 })
        .limit(10),
    ]);

    const counts = {};
    for (const item of statusCounts) {
      counts[item._id] = item.count;
    }

    return {
      pending: counts['pending'] || 0,
      printing: counts['printing'] || 0,
      queued: counts['queued'] || 0,
      accepted: counts['accepted'] || 0,
      ready: counts['ready'] || 0,
      completed: counts['completed'] || 0,
      rejected: counts['rejected'] || 0,
      cancelled: counts['cancelled'] || 0,
      completedToday: completedToday || 0,
      currentQueue: (counts['accepted'] || 0) + (counts['queued'] || 0) + (counts['printing'] || 0),
      activeQueue,
      recentRequests,
    };
  },
};

module.exports = requestRepository;
