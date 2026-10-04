const PrintingShop = require('../models/PrintingShop');

const shopRepository = {
  create: async (data) => {
    const shop = new PrintingShop(data);
    return shop.save();
  },

  findById: async (id) => {
    return PrintingShop.findById(id).populate('ownerId', 'name email contactNumber');
  },

  findByOwnerId: async (ownerId) => {
    return PrintingShop.findOne({ ownerId });
  },

  findAll: async (filter = {}, options = {}) => {
    const { page = 1, limit = 20, sort = { shopName: 1 } } = options;
    const skip = (page - 1) * limit;
    const [shops, total] = await Promise.all([
      PrintingShop.find(filter)
        .select('-dtiDocUrl -permitDocUrl -businessDocuments -dtiDocName -permitDocName -storefrontPhotoData')
        .populate('ownerId', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      PrintingShop.countDocuments(filter),
    ]);
    return { shops, total, page, totalPages: Math.ceil(total / limit) };
  },

  findForStats: async () => {
    return PrintingShop.find({ verificationStatus: 'verified' })
      .select('status operatingHours temporaryClosures verificationStatus')
      .lean();
  },

  findVerifiedAndOpen: async () => {
    return PrintingShop.find({
      verificationStatus: 'verified',
      status: { $in: ['open', 'busy'] },
    }).select('-dtiDocUrl -permitDocUrl -businessDocuments -dtiDocName -permitDocName -storefrontPhotoData');
  },

  findNearby: async (lng, lat, radiusMeters = 5000) => {
    return PrintingShop.find({
      verificationStatus: 'verified',
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusMeters,
        },
      },
    }).select('-dtiDocUrl -permitDocUrl -businessDocuments -dtiDocName -permitDocName -storefrontPhotoData');
  },

  findTopNearbyEligible: async (lng, lat, limit = 15, radiusMeters = 40000) => {
    const baseFilter = {
      verificationStatus: 'verified',
    };
    const excludeHeavyFields = '-dtiDocUrl -permitDocUrl -businessDocuments -dtiDocName -permitDocName -storefrontPhotoData';

    try {
      if (lng !== undefined && lat !== undefined && !isNaN(Number(lng)) && !isNaN(Number(lat))) {
        const shops = await PrintingShop.find({
          ...baseFilter,
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
              $maxDistance: radiusMeters,
            },
          },
        })
          .select(excludeHeavyFields)
          .limit(limit);

        if (shops && shops.length > 0) {
          return shops;
        }
      }
    } catch (geoErr) {
      console.warn('[shopRepository] 2dsphere $near query fallback:', geoErr.message);
    }

    // Fallback: return verified shops regardless of distance (e.g. testing from outside Naval or no GPS fix)
    const fallbackShops = await PrintingShop.find(baseFilter).select(excludeHeavyFields).limit(limit);
    if (fallbackShops && fallbackShops.length > 0) {
      return fallbackShops;
    }

    // Ultimate safety: return any registered shops in database
    return PrintingShop.find({}).select(excludeHeavyFields).limit(limit);
  },

  update: async (id, data) => {
    return PrintingShop.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  },

  updateStatus: async (id, status) => {
    return PrintingShop.findByIdAndUpdate(id, { status }, { new: true });
  },

  updateVerification: async (id, verificationStatus) => {
    return PrintingShop.findByIdAndUpdate(id, { verificationStatus }, { new: true });
  },

  updateWalkInTraffic: async (id, walkInTrafficLevel) => {
    return PrintingShop.findByIdAndUpdate(
      id,
      { walkInTrafficLevel, walkInTrafficUpdatedAt: new Date() },
      { returnDocument: 'after', new: true }
    );
  },

  updateWalkInCount: async (id, count, walkInTrafficLevel = undefined) => {
    const numericCount = Math.max(0, Number(count) || 0);
    const updateObj = {
      walkInCustomerCount: numericCount,
      walkInTrafficUpdatedAt: new Date(),
    };
    if (walkInTrafficLevel && ['normal', 'moderate', 'packed'].includes(walkInTrafficLevel)) {
      updateObj.walkInTrafficLevel = walkInTrafficLevel;
    }
    return PrintingShop.findByIdAndUpdate(
      id,
      updateObj,
      { returnDocument: 'after', new: true }
    );
  },

  setTemporaryClosure: async (id, closureData) => {
    const updateObj = {
      temporaryClosure: {
        isClosed: true,
        reason: closureData.reason || 'temporary_closure',
        customReason: closureData.customReason || '',
        advisoryMessage: closureData.advisoryMessage || '',
        reopenType: closureData.reopenType || 'next_scheduled_opening',
        reopenAt: closureData.reopenAt ? new Date(closureData.reopenAt) : null,
        closedAt: new Date(),
      },
      status: 'closed',
      operationalCondition: closureData.reason === 'power_outage' ? 'power_interruption' : (closureData.reason === 'equipment_problem' ? 'equipment_problem' : 'closed'),
      operationalMessage: closureData.advisoryMessage || '',
      operationalUpdatedAt: new Date(),
    };
    return PrintingShop.findByIdAndUpdate(id, updateObj, { new: true });
  },

  reopenShop: async (id) => {
    const updateObj = {
      temporaryClosure: {
        isClosed: false,
        reason: '',
        customReason: '',
        advisoryMessage: '',
        reopenType: 'next_scheduled_opening',
        reopenAt: null,
        closedAt: null,
      },
      status: 'open',
      operationalCondition: 'normal',
      operationalMessage: '',
      operationalDelayMinutes: 0,
      operationalUpdatedAt: new Date(),
    };
    return PrintingShop.findByIdAndUpdate(id, updateObj, { new: true });
  },

  updateOperationalStatus: async (id, data) => {
    const condition = data.operationalCondition || data.condition || 'normal';
    const message = data.operationalMessage || data.message || '';
    const delayMinutes = Number(
      data.operationalDelayMinutes !== undefined ? data.operationalDelayMinutes : data.delayMinutes
    ) || 0;
    const isClosed = condition === 'closed';
    const updateObj = {
      operationalCondition: condition,
      operationalMessage: message,
      operationalDelayMinutes: delayMinutes,
      operationalUpdatedAt: new Date(),
    };
    if (isClosed) {
      updateObj.status = 'closed';
    } else if (data.status) {
      updateObj.status = data.status;
    }
    if (data.temporaryClosure) {
      updateObj.temporaryClosure = data.temporaryClosure;
    }
    if (data.walkInCustomerCount !== undefined) {
      updateObj.walkInCustomerCount = Math.max(0, Number(data.walkInCustomerCount) || 0);
      updateObj.walkInTrafficUpdatedAt = new Date();
    }
    if (data.walkInTrafficLevel && ['normal', 'moderate', 'packed'].includes(data.walkInTrafficLevel)) {
      updateObj.walkInTrafficLevel = data.walkInTrafficLevel;
      updateObj.walkInTrafficUpdatedAt = new Date();
    }
    return PrintingShop.findByIdAndUpdate(id, updateObj, { returnDocument: 'after', new: true });
  },

  getShopSalesMetrics: async (shopId) => {
    const PrintingRequest = require('../models/PrintingRequest');
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedOrders = await PrintingRequest.find({
      shopId,
      status: { $in: ['completed', 'picked_up'] },
    })
      .populate('customerId', 'name email contactNumber')
      .populate('documentId', 'originalFilename fileType pageCount')
      .sort({ completedAt: -1, updatedAt: -1 });

    let todaySales = 0;
    let todayOrders = 0;
    let weekSales = 0;
    let weekOrders = 0;
    let monthSales = 0;
    let monthOrders = 0;
    let totalSales = 0;
    let totalOrders = completedOrders.length;

    const serviceRevenueMap = {};
    const dateRevenueMap = {};

    completedOrders.forEach((o) => {
      const cost = Number(o.estimatedCost) || 0;
      const date = new Date(o.completedAt || o.updatedAt || o.submittedAt || o.createdAt);

      totalSales += cost;

      if (date >= startOfToday) {
        todaySales += cost;
        todayOrders++;
      }
      if (date >= startOfWeek) {
        weekSales += cost;
        weekOrders++;
      }
      if (date >= startOfMonth) {
        monthSales += cost;
        monthOrders++;
      }

      const specs = o.printingSpecifications || {};
      let serviceKey = 'Document Printing';
      if (specs.colorMode === 'color') serviceKey = 'Color Printing';
      else if (specs.binding && specs.binding !== 'none') serviceKey = 'Bookbinding';
      else if (specs.paperSize === 'A3') serviceKey = 'Large Format Printing';

      if (!serviceRevenueMap[serviceKey]) {
        serviceRevenueMap[serviceKey] = { revenue: 0, count: 0 };
      }
      serviceRevenueMap[serviceKey].revenue += cost;
      serviceRevenueMap[serviceKey].count += 1;

      const dateKey = date.toISOString().split('T')[0];
      if (!dateRevenueMap[dateKey]) {
        dateRevenueMap[dateKey] = { revenue: 0, count: 0 };
      }
      dateRevenueMap[dateKey].revenue += cost;
      dateRevenueMap[dateKey].count += 1;
    });

    const revenueByService = Object.keys(serviceRevenueMap).map((k) => ({
      service: k,
      revenue: Math.round(serviceRevenueMap[k].revenue * 100) / 100,
      count: serviceRevenueMap[k].count,
    }));

    const revenueByDate = Object.keys(dateRevenueMap)
      .sort()
      .slice(-30)
      .map((d) => ({
        date: d,
        revenue: Math.round(dateRevenueMap[d].revenue * 100) / 100,
        count: dateRevenueMap[d].count,
      }));

    return {
      today: {
        sales: Math.round(todaySales * 100) / 100,
        completedOrders: todayOrders,
        averageOrder: todayOrders > 0 ? Math.round((todaySales / todayOrders) * 100) / 100 : 0,
      },
      week: {
        sales: Math.round(weekSales * 100) / 100,
        completedOrders: weekOrders,
        averageOrder: weekOrders > 0 ? Math.round((weekSales / weekOrders) * 100) / 100 : 0,
      },
      month: {
        sales: Math.round(monthSales * 100) / 100,
        completedOrders: monthOrders,
        averageOrder: monthOrders > 0 ? Math.round((monthSales / monthOrders) * 100) / 100 : 0,
      },
      total: {
        sales: Math.round(totalSales * 100) / 100,
        completedOrders: totalOrders,
        averageOrder: totalOrders > 0 ? Math.round((totalSales / totalOrders) * 100) / 100 : 0,
      },
      revenueByService,
      revenueByDate,
      recentTransactions: completedOrders.slice(0, 100),
    };
  },

  incrementQueue: async (id) => {
    return PrintingShop.findByIdAndUpdate(id, { $inc: { currentQueue: 1 } }, { new: true });
  },

  decrementQueue: async (id) => {
    const updated = await PrintingShop.findOneAndUpdate(
      { _id: id, currentQueue: { $gt: 0 } },
      { $inc: { currentQueue: -1 } },
      { new: true }
    );
    if (!updated) {
      return PrintingShop.findByIdAndUpdate(
        id,
        { $set: { currentQueue: 0 } },
        { new: true }
      );
    }
    return updated;
  },

  getStats: async () => {
    return PrintingShop.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 },
        },
      },
    ]);
  },

  recalculateRatings: async (shopId) => {
    const PrintingRequest = require('../models/PrintingRequest');
    const mongoose = require('mongoose');
    const sId = typeof shopId === 'string' ? new mongoose.Types.ObjectId(shopId) : shopId;

    const stats = await PrintingRequest.aggregate([
      {
        $match: {
          shopId: sId,
          'review.rating': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$shopId',
          avgRating: { $avg: '$review.rating' },
          avgPrintQuality: { $avg: '$review.printQuality' },
          avgSpeedRating: { $avg: '$review.speedRating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (!stats || stats.length === 0) {
      return {
        avgRating: 0,
        avgPrintQuality: null,
        avgSpeedRating: null,
        totalReviews: 0,
      };
    }

    return {
      avgRating: Number(stats[0].avgRating.toFixed(1)),
      avgPrintQuality: stats[0].avgPrintQuality !== undefined && stats[0].avgPrintQuality !== null ? Number(stats[0].avgPrintQuality.toFixed(1)) : null,
      avgSpeedRating: stats[0].avgSpeedRating !== undefined && stats[0].avgSpeedRating !== null ? Number(stats[0].avgSpeedRating.toFixed(1)) : null,
      totalReviews: stats[0].totalReviews,
    };
  },
};

module.exports = shopRepository;
