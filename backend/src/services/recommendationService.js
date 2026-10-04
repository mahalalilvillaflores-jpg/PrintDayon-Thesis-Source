const shopRepository = require('../repositories/shopRepository');
const requestRepository = require('../repositories/requestRepository');
const { rankShops } = require('../algorithms/recommendationEngine');
const { calculateEstimatedCost } = require('../algorithms/queueOptimizer');
const { getShortestPath } = require('../algorithms/dijkstra');
const { navalGraph, nodeCoordinates } = require('../config/navalGraph');

const recommendationService = {
  getRankedShops: async (customerLat, customerLng, printingSpecs = {}, limit = 10, travelMode = 'motor') => {

    const candidateShops = await shopRepository.findTopNearbyEligible(
      customerLng,
      customerLat,
      Math.max(15, limit)
    );

    if (!candidateShops || !candidateShops.length) return [];

    const shopIds = candidateShops.map((s) => s._id);
    const [activeRequestsMap, reviewAggregates] = await Promise.all([
      requestRepository.findAllActive(shopIds),
      require('../models/PrintingRequest').aggregate([
        { $match: { shopId: { $in: shopIds }, 'review.rating': { $gt: 0 } } },
        { $group: {
          _id: '$shopId',
          avgRating: { $avg: '$review.rating' },
          totalReviews: { $sum: 1 },
        }},
      ]),
    ]);

    const reviewMap = {};
    for (const r of (reviewAggregates || [])) {
      reviewMap[r._id.toString()] = {
        avgRating: Number(r.avgRating.toFixed(1)),
        totalReviews: r.totalReviews,
      };
    }

    // Ensure rating and reviewsCount are always strictly synced with database reality
    candidateShops.forEach((s) => {
      const sId = s._id.toString();
      if (reviewMap[sId]) {
        s.rating = reviewMap[sId].avgRating;
        s.reviewsCount = reviewMap[sId].totalReviews;
      } else if (!s.reviewsCount || !s.rating || Number(s.reviewsCount) === 0) {
        s.rating = 0;
        s.reviewsCount = 0;
      }
    });

    const ranked = rankShops(
      candidateShops,
      customerLat,
      customerLng,
      printingSpecs,
      activeRequestsMap,
      travelMode
    );

    return ranked;
  },

  getRouteToShop: async (customerLat, customerLng, shopId, travelMode = 'motor') => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) {
      const error = new Error('Shop not found.');
      error.statusCode = 404;
      throw error;
    }

    const shopLat = Number(shop.latitude ?? shop.lat ?? shop.location?.coordinates?.[1] ?? 11.5636);
    const shopLng = Number(shop.longitude ?? shop.lng ?? shop.location?.coordinates?.[0] ?? 124.3985);

    const pathResult = getShortestPath(
      navalGraph,
      nodeCoordinates,
      customerLat,
      customerLng,
      shopLat,
      shopLng,
      travelMode
    );

    return {
      shop: {
        _id: shop._id,
        shopName: shop.shopName,
        address: shop.address,
        latitude: shopLat,
        longitude: shopLng,
      },
      ...pathResult,
    };
  },
};

module.exports = recommendationService;
