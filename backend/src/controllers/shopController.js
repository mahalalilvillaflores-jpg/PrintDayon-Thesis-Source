const shopService = require('../services/shopService');
const { emitAdminStatsUpdate } = require('../sockets/socketManager');

const shopController = {
  createShop: async (req, res, next) => {
    try {
      const shop = await shopService.createShop(req.user._id, req.body);
      emitAdminStatsUpdate().catch(() => {});
      res.status(201).json({ success: true, message: 'Shop created and pending verification.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  getMyShop: async (req, res, next) => {
    try {
      const shop = await shopService.getMyShop(req.user._id);
      res.status(200).json({ success: true, data: shop });
    } catch (err) {
      if (err.statusCode === 404) {
        return res.status(200).json({
          success: true,
          data: null,
          requiresOnboarding: true,
          message: 'No shop found for this owner. Onboarding required.',
        });
      }
      next(err);
    }
  },

  getMyShopDashboard: async (req, res, next) => {
    try {
      const shopRepository = require('../repositories/shopRepository');
      const requestRepository = require('../repositories/requestRepository');
      const { getQueueStats } = require('../algorithms/queueOptimizer');

      const shop = await shopRepository.findByOwnerId(req.user._id);
      if (!shop) {
        return res.status(200).json({
          success: true,
          data: null,
          requiresOnboarding: true,
          message: 'No shop found for this owner. Onboarding required.',
        });
      }

      const dashData = await requestRepository.getShopDashboardData(shop._id);
      const queueStats = getQueueStats(dashData.activeQueue, shop.pricing, shop.walkInTrafficLevel, shop.walkInCustomerCount, shop.operationalDelayMinutes);

      const { getEffectiveShopStatus } = require('../utils/shopHelper');
      const sObj = shop.toObject ? shop.toObject() : shop;
      const effective = getEffectiveShopStatus(sObj);
      const enrichedShop = {
        ...sObj,
        isOpen: effective.isOpen,
        isWithinHours: effective.isWithinHours,
        status: effective.status,
        effectiveStatus: effective.status,
        isManualClosure: effective.isManualClosure,
        statusSource: effective.statusSource,
        closureReason: effective.closureReason || '',
        closureReasonLabel: effective.closureReasonLabel || '',
        customReason: effective.customReason || '',
        advisoryMessage: effective.advisoryMessage || '',
        reopenAt: effective.reopenAt || null,
        reopenType: effective.reopenType || 'next_scheduled_opening',
        reopenFormatted: effective.reopenFormatted || '',
        nextOpening: effective.nextOpening || null,
        unavailableReason: effective.unavailableReason || null,
      };

      res.status(200).json({
        success: true,
        data: {
          shop: enrichedShop,
          stats: {
            pendingOrders: dashData.pending,
            currentlyPrinting: dashData.printing,
            completedToday: dashData.completedToday,
            currentQueue: dashData.currentQueue,
            queued: dashData.queued,
            accepted: dashData.accepted,
            ready: dashData.ready,
            totalCompleted: dashData.completed,
          },
          activeQueue: dashData.activeQueue,
          recentOrders: dashData.recentRequests,
          queueStats,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  getShopById: async (req, res, next) => {
    try {
      const shop = await shopService.getShopById(req.params.id, req.user);
      res.status(200).json({ success: true, data: shop });
    } catch (err) {
      next(err);
    }
  },

  getAllShops: async (req, res, next) => {
    try {
      const { page, limit, status, verificationStatus } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (verificationStatus) filter.verificationStatus = verificationStatus;
      const result = await shopService.getAllShops(filter, { page: +page || 1, limit: +limit || 20 }, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  getShopStats: async (req, res, next) => {
    try {
      const stats = await shopService.getShopStats();
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  },

  getNearbyShops: async (req, res, next) => {
    try {
      const { lat, lng, radius } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ success: false, message: 'lat and lng are required.' });
      }
      const shops = await shopService.getNearbyShops(+lat, +lng, +radius || 5000);
      res.status(200).json({ success: true, data: shops });
    } catch (err) {
      next(err);
    }
  },

  updateShop: async (req, res, next) => {
    try {
      const shop = await shopService.updateShop(req.params.id, req.user._id, req.body);
      res.status(200).json({ success: true, message: 'Shop updated.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      const shop = await shopService.updateStatus(req.params.id, req.user._id, status);
      res.status(200).json({ success: true, message: 'Shop status updated.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  updatePrinters: async (req, res, next) => {
    try {
      const { printers } = req.body;
      const shop = await shopService.updatePrinters(req.params.id, req.user._id, printers);
      res.status(200).json({ success: true, message: 'Printer equipment status updated.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  updateWalkInTraffic: async (req, res, next) => {
    try {
      const { walkInTrafficLevel } = req.body;
      const shop = await shopService.updateWalkInTraffic(req.params.id, req.user._id, walkInTrafficLevel);
      res.status(200).json({ success: true, message: 'Walk-in crowd level updated.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  updateWalkInCount: async (req, res, next) => {
    try {
      const { count, walkInTrafficLevel } = req.body;
      const shop = await shopService.updateWalkInCount(req.params.id, req.user._id, count, walkInTrafficLevel);
      res.status(200).json({ success: true, message: 'Walk-in customer count updated.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  updateOperationalStatus: async (req, res, next) => {
    try {
      const shop = await shopService.updateOperationalStatus(req.params.id, req.user._id, req.body);
      res.status(200).json({ success: true, message: 'Shop operational status updated.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  setTemporaryClosure: async (req, res, next) => {
    try {
      const shop = await shopService.setTemporaryClosure(req.params.id, req.user._id, req.body);
      res.status(200).json({ success: true, message: 'Shop temporary closure activated.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  reopenShop: async (req, res, next) => {
    try {
      const shop = await shopService.reopenShop(req.params.id, req.user._id);
      res.status(200).json({ success: true, message: 'Shop reopened and returned to automatic schedule.', data: shop });
    } catch (err) {
      next(err);
    }
  },

  replaceBusinessDocument: async (req, res, next) => {
    try {
      const { docType } = req.params;
      const document = await shopService.replaceBusinessDocument(
        req.user._id,
        docType,
        req.file,
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'Document uploaded and submitted for verification.',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  },

  uploadStorefrontPhoto: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Photo file is required.' });
      }
      const shop = await shopService.updateStorefrontPhoto(req.user._id, req.file);
      res.status(200).json({
        success: true,
        message: 'Storefront facade photo updated successfully.',
        data: shop,
      });
    } catch (err) {
      next(err);
    }
  },

  deleteStorefrontPhoto: async (req, res, next) => {
    try {
      const shop = await shopService.deleteStorefrontPhoto(req.user._id);
      res.status(200).json({
        success: true,
        message: 'Facade photo deleted successfully.',
        data: shop,
      });
    } catch (err) {
      next(err);
    }
  },

  getShopSales: async (req, res, next) => {
    try {
      const sales = await shopService.getShopSales(req.user._id);
      res.status(200).json({ success: true, data: sales });
    } catch (err) {
      next(err);
    }
  },

  getShopReviews: async (req, res, next) => {
    try {
      const data = await shopService.getShopReviews(req.params.id, req.user._id, req.user.role, req.query);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getOwnerReviews: async (req, res, next) => {
    try {
      const shopRepository = require('../repositories/shopRepository');
      const shop = await shopRepository.findByOwnerId(req.user._id);
      if (!shop) {
        return res.status(404).json({ success: false, message: 'No shop found for this owner.' });
      }
      const data = await shopService.getShopReviews(shop._id, req.user._id, req.user.role, req.query);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getPublicReviews: async (req, res, next) => {
    try {
      const data = await shopService.getPublicReviews(req.params.id, req.query);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = shopController;
