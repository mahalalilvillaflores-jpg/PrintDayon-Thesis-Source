const path = require('path');
const fs = require('fs');
const documentRepository = require('../repositories/documentRepository');
const documentCleanupService = require('../services/documentCleanupService');
const { UPLOAD_DIR } = require('../middleware/uploadMiddleware');
const { detectPageCount } = require('../utils/pageCounter');

const documentController = {
  uploadDocument: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }

      const ext = req.file.originalname.split('.').pop().toLowerCase();
      const detectedPages = detectPageCount(req.file.path, req.file.originalname);
      const doc = await documentRepository.create({
        customerId: req.user._id,
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        fileType: ext === 'docx' ? 'docx' : ext,
        fileSize: req.file.size,
        storagePath: req.file.path,
        pageCount: detectedPages || (req.body.pageCount ? +req.body.pageCount : null),
      });

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully.',
        data: doc,
        pageCount: doc.pageCount,
      });
    } catch (err) {
      next(err);
    }
  },

  getDocument: async (req, res, next) => {
    try {
      const doc = await documentRepository.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found.' });
      }

      const isCustomerOwner = doc.customerId.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';
      let isAuthorizedShopOwner = false;

      if (req.user.role === 'shop_owner') {
        const shopRepository = require('../repositories/shopRepository');
        const PrintingRequest = require('../models/PrintingRequest');
        const shop = await shopRepository.findByOwnerId(req.user._id);
        if (shop) {
          const associatedOrder = await PrintingRequest.findOne({
            documentId: doc._id,
            shopId: shop._id,
          });
          if (associatedOrder) {
            isAuthorizedShopOwner = true;
          }
        }
      }

      if (!isCustomerOwner && !isAdmin && !isAuthorizedShopOwner) {
        return res.status(403).json({ success: false, message: 'Access denied. You are not authorized to view this document.' });
      }

      if (doc.isDeletedFromStorage || !fs.existsSync(doc.storagePath)) {
        return res.status(410).json({
          success: false,
          isPurged: true,
          message: 'This document has been permanently deleted from storage per the 24-hour privacy retention policy.',
        });
      }

      const ext = path.extname(doc.originalFilename || doc.storagePath).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFilename || ('document' + ext))}"`);

      res.sendFile(path.resolve(doc.storagePath));
    } catch (err) {
      next(err);
    }
  },

  getMyDocuments: async (req, res, next) => {
    try {
      const docs = await documentRepository.findByCustomer(req.user._id);
      res.status(200).json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  },

  deleteDocument: async (req, res, next) => {
    try {
      const doc = await documentRepository.findById(req.params.id);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found.' });
      }

      const isCustomerOwner = doc.customerId.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      // Shop owners are strictly forbidden from deleting customer documents
      if (!isCustomerOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only the document owner or an administrator can delete this document.',
        });
      }

      const result = await documentCleanupService.purgePhysicalFile(doc._id);
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'Failed to purge document.' });
      }

      res.status(200).json({
        success: true,
        message: 'Document file has been permanently deleted from storage.',
        data: result.doc,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = documentController;
