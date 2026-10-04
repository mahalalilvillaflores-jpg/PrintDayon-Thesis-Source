const requestService = require('../services/requestService');

const requestController = {
  submitRequest: async (req, res, next) => {
    try {
      const request = await requestService.submitRequest(req.user._id, req.body);
      res.status(201).json({ success: true, message: 'Printing request submitted.', data: request });
    } catch (err) {
      next(err);
    }
  },

  getRequestById: async (req, res, next) => {
    try {
      const request = await requestService.getRequestById(req.params.id, req.user._id, req.user.role);
      res.status(200).json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  },

  getOrderStatusHistory: async (req, res, next) => {
    try {
      const history = await requestService.getOrderStatusHistory(req.params.id, req.user._id, req.user.role);
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  },

  getMyRequests: async (req, res, next) => {
    try {
      const { status, page, limit } = req.query;
      const filter = {};
      if (status) filter.status = status;
      const result = await requestService.getCustomerRequests(req.user._id, filter, { page: +page || 1, limit: +limit || 20 });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  getShopRequests: async (req, res, next) => {
    try {
      const { status, page, limit } = req.query;
      const filter = {};
      if (status) filter.status = status;
      const result = await requestService.getShopRequests(req.params.shopId, req.user._id, filter, { page: +page || 1, limit: +limit || 50 });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status, reason } = req.body;
      const updated = await requestService.updateStatus(req.params.id, req.user._id, status, reason);
      res.status(200).json({ success: true, message: 'Request status updated.', data: updated });
    } catch (err) {
      next(err);
    }
  },

  cancelRequest: async (req, res, next) => {
    try {
      const { reason } = req.body;
      const updated = await requestService.cancelRequest(req.params.id, req.user._id, reason);
      res.status(200).json({ success: true, message: 'Request cancelled.', data: updated });
    } catch (err) {
      next(err);
    }
  },

  getActiveQueue: async (req, res, next) => {
    try {
      const queue = await requestService.getActiveQueue(req.params.shopId);
      res.status(200).json({ success: true, data: queue });
    } catch (err) {
      next(err);
    }
  },

  submitReview: async (req, res, next) => {
    try {
      const { rating, printQuality, speedRating, comment, tags, isAnonymous } = req.body;
      const updated = await requestService.submitReview(req.params.id, req.user._id, { rating, printQuality, speedRating, comment, tags, isAnonymous });
      res.status(200).json({ success: true, message: 'Review submitted successfully. Thank you!', data: updated });
    } catch (err) {
      next(err);
    }
  },

  addShopNote: async (req, res, next) => {
    try {
      const { category, message, delayMinutes } = req.body;
      const updated = await requestService.addShopNote(req.params.id, req.user._id, {
        category,
        message,
        delayMinutes,
      });
      res.status(200).json({
        success: true,
        message: 'Note added and customer notified successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  broadcastShopDelay: async (req, res, next) => {
    try {
      const { reason, estimatedDelayMinutes } = req.body;
      const result = await requestService.broadcastShopDelay(req.params.shopId, req.user._id, {
        reason,
        estimatedDelayMinutes,
      });
      res.status(200).json({
        success: true,
        message: `Power outage delay broadcasted to ${result.affectedCount} active customer(s).`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  clearShopDelay: async (req, res, next) => {
    try {
      const result = await requestService.clearShopDelay(req.params.shopId, req.user._id);
      res.status(200).json({
        success: true,
        message: `Power outage delay cleared for ${result.clearedCount} customer(s).`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },

  uploadPaymentProof: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No proof image uploaded.' });
      }
      const proofUrl = `/uploads/${req.file.filename}`;
      res.status(200).json({
        success: true,
        message: 'Payment proof uploaded successfully.',
        data: {
          proofUrl,
          filename: req.file.originalname,
          size: req.file.size,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  attachPaymentProof: async (req, res, next) => {
    try {
      const { paymentProofUrl, paymentRefNumber } = req.body;
      const updated = await requestService.attachPaymentProof(req.params.id, req.user._id, {
        paymentProofUrl,
        paymentRefNumber,
      });
      res.status(200).json({
        success: true,
        message: 'Payment proof attached to order.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  verifyPayment: async (req, res, next) => {
    try {
      const { paymentStatus } = req.body;
      const updated = await requestService.verifyPayment(req.params.id, req.user._id, req.user.role, paymentStatus);
      res.status(200).json({
        success: true,
        message: `Payment status marked as ${paymentStatus || 'verified'}.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  getPaymentProof: async (req, res, next) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const PrintingRequest = require('../models/PrintingRequest');
      const PrintingShop = require('../models/PrintingShop');

      const request = await PrintingRequest.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Printing request not found.' });
      }

      if (!request.paymentProofUrl) {
        return res.status(404).json({ success: false, message: 'No payment proof attached to this order.' });
      }

      const isCustomerOwner = req.user.role === 'customer' && request.customerId.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';
      let isAuthorizedShopOwner = false;

      if (req.user.role === 'shop_owner') {
        const ownsShop = await PrintingShop.exists({ _id: request.shopId, ownerId: req.user._id });
        if (ownsShop) {
          isAuthorizedShopOwner = true;
        }
      }

      if (!isCustomerOwner && !isAdmin && !isAuthorizedShopOwner) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not authorized to view this payment proof.',
        });
      }

      const cleanFilename = path.basename(request.paymentProofUrl.split('?')[0]);
      const filePath = path.join(__dirname, '../../uploads', cleanFilename);

      if (!fs.existsSync(filePath)) {
        if (request.paymentProofData) {
          const base64Data = request.paymentProofData.split(',')[1];
          const imgBuffer = Buffer.from(base64Data, 'base64');
          const ext = path.extname(cleanFilename).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
          };
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          return res.send(imgBuffer);
        }

        return res.status(404).json({
          success: false,
          message: 'Payment proof file not found on disk and no backup data available.',
        });
      }

      const ext = path.extname(cleanFilename).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cleanFilename)}"`);

      return res.sendFile(path.resolve(filePath));
    } catch (err) {
      next(err);
    }
  },
};

module.exports = requestController;
