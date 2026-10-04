const userRepository = require('../repositories/userRepository');
const shopRepository = require('../repositories/shopRepository');
const requestRepository = require('../repositories/requestRepository');
const shopService = require('../services/shopService');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const PrintingShop = require('../models/PrintingShop');
const PrintingRequest = require('../models/PrintingRequest');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { getIO, emitAdminStatsUpdate } = require('../sockets/socketManager');
const { getEffectiveShopStatus } = require('../utils/shopHelper');

const adminController = {
  // 1. DASHBOARD STATS (100% Real Database Values)
  getStats: async (req, res, next) => {
    try {
      const [
        totalCustomers,
        totalShopOwners,
        totalAdmins,
        totalUsers,
        shopStatusAgg,
        orderStatusAgg,
        pendingDocsCount,
        salesAgg,
        recentActivity,
      ] = await Promise.all([
        User.countDocuments({ role: 'customer' }),
        User.countDocuments({ role: 'shop_owner' }),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({}),
        PrintingShop.aggregate([
          { $group: { _id: '$verificationStatus', count: { $sum: 1 } } },
        ]),
        PrintingRequest.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        PrintingShop.countDocuments({
          'businessDocuments.currentFile.status': 'pending',
        }),
        PrintingRequest.aggregate([
          { $match: { status: { $in: ['completed', 'picked_up'] } } },
          { $group: { 
              _id: null, 
              totalSales: { $sum: '$estimatedCost' }, 
              totalPlatformFee: { $sum: '$platformFee' },
              totalShopEarnings: { $sum: '$shopEarnings' },
              count: { $sum: 1 } 
            } 
          },
        ]),
        AuditLog.find({})
          .sort({ timestamp: -1 })
          .limit(12)
          .lean(),
      ]);

      const shops = {
        total: 0,
        verified: 0,
        pending: 0,
        rejected: 0,
        suspended: 0,
        restricted: 0,
      };
      shopStatusAgg.forEach((s) => {
        if (s._id) {
          shops[s._id] = s.count;
          shops.total += s.count;
        }
      });

      const orders = {
        total: 0,
        submitted: 0,
        accepted: 0,
        queued: 0,
        printing: 0,
        ready: 0,
        completed: 0,
        cancelled: 0,
        declined: 0,
        on_hold: 0,
        active: 0,
      };

      orderStatusAgg.forEach((r) => {
        const status = r._id;
        const count = r.count;
        orders.total += count;

        if (status === 'submitted' || status === 'pending') {
          orders.submitted += count;
          orders.active += count;
        } else if (status === 'accepted') {
          orders.accepted += count;
          orders.active += count;
        } else if (status === 'queued') {
          orders.queued += count;
          orders.active += count;
        } else if (status === 'printing') {
          orders.printing += count;
          orders.active += count;
        } else if (status === 'ready' || status === 'ready_for_pickup') {
          orders.ready += count;
          orders.active += count;
        } else if (status === 'completed' || status === 'picked_up') {
          orders.completed += count;
        } else if (status === 'cancelled') {
          orders.cancelled += count;
        } else if (status === 'rejected' || status === 'declined') {
          orders.declined += count;
        } else if (status === 'on_hold') {
          orders.on_hold += count;
          orders.active += count;
        }
      });

      const completedSales = salesAgg.length > 0 ? salesAgg[0].totalSales : 0;
      const platformRevenue = Number((completedSales * 0.03).toFixed(2));
      const shopEarnings = Number((completedSales - platformRevenue).toFixed(2));

      res.status(200).json({
        success: true,
        data: {
          users: {
            total: totalUsers,
            customers: totalCustomers,
            shopOwners: totalShopOwners,
            admins: totalAdmins,
          },
          shops: {
            total: shops.total,
            verified: shops.verified,
            pending: shops.pending,
            rejected: shops.rejected,
            suspended: shops.suspended + shops.restricted,
          },
          orders: {
            total: orders.total,
            active: orders.active,
            completed: orders.completed,
            submitted: orders.submitted,
            accepted: orders.accepted,
            queued: orders.queued,
            printing: orders.printing,
            ready: orders.ready,
            cancelled: orders.cancelled,
            declined: orders.declined,
            on_hold: orders.on_hold,
          },
          pendingDocuments: pendingDocsCount,
          completedSales,
          platformRevenue,
          shopEarnings,
          recentActivity,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. USER MANAGEMENT
  getAllUsers: async (req, res, next) => {
    try {
      const { page = 1, limit = 20, role, status, search } = req.query;
      const filter = {};

      if (role && role !== 'all') {
        filter.role = role;
      }
      if (status && status !== 'all') {
        if (status === 'active') {
          filter.$or = [{ status: 'active' }, { status: { $exists: false }, isActive: true }];
        } else if (status === 'suspended') {
          filter.$or = [{ status: 'suspended' }, { isActive: false }];
        } else if (status === 'restricted') {
          filter.status = 'restricted';
        }
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { contactNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (+page - 1) * +limit;
      const [users, total] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(+limit).lean(),
        User.countDocuments(filter),
      ]);

      // Enrich users with associated stats
      const userIds = users.map((u) => u._id);
      const [customerOrderStats, ownerShops] = await Promise.all([
        PrintingRequest.aggregate([
          { $match: { customerId: { $in: userIds } } },
          {
            $group: {
              _id: { customerId: '$customerId', status: '$status' },
              count: { $sum: 1 },
            },
          },
        ]),
        PrintingShop.find({ ownerId: { $in: userIds } })
          .select('ownerId shopName verificationStatus status')
          .lean(),
      ]);

      const ownerShopMap = {};
      ownerShops.forEach((s) => {
        ownerShopMap[s.ownerId.toString()] = s;
      });

      const customerStatsMap = {};
      customerOrderStats.forEach((item) => {
        const cId = item._id.customerId.toString();
        if (!customerStatsMap[cId]) {
          customerStatsMap[cId] = { total: 0, completed: 0, cancelled: 0 };
        }
        customerStatsMap[cId].total += item.count;
        if (item._id.status === 'completed' || item._id.status === 'picked_up') {
          customerStatsMap[cId].completed += item.count;
        } else if (item._id.status === 'cancelled' || item._id.status === 'rejected' || item._id.status === 'declined') {
          customerStatsMap[cId].cancelled += item.count;
        }
      });

      const enrichedUsers = users.map((u) => {
        const uId = u._id.toString();
        return {
          ...u,
          status: u.status || (u.isActive === false ? 'suspended' : 'active'),
          orderStats: customerStatsMap[uId] || { total: 0, completed: 0, cancelled: 0 },
          associatedShop: ownerShopMap[uId] || null,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          users: enrichedUsers,
          total,
          page: +page,
          totalPages: Math.ceil(total / +limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  toggleUserStatus: async (req, res, next) => {
    try {
      const { status, isActive, reason = '' } = req.body;
      const targetUserId = req.params.id;

      if (targetUserId === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Security protection: You cannot alter the status of your own administrator account.',
        });
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      // Determine target status
      let newStatus = status;
      if (!newStatus) {
        newStatus = isActive === false ? 'suspended' : 'active';
      }

      if (['suspended', 'restricted'].includes(newStatus) && !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required to suspend or restrict an account.',
        });
      }

      targetUser.status = newStatus;
      targetUser.isActive = newStatus === 'active';
      targetUser.statusReason = reason.trim();
      targetUser.statusUpdatedAt = new Date();
      targetUser.statusUpdatedBy = req.user._id;
      if (newStatus !== 'active') {
        targetUser.deactivationReason = reason.trim();
        targetUser.deactivatedAt = new Date();
      } else {
        targetUser.deactivationReason = '';
        targetUser.deactivatedAt = null;
      }

      await targetUser.save();

      // Log audit
      await auditService.log({
        action: `user_${newStatus}`,
        eventType: 'user',
        details: `Admin ${req.user.name} set user "${targetUser.name}" (${targetUser.email}) status to ${newStatus.toUpperCase()}.${reason ? ` Reason: "${reason}"` : ''}`,
        actorId: req.user._id,
        actorName: req.user.name || 'Admin',
        actorRole: 'admin',
        targetId: targetUser._id,
        targetName: targetUser.name,
        metadata: { newStatus, reason },
      });

      // Send notification
      try {
        await notificationService.createAndEmit(
          targetUser._id,
          newStatus === 'active' ? 'account_activated' : 'account_suspended',
          newStatus === 'active' ? 'Account Reactivated' : `Account ${newStatus.toUpperCase()}`,
          newStatus === 'active'
            ? 'Your PrintDayon account has been reactivated. You have full access again.'
            : `Your account status is now ${newStatus.toUpperCase()}. Reason: ${reason}`
        );
      } catch (_) {}

      res.status(200).json({
        success: true,
        message: `User status updated to ${newStatus}.`,
        data: targetUser,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  createUser: async (req, res, next) => {
    try {
      const authService = require('../services/authService');
      const { name, email, password, role, contactNumber } = req.body;
      const result = await authService.register({ name, email, password, role, contactNumber });

      await auditService.log({
        action: 'user_created',
        eventType: 'user',
        details: `Admin created new ${role} account: "${name}" (${email})`,
        actorId: req.user._id,
        actorName: req.user.name || 'Admin',
        actorRole: 'admin',
        targetId: result.user._id,
        targetName: name,
      });

      res.status(201).json({ success: true, message: 'User created successfully.', data: result.user });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  deactivateUser: async (req, res, next) => {
    try {
      const user = await userRepository.deactivate(req.params.id);
      res.status(200).json({ success: true, message: 'User deactivated.', data: user });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  deleteUser: async (req, res, next) => {
    try {
      if (req.params.id === req.user._id.toString()) {
        return res.status(400).json({ success: false, message: 'Cannot delete your own admin account.' });
      }
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      await auditService.log({
        action: 'user_deleted',
        eventType: 'user',
        details: `Admin deleted user account: "${user.name}" (${user.email})`,
        actorId: req.user._id,
        actorName: req.user.name || 'Admin',
        actorRole: 'admin',
        targetId: user._id,
        targetName: user.name,
      });

      res.status(200).json({ success: true, message: 'User deleted successfully.', data: user });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  // 3. SHOP MANAGEMENT
  getAllShops: async (req, res, next) => {
    try {
      const { page = 1, limit = 20, tab = 'all', search, status } = req.query;
      const filter = {};

      if (tab === 'pending') {
        filter.verificationStatus = 'pending';
      } else if (tab === 'suspended') {
        filter.verificationStatus = { $in: ['suspended', 'restricted'] };
      } else if (tab === 'verified') {
        filter.verificationStatus = 'verified';
      } else if (status) {
        filter.verificationStatus = status;
      }

      if (search) {
        filter.$or = [
          { shopName: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { contactNumber: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (+page - 1) * +limit;
      const [shops, total] = await Promise.all([
        PrintingShop.find(filter)
          .populate('ownerId', 'name email contactNumber status')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(+limit)
          .lean(),
        PrintingShop.countDocuments(filter),
      ]);

      // Calculate real active queue counts for each shop
      const shopIds = shops.map((s) => s._id);
      const activeQueueCounts = await PrintingRequest.aggregate([
        {
          $match: {
            shopId: { $in: shopIds },
            status: { $in: ['accepted', 'queued', 'printing'] },
          },
        },
        { $group: { _id: '$shopId', count: { $sum: 1 } } },
      ]);

      const queueMap = {};
      activeQueueCounts.forEach((q) => {
        queueMap[q._id.toString()] = q.count;
      });

      const enrichedShops = shops.map((s) => {
        const live = getEffectiveShopStatus(s);
        return {
          ...s,
          status: live.status,
          isOpen: live.isOpen,
          isWithinHours: live.isWithinHours,
          unavailableReason: live.unavailableReason,
          nextOpening: live.nextOpening,
          liveQueueCount: queueMap[s._id.toString()] || 0,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          shops: enrichedShops,
          total,
          page: +page,
          totalPages: Math.ceil(total / +limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  getShopById: async (req, res, next) => {
    try {
      const shop = await PrintingShop.findById(req.params.id)
        .populate('ownerId', 'name email contactNumber status createdAt')
        .populate('verifiedBy', 'name email')
        .lean();

      if (!shop) {
        return res.status(404).json({ success: false, message: 'Shop not found.' });
      }

      // Fetch shop order and sales statistics
      const [orderStats, recentOrders] = await Promise.all([
        PrintingRequest.aggregate([
          { $match: { shopId: shop._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$estimatedCost' },
            },
          },
        ]),
        PrintingRequest.find({ shopId: shop._id })
          .populate('customerId', 'name email contactNumber')
          .populate('documentId', 'originalFilename')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      let completedOrders = 0;
      let completedSales = 0;
      let activeOrders = 0;

      orderStats.forEach((stat) => {
        if (stat._id === 'completed' || stat._id === 'picked_up') {
          completedOrders += stat.count;
          completedSales += stat.totalAmount;
        } else if (['submitted', 'pending', 'accepted', 'queued', 'printing', 'ready', 'ready_for_pickup'].includes(stat._id)) {
          activeOrders += stat.count;
        }
      });

      const live = getEffectiveShopStatus(shop);

      res.status(200).json({
        success: true,
        data: {
          ...shop,
          status: live.status,
          isOpen: live.isOpen,
          isWithinHours: live.isWithinHours,
          unavailableReason: live.unavailableReason,
          nextOpening: live.nextOpening,
          stats: {
            activeOrders,
            completedOrders,
            completedSales,
          },
          recentOrders,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  verifyShop: async (req, res, next) => {
    try {
      const { verificationStatus, rejectionReason = '' } = req.body;
      const shopId = req.params.id;

      if (!['verified', 'rejected', 'needs_update', 'pending'].includes(verificationStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid verification status.' });
      }

      if (verificationStatus === 'rejected' && !rejectionReason.trim()) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
      }

      const shop = await PrintingShop.findById(shopId);
      if (!shop) {
        return res.status(404).json({ success: false, message: 'Shop not found.' });
      }

      const previousStatus = shop.verificationStatus;
      shop.verificationStatus = verificationStatus;
      if (verificationStatus === 'verified') {
        shop.verifiedAt = new Date();
        shop.verifiedBy = req.user._id;
        shop.rejectionReason = '';
        shop.status = 'open';
      } else if (verificationStatus === 'rejected') {
        shop.rejectionReason = rejectionReason.trim();
        shop.status = 'closed';
      }

      await shop.save();

      // Send notification to shop owner
      await notificationService.createAndEmit(
        shop.ownerId,
        verificationStatus === 'verified' ? 'shop_verified' : 'shop_rejected',
        verificationStatus === 'verified' ? 'Shop Verified & Approved ✅' : 'Shop Application Rejected',
        verificationStatus === 'verified'
          ? 'Congratulations! Your shop has been verified and approved by the admin. Customers can now discover and place orders.'
          : `Your shop application was rejected. Reason: ${rejectionReason.trim()}`
      );

      // Log audit
      await auditService.log({
        action: `shop_${verificationStatus}`,
        eventType: 'verify',
        details: `Admin ${req.user.name} changed shop "${shop.shopName}" status from ${previousStatus} to ${verificationStatus}.${rejectionReason ? ` Reason: "${rejectionReason}"` : ''}`,
        actorId: req.user._id,
        actorName: req.user.name || 'Admin',
        actorRole: 'admin',
        targetId: shop._id,
        targetName: shop.shopName,
        metadata: { previousStatus, newStatus: verificationStatus, rejectionReason },
      });

      // Emit real-time updates
      try {
        const io = getIO();
        io.emit('shop:status_changed', {
          shopId: shop._id.toString(),
          verificationStatus,
          status: shop.status,
        });
        io.emit('shop:verified', {
          shopId: shop._id.toString(),
          verificationStatus,
        });
      } catch (_) {}

      res.status(200).json({
        success: true,
        message: `Shop has been ${verificationStatus}.`,
        data: shop,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  updateShopStatus: async (req, res, next) => {
    try {
      const { status, reason = '' } = req.body;
      const shopId = req.params.id;

      if (!['suspended', 'restricted', 'verified'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be suspended, restricted, or verified (reactivated).',
        });
      }

      if (['suspended', 'restricted'].includes(status) && !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required when suspending or restricting a shop.',
        });
      }

      const shop = await PrintingShop.findById(shopId);
      if (!shop) {
        return res.status(404).json({ success: false, message: 'Shop not found.' });
      }

      const previousStatus = shop.verificationStatus;
      shop.verificationStatus = status;

      if (status === 'suspended' || status === 'restricted') {
        shop.suspensionReason = reason.trim();
        shop.suspendedAt = new Date();
        shop.suspendedBy = req.user._id;
        shop.status = 'closed';
      } else if (status === 'verified') {
        shop.suspensionReason = '';
        shop.suspendedAt = null;
        shop.suspendedBy = null;
      }

      await shop.save();

      // Log audit
      await auditService.log({
        action: `shop_${status}`,
        eventType: 'shop',
        details: `Admin ${req.user.name} set shop "${shop.shopName}" status to ${status.toUpperCase()}.${reason ? ` Reason: "${reason}"` : ''}`,
        actorId: req.user._id,
        actorName: req.user.name || 'Admin',
        actorRole: 'admin',
        targetId: shop._id,
        targetName: shop.shopName,
        metadata: { previousStatus, newStatus: status, reason },
      });

      // Send notification to shop owner
      await notificationService.createAndEmit(
        shop.ownerId,
        status === 'suspended' ? 'shop_suspended' : status === 'restricted' ? 'shop_restricted' : 'shop_reactivated',
        status === 'verified' ? 'Shop Reactivated ✅' : `Shop ${status === 'suspended' ? 'Suspended ⚠️' : 'Restricted ⚠️'}`,
        status === 'verified'
          ? 'Your shop has been reactivated by the administrator and is now open for customer orders.'
          : `Your shop has been ${status} by the administrator. Reason: ${reason}`
      );

      // Real-time socket broadcast
      try {
        const io = getIO();
        io.emit('shop:status_changed', {
          shopId: shop._id.toString(),
          verificationStatus: status,
          status: shop.status,
          suspensionReason: shop.suspensionReason,
        });
      } catch (_) {}

      res.status(200).json({
        success: true,
        message: `Shop status updated to ${status}.`,
        data: shop,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  deleteShop: async (req, res, next) => {
    try {
      const shop = await PrintingShop.findById(req.params.id);
      if (!shop) {
        return res.status(404).json({ success: false, message: 'Shop not found.' });
      }

      await PrintingShop.findByIdAndDelete(req.params.id);

      await auditService.log({
        action: 'shop_deleted',
        eventType: 'shop',
        details: `Admin deleted shop: "${shop.shopName}"`,
        actorId: req.user._id,
        actorName: req.user.name || 'Admin',
        actorRole: 'admin',
        targetId: shop._id,
        targetName: shop.shopName,
      });

      try {
        getIO().emit('shop:deleted', { shopId: req.params.id });
      } catch (_) {}

      res.status(200).json({ success: true, message: 'Shop deleted successfully.', data: shop });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  // 4. BUSINESS VERIFICATION (Across All Shops)
  getAllDocuments: async (req, res, next) => {
    try {
      const { status = 'all', docType, search } = req.query;

      const shops = await PrintingShop.find({
        $or: [
          { businessDocuments: { $exists: true, $ne: [] } },
          { dtiDocUrl: { $ne: '' } },
          { permitDocUrl: { $ne: '' } },
        ],
      })
        .populate('ownerId', 'name email contactNumber')
        .lean();

      const allDocs = [];
      const now = new Date();

      shops.forEach((shop) => {
        const docs = shop.businessDocuments || [];
        docs.forEach((doc) => {
          const current = doc.currentFile || {};
          let effectiveDocStatus = current.status || 'pending';

          if (current.expiresAt && new Date(current.expiresAt) < now) {
            effectiveDocStatus = 'expired';
          }

          if (status !== 'all' && effectiveDocStatus !== status) {
            return;
          }

          if (docType && docType !== 'all' && doc.type !== docType) {
            return;
          }

          if (search) {
            const q = search.toLowerCase();
            const matches =
              (shop.shopName || '').toLowerCase().includes(q) ||
              (shop.ownerId?.name || '').toLowerCase().includes(q) ||
              (doc.title || '').toLowerCase().includes(q) ||
              (doc.docNumber || '').toLowerCase().includes(q);
            if (!matches) return;
          }

          allDocs.push({
            shopId: shop._id,
            shopName: shop.shopName,
            ownerName: shop.ownerId?.name || 'Owner',
            ownerEmail: shop.ownerId?.email || '',
            ownerContact: shop.ownerId?.contactNumber || shop.contactNumber || '',
            docType: doc.type,
            title: doc.title,
            docNumber: doc.docNumber,
            currentFile: {
              ...current,
              status: effectiveDocStatus,
            },
            history: doc.history || [],
          });
        });
      });

      res.status(200).json({
        success: true,
        data: {
          documents: allDocs,
          total: allDocs.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  verifyBusinessDocument: async (req, res, next) => {
    try {
      const { id, docType } = req.params;
      const { status, rejectionReason } = req.body;

      if (status === 'rejected' && !rejectionReason?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'A rejection reason is required to reject a business document.',
        });
      }

      const document = await shopService.verifyBusinessDocument(
        id,
        docType,
        status,
        rejectionReason,
        req.user._id
      );

      res.status(200).json({
        success: true,
        message: `Document ${status === 'verified' ? 'verified' : 'rejected'} successfully.`,
        data: document,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  // 5. ORDERS & TRANSACTIONS
  getAllRequests: async (req, res, next) => {
    try {
      const { page = 1, limit = 50, status, tab = 'all', search, customerId, shopId } = req.query;
      const filter = {};

      if (tab === 'cancelled') {
        filter.status = { $in: ['cancelled', 'rejected', 'declined'] };
      } else if (tab === 'transactions') {
        filter.paymentMethod = { $exists: true };
      } else if (status && status !== 'all') {
        filter.status = status;
      }

      if (customerId) filter.customerId = customerId;
      if (shopId) filter.shopId = shopId;

      const skip = (+page - 1) * +limit;
      const [requests, total] = await Promise.all([
        PrintingRequest.find(filter)
          .populate('customerId', 'name email contactNumber')
          .populate('shopId', 'shopName address contactNumber storefrontPhotoUrl')
          .populate('documentId', 'originalFilename fileType fileSize')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(+limit)
          .lean(),
        PrintingRequest.countDocuments(filter),
      ]);

      let filteredList = requests;
      if (search) {
        const q = search.toLowerCase();
        filteredList = requests.filter((r) => {
          const sName = (r.shopId?.shopName || '').toLowerCase();
          const cName = (r.customerId?.name || '').toLowerCase();
          const docName = (r.documentId?.originalFilename || '').toLowerCase();
          const claim = (r.claimCode || '').toLowerCase();
          const idStr = (r._id || '').toString().toLowerCase();
          const ref = (r.paymentRefNumber || '').toLowerCase();
          return sName.includes(q) || cName.includes(q) || docName.includes(q) || claim.includes(q) || idStr.includes(q) || ref.includes(q);
        });
      }

      res.status(200).json({
        success: true,
        data: {
          requests: filteredList,
          total: search ? filteredList.length : total,
          page: +page,
          totalPages: Math.ceil((search ? filteredList.length : total) / +limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },

  holdOrder: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { onHold = true, reason = 'Administrative review' } = req.body;

      const request = await PrintingRequest.findById(id)
        .populate('customerId', 'name email')
        .populate('shopId', 'shopName ownerId');

      if (!request) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      const newStatus = onHold ? 'on_hold' : 'queued';
      request.status = newStatus;
      await request.save();

      // Log audit
      await auditService.log({
        action: onHold ? 'order_hold' : 'order_hold_released',
        eventType: 'order',
        details: `Admin ${req.user.name} placed Order #${request._id.toString().slice(-6)} on ${onHold ? 'HOLD' : 'RELEASED'}. Reason: "${reason}"`,
        actorId: req.user._id,
        actorName: req.user.name || 'Admin',
        actorRole: 'admin',
        targetId: request._id,
        targetName: `Order #${request._id.toString().slice(-6)}`,
        metadata: { onHold, reason },
      });

      // Send notifications to both customer and shop owner
      if (request.customerId?._id) {
        await notificationService.createAndEmit(
          request.customerId._id,
          'order_status_update',
          onHold ? 'Order Placed on Hold ⚠️' : 'Order Hold Released',
          `Your order with ${request.shopId?.shopName || 'Shop'} has been ${onHold ? 'placed on administrative hold' : 'released and resumed'}. Reason: ${reason}`
        );
      }

      if (request.shopId?.ownerId) {
        await notificationService.createAndEmit(
          request.shopId.ownerId,
          'order_status_update',
          onHold ? 'Order Placed on Hold by Admin ⚠️' : 'Order Hold Released',
          `Order #${request._id.toString().slice(-6)} has been ${onHold ? 'placed on administrative hold' : 'resumed'}. Reason: ${reason}`
        );
      }

      try {
        const io = getIO();
        io.emit('request:status_changed', {
          requestId: request._id.toString(),
          status: newStatus,
        });
      } catch (_) {}

      res.status(200).json({
        success: true,
        message: `Order status set to ${newStatus}.`,
        data: request,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {
      next(err);
    }
  },

  // 6. REPORTS & ANALYTICS
  getReports: async (req, res, next) => {
    try {
      const { timeRange } = req.query;
      let dateFilter = {};
      const now = new Date();

      if (timeRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { createdAt: { $gte: startOfDay } };
      } else if (timeRange === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: sevenDaysAgo } };
      } else if (timeRange === 'month') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: thirtyDaysAgo } };
      }

      const orderMatch = Object.keys(dateFilter).length > 0 ? dateFilter : {};

      const [
        totalCustomers,
        totalShopOwners,
        totalAdmins,
        totalUsers,
        allShops,
        ordersByStatus,
        completedSalesAgg,
        allOrdersAgg,
        paymentMethodAgg,
        timelineAgg,
        demandAgg,
      ] = await Promise.all([
        User.countDocuments({ role: 'customer' }),
        User.countDocuments({ role: 'shop_owner' }),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({}),
        PrintingShop.find({ isArchived: { $ne: true } })
          .populate('ownerId', 'name email contactNumber')
          .lean(),
        PrintingRequest.aggregate([
          { $match: orderMatch },
          { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$estimatedCost' } } },
        ]),
        PrintingRequest.aggregate([
          { $match: { ...orderMatch, status: { $in: ['completed', 'picked_up'] } } },
          { $group: { _id: null, totalSales: { $sum: '$estimatedCost' }, count: { $sum: 1 } } },
        ]),
        PrintingRequest.aggregate([
          { $match: orderMatch },
          {
            $group: {
              _id: '$shopId',
              totalOrders: { $sum: 1 },
              completedOrders: {
                $sum: { $cond: [{ $in: ['$status', ['completed', 'picked_up']] }, 1, 0] }
              },
              totalRevenue: {
                $sum: { $cond: [{ $in: ['$status', ['completed', 'picked_up']] }, '$estimatedCost', 0] }
              }
            }
          }
        ]),
        PrintingRequest.aggregate([
          { $match: orderMatch },
          { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$estimatedCost' } } },
        ]),
        PrintingRequest.aggregate([
          { $match: orderMatch },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: timeRange === 'today' ? '%H:00' : '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: '+08:00',
                },
              },
              totalOrders: { $sum: 1 },
              completedOrders: {
                $sum: { $cond: [{ $in: ['$status', ['completed', 'picked_up']] }, 1, 0] },
              },
              grossSales: {
                $sum: { $cond: [{ $in: ['$status', ['completed', 'picked_up']] }, '$estimatedCost', 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        PrintingRequest.aggregate([
          { $match: orderMatch },
          {
            $group: {
              _id: null,
              bwCount: {
                $sum: { $cond: [{ $eq: ['$printingSpecifications.colorMode', 'black_and_white'] }, 1, 0] },
              },
              colorCount: {
                $sum: { $cond: [{ $eq: ['$printingSpecifications.colorMode', 'color'] }, 1, 0] },
              },
              a4Count: {
                $sum: { $cond: [{ $eq: ['$printingSpecifications.paperSize', 'A4'] }, 1, 0] },
              },
              legalCount: {
                $sum: { $cond: [{ $eq: ['$printingSpecifications.paperSize', 'Legal'] }, 1, 0] },
              },
              letterCount: {
                $sum: { $cond: [{ $eq: ['$printingSpecifications.paperSize', 'Letter'] }, 1, 0] },
              },
              rushCount: {
                $sum: { $cond: [{ $eq: ['$isRush', true] }, 1, 0] },
              },
            },
          },
        ]),
      ]);

      // Calculate order breakdown
      let totalOrders = 0;
      let completedOrders = 0;
      let inProgressOrders = 0;
      let pendingOrders = 0;
      let cancelledOrders = 0;
      let totalVolume = 0;

      ordersByStatus.forEach(item => {
        const count = item.count || 0;
        const amount = item.totalAmount || 0;
        totalOrders += count;
        totalVolume += amount;

        if (['completed', 'picked_up'].includes(item._id)) {
          completedOrders += count;
        } else if (['in_progress', 'printing', 'ready_for_pickup', 'accepted'].includes(item._id)) {
          inProgressOrders += count;
        } else if (['pending'].includes(item._id)) {
          pendingOrders += count;
        } else if (['cancelled', 'declined', 'rejected'].includes(item._id)) {
          cancelledOrders += count;
        }
      });

      const completedVolume = completedSalesAgg[0]?.totalSales || 0;
      const commissionRate = 0.03; // 3% Platform Commission Revenue Share (TikTok Shop Model)
      const platformRevenue = Number((completedVolume * commissionRate).toFixed(2));
      const netShopPayout = Number((completedVolume - platformRevenue).toFixed(2));
      const fulfillmentRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
      const avgOrderValue = completedOrders > 0 ? completedVolume / completedOrders : 0;

      // Map shops breakdown including all Naval stores
      const shopsBreakdown = allShops.map(shop => {
        const stats = allOrdersAgg.find(a => a._id && a._id.toString() === shop._id.toString()) || {
          totalOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
        };
        const shopFulfillment = stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0;
        const grossSales = stats.totalRevenue || 0;
        const shopCommission = Number((grossSales * commissionRate).toFixed(2));
        const netEarnings = Number((grossSales - shopCommission).toFixed(2));

        return {
          shopId: shop._id,
          shopName: shop.shopName,
          ownerName: shop.ownerId?.name || 'Shop Partner',
          address: shop.address || shop.landmark || 'Naval, Biliran',
          totalOrders: stats.totalOrders,
          completedOrders: stats.completedOrders,
          totalRevenue: grossSales,
          grossSales,
          platformCommission: shopCommission,
          netEarnings,
          fulfillmentRate: shopFulfillment,
          verificationStatus: shop.verificationStatus || 'pending',
          isAvailable: shop.isAvailable,
        };
      }).sort((a, b) => b.totalOrders - a.totalOrders || b.totalRevenue - a.totalRevenue);

      // Digital Payment Breakdown (100% Cashless Advance Payment)
      const payments = {
        gcash: { count: 0, total: 0 },
        maya: { count: 0, total: 0 },
      };
      paymentMethodAgg.forEach(p => {
        if (p._id === 'maya') {
          payments.maya = { count: p.count || 0, total: p.total || 0 };
        } else {
          payments.gcash = { count: (payments.gcash.count || 0) + (p.count || 0), total: (payments.gcash.total || 0) + (p.total || 0) };
        }
      });

      const rawDemand = demandAgg?.[0] || {
        bwCount: 0,
        colorCount: 0,
        a4Count: 0,
        legalCount: 0,
        letterCount: 0,
        rushCount: 0,
      };

      const timeline = (timelineAgg || []).map((t) => ({
        label: t._id,
        totalOrders: t.totalOrders || 0,
        completedOrders: t.completedOrders || 0,
        grossSales: t.grossSales || 0,
        platformCommission: Number(((t.grossSales || 0) * commissionRate).toFixed(2)),
      }));

      const serviceDemand = {
        colorMode: {
          black_and_white: rawDemand.bwCount || 0,
          color: rawDemand.colorCount || 0,
        },
        paperSize: {
          A4: rawDemand.a4Count || 0,
          Legal: rawDemand.legalCount || 0,
          Letter: rawDemand.letterCount || 0,
        },
        rushOrders: rawDemand.rushCount || 0,
      };

      res.status(200).json({
        success: true,
        data: {
          financials: {
            totalVolume,
            completedVolume,
            commissionRate,
            platformRevenue,
            platformCommission: platformRevenue,
            netShopPayout,
            avgOrderValue,
          },
          orders: {
            total: totalOrders,
            completed: completedOrders,
            in_progress: inProgressOrders,
            pending: pendingOrders,
            cancelled: cancelledOrders,
            fulfillmentRate,
          },
          users: {
            total: totalUsers,
            customers: totalCustomers,
            shopOwners: totalShopOwners,
            admins: totalAdmins,
          },
          shopsBreakdown,
          payments,
          timeline,
          serviceDemand,
          system: {
            usersByRole: [
              { _id: 'customer', count: totalCustomers },
              { _id: 'shop_owner', count: totalShopOwners },
              { _id: 'admin', count: totalAdmins },
            ],
            shopsByVerification: allShops.reduce((acc, s) => {
              const status = s.verificationStatus || 'pending';
              const found = acc.find(x => x._id === status);
              if (found) found.count += 1;
              else acc.push({ _id: status, count: 1 });
              return acc;
            }, []),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // 7. AUDIT LOGS
  getLogs: async (req, res, next) => {
    try {
      const { page, limit, eventType, search } = req.query;
      const [result, stats] = await Promise.all([
        auditService.getLogs({ eventType, search }, { page: +page || 1, limit: +limit || 50 }),
        auditService.getStats(),
      ]);
      res.status(200).json({ success: true, data: { ...result, stats } });
    } catch (err) {
      next(err);
    }
  },

  clearLogs: async (req, res, next) => {
    try {
      await auditService.clearLogs();
      res.status(200).json({ success: true, message: 'Audit logs cleared.' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = adminController;

