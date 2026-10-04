const notificationRepository = require('../repositories/notificationRepository');
const { getIO } = require('../sockets/socketManager');

const notificationService = {
  createAndEmit: async (userId, type, title, message, relatedRequestId = null, relatedShopId = null) => {
    const notif = await notificationRepository.create({
      userId,
      type,
      title,
      message,
      relatedRequestId,
      relatedShopId,
    });

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('notification:new', notif);
    } catch (err) {
    }

    return notif;
  },

  notifyCustomerStatusChange: async (request, status, reason = '') => {
    const shopName = request.shopId?.shopName || 'the print shop';
    const claimCode = request.claimCode || (request._id ? `#${request._id.toString().slice(-4).toUpperCase()}` : '');

    const messages = {
      submitted: {
        type: 'request_submitted',
        title: 'Order Submitted',
        message: `Your print order was submitted to ${shopName}.`,
      },
      pending: {
        type: 'request_submitted',
        title: 'Order Submitted',
        message: `Your print order was submitted to ${shopName}.`,
      },
      accepted: {
        type: 'request_accepted',
        title: 'Order Accepted',
        message: `Your order was accepted at ${shopName}.${request.queuePosition ? ` You are position #${request.queuePosition} in line.` : ''}`,
      },
      rejected: {
        type: 'request_rejected',
        title: 'Order Declined',
        message: `Your print order was declined by ${shopName}.${reason ? ` Reason: ${reason}` : ''}`,
      },
      on_hold: {
        type: 'request_on_hold',
        title: 'Order On Hold',
        message: `Your print order at ${shopName} has been temporarily placed on hold.${reason ? ` Reason: ${reason}` : ''}`,
      },
      queued: {
        type: 'request_queued',
        title: 'Order in Queue',
        message: `Your documents are in line at ${shopName}${request.queuePosition ? ` (Position #${request.queuePosition})` : ''}.`,
      },
      printing: {
        type: 'request_printing',
        title: 'Printing Started',
        message: `Your documents are now being printed at ${shopName}.`,
      },
      ready: {
        type: 'request_ready',
        title: 'Ready for Pickup',
        message: `Your documents are ready to collect at ${shopName}.${claimCode ? ` Claim code: ${claimCode}` : ''}`,
      },
      ready_for_pickup: {
        type: 'request_ready',
        title: 'Ready for Pickup',
        message: `Your documents are ready to collect at ${shopName}.${claimCode ? ` Claim code: ${claimCode}` : ''}`,
      },
      picked_up: {
        type: 'request_picked_up',
        title: 'Documents Picked Up',
        message: `Your documents have been picked up at ${shopName}.`,
      },
      completed: {
        type: 'request_completed',
        title: 'Order Completed',
        message: `Your print order at ${shopName} is now complete. Thank you!`,
      },
      cancelled: {
        type: 'request_cancelled',
        title: 'Order Cancelled',
        message: `Your print order at ${shopName} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
      },
    };

    const notifData = messages[status];
    if (!notifData) return;

    const customerUserId = request.customerId?._id || request.customerId;
    if (!customerUserId) return;

    // Prevent duplicate notifications for the same order and status transition
    const NotificationModel = require('../models/Notification');
    const duplicate = await NotificationModel.findOne({
      userId: customerUserId,
      relatedRequestId: request._id,
      type: notifData.type,
    });

    let notif = null;
    const shopId = request.shopId?._id || request.shopId;
    if (!duplicate) {
      notif = await notificationService.createAndEmit(
        customerUserId,
        notifData.type,
        notifData.title,
        notifData.message,
        request._id,
        shopId
      );
    }

    try {
      const io = getIO();
      if (customerUserId) {
        io.to(`user:${customerUserId}`).emit(`request:${status}`, {
          requestId: request._id,
          status,
          queuePosition: request.queuePosition,
        });
        io.to(`user:${customerUserId}`).emit('request:status_changed', {
          requestId: request._id,
          status,
          queuePosition: request.queuePosition,
        });
      }

      const shopId = request.shopId?._id || request.shopId;
      if (shopId) {
        io.to(`shop:${shopId}`).emit('request:status_changed', {
          requestId: request._id,
          status,
          queuePosition: request.queuePosition,
        });
        io.to(`shop:${shopId}`).emit('queue:update', { shopId });
      }

      io.emit('shop:queue_changed', { shopId });
    } catch (err) { }

    return notif;
  },

  notifyShopNewRequest: async (shop, request, customerId) => {
    await notificationService.createAndEmit(
      shop.ownerId,
      'request_new',
      'New Printing Request 📥',
      `A new printing request has been submitted.`,
      request._id
    );

    try {
      const io = getIO();
      io.to(`shop:${shop._id}`).emit('request:new', {
        requestId: request._id,
        customerId,
      });
      io.to(`shop:${shop._id}`).emit('queue:update', { shopId: shop._id });
      io.emit('shop:queue_changed', { shopId: shop._id });
    } catch (err) { }
  },

  notifyShopCancellation: async (request) => {
    const shopId = request.shopId._id || request.shopId;
    const shop = await require('../repositories/shopRepository').findById(shopId);
    if (!shop) return;

    await notificationService.createAndEmit(
      shop.ownerId,
      'request_cancelled',
      'Request Cancelled',
      `A customer has cancelled their printing request.`,
      request._id
    );

    try {
      const io = getIO();
      io.to(`shop:${shopId}`).emit('request:cancelled', { requestId: request._id });
    } catch (err) { }
  },

  notifyCustomerShopNote: async (request, shopNote, shopName = 'Shop') => {
    const customerUserId = request.customerId?._id || request.customerId;
    if (!customerUserId) return;

    const titleMap = {
      file_issue: `📄 File Issue Reported - ${shopName}`,
      layout_issue: `⚠️ Layout / Margin Notice - ${shopName}`,
      power_outage: `⚡ Power Cut Delay Alert - ${shopName}`,
      equipment_maintenance: `🛠️ Equipment Notice - ${shopName}`,
      general_delay: `⏳ Printing Delay Notice - ${shopName}`,
      custom: `💬 Message from ${shopName}`,
    };

    const notif = await notificationService.createAndEmit(
      customerUserId,
      shopNote.category === 'power_outage' ? 'delay_alert' : 'shop_note',
      titleMap[shopNote.category] || `Notice from ${shopName}`,
      shopNote.message,
      request._id
    );

    try {
      const io = getIO();
      const payload = {
        requestId: request._id,
        shopNote,
        delayNotice: request.delayNotice,
      };
      io.to(`user:${customerUserId}`).emit('request:note_added', payload);
      const shopId = request.shopId?._id || request.shopId;
      if (shopId) {
        io.to(`shop:${shopId}`).emit('request:note_added', payload);
      }
    } catch (err) { }

    return notif;
  },

  notifyCustomerDelayAlert: async (request, reason, estimatedDelayMinutes = 0, shopName = 'Shop') => {
    const customerUserId = request.customerId?._id || request.customerId;
    if (!customerUserId) return;

    const notif = await notificationService.createAndEmit(
      customerUserId,
      'delay_alert',
      `⚡ Power Outage Delay Alert - ${shopName}`,
      reason || 'Electrical interruption in Naval. Printing is temporarily paused.',
      request._id
    );

    try {
      const io = getIO();
      const payload = {
        requestId: request._id,
        reason,
        estimatedDelayMinutes,
        delayNotice: request.delayNotice,
      };
      io.to(`user:${customerUserId}`).emit('request:delay_alert', payload);
      const shopId = request.shopId?._id || request.shopId;
      if (shopId) {
        io.to(`shop:${shopId}`).emit('request:delay_alert', payload);
      }
    } catch (err) { }

    return notif;
  },

  notifyCustomerDelayCleared: async (request, shopName = 'Shop') => {
    const customerUserId = request.customerId?._id || request.customerId;
    if (!customerUserId) return;

    const notif = await notificationService.createAndEmit(
      customerUserId,
      'system',
      `⚡ Power Restored - ${shopName}`,
      'Power has been restored. Printing queue has resumed operations.',
      request._id
    );

    try {
      const io = getIO();
      const payload = {
        requestId: request._id,
        delayNotice: request.delayNotice,
      };
      io.to(`user:${customerUserId}`).emit('request:delay_cleared', payload);
      const shopId = request.shopId?._id || request.shopId;
      if (shopId) {
        io.to(`shop:${shopId}`).emit('request:delay_cleared', payload);
      }
    } catch (err) { }

    return notif;
  },

  notifyQueueRecalculated: (shopId, activeRequests = []) => {
    try {
      const io = getIO();
      if (!io) return;

      io.to(`shop:${shopId}`).emit('queue:recalculated', {
        shopId,
        activeCount: activeRequests.length,
        timestamp: Date.now(),
      });

      activeRequests.forEach((req, idx) => {
        const customerId = req.customerId?._id || req.customerId;
        if (customerId) {
          io.to(`user:${customerId}`).emit('request:queue_recalculated', {
            requestId: req._id,
            queuePosition: idx + 1,
            printerChannel: req.printerChannel,
            isRush: req.isRush,
            status: req.status,
            estimatedWaitingTime: req.estimatedWaitingTime,
          });
        }
      });
    } catch (err) {
      console.warn('notifyQueueRecalculated error:', err.message);
    }
  },

  notifyShopClosureToActiveCustomers: async (shop, closureReasonLabel, advisoryMessage) => {
    try {
      const requestRepository = require('../repositories/requestRepository');
      const activeRequests = await requestRepository.findActiveByShop(shop._id);
      const io = getIO();

      for (const req of activeRequests) {
        const customerUserId = req.customerId?._id || req.customerId;
        if (!customerUserId) continue;

        const reasonText = closureReasonLabel || 'Operational adjustment';
        const advice = advisoryMessage ? ` Advisory: ${advisoryMessage}` : '';
        const msg = `${shop.shopName} has temporarily closed (${reasonText}). Your order #${req.claimCode || req._id.toString().slice(-4).toUpperCase()} is on queue and will resume as soon as operations reopen.${advice}`;

        await notificationService.createAndEmit(
          customerUserId,
          'shop_closed',
          `⚠️ ${shop.shopName} Temporarily Closed`,
          msg,
          req._id,
          shop._id
        );

        if (io) {
          io.to(`user:${customerUserId}`).emit('shop:closed_alert', {
            shopId: shop._id,
            shopName: shop.shopName,
            reason: reasonText,
            advisoryMessage,
            requestId: req._id,
          });
        }
      }
    } catch (err) {
      console.warn('Error in notifyShopClosureToActiveCustomers:', err.message);
    }
  },

  notifyShopDelayToActiveCustomers: async (shop, delayMinutes, operationalMessage) => {
    try {
      const requestRepository = require('../repositories/requestRepository');
      const activeRequests = await requestRepository.findActiveByShop(shop._id);
      const io = getIO();

      for (const req of activeRequests) {
        const customerUserId = req.customerId?._id || req.customerId;
        if (!customerUserId) continue;

        const delayText = delayMinutes > 0 ? ` (+${delayMinutes} mins estimated delay)` : '';
        const detail = operationalMessage || 'High demand or operational delay reported.';
        const msg = `Service delay alert at ${shop.shopName}${delayText}. Note: ${detail}. Your order #${req.claimCode || req._id.toString().slice(-4).toUpperCase()} is currently queued.`;

        await notificationService.createAndEmit(
          customerUserId,
          'service_delay',
          `⏳ Service Delay Notice - ${shop.shopName}`,
          msg,
          req._id,
          shop._id
        );

        if (io) {
          io.to(`user:${customerUserId}`).emit('shop:delay_alert', {
            shopId: shop._id,
            shopName: shop.shopName,
            delayMinutes,
            operationalMessage,
            requestId: req._id,
          });
        }
      }
    } catch (err) {
      console.warn('Error in notifyShopDelayToActiveCustomers:', err.message);
    }
  },

  getUserNotifications: async (userId) => {
    return notificationRepository.findByUser(userId);
  },

  getNotificationById: async (notifId, userId) => {
    return notificationRepository.findById(notifId, userId);
  },

  markRead: async (notifId, userId) => {
    return notificationRepository.markRead(notifId, userId);
  },

  markAllRead: async (userId) => {
    return notificationRepository.markAllRead(userId);
  },

  getUnreadCount: async (userId) => {
    return notificationRepository.countUnread(userId);
  },

  deleteNotification: async (notifId, userId) => {
    return notificationRepository.deleteById(notifId, userId);
  },

  deleteAllNotifications: async (userId) => {
    return notificationRepository.deleteAllByUser(userId);
  },
};

module.exports = notificationService;
