const recommendationService = require('../services/recommendationService');
const { normalizeStorefrontPhoto } = require('../utils/photoHelper');

const recommendationController = {
  getRankedShops: async (req, res, next) => {
    try {
      const lat = req.query.lat || req.query.latitude;
      const lng = req.query.lng || req.query.longitude;
      const limit = parseInt(req.query.limit || '5', 10);
      const travelMode = req.query.travelMode || 'tricycle';
      const {
        copies = 1,
        totalPages = 1,
        colorMode = 'black_and_white',
        sided = 'single',
        paperSize = 'A4',
        binding = 'none',
      } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ success: false, message: 'latitude and longitude are required.' });
      }

      const isRush = req.query.isRush === 'true' || req.query.isRush === true;

      const printingSpecs = {
        copies: Math.max(1, +copies || 1),
        totalPages: Math.max(1, +totalPages || 1),
        colorMode: colorMode === 'color' ? 'color' : 'black_and_white',
        sided: sided === 'double' ? 'double' : 'single',
        paperSize: paperSize || 'A4',
        binding: binding || 'none',
        isRush,
      };

      const ranked = await recommendationService.getRankedShops(+lat, +lng, printingSpecs, limit, travelMode);
      const recommended = ranked.find((s) => s.isRecommended) || null;
      const topCandidate = recommended || (ranked.length > 0 ? ranked[0] : null);
      const availableShops = ranked.filter((s) => s.isAvailable).length;

      const candidate = recommended || topCandidate;

      res.status(200).json({
        success: true,
        customerLocation: {
          latitude: +lat,
          longitude: +lng,
        },
        travelMode,
        ranked,
        recommendation: candidate ? {
          shopId: candidate.shopId,
          shopName: candidate.shopName,
          address: candidate.address,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          distanceKm: candidate.distanceKm,
          distanceMeters: candidate.distanceMeters,
          pathCoordinates: candidate.pathCoordinates,
          shortestPath: candidate.shortestPath,
          isOpen: candidate.isOpen,
          status: candidate.status,
          isWithinHours: candidate.isWithinHours,
          rating: candidate.rating !== undefined ? candidate.rating : null,
          reviewsCount: Number(candidate.reviewsCount || 0),
          hasReviews: Boolean(candidate.hasReviews),
          verificationStatus: candidate.verificationStatus || 'pending',
          currentQueue: candidate.currentQueue ?? candidate.queueCount ?? 0,
          queueCount: candidate.queueCount ?? 0,
          totalInQueue: candidate.totalInQueue ?? candidate.queueCount ?? 0,
          onlineJobs: candidate.onlineJobs ?? 0,
          walkInCustomerCount: candidate.walkInCustomerCount ?? 0,
          storefrontPhotoUrl: normalizeStorefrontPhoto(candidate),
          estimatedCost: candidate.estimatedCost,
          ratePerPage: candidate.ratePerPage,
          recommendationScore: candidate.recommendationScore,
          recommendationSummary: candidate.recommendationSummary,
          recommendationPoints: candidate.recommendationPoints,
          recommendationReason: candidate.recommendationReason,
          recommendationBadges: candidate.recommendationBadges,
          scoreBreakdown: candidate.scoreBreakdown,
          estimatedCompletionMinutes: candidate.estimatedCompletionMinutes || candidate.estimatedCompletionTime,
          travelTimeMinutes: candidate.travelTimeMinutes,
          travelMode: candidate.travelMode,
          modeLabel: candidate.modeLabel,
          modeSpeedKmh: candidate.modeSpeedKmh,
          waitingTimeMinutes: candidate.waitingTimeMinutes || candidate.estimatedWaitingTime,
          serviceTimeMinutes: candidate.serviceTimeMinutes || candidate.estimatedPrintingTime,
        } : null,
        data: {
          allClosed: availableShops === 0,
          customerLocation: {
            latitude: +lat,
            longitude: +lng,
          },
          printingSpecs,
          travelMode,
          totalShops: ranked.length,
          availableShops,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  getRouteToShop: async (req, res, next) => {
    try {
      const { shopId } = req.params;
      const { lat, lng, travelMode = 'motor' } = req.query;

      const mongoose = require('mongoose');
      if (!shopId || shopId === '[object Object]' || !mongoose.Types.ObjectId.isValid(shopId)) {
        return res.status(400).json({ success: false, message: 'Valid shopId is required.' });
      }

      if (lat === undefined || lng === undefined || isNaN(Number(lat)) || isNaN(Number(lng))) {
        return res.status(400).json({ success: false, message: 'Valid lat and lng are required.' });
      }

      const result = await recommendationService.getRouteToShop(+lat, +lng, shopId, travelMode);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = recommendationController;
