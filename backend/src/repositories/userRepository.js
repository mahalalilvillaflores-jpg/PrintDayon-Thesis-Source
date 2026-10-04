const User = require('../models/User');
const PrintingShop = require('../models/PrintingShop');
const PrintingRequest = require('../models/PrintingRequest');

const userRepository = {
  findByEmail: async (email) => {
    return User.findOne({ email }).select('+password');
  },

  findById: async (id) => {
    const user = await User.findById(id).lean();
    if (user && user.role === 'shop_owner') {
      user.shop = await PrintingShop.findOne({ ownerId: user._id }).lean();
    }
    return user;
  },

  create: async (data) => {
    const user = new User(data);
    return user.save();
  },

  update: async (id, data) => {
    return User.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  },

  findAll: async (filter = {}, options = {}) => {
    const { page = 1, limit = 20, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;
    const [rawUsers, total] = await Promise.all([
      User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    const ownerIds = rawUsers.filter((u) => u.role === 'shop_owner').map((u) => u._id);
    if (ownerIds.length > 0) {
      try {
        const shops = await PrintingShop.find({ ownerId: { $in: ownerIds } }).lean();
        const shopMap = new Map();
        shops.forEach((s) => shopMap.set(s.ownerId.toString(), s));
        rawUsers.forEach((u) => {
          if (u.role === 'shop_owner' && shopMap.has(u._id.toString())) {
            u.shop = shopMap.get(u._id.toString());
          }
        });
      } catch (_) {}
    }

    const customerIds = rawUsers.filter((u) => u.role === 'customer').map((u) => u._id);
    if (customerIds.length > 0) {
      try {
        const stats = await PrintingRequest.aggregate([
          { $match: { customerId: { $in: customerIds } } },
          {
            $group: {
              _id: '$customerId',
              totalRequests: { $sum: 1 },
              completedRequests: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
              },
              lastRequestAt: { $max: '$createdAt' },
            },
          },
        ]);
        const statsMap = new Map();
        stats.forEach((s) => statsMap.set(s._id.toString(), s));
        rawUsers.forEach((u) => {
          if (u.role === 'customer' && statsMap.has(u._id.toString())) {
            u.activity = statsMap.get(u._id.toString());
          }
        });
      } catch (_) {}
    }

    return { users: rawUsers, total, page, totalPages: Math.ceil(total / limit) };
  },

  countByRole: async () => {
    return User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
  },

  deactivate: async (id) => {
    return User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  },
};

module.exports = userRepository;
