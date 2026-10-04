const requestRepository = require('../repositories/requestRepository');
const shopRepository = require('../repositories/shopRepository');
const documentRepository = require('../repositories/documentRepository');
const PrintingRequest = require('../models/PrintingRequest');
const OrderStatusHistory = require('../models/OrderStatusHistory');
const notificationService = require('./notificationService');
const documentCleanupService = require('./documentCleanupService');
const { estimatePrintingTime, estimateWaitingTime, calculateEstimatedCost, detectPrinterChannel } = require('../algorithms/queueOptimizer');
const { getShortestPath } = require('../algorithms/dijkstra');
const { navalGraph, nodeCoordinates } = require('../config/navalGraph');
const { getEffectiveShopStatus, isShopOpenNow } = require('../utils/shopHelper');

const getStatusMessage = (status, shopName = 'Shop', reason = '') => {
  switch (status) {
    case 'submitted':
    case 'pending':
      return `Order submitted to ${shopName}`;
    case 'accepted':
      return `Order accepted by ${shopName}`;
    case 'queued':
      return `Order placed in printing queue at ${shopName}`;
    case 'printing':
      return `Documents currently printing at ${shopName}`;
    case 'ready':
    case 'ready_for_pickup':
      return `Documents ready for pickup at ${shopName}`;
    case 'picked_up':
      return `Documents picked up by customer`;
    case 'completed':
      return `Order completed and finalized`;
    case 'rejected':
      return reason ? `Order declined: ${reason}` : `Order declined by ${shopName}`;
    case 'on_hold':
      return reason ? `Order placed on hold: ${reason}` : `Order placed on hold by ${shopName}`;
    case 'cancelled':
      return reason ? `Order cancelled: ${reason}` : `Order cancelled`;
    default:
      return `Order status updated to ${status}`;
  }
};

const requestService = {
  submitRequest: async (customerId, { shopId, documentId, printingSpecs, customerLat, customerLng, paymentMethod = 'gcash', paymentRefNumber = '', paymentProofUrl = '', isRush = false, travelMode = 'motor' }) => {

    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Printing shop not found.');
      error.statusCode = 404;
      throw error;
    }

    // Verify shop is verified and eligible to accept orders
    if (shop.verificationStatus !== 'verified') {
      const msg = shop.verificationStatus === 'suspended'
        ? 'This printing shop is currently suspended and cannot accept orders.'
        : (shop.verificationStatus === 'rejected'
          ? 'This printing shop has been rejected and cannot accept orders.'
          : 'This printing shop is pending administrator verification and cannot accept orders yet.');
      const error = new Error(msg);
      error.statusCode = 400;
      throw error;
    }

    // Purely online, prepaid system: GCash is the only payment method and the
    // payment receipt must be attached BEFORE an order can be placed (no cash / pay-on-pickup).
    if (paymentMethod !== 'gcash') {
      const error = new Error('Only GCash payment is accepted.');
      error.statusCode = 400;
      throw error;
    }
    if (typeof paymentProofUrl !== 'string' || !paymentProofUrl.trim()) {
      const error = new Error('Payment is required before ordering. Please attach your GCash payment receipt.');
      error.statusCode = 400;
      throw error;
    }

    // Determine if shop is currently open or closed (Option 1: allow orders while closed)
    const effective = getEffectiveShopStatus(shop);
    const placedWhileShopClosed = !effective.isOpen;

    const rushRequested = Boolean(isRush);
    if (rushRequested && shop.pricing?.allowRush === false) {
      const error = new Error('This shop is currently not accepting rush orders.');
      error.statusCode = 400;
      throw error;
    }
    const rushFee = (rushRequested && shop.pricing?.allowRush !== false) ? Number(shop.pricing?.rushFee ?? 20) : 0;

    const doc = await documentRepository.findById(documentId);
    if (!doc || doc.customerId.toString() !== customerId.toString()) {
      const error = new Error('Document not found or unauthorized.');
      error.statusCode = 403;
      throw error;
    }

    // Duplicate prevention / idempotency check (within last 15s)
    const recentDuplicate = await PrintingRequest.findOne({
      customerId,
      shopId,
      documentId,
      status: { $in: ['pending', 'submitted'] },
      createdAt: { $gte: new Date(Date.now() - 15000) },
    });
    if (recentDuplicate) {
      return recentDuplicate;
    }

    // Service availability validation
    if (printingSpecs?.binding && printingSpecs.binding !== 'none') {
      const offersBinding = shop.services?.some((s) => 
        s.available !== false && (s.name?.toLowerCase().includes('bind') || s.name?.toLowerCase().includes('book'))
      ) || (shop.pricing?.bindingCost > 0) || (shop.pricing?.softbindCost > 0);

      if (!offersBinding) {
        const error = new Error('Binding service is not offered by this shop.');
        error.statusCode = 400;
        throw error;
      }
    }

    const printerChannel = detectPrinterChannel(printingSpecs);
    const pathResult = getShortestPath(navalGraph, nodeCoordinates, customerLat, customerLng, shop.latitude, shop.longitude, travelMode);
    const activeRequests = await requestRepository.findActiveByShop(shopId);
    const onlineWait = estimateWaitingTime(activeRequests, shop.pricing, rushRequested, printerChannel);

    const walkInCount = Math.max(0, Number(shop.walkInCustomerCount) || 0);
    const validLevels = ['normal', 'moderate', 'packed'];
    const walkInTrafficLevel = validLevels.includes(shop.walkInTrafficLevel)
      ? shop.walkInTrafficLevel
      : (walkInCount > 8 ? 'packed' : (walkInCount > 3 ? 'moderate' : 'normal'));

    let walkInWait = 0;
    if (walkInTrafficLevel === 'packed') {
      walkInWait = 25;
    } else if (walkInTrafficLevel === 'moderate') {
      walkInWait = 10;
    } else if (walkInCount > 8) {
      walkInWait = 25;
    } else if (walkInCount > 3) {
      walkInWait = 10;
    }

    const opDelay = Math.max(0, Number(shop.operationalDelayMinutes) || 0);
    const waitingTime = onlineWait + walkInWait + opDelay;
    const printingTime = estimatePrintingTime(printingSpecs, shop.pricing);
    const totalTime = pathResult.travelTimeMinutes + waitingTime + printingTime;
    const estimatedCost = calculateEstimatedCost(printingSpecs, shop.pricing, rushRequested);

    const pricingSnapshot = {
      bwPerPage: Number(shop.pricing?.bwPerPage ?? 2),
      bwLongPerPage: Number(shop.pricing?.bwLongPerPage ?? 3),
      colorPerPage: Number(shop.pricing?.colorPerPage ?? 4),
      colorLongPerPage: Number(shop.pricing?.colorLongPerPage ?? 5),
      bindingCost: Number(shop.pricing?.bindingCost ?? 35),
      softbindCost: Number(shop.pricing?.softbindCost ?? 50),
      stapleCost: Number(shop.pricing?.stapleCost ?? 5),
      rushFee,
      calculatedCost: estimatedCost,
      placedWhileShopClosed,
    };

    const claimCode = `PD-${Math.floor(1000 + Math.random() * 9000)}`;

    const timeSavedMinutes = Math.max(10, waitingTime + 12);

    const request = await requestRepository.create({
      customerId,
      shopId,
      documentId,
      printingSpecifications: printingSpecs,
      isRush: rushRequested,
      rushFee,
      placedWhileShopClosed,
      pricingSnapshot,
      printerChannel,
      travelMode,
      estimatedCost,
      estimatedTravelTime: pathResult.travelTimeMinutes,
      estimatedWaitingTime: waitingTime,
      estimatedPrintingTime: printingTime,
      estimatedCompletionTime: totalTime,
      paymentMethod,
      paymentStatus: (paymentRefNumber || paymentProofUrl) ? 'paid_verifying' : 'unpaid',
      paymentRefNumber,
      paymentProofUrl,
      claimCode,
      timeSavedMinutes,
      queuePosition: null,
      status: 'pending',
    });

    await documentRepository.linkToRequest(documentId, request._id);

    try {
      await OrderStatusHistory.create({
        orderId: request._id,
        order_id: request._id,
        status: 'submitted',
        message: getStatusMessage('submitted', shop.shopName),
        changedBy: customerId,
        changed_by: customerId,
        createdAt: request.submittedAt || new Date(),
        created_at: request.submittedAt || new Date(),
      });
    } catch (err) {
      console.warn('Failed to record initial status history:', err.message);
    }

    await notificationService.notifyShopNewRequest(shop, request, customerId);

    try {
      const refreshedActive = await requestRepository.findActiveByShop(shopId);
      notificationService.notifyQueueRecalculated(shopId, refreshedActive);
    } catch (e) {}

    try {
      const auditService = require('./auditService');
      const userRepository = require('../repositories/userRepository');
      const customer = await userRepository.findById(customerId);
      auditService.log({
        action: 'request_created',
        eventType: 'request',
        details: `${customer?.name || 'Customer'} submitted ${rushRequested ? '⚡ RUSH ' : ''}print request at ${shop.shopName} (₱${estimatedCost.toFixed(2)})`,
        actorId: customerId,
        actorName: customer?.name || 'Customer',
        actorRole: 'customer',
        targetId: request._id,
        targetName: doc.originalFilename,
        metadata: { cost: estimatedCost, shopName: shop.shopName, filename: doc.originalFilename, isRush: rushRequested, rushFee },
      });
    } catch (err) { }

    return request;
  },

  getOrderStatusHistory: async (requestId, userId, userRole) => {
    const request = await requestRepository.findById(requestId);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }

    if (userRole === 'customer' && request.customerId._id.toString() !== userId.toString()) {
      const error = new Error('Access denied.');
      error.statusCode = 403;
      throw error;
    }

    if (userRole === 'shop_owner') {
      const shop = await shopRepository.findByOwnerId(userId);
      const reqShopId = request.shopId?._id ? request.shopId._id.toString() : request.shopId?.toString();
      if (!shop || reqShopId !== shop._id.toString()) {
        const error = new Error('Access denied. You can only view orders placed with your own shop.');
        error.statusCode = 403;
        throw error;
      }
    }

    let history = await OrderStatusHistory.find({ orderId: requestId }).sort({ createdAt: 1 }).lean();

    if (!history || history.length === 0) {
      history = [];
      const shopName = request.shopId?.shopName || 'Shop';
      if (request.submittedAt || request.createdAt) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'submitted',
          message: `Order submitted to ${shopName}`,
          createdAt: request.submittedAt || request.createdAt,
          created_at: request.submittedAt || request.createdAt,
        });
      }
      if (request.acceptedAt) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'accepted',
          message: `Order accepted by ${shopName}`,
          createdAt: request.acceptedAt,
          created_at: request.acceptedAt,
        });
      }
      if (request.queuedAt) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'queued',
          message: `Order placed in queue at ${shopName}`,
          createdAt: request.queuedAt,
          created_at: request.queuedAt,
        });
      }
      if (request.printingStartedAt) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'printing',
          message: `Printing in progress at ${shopName}`,
          createdAt: request.printingStartedAt,
          created_at: request.printingStartedAt,
        });
      }
      if (request.readyAt) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'ready',
          message: `Documents ready for pickup at ${shopName}`,
          createdAt: request.readyAt,
          created_at: request.readyAt,
        });
      }
      if (request.pickedUpAt) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'picked_up',
          message: `Documents picked up by customer`,
          createdAt: request.pickedUpAt,
          created_at: request.pickedUpAt,
        });
      }
      if (request.completedAt) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'completed',
          message: `Order completed and finalized`,
          createdAt: request.completedAt,
          created_at: request.completedAt,
        });
      }
      if (request.rejectedAt || (request.status === 'rejected' && request.updatedAt)) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'rejected',
          message: request.rejectionReason ? `Order declined: ${request.rejectionReason}` : `Order declined by ${shopName}`,
          createdAt: request.rejectedAt || request.updatedAt,
          created_at: request.rejectedAt || request.updatedAt,
        });
      }
      if (request.cancelledAt || (request.status === 'cancelled' && request.updatedAt)) {
        history.push({
          orderId: request._id,
          order_id: request._id,
          status: 'cancelled',
          message: request.cancellationReason ? `Order cancelled: ${request.cancellationReason}` : 'Order cancelled',
          createdAt: request.cancelledAt || request.updatedAt,
          created_at: request.cancelledAt || request.updatedAt,
        });
      }
    }

    return history;
  },

  getRequestById: async (requestId, userId, userRole) => {
    const request = await requestRepository.findById(requestId);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }

    if (userRole === 'customer' && request.customerId._id.toString() !== userId.toString()) {
      const error = new Error('Access denied.');
      error.statusCode = 403;
      throw error;
    }

    if (userRole === 'shop_owner') {
      const shop = await shopRepository.findByOwnerId(userId);
      const reqShopId = request.shopId?._id ? request.shopId._id.toString() : request.shopId?.toString();
      if (!shop || reqShopId !== shop._id.toString()) {
        const error = new Error('Access denied. You can only view orders placed with your own shop.');
        error.statusCode = 403;
        throw error;
      }
    }

    const history = await requestService.getOrderStatusHistory(requestId, userId, userRole);
    const reqObj = request.toObject ? request.toObject() : JSON.parse(JSON.stringify(request));
    reqObj.statusHistory = history;

    return reqObj;
  },

  getCustomerRequests: async (customerId, filter, options) => {
    return requestRepository.findByCustomer(customerId, filter, options);
  },

  getShopRequests: async (shopId, ownerId, filter, options) => {
    const shop = await shopRepository.findById(shopId);
    const shopOwnerId = shop?.ownerId?._id ? shop.ownerId._id.toString() : shop?.ownerId?.toString();
    if (!shop || shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }
    return requestRepository.findByShop(shopId, filter, options);
  },

  updateStatus: async (requestId, ownerId, status, reason = '') => {
    const request = await requestRepository.findById(requestId);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }

    const shop = await shopRepository.findById(request.shopId);
    const shopOwnerId = shop?.ownerId?._id ? shop.ownerId._id.toString() : shop?.ownerId?.toString();
    if (!shop || shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }

    const targetStatus = status === 'declined' ? 'rejected' : status;

    // Prevent duplicate status transitions
    if (request.status === targetStatus) {
      return request;
    }

    const validTransitions = {
      pending: ['accepted', 'rejected', 'declined', 'cancelled'],
      submitted: ['accepted', 'rejected', 'declined', 'cancelled'],
      accepted: ['queued', 'on_hold', 'rejected', 'declined', 'cancelled'],
      queued: ['printing', 'on_hold', 'cancelled'],
      printing: ['ready', 'ready_for_pickup', 'on_hold', 'cancelled'],
      on_hold: ['accepted', 'queued', 'cancelled'],
      ready: ['picked_up', 'completed'],
      ready_for_pickup: ['picked_up', 'completed'],
      picked_up: ['completed'],
    };

    if (!validTransitions[request.status]?.includes(targetStatus) && !validTransitions[request.status]?.includes(status)) {
      const error = new Error(`Cannot transition from '${request.status}' to '${targetStatus}'.`);
      error.statusCode = 400;
      throw error;
    }

    // Prepaid enforcement: an order cannot be accepted without a submitted payment,
    // and cannot be printed until the shop owner has verified the GCash payment.
    if (targetStatus === 'accepted' && !['paid_verifying', 'verified'].includes(request.paymentStatus)) {
      const error = new Error('Cannot accept this order: the customer has not submitted a GCash payment.');
      error.statusCode = 400;
      throw error;
    }
    if (targetStatus === 'printing' && request.paymentStatus !== 'verified') {
      const error = new Error('Please verify the GCash payment before printing this order.');
      error.statusCode = 400;
      throw error;
    }

    const extra = {};
    if (targetStatus === 'rejected') extra.rejectionReason = reason;
    if (targetStatus === 'on_hold') {
      extra.onHoldReason = reason;
      extra.queuePosition = null;
    }
    if (targetStatus === 'accepted' || (request.status === 'on_hold' && targetStatus === 'queued')) {
      const activeRequests = await requestRepository.findActiveByShop(request.shopId);
      extra.queuePosition = activeRequests.length + 1;
      await shopRepository.incrementQueue(request.shopId);
    }
    if (['completed', 'rejected', 'cancelled'].includes(targetStatus)) {
      await shopRepository.decrementQueue(request.shopId);

      if (request.documentId) {
        await documentCleanupService.scheduleRetention(request.documentId, 24);
      }
    }

    if (targetStatus === 'completed') {
      const totalAmount = request.estimatedCost || request.pricingSnapshot?.calculatedCost || 0;
      const commissionRate = 0.03; // 3% Admin Commission
      extra.platformFee = Number((totalAmount * commissionRate).toFixed(2));
      extra.shopEarnings = Number((totalAmount - extra.platformFee).toFixed(2));
    }

    const updated = await requestRepository.updateStatus(requestId, targetStatus, extra);

    // Record in OrderStatusHistory (prevent duplicates for same order + status transition)
    try {
      const existingHistory = await OrderStatusHistory.findOne({ orderId: requestId, status: targetStatus });
      if (!existingHistory) {
        await OrderStatusHistory.create({
          orderId: requestId,
          order_id: requestId,
          status: targetStatus,
          message: getStatusMessage(targetStatus, shop.shopName, reason),
          changedBy: ownerId,
          changed_by: ownerId,
          createdAt: new Date(),
          created_at: new Date(),
        });
      }
    } catch (hErr) {
      console.warn('Failed to record order status history:', hErr.message);
    }

    await notificationService.notifyCustomerStatusChange(updated, targetStatus, reason);

    try {
      const refreshedActive = await requestRepository.findActiveByShop(request.shopId);
      refreshedActive.sort((a, b) => {
        if (a.status === 'printing' && b.status !== 'printing') return -1;
        if (b.status === 'printing' && a.status !== 'printing') return 1;
        if (a.isRush && !b.isRush) return -1;
        if (!a.isRush && b.isRush) return 1;
        const timeA = new Date(a.acceptedAt || a.submittedAt || a.createdAt).getTime();
        const timeB = new Date(b.acceptedAt || b.submittedAt || b.createdAt).getTime();
        return timeA - timeB;
      });

      for (let i = 0; i < refreshedActive.length; i++) {
        const expectedPos = i + 1;
        if (refreshedActive[i].queuePosition !== expectedPos) {
          refreshedActive[i].queuePosition = expectedPos;
          await requestRepository.updateQueuePosition(refreshedActive[i]._id, expectedPos);
        }
      }

      notificationService.notifyQueueRecalculated(request.shopId, refreshedActive);
    } catch (err) {
      console.warn('Error updating dynamic queue positions:', err.message);
    }

    try {
      const auditService = require('./auditService');
      const eventTypeMap = {
        accepted: 'verify',
        queued: 'queue',
        printing: 'request',
        ready: 'request',
        ready_for_pickup: 'request',
        picked_up: 'order',
        completed: 'order',
        rejected: 'verify',
        cancelled: 'order',
      };
      auditService.log({
        action: `order_${status}`,
        eventType: eventTypeMap[status] || 'order',
        details: `Order #${requestId.toString().slice(-6).toUpperCase()} at ${shop.shopName} updated to ${status.toUpperCase()}`,
        actorId: ownerId,
        actorName: shop.shopName,
        actorRole: 'shop_owner',
        targetId: requestId,
        targetName: shop.shopName,
        metadata: { status, reason },
      });
    } catch (err) { }

    return updated;
  },

  cancelRequest: async (requestId, customerId, reason = '') => {
    const request = await requestRepository.findById(requestId);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }
    if (request.customerId._id.toString() !== customerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }
    const cancellableStatuses = ['pending', 'submitted', 'accepted', 'queued', 'on_hold'];
    if (!cancellableStatuses.includes(request.status)) {
      const error = new Error('Cannot cancel a request that is already printing or completed.');
      error.statusCode = 400;
      throw error;
    }

    const updated = await requestRepository.updateStatus(requestId, 'cancelled', { cancellationReason: reason });
    await shopRepository.decrementQueue(request.shopId);

    // Record in OrderStatusHistory
    try {
      const existingHistory = await OrderStatusHistory.findOne({ orderId: requestId, status: 'cancelled' });
      if (!existingHistory) {
        await OrderStatusHistory.create({
          orderId: requestId,
          order_id: requestId,
          status: 'cancelled',
          message: reason ? `Order cancelled: ${reason}` : 'Order cancelled by customer',
          changedBy: customerId,
          changed_by: customerId,
          createdAt: new Date(),
          created_at: new Date(),
        });
      }
    } catch (hErr) {
      console.warn('Failed to record cancellation status history:', hErr.message);
    }

    if (request.documentId) {
      await documentCleanupService.scheduleRetention(request.documentId, 24);
    }

    await notificationService.notifyShopCancellation(updated);

    try {
      const refreshedActive = await requestRepository.findActiveByShop(request.shopId);
      refreshedActive.sort((a, b) => {
        if (a.status === 'printing' && b.status !== 'printing') return -1;
        if (b.status === 'printing' && a.status !== 'printing') return 1;
        if (a.isRush && !b.isRush) return -1;
        if (!a.isRush && b.isRush) return 1;
        const timeA = new Date(a.acceptedAt || a.submittedAt || a.createdAt).getTime();
        const timeB = new Date(b.acceptedAt || b.submittedAt || b.createdAt).getTime();
        return timeA - timeB;
      });

      for (let i = 0; i < refreshedActive.length; i++) {
        const expectedPos = i + 1;
        if (refreshedActive[i].queuePosition !== expectedPos) {
          refreshedActive[i].queuePosition = expectedPos;
          await requestRepository.updateQueuePosition(refreshedActive[i]._id, expectedPos);
        }
      }

      notificationService.notifyQueueRecalculated(request.shopId, refreshedActive);
    } catch (err) {
      console.warn('Error recalculating queue after cancellation:', err.message);
    }

    try {
      const auditService = require('./auditService');
      auditService.log({
        action: 'order_cancelled',
        eventType: 'order',
        details: `Order #${requestId.toString().slice(-6).toUpperCase()} cancelled by customer`,
        actorId: customerId,
        actorName: request.customerId?.name || 'Customer',
        actorRole: 'customer',
        targetId: requestId,
        metadata: { reason },
      });
    } catch (err) { }

    return updated;
  },

  getActiveQueue: async (shopId) => {
    return requestRepository.findActiveByShop(shopId);
  },

  submitReview: async (requestId, customerId, { rating, printQuality = 5, speedRating = 5, comment = '', tags = [], isAnonymous = false }) => {
    const request = await requestRepository.findById(requestId);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }
    if (request.customerId._id.toString() !== customerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }
    if (request.status !== 'completed') {
      const error = new Error('You can only review completed orders.');
      error.statusCode = 400;
      throw error;
    }
    if (request.review?.rating) {
      const error = new Error('You have already submitted a review for this order.');
      error.statusCode = 400;
      throw error;
    }

    const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const numericQuality = Math.min(5, Math.max(1, Number(printQuality) || 5));
    const numericSpeed = Math.min(5, Math.max(1, Number(speedRating) || 5));
    const cleanTags = Array.isArray(tags) ? tags.filter(Boolean) : [];
    const anon = Boolean(isAnonymous);

    request.review = {
      rating: numericRating,
      printQuality: numericQuality,
      speedRating: numericSpeed,
      tags: cleanTags,
      isAnonymous: anon,
      comment: (comment || '').trim(),
      reviewedAt: new Date(),
    };
    await request.save();

    try {
      const shop = await shopRepository.findById(request.shopId._id || request.shopId);
      if (shop) {
        const stats = await shopRepository.recalculateRatings(shop._id);
        shop.rating = stats.avgRating;
        shop.reviewsCount = stats.totalReviews;

        if (!shop.recentReviews) shop.recentReviews = [];
        shop.recentReviews.unshift({
          customerName: anon ? 'Anonymous Student' : (request.customerId?.name || 'Customer'),
          isAnonymous: anon,
          rating: numericRating,
          printQuality: numericQuality,
          speedRating: numericSpeed,
          tags: cleanTags,
          comment: (comment || '').trim(),
          createdAt: new Date(),
        });
        if (shop.recentReviews.length > 30) {
          shop.recentReviews = shop.recentReviews.slice(0, 30);
        }
        await shop.save();

        const { getIO } = require('../sockets/socketManager');
        getIO().emit('shop:rated', {
          shopId: shop._id,
          rating: stats.avgRating,
          reviewsCount: stats.totalReviews,
        });
      }
    } catch (err) {
      console.error('Error updating shop review stats:', err);
      // Rollback request.review to prevent database desynchronization
      request.review = undefined;
      await request.save();
      throw err;
    }

    return request;
  },

  addShopNote: async (requestId, ownerId, { category = 'custom', message, delayMinutes = 0 }) => {
    if (!message || !message.trim()) {
      const error = new Error('Message is required.');
      error.statusCode = 400;
      throw error;
    }

    const request = await requestRepository.findById(requestId);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }

    const shop = await shopRepository.findById(request.shopId._id || request.shopId);
    const shopOwnerId = shop?.ownerId?._id ? shop.ownerId._id.toString() : shop?.ownerId?.toString();
    if (!shop || shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized. You do not own this print shop.');
      error.statusCode = 403;
      throw error;
    }

    const newNote = {
      category: category || 'custom',
      message: message.trim(),
      authorName: shop.shopName || 'Shop Owner',
      createdAt: new Date(),
    };

    if (!request.shopNotes) request.shopNotes = [];
    request.shopNotes.push(newNote);

    const numDelay = Number(delayMinutes) || 0;
    if (category === 'power_outage' || numDelay > 0) {
      request.delayNotice = {
        isDelayed: true,
        reason: message.trim(),
        estimatedDelayMinutes: numDelay,
        reportedAt: new Date(),
      };
    }

    await request.save();

    await notificationService.notifyCustomerShopNote(request, newNote, shop.shopName);

    try {
      const auditService = require('./auditService');
      auditService.log({
        action: 'order_shop_note',
        eventType: 'request',
        details: `Shop note [${category}] added to Order #${request._id.toString().slice(-6).toUpperCase()}: "${message.trim().slice(0, 60)}"`,
        actorId: ownerId,
        actorName: shop.shopName,
        actorRole: 'shop_owner',
        targetId: request._id,
        targetName: shop.shopName,
        metadata: { category, delayMinutes: numDelay },
      });
    } catch (err) { }

    return request;
  },

  broadcastShopDelay: async (shopId, ownerId, { reason = 'Power interruption in Naval. Expect printing delays.', estimatedDelayMinutes = 30 }) => {
    const shop = await shopRepository.findById(shopId);
    const shopOwnerId = shop?.ownerId?._id ? shop.ownerId._id.toString() : shop?.ownerId?.toString();
    if (!shop || shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized. You do not own this print shop.');
      error.statusCode = 403;
      throw error;
    }

    const activeRequests = await PrintingRequest.find({
      shopId,
      status: { $in: ['pending', 'accepted', 'queued', 'printing'] },
    }).populate('customerId', 'name email contactNumber');

    const numDelay = Number(estimatedDelayMinutes) || 30;
    const cleanReason = (reason && reason.trim()) || 'Electrical interruption in Naval (BILECO). Expect printing delays until power is restored.';

    for (const req of activeRequests) {
      req.delayNotice = {
        isDelayed: true,
        reason: cleanReason,
        estimatedDelayMinutes: numDelay,
        reportedAt: new Date(),
      };
      if (!req.shopNotes) req.shopNotes = [];
      const note = {
        category: 'power_outage',
        message: cleanReason,
        authorName: shop.shopName,
        createdAt: new Date(),
      };
      req.shopNotes.push(note);
      await req.save();

      await notificationService.notifyCustomerDelayAlert(req, cleanReason, numDelay, shop.shopName);
    }

    try {
      const auditService = require('./auditService');
      auditService.log({
        action: 'broadcast_delay',
        eventType: 'system',
        details: `Broadcasted power outage delay alert to ${activeRequests.length} active orders at ${shop.shopName}`,
        actorId: ownerId,
        actorName: shop.shopName,
        actorRole: 'shop_owner',
        targetId: shopId,
        targetName: shop.shopName,
        metadata: { affectedCount: activeRequests.length, reason: cleanReason, estimatedDelayMinutes: numDelay },
      });
    } catch (err) { }

    return {
      success: true,
      affectedCount: activeRequests.length,
      reason: cleanReason,
      estimatedDelayMinutes: numDelay,
    };
  },

  clearShopDelay: async (shopId, ownerId) => {
    const shop = await shopRepository.findById(shopId);
    const shopOwnerId = shop?.ownerId?._id ? shop.ownerId._id.toString() : shop?.ownerId?.toString();
    if (!shop || shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized. You do not own this print shop.');
      error.statusCode = 403;
      throw error;
    }

    const activeRequests = await PrintingRequest.find({
      shopId,
      'delayNotice.isDelayed': true,
      status: { $in: ['pending', 'accepted', 'queued', 'printing'] },
    }).populate('customerId', 'name email contactNumber');

    for (const req of activeRequests) {
      req.delayNotice = {
        isDelayed: false,
        reason: '',
        estimatedDelayMinutes: 0,
        reportedAt: null,
      };
      await req.save();
      await notificationService.notifyCustomerDelayCleared(req, shop.shopName);
    }

    return {
      success: true,
      clearedCount: activeRequests.length,
    };
  },

  attachPaymentProof: async (requestId, customerId, { paymentProofUrl, paymentRefNumber }) => {
    const request = await PrintingRequest.findById(requestId);
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }
    if (request.customerId.toString() !== customerId.toString()) {
      const error = new Error('Unauthorized to modify this request.');
      error.statusCode = 403;
      throw error;
    }

    if (paymentProofUrl) {
      request.paymentProofUrl = paymentProofUrl;
      const fs = require('fs');
      const path = require('path');
      const cleanFilename = path.basename(paymentProofUrl.split('?')[0]);
      const filePath = path.join(__dirname, '../../uploads', cleanFilename);
      if (fs.existsSync(filePath)) {
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const ext = path.extname(cleanFilename).toLowerCase();
          const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
          };
          const mime = mimeTypes[ext] || 'image/jpeg';
          request.paymentProofData = `data:${mime};base64,${fileBuffer.toString('base64')}`;
        } catch (e) {
          console.warn('Could not cache payment proof buffer for persistent backup:', e.message);
        }
      }
    }
    if (paymentRefNumber) request.paymentRefNumber = paymentRefNumber;
    request.paymentStatus = 'paid_verifying';
    await request.save();

    try {
      const { getIO } = require('../sockets/socketManager');
      const io = getIO();
      if (io) {
        io.to(`shop_${request.shopId.toString()}`).emit('request:status_changed', {
          requestId: request._id,
          status: request.status,
        });
      }
    } catch (err) {
      console.warn('Failed to emit payment proof attached event:', err.message);
    }

    return request;
  },

  verifyPayment: async (requestId, userId, userRole, paymentStatus = 'verified') => {
    const request = await PrintingRequest.findById(requestId).populate('shopId');
    if (!request) {
      const error = new Error('Request not found.');
      error.statusCode = 404;
      throw error;
    }

    if (userRole === 'shop_owner' && request.shopId.ownerId?.toString() !== userId.toString()) {
      const error = new Error('Unauthorized. You do not own this shop.');
      error.statusCode = 403;
      throw error;
    }

    request.paymentStatus = paymentStatus;
    await request.save();

    try {
      const { getIO } = require('../sockets/socketManager');
      const io = getIO();
      if (io) {
        io.to(`request_${requestId}`).emit('payment_status_updated', {
          requestId,
          paymentStatus,
        });
      }
    } catch (sockErr) {
      console.warn('Socket notification error on payment verify:', sockErr.message);
    }

    return request;
  },
};

module.exports = requestService;
