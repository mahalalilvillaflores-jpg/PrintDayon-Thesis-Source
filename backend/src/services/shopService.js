const shopRepository = require('../repositories/shopRepository');
const requestRepository = require('../repositories/requestRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const { getQueueStats } = require('../algorithms/queueOptimizer');
const { getEffectiveShopStatus, getNextScheduledOpening } = require('../utils/shopHelper');
const { normalizeStorefrontPhoto } = require('../utils/photoHelper');

function enrichShopWithEffectiveStatus(sObj) {
  const effective = getEffectiveShopStatus(sObj);
  const walkInCount = Math.max(0, Number(sObj.walkInCustomerCount) || 0);
  const validLevels = ['normal', 'moderate', 'packed'];
  const effectiveTrafficLevel = validLevels.includes(sObj.walkInTrafficLevel)
    ? sObj.walkInTrafficLevel
    : (walkInCount > 8 ? 'packed' : (walkInCount > 3 ? 'moderate' : 'normal'));
  const cleanPhotoUrl = normalizeStorefrontPhoto(sObj);
  return {
    ...sObj,
    storefrontPhotoUrl: cleanPhotoUrl,
    photoUrl: cleanPhotoUrl,
    walkInCustomerCount: walkInCount,
    walkInTrafficLevel: effectiveTrafficLevel,
    operationalCondition: sObj.operationalCondition || 'normal',
    operationalMessage: sObj.operationalMessage || '',
    operationalDelayMinutes: Math.max(0, Number(sObj.operationalDelayMinutes) || 0),
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
}

function formatBusinessDocuments(shop) {
  let docs = (shop.businessDocuments || []).map((d) => (d.toObject ? d.toObject() : d));
  const hasDti = docs.some((d) => d.type === 'dti');
  const hasPermit = docs.some((d) => d.type === 'mayors_permit');

  if (!hasDti) {
    docs.push({
      type: 'dti',
      title: 'DTI Business Name Registration',
      docNumber: shop.dtiNumber || '',
      currentFile: {
        docNumber: shop.dtiNumber || '',
        fileName: shop.dtiDocName || (shop.dtiDocUrl ? 'DTI_Registration_Cert.pdf' : ''),
        fileUrl: shop.dtiDocUrl || '',
        fileType: 'application/pdf',
        fileSize: 0,
        uploadedAt: shop.createdAt || new Date(),
        expiresAt: null,
        status: shop.verificationStatus === 'verified' ? 'verified' : 'pending',
        verifiedAt: shop.verificationStatus === 'verified' ? shop.updatedAt : null,
        rejectionReason: '',
      },
      history: [],
    });
  }

  if (!hasPermit) {
    const defaultYear = new Date().getFullYear();
    const defaultPermitExpiry = new Date(defaultYear, 11, 31, 23, 59, 59);
    docs.push({
      type: 'mayors_permit',
      title: "Mayor's Permit",
      docNumber: shop.mayorsPermitNumber || '',
      currentFile: {
        docNumber: shop.mayorsPermitNumber || '',
        fileName: shop.permitDocName || (shop.permitDocUrl ? 'Mayors_Business_Permit_2026.pdf' : ''),
        fileUrl: shop.permitDocUrl || '',
        fileType: 'application/pdf',
        fileSize: 0,
        uploadedAt: shop.createdAt || new Date(),
        expiresAt: defaultPermitExpiry,
        status: shop.verificationStatus === 'verified' ? 'verified' : 'pending',
        verifiedAt: shop.verificationStatus === 'verified' ? shop.updatedAt : null,
        rejectionReason: '',
      },
      history: [],
    });
  }

  return docs;
}

function saveBase64Upload(base64Data, prefix = 'doc') {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.startsWith('data:')) {
    return base64Data;
  }
  try {
    const fs = require('fs');
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Data;
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    let ext = 'jpg';
    if (mimeType.includes('pdf')) ext = 'pdf';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';

    const filename = `${prefix}_${uuidv4()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/${filename}`;
  } catch (err) {
    console.warn(`Failed to convert Base64 ${prefix} to file:`, err);
    return base64Data;
  }
}

const shopService = {
  createShop: async (ownerId, data) => {
    const existing = await shopRepository.findByOwnerId(ownerId);
    if (existing) {
      const error = new Error('You already have a registered printing shop.');
      error.statusCode = 409;
      throw error;
    }

    if (data.contactNumber) {
      const cleanPhone = String(data.contactNumber).trim().replace(/\D/g, '');
      if (!/^09\d{9}$/.test(cleanPhone)) {
        const error = new Error('Cellphone number must be a valid 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
        error.statusCode = 400;
        throw error;
      }
      data.contactNumber = cleanPhone;
    }

    let persistentPhotoData = '';
    // Convert any Base64 uploaded files into stored files so MongoDB storage is conserved
    if (data.storefrontPhotoUrl && data.storefrontPhotoUrl.startsWith('data:')) {
      persistentPhotoData = data.storefrontPhotoUrl;
      data.storefrontPhotoUrl = saveBase64Upload(data.storefrontPhotoUrl, 'storefront');
    }
    if (data.dtiDocUrl && data.dtiDocUrl.startsWith('data:')) {
      data.dtiDocUrl = saveBase64Upload(data.dtiDocUrl, 'dti');
    }
    if (data.permitDocUrl && data.permitDocUrl.startsWith('data:')) {
      data.permitDocUrl = saveBase64Upload(data.permitDocUrl, 'permit');
    }

    const numLat = Number(data.latitude) || 11.5636;
    const numLng = Number(data.longitude) || 124.3985;
    const { nodeCoordinates } = require('../config/navalGraph');
    const { findNearestNode } = require('../algorithms/dijkstra');
    const nearestNode = findNearestNode(nodeCoordinates, numLat, numLng);

    const shop = await shopRepository.create({
      ownerId,
      ...data,
      latitude: numLat,
      longitude: numLng,
      graphNodeId: data.graphNodeId || nearestNode || 'N021',
      storefrontPhotoData: persistentPhotoData || undefined,
      location: {
        type: 'Point',
        coordinates: [numLng, numLat],
      },
      verificationStatus: 'pending',
      status: 'closed',
    });

    try {
      const auditService = require('./auditService');
      auditService.log({
        action: 'shop_registered',
        eventType: 'shop',
        details: `Shop registration submitted: ${data.shopName} (${data.address})`,
        actorId: ownerId,
      });
    } catch (err) {}

    return shop;
  },

  getShopById: async (shopId, requestingUser = null) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Printing shop not found.');
      error.statusCode = 404;
      throw error;
    }

    const activeRequests = await requestRepository.findActiveByShop(shopId);
    const queueStats = getQueueStats(activeRequests, shop.pricing, shop.walkInTrafficLevel, shop.walkInCustomerCount, shop.operationalDelayMinutes);
    const sObj = shop.toObject ? shop.toObject() : shop;
    const enriched = enrichShopWithEffectiveStatus(sObj);

    const isOwnerOrAdmin = requestingUser && (
      requestingUser.role === 'admin' ||
      shop.ownerId?._id?.toString() === requestingUser._id?.toString() ||
      shop.ownerId?.toString() === requestingUser._id?.toString()
    );

    return {
      ...enriched,
      businessDocuments: isOwnerOrAdmin ? formatBusinessDocuments(sObj) : undefined,
      queueStats,
      activeQueue: isOwnerOrAdmin ? activeRequests : undefined,
      rating: Number(sObj.rating || 0),
      reviewsCount: Number(sObj.reviewsCount || 0),
    };
  },

  getMyShop: async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) {
      const error = new Error('No shop found for this owner.');
      error.statusCode = 404;
      error.requiresOnboarding = true;
      throw error;
    }
    const activeRequests = await requestRepository.findActiveByShop(shop._id);
    const queueStats = getQueueStats(activeRequests, shop.pricing, shop.walkInTrafficLevel, shop.walkInCustomerCount, shop.operationalDelayMinutes);
    const sObj = shop.toObject ? shop.toObject() : shop;
    const enriched = enrichShopWithEffectiveStatus(sObj);

    return {
      ...enriched,
      businessDocuments: formatBusinessDocuments(sObj),
      queueStats,
      activeQueue: activeRequests,
      rating: Number(sObj.rating || 0),
      reviewsCount: Number(sObj.reviewsCount || 0),
    };
  },

  getAllShops: async (filter = {}, options = {}, requestingUser = null) => {
    const queryFilter = { ...filter };
    const isPrivileged = requestingUser && requestingUser.role === 'admin';
    if (!isPrivileged && !queryFilter.verificationStatus) {
      queryFilter.verificationStatus = 'verified';
    }
    const result = await shopRepository.findAll(queryFilter, options);
    const formattedShops = result.shops.map((shop) => {
      const sObj = shop.toObject ? shop.toObject() : shop;
      const enriched = enrichShopWithEffectiveStatus(sObj);
      return {
        ...enriched,
        businessDocuments: isPrivileged ? formatBusinessDocuments(sObj) : undefined,
        rating: Number(sObj.rating || 0),
        reviewsCount: Number(sObj.reviewsCount || 0),
      };
    });

    const finalShops = filter.status === 'open'
      ? formattedShops.filter((s) => s.isOpen)
      : formattedShops;

    return {
      ...result,
      shops: finalShops,
      total: filter.status === 'open' ? finalShops.length : result.total,
      currentlyOpenCount: formattedShops.filter((s) => s.isOpen).length,
    };
  },

  getNearbyShops: async (lat, lng, radius = 5000) => {
    const shops = await shopRepository.findNearby(lng, lat, radius);
    const shopIds = shops.map((s) => s._id);
    const activeMap = await requestRepository.findAllActive(shopIds);

    return shops.map((shop) => {
      const sObj = shop.toObject ? shop.toObject() : shop;
      const activeRequests = activeMap[shop._id.toString()] || [];
      const queueStats = getQueueStats(activeRequests, shop.pricing, shop.walkInTrafficLevel, shop.walkInCustomerCount, shop.operationalDelayMinutes);
      const { isOpen, isWithinHours, status: effectiveStatus, unavailableReason } = getEffectiveShopStatus(sObj);
      return {
        ...sObj,
        queueStats,
        isOpen,
        isWithinHours,
        status: effectiveStatus,
        unavailableReason,
        rating: Number(sObj.rating || 0),
        reviewsCount: Number(sObj.reviewsCount || 0),
      };
    });
  },

  updateShop: async (shopId, ownerId, data) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }
    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized to update this shop.');
      error.statusCode = 403;
      throw error;
    }

    const updateData = { ...data };
    if (data.storefrontPhotoUrl && data.storefrontPhotoUrl.startsWith('data:')) {
      updateData.storefrontPhotoData = data.storefrontPhotoUrl;
      updateData.storefrontPhotoUrl = saveBase64Upload(data.storefrontPhotoUrl, 'storefront');
    }
    if (data.contactNumber !== undefined) {
      const cleanPhone = String(data.contactNumber).trim().replace(/\D/g, '');
      if (cleanPhone && !/^09\d{9}$/.test(cleanPhone)) {
        const error = new Error('Cellphone number must be a valid 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
        error.statusCode = 400;
        throw error;
      }
      updateData.contactNumber = cleanPhone;
    }

    if (data.latitude !== undefined && data.longitude !== undefined) {
      const numLat = Number(data.latitude);
      const numLng = Number(data.longitude);
      if (!isNaN(numLat) && !isNaN(numLng) && numLat > 0 && numLng > 0) {
        updateData.latitude = numLat;
        updateData.longitude = numLng;
        updateData.location = {
          type: 'Point',
          coordinates: [numLng, numLat],
        };
        const { nodeCoordinates } = require('../config/navalGraph');
        const { findNearestNode } = require('../algorithms/dijkstra');
        const nearest = findNearestNode(nodeCoordinates, numLat, numLng);
        if (nearest) {
          updateData.graphNodeId = nearest;
        }
      }
    }

    const updated = await shopRepository.update(shopId, updateData);

    try {
      const { getIO, emitAdminStatsUpdate } = require('../sockets/socketManager');
      getIO().emit('shop:updated', {
        shopId: (updated._id || shopId).toString(),
        shop: updated,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {}

    return updated;
  },

  updateStatus: async (shopId, ownerId, status) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }
    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }
    if (shop.verificationStatus === 'suspended' || shop.verificationStatus === 'restricted') {
      const error = new Error('This shop is suspended or restricted by platform administration and cannot change operational status.');
      error.statusCode = 403;
      throw error;
    }
    const updatedShop = await shopRepository.updateStatus(shopId, status);

    try {
      const auditService = require('./auditService');
      auditService.log({
        action: 'shop_status_changed',
        eventType: 'shop',
        details: `Shop "${shop.shopName}" status updated to ${status.toUpperCase()}`,
        actorId: ownerId,
        actorName: shop.shopName,
        actorRole: 'shop_owner',
        targetId: shop._id,
        targetName: shop.shopName,
        metadata: { status },
      });
    } catch (err) {}

    try {
      const { getIO, emitAdminStatsUpdate } = require('../sockets/socketManager');
      const payload = {
        shopId: (updatedShop?._id || shopId).toString(),
        status,
        updatedShop,
      };
      getIO().emit('shop:status_changed', payload);
      getIO().emit('shop:status', payload);
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {}

    return updatedShop;
  },

  verifyShop: async (shopId, verificationStatus, adminId) => {
    return shopRepository.updateVerification(shopId, verificationStatus);
  },

  updatePrinters: async (shopId, ownerId, printers) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }
    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }
    shop.printers = printers;
    await shop.save();
    return shop;
  },

  updateWalkInTraffic: async (shopId, ownerId, walkInTrafficLevel) => {
    const validLevels = ['normal', 'moderate', 'packed'];
    if (!validLevels.includes(walkInTrafficLevel)) {
      const error = new Error('Invalid walk-in traffic level. Must be normal, moderate, or packed.');
      error.statusCode = 400;
      throw error;
    }

    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }

    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized to update this shop.');
      error.statusCode = 403;
      throw error;
    }

    const updatedShop = await shopRepository.updateWalkInTraffic(shopId, walkInTrafficLevel);

    try {
      const { getIO } = require('../sockets/socketManager');
      let walkInWaitMinutes = 0;
      if (walkInTrafficLevel === 'moderate') walkInWaitMinutes = 10;
      else if (walkInTrafficLevel === 'packed') walkInWaitMinutes = 25;

      getIO().emit('shop:walk_in_traffic_changed', {
        shopId: updatedShop._id.toString(),
        walkInTrafficLevel,
        walkInWaitMinutes,
        updatedAt: updatedShop.walkInTrafficUpdatedAt,
      });
    } catch (err) {}

    return updatedShop;
  },

  updateWalkInCount: async (shopId, ownerId, count, walkInTrafficLevel) => {
    if (count === undefined || count === null || isNaN(count)) {
      const error = new Error('Walk-in customer count must be a non-negative integer.');
      error.statusCode = 400;
      throw error;
    }
    const numeric = Number(count);
    if (numeric < 0 || !Number.isInteger(numeric)) {
      const error = new Error('Walk-in customer count cannot be negative and must be a whole number.');
      error.statusCode = 400;
      throw error;
    }

    if (walkInTrafficLevel !== undefined && walkInTrafficLevel !== null && !['normal', 'moderate', 'packed'].includes(walkInTrafficLevel)) {
      const error = new Error('Invalid walk-in traffic level. Must be normal, moderate, or packed.');
      error.statusCode = 400;
      throw error;
    }

    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }
    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }

    const updatedShop = await shopRepository.updateWalkInCount(shopId, numeric, walkInTrafficLevel);

    try {
      const { getIO } = require('../sockets/socketManager');
      let walkInWaitMinutes = 0;
      if (updatedShop.walkInTrafficLevel === 'packed') walkInWaitMinutes = 25;
      else if (updatedShop.walkInTrafficLevel === 'moderate') walkInWaitMinutes = 10;
      else if (numeric > 8) walkInWaitMinutes = 25;
      else if (numeric > 3) walkInWaitMinutes = 10;

      getIO().emit('shop:walk_in_traffic_changed', {
        shopId: updatedShop._id.toString(),
        walkInCustomerCount: updatedShop.walkInCustomerCount,
        walkInTrafficLevel: updatedShop.walkInTrafficLevel,
        walkInWaitMinutes,
        updatedAt: updatedShop.walkInTrafficUpdatedAt,
      });
    } catch (err) {}

    return updatedShop;
  },

  updateOperationalStatus: async (shopId, ownerId, data) => {
    const validConditions = ['normal', 'high_walkin', 'power_interruption', 'equipment_problem', 'temporary_delay', 'service_delay', 'closed'];
    const condition = data.operationalCondition || data.condition || 'normal';
    if (!validConditions.includes(condition)) {
      const error = new Error('Invalid operational condition.');
      error.statusCode = 400;
      throw error;
    }

    const delay = Number(data.operationalDelayMinutes !== undefined ? data.operationalDelayMinutes : (data.delayMinutes !== undefined ? data.delayMinutes : 0));
    if (isNaN(delay) || delay < 0) {
      const error = new Error('Operational delay minutes cannot be negative.');
      error.statusCode = 400;
      throw error;
    }

    if (data.walkInCustomerCount !== undefined && data.walkInCustomerCount !== null) {
      const countVal = Number(data.walkInCustomerCount);
      if (isNaN(countVal) || countVal < 0 || !Number.isInteger(countVal)) {
        const error = new Error('Walk-in customer count cannot be negative and must be a whole number.');
        error.statusCode = 400;
        throw error;
      }
    }

    if (data.walkInTrafficLevel !== undefined && data.walkInTrafficLevel !== null && !['normal', 'moderate', 'packed'].includes(data.walkInTrafficLevel)) {
      const error = new Error('Invalid walk-in traffic level. Must be normal, moderate, or packed.');
      error.statusCode = 400;
      throw error;
    }

    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }
    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }

    const updatedShop = await shopRepository.updateOperationalStatus(shopId, data);

    try {
      const { getIO } = require('../sockets/socketManager');
      const effective = getEffectiveShopStatus(updatedShop);
      getIO().emit('shop:status_updated', {
        shopId: updatedShop._id.toString(),
        operationalCondition: updatedShop.operationalCondition,
        operationalMessage: updatedShop.operationalMessage,
        operationalDelayMinutes: updatedShop.operationalDelayMinutes,
        status: effective.status,
        isOpen: effective.isOpen,
        isManualClosure: effective.isManualClosure,
        statusSource: effective.statusSource,
        temporaryClosure: updatedShop.temporaryClosure,
        walkInCustomerCount: updatedShop.walkInCustomerCount,
        walkInTrafficLevel: updatedShop.walkInTrafficLevel,
        updatedAt: updatedShop.operationalUpdatedAt,
      });
    } catch (err) {}

    if (data.operationalCondition === 'delay' || (Number(data.operationalDelayMinutes) > 0) || (Number(data.delayMinutes) > 0)) {
      notificationService.notifyShopDelayToActiveCustomers(
        updatedShop,
        Number(data.operationalDelayMinutes || data.delayMinutes) || 0,
        data.operationalMessage || data.message || ''
      ).catch(() => {});
    }

    return updatedShop;
  },

  setTemporaryClosure: async (shopId, ownerId, data) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }
    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }

    let reopenAt = null;
    if (data.reopenType === 'specific_time' && data.reopenAt) {
      reopenAt = new Date(data.reopenAt);
    } else {
      // Default to next scheduled opening
      const next = getNextScheduledOpening(shop.operatingHours);
      if (next?.date) {
        reopenAt = next.date;
      }
    }

    const updatedShop = await shopRepository.setTemporaryClosure(shopId, {
      ...data,
      reopenAt,
    });

    try {
      const { getIO } = require('../sockets/socketManager');
      const effective = getEffectiveShopStatus(updatedShop);
      getIO().emit('shop:status_updated', {
        shopId: updatedShop._id.toString(),
        operationalCondition: updatedShop.operationalCondition,
        operationalMessage: updatedShop.operationalMessage,
        operationalDelayMinutes: updatedShop.operationalDelayMinutes,
        status: effective.status,
        isOpen: effective.isOpen,
        isManualClosure: effective.isManualClosure,
        statusSource: effective.statusSource,
        temporaryClosure: updatedShop.temporaryClosure,
        closureReason: effective.closureReason,
        closureReasonLabel: effective.closureReasonLabel,
        advisoryMessage: effective.advisoryMessage,
        reopenAt: effective.reopenAt,
        reopenFormatted: effective.reopenFormatted,
        nextOpening: effective.nextOpening,
        walkInCustomerCount: updatedShop.walkInCustomerCount,
        updatedAt: updatedShop.operationalUpdatedAt,
      });

      notificationService.notifyShopClosureToActiveCustomers(
        updatedShop,
        effective.closureReasonLabel,
        effective.advisoryMessage
      ).catch(() => {});
    } catch (err) {}

    return updatedShop;
  },

  reopenShop: async (shopId, ownerId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }
    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (shopOwnerId !== ownerId.toString()) {
      const error = new Error('Unauthorized.');
      error.statusCode = 403;
      throw error;
    }
    if (shop.verificationStatus === 'suspended' || shop.verificationStatus === 'restricted') {
      const error = new Error('This shop is suspended by platform administration and cannot be reopened.');
      error.statusCode = 403;
      throw error;
    }

    const updatedShop = await shopRepository.reopenShop(shopId);

    try {
      const { getIO } = require('../sockets/socketManager');
      const effective = getEffectiveShopStatus(updatedShop);
      getIO().emit('shop:status_updated', {
        shopId: updatedShop._id.toString(),
        operationalCondition: updatedShop.operationalCondition,
        operationalMessage: updatedShop.operationalMessage,
        operationalDelayMinutes: updatedShop.operationalDelayMinutes,
        status: effective.status,
        isOpen: effective.isOpen,
        isManualClosure: effective.isManualClosure,
        statusSource: effective.statusSource,
        temporaryClosure: updatedShop.temporaryClosure,
        walkInCustomerCount: updatedShop.walkInCustomerCount,
        updatedAt: updatedShop.operationalUpdatedAt,
      });
    } catch (err) {}

    return updatedShop;
  },

  replaceBusinessDocument: async (ownerId, docType, file, body = {}) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) {
      const error = new Error('No shop found for this owner.');
      error.statusCode = 404;
      throw error;
    }

    if (!['dti', 'mayors_permit'].includes(docType)) {
      const error = new Error('Invalid document type. Must be dti or mayors_permit.');
      error.statusCode = 400;
      throw error;
    }

    if (!file) {
      const error = new Error('Document file is required.');
      error.statusCode = 400;
      throw error;
    }

    if (!shop.businessDocuments) {
      shop.businessDocuments = [];
    }

    let docIndex = shop.businessDocuments.findIndex((d) => d.type === docType);
    let doc;
    if (docIndex === -1) {
      const title = docType === 'dti' ? 'DTI Business Name Registration' : "Mayor's Permit";
      doc = {
        type: docType,
        title,
        docNumber: body.docNumber || (docType === 'dti' ? shop.dtiNumber : shop.mayorsPermitNumber) || '',
        currentFile: {
          docNumber: body.docNumber || (docType === 'dti' ? shop.dtiNumber : shop.mayorsPermitNumber) || '',
          fileName: (docType === 'dti' ? shop.dtiDocName : shop.permitDocName) || '',
          fileUrl: (docType === 'dti' ? shop.dtiDocUrl : shop.permitDocUrl) || '',
          fileType: 'application/pdf',
          fileSize: 0,
          uploadedAt: shop.createdAt || new Date(),
          expiresAt: null,
          status: shop.verificationStatus === 'verified' ? 'verified' : 'pending',
          verifiedAt: shop.verificationStatus === 'verified' ? shop.updatedAt : null,
          rejectionReason: '',
        },
        history: [],
      };
      shop.businessDocuments.push(doc);
      docIndex = shop.businessDocuments.length - 1;
    }

    const currentDoc = shop.businessDocuments[docIndex];

    // Archive current document into history if file exists
    if (currentDoc.currentFile && currentDoc.currentFile.fileUrl) {
      currentDoc.history.unshift({
        docNumber: currentDoc.currentFile.docNumber || currentDoc.docNumber || '',
        fileName: currentDoc.currentFile.fileName || 'Previous_Document',
        fileUrl: currentDoc.currentFile.fileUrl,
        fileType: currentDoc.currentFile.fileType || 'application/pdf',
        fileSize: currentDoc.currentFile.fileSize || 0,
        uploadedAt: currentDoc.currentFile.uploadedAt || new Date(),
        expiresAt: currentDoc.currentFile.expiresAt || null,
        status: currentDoc.currentFile.status || 'verified',
        verifiedAt: currentDoc.currentFile.verifiedAt || null,
        verifiedBy: currentDoc.currentFile.verifiedBy || null,
        rejectionReason: currentDoc.currentFile.rejectionReason || '',
      });
    }

    const newDocNumber = body.docNumber || currentDoc.docNumber || '';
    const newExpiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    currentDoc.docNumber = newDocNumber;
    currentDoc.currentFile = {
      docNumber: newDocNumber,
      fileName: file.originalname,
      fileUrl: `/uploads/${file.filename}`,
      fileType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date(),
      expiresAt: newExpiresAt,
      status: 'pending',
      verifiedAt: null,
      verifiedBy: null,
      rejectionReason: '',
    };

    // Update legacy fields for 100% backward compatibility
    if (docType === 'dti') {
      shop.dtiNumber = newDocNumber;
      shop.dtiDocName = file.originalname;
      shop.dtiDocUrl = `/uploads/${file.filename}`;
    } else if (docType === 'mayors_permit') {
      shop.mayorsPermitNumber = newDocNumber;
      shop.permitDocName = file.originalname;
      shop.permitDocUrl = `/uploads/${file.filename}`;
    }

    await shop.save();

    try {
      const { getIO, emitAdminStatsUpdate } = require('../sockets/socketManager');
      getIO().emit('shop:document_updated', {
        shopId: shop._id.toString(),
        docType,
        document: currentDoc,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {}

    return currentDoc;
  },

  verifyBusinessDocument: async (shopId, docType, status, rejectionReason, adminId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!['verified', 'rejected'].includes(status)) {
      const error = new Error('Invalid verification status. Must be verified or rejected.');
      error.statusCode = 400;
      throw error;
    }

    if (!shop.businessDocuments) {
      shop.businessDocuments = [];
    }

    let doc = shop.businessDocuments.find((d) => d.type === docType);
    if (!doc) {
      const title = docType === 'dti' ? 'DTI Business Name Registration' : "Mayor's Permit";
      doc = {
        type: docType,
        title,
        docNumber: (docType === 'dti' ? shop.dtiNumber : shop.mayorsPermitNumber) || '',
        currentFile: {
          docNumber: (docType === 'dti' ? shop.dtiNumber : shop.mayorsPermitNumber) || '',
          fileName: (docType === 'dti' ? shop.dtiDocName : shop.permitDocName) || '',
          fileUrl: (docType === 'dti' ? shop.dtiDocUrl : shop.permitDocUrl) || '',
          fileType: 'application/pdf',
          fileSize: 0,
          uploadedAt: shop.createdAt || new Date(),
          expiresAt: null,
          status: 'pending',
          verifiedAt: null,
          verifiedBy: null,
          rejectionReason: '',
        },
        history: [],
      };
      shop.businessDocuments.push(doc);
    }

    doc.currentFile.status = status;
    if (status === 'verified') {
      doc.currentFile.verifiedAt = new Date();
      doc.currentFile.verifiedBy = adminId;
      doc.currentFile.rejectionReason = '';
    } else {
      doc.currentFile.rejectionReason = rejectionReason || 'Document did not meet verification criteria.';
    }

    await shop.save();

    // Send notification to shop owner
    try {
      const notificationService = require('../services/notificationService');
      const docTitle = docType === 'dti' ? 'DTI Registration' : "Mayor's Permit";
      await notificationService.createAndEmit(
        shop.ownerId,
        status === 'verified' ? 'document_verified' : 'document_rejected',
        status === 'verified' ? `${docTitle} Verified ✅` : `${docTitle} Rejected ❌`,
        status === 'verified'
          ? `Your ${docTitle} has been verified by the administrator.`
          : `Your ${docTitle} was rejected. Reason: ${doc.currentFile.rejectionReason}`
      );
    } catch (err) {}

    // Audit log
    try {
      const auditService = require('../services/auditService');
      auditService.log({
        action: `document_${status}`,
        eventType: 'verify',
        details: `Admin ${status === 'verified' ? 'verified' : 'rejected'} ${doc.title} for shop: "${shop.shopName}". ${status === 'rejected' ? `Reason: "${doc.currentFile.rejectionReason}"` : ''}`,
        actorId: adminId,
        actorRole: 'admin',
        targetId: shop._id,
        targetName: shop.shopName,
        metadata: { docType, status, rejectionReason },
      });
    } catch (err) {}

    try {
      const { getIO, emitAdminStatsUpdate } = require('../sockets/socketManager');
      getIO().emit('shop:document_verified', {
        shopId: shop._id.toString(),
        docType,
        document: doc,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {}

    return doc;
  },

  updateStorefrontPhoto: async (ownerId, file) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) {
      const error = new Error('Shop not found for this owner.');
      error.statusCode = 404;
      throw error;
    }

    const fs = require('fs');
    const path = require('path');

    // Ensure the filename starts with 'storefront_' so it's served as a public asset by app.js
    let finalFilename = file.filename;
    let finalPath = file.path;
    if (!finalFilename.startsWith('storefront_')) {
      const targetFilename = `storefront_${file.filename}`;
      const targetPath = path.join(path.dirname(file.path), targetFilename);
      try {
        if (fs.existsSync(file.path)) {
          fs.renameSync(file.path, targetPath);
          finalFilename = targetFilename;
          finalPath = targetPath;
        }
      } catch (err) {
        console.error('Could not rename storefront photo:', err);
      }
    }

    shop.storefrontPhotoName = file.originalname;
    shop.storefrontPhotoUrl = `/uploads/${finalFilename}`;
    await shop.save();

    try {
      const { getIO, emitAdminStatsUpdate } = require('../sockets/socketManager');
      getIO().emit('shop:updated', {
        shopId: shop._id.toString(),
        shop,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {}

    return shop;
  },

  deleteStorefrontPhoto: async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) {
      const error = new Error('Shop not found for this owner.');
      error.statusCode = 404;
      throw error;
    }

    const fs = require('fs');
    const path = require('path');

    // Safely remove associated file if stored locally in uploads
    if (shop.storefrontPhotoUrl && typeof shop.storefrontPhotoUrl === 'string' && shop.storefrontPhotoUrl.startsWith('/uploads/')) {
      const filename = path.basename(shop.storefrontPhotoUrl);
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('[deleteStorefrontPhoto] Failed to unlink file:', e.message);
        }
      }
    }

    // Clear storefront photo fields
    shop.storefrontPhotoUrl = '';
    shop.storefrontPhotoName = '';
    shop.storefrontPhotoData = '';
    await shop.save();

    try {
      const { getIO, emitAdminStatsUpdate } = require('../sockets/socketManager');
      getIO().emit('shop:updated', {
        shopId: shop._id.toString(),
        shop,
      });
      emitAdminStatsUpdate().catch(() => {});
    } catch (err) {}

    return shop;
  },

  getShopSales: async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) {
      const error = new Error('Shop not found for this owner.');
      error.statusCode = 404;
      throw error;
    }
    return shopRepository.getShopSalesMetrics(shop._id);
  },

  getShopStats: async () => {
    const lightweightShops = await shopRepository.findForStats();
    
    let openCount = 0;
    for (const shop of lightweightShops) {
      const effective = getEffectiveShopStatus(shop);
      if (effective.isOpen) {
        openCount++;
      }
    }

    return {
      total: lightweightShops.length,
      open: openCount,
      currentlyOpenCount: openCount,
    };
  },

  recalculateShopRatings: async (shopId) => {
    return shopRepository.recalculateRatings(shopId);
  },

  getPublicReviews: async (shopId, query = {}) => {
    const PrintingRequest = require('../models/PrintingRequest');
    const mongoose = require('mongoose');

    if (!shopId || !mongoose.Types.ObjectId.isValid(shopId)) {
      const error = new Error('Invalid shop ID.');
      error.statusCode = 400;
      throw error;
    }

    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {
      shopId: shop._id,
      'review.rating': { $gt: 0 },
    };

    const [total, requests] = await Promise.all([
      PrintingRequest.countDocuments(filter),
      PrintingRequest.find(filter)
        .select('review customerId createdAt updatedAt')
        .populate('customerId', 'name')
        .sort({ 'review.reviewedAt': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const sanitizedReviews = requests.map((req) => {
      const rev = req.review || {};
      const isAnon = Boolean(rev.isAnonymous);
      return {
        id: req._id,
        rating: Number(rev.rating || 5),
        printQuality: rev.printQuality !== undefined && rev.printQuality !== null ? Number(rev.printQuality) : null,
        speedRating: rev.speedRating !== undefined && rev.speedRating !== null ? Number(rev.speedRating) : null,
        tags: Array.isArray(rev.tags) ? rev.tags : [],
        comment: rev.comment || '',
        isAnonymous: isAnon,
        customerName: isAnon ? 'Anonymous Student' : (req.customerId?.name || 'Customer'),
        reviewedAt: rev.reviewedAt || req.updatedAt || req.createdAt,
      };
    });

    return {
      shopId: shop._id,
      shopName: shop.shopName,
      totalReviews: total,
      rating: shop.averageRating || shop.rating || 0,
      reviews: sanitizedReviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  },

  getShopReviews: async (shopId, userId, userRole, query = {}) => {
    const PrintingRequest = require('../models/PrintingRequest');
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }

    const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
    if (userRole !== 'admin' && shopOwnerId !== userId.toString()) {
      const error = new Error('Unauthorized. You can only view reviews for your own shop.');
      error.statusCode = 403;
      throw error;
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      shopId: shop._id,
      'review.rating': { $gt: 0 },
    };

    const [total, requests, ratingStats] = await Promise.all([
      PrintingRequest.countDocuments(filter),
      PrintingRequest.find(filter)
        .select('review customerId documentId fileName updatedAt createdAt status')
        .populate('customerId', 'name')
        .sort({ 'review.reviewedAt': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      shopRepository.recalculateRatings(shop._id),
    ]);

    const sanitizedReviews = requests.map((req) => {
      const rev = req.review || {};
      const isAnon = Boolean(rev.isAnonymous);
      return {
        id: req._id,
        orderId: req._id,
        rating: Number(rev.rating || 5),
        printQuality: rev.printQuality !== undefined && rev.printQuality !== null ? Number(rev.printQuality) : null,
        speedRating: rev.speedRating !== undefined && rev.speedRating !== null ? Number(rev.speedRating) : null,
        tags: Array.isArray(rev.tags) ? rev.tags : [],
        comment: rev.comment || '',
        isAnonymous: isAnon,
        customerName: isAnon ? 'Anonymous Student' : (req.customerId?.name || 'Customer'),
        reviewedAt: rev.reviewedAt || req.updatedAt || req.createdAt,
        fileName: req.fileName || 'Printed Document',
      };
    });

    return {
      shopId: shop._id,
      shopName: shop.shopName,
      summary: {
        rating: ratingStats.avgRating || shop.rating || 0,
        reviewsCount: ratingStats.totalReviews || shop.reviewsCount || 0,
        avgPrintQuality: ratingStats.avgPrintQuality,
        avgSpeedRating: ratingStats.avgSpeedRating,
      },
      reviews: sanitizedReviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  },
};

module.exports = shopService;
