
const { getShortestPath, TRAVEL_MODES, DEFAULT_TRAVEL_MODE } = require('./dijkstra');
const { estimatePrintingTime, estimateWaitingTime, calculateEstimatedCost } = require('./queueOptimizer');
const { navalGraph, nodeCoordinates } = require('../config/navalGraph');
const { computeAdjustedTravelTime } = require('./trafficMultiplier');
const { getEffectiveShopStatus, isShopOpenNow } = require('../utils/shopHelper');
const { normalizeStorefrontPhoto } = require('../utils/photoHelper');

const RECOMMENDATION_WEIGHTS = {
  price: 0.25,
  distance: 0.25,
  queue: 0.20,
  turnaround: 0.20,
  rating: 0.10,
};

function generateRecommendationExplanation(rankedShops, recommendedShop) {
  if (!recommendedShop) return '';

  const costStr = `₱${Number(recommendedShop.estimatedCost || 0).toFixed(2)}`;
  const rateStr = `₱${Number(recommendedShop.ratePerPage || 2).toFixed(2)}/page`;
  const distStr = `${recommendedShop.distanceKm ? parseFloat(recommendedShop.distanceKm).toFixed(2) : '0.50'} km away`;
  const queueCount = recommendedShop.queueCount || 0;
  const queueStr = queueCount === 0 ? '0 in queue' : `${queueCount} in queue`;
  const timeStr = `~${recommendedShop.estimatedCompletionTime || 2} min turnaround`;

  return {
    summary: `Best balance of price (${costStr}), distance (${distStr}), queue (${queueStr}) & speed (${timeStr})`,
    points: [
      `${costStr} estimated price (${rateStr})`,
      distStr,
      queueStr,
      timeStr,
    ],
    fullText: `${recommendedShop.shopName} provides the best overall balance across rate/price (${costStr} for your request), distance (${distStr}), queue (${queueStr}), and turnaround (${timeStr}) with a ${recommendedShop.recommendationScore || 90}% recommendation score.`,
  };
}

function rankShops(shops, customerLat, customerLng, printingSpecs, activeRequestsMap = {}, travelMode = DEFAULT_TRAVEL_MODE) {
  const results = [];

  for (const shop of shops) {
    try {
      const effective = getEffectiveShopStatus(shop);
      const isOpen = effective.isOpen;
      let isEligible = effective.isAvailable;
      const isWithinHours = effective.isWithinHours;
      let unavailableReason = effective.unavailableReason;

      if (isEligible && printingSpecs) {
        if (printingSpecs.isRush && shop.pricing?.allowRush === false) {
          isEligible = false;
          unavailableReason = 'Rush orders not accepted at this shop';
        } else if (printingSpecs.binding && printingSpecs.binding !== 'none') {
          const offersBinding = shop.services?.some((s) => 
            s.available !== false && (s.name?.toLowerCase().includes('bind') || s.name?.toLowerCase().includes('book'))
          ) || shop.pricing?.bindingCost > 0 || shop.pricing?.softbindCost > 0;

          if (!offersBinding) {
            isEligible = false;
            unavailableReason = 'Binding service is not offered by this shop';
          }
        }
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

      const trafficResult = computeAdjustedTravelTime(
        pathResult.distanceMeters,
        pathResult.modeSpeedKmh,
        travelMode
      );
      const adjustedTravelTime = trafficResult.travelTimeMinutes;

      const activeRequests = activeRequestsMap[shop._id.toString()] || [];
      const onlineWaitTime = estimateWaitingTime(activeRequests, shop.pricing);

      const walkInCount = Math.max(0, Number(
        shop.walkInCustomerCount !== undefined
          ? shop.walkInCustomerCount
          : (shop.walkInCustomers || 0)
      ) || 0);

      const validLevels = ['normal', 'moderate', 'packed'];
      const walkInTrafficLevel = validLevels.includes(shop.walkInTrafficLevel)
        ? shop.walkInTrafficLevel
        : (walkInCount > 8 ? 'packed' : (walkInCount > 3 ? 'moderate' : 'normal'));

      let walkInWaitMinutes = 0;
      if (walkInTrafficLevel === 'packed') {
        walkInWaitMinutes = 25;
      } else if (walkInTrafficLevel === 'moderate') {
        walkInWaitMinutes = 10;
      } else if (walkInCount > 8) {
        walkInWaitMinutes = 25;
      } else if (walkInCount > 3) {
        walkInWaitMinutes = 10;
      }

      const operationalDelayMinutes = Math.max(0, Number(shop.operationalDelayMinutes) || 0);
      const waitingTime = onlineWaitTime + walkInWaitMinutes + operationalDelayMinutes;

      const printingTime = estimatePrintingTime(printingSpecs || {}, shop.pricing);

      const effectiveTravelMinutes = trafficResult.rawTravelTimeMinutes !== undefined
        ? trafficResult.rawTravelTimeMinutes
        : adjustedTravelTime;

      const totalTime = adjustedTravelTime + (waitingTime || 0) + (printingTime || 1);

      // Price & Rate Evaluation
      const effectiveSpecs = {
        copies: Math.max(1, +(printingSpecs?.copies) || 1),
        totalPages: Math.max(1, +(printingSpecs?.totalPages) || 1),
        colorMode: printingSpecs?.colorMode === 'color' ? 'color' : 'black_and_white',
        paperSize: printingSpecs?.paperSize || 'A4',
        sided: printingSpecs?.sided === 'double' ? 'double' : 'single',
        binding: printingSpecs?.binding || 'none',
        isRush: Boolean(printingSpecs?.isRush),
      };

      const estimatedCost = calculateEstimatedCost(effectiveSpecs, shop.pricing, effectiveSpecs.isRush);

      const isLong = effectiveSpecs.paperSize === 'Legal' || effectiveSpecs.paperSize === 'Long';
      const isColor = effectiveSpecs.colorMode === 'color';
      const p = shop.pricing || {};
      let ratePerPage;
      if (isColor) {
        ratePerPage = isLong ? (p.colorLongPerPage || 5) : (p.colorPerPage || 4);
      } else {
        ratePerPage = isLong ? (p.bwLongPerPage || 3) : (p.bwPerPage || 2);
      }

      const totalQueue = activeRequests.length + (walkInCount || 0);

      results.push({
        shopId: shop._id,
        shopName: shop.shopName,
        address: shop.address,
        contactNumber: shop.contactNumber,
        latitude: shopLat,
        longitude: shopLng,

        distanceMeters: pathResult.distanceMeters,
        distanceKm: parseFloat(pathResult.distanceKm || (pathResult.distanceMeters / 1000).toFixed(2)),

        travelTimeMinutes: adjustedTravelTime,
        rawTravelTimeMinutes: trafficResult.rawTravelTimeMinutes || pathResult.travelTimeMinutes,
        trafficMultiplier: trafficResult.trafficMultiplier,
        trafficLabel: trafficResult.trafficLabel,
        trafficReason: trafficResult.trafficReason,
        effectiveSpeedKmh: trafficResult.effectiveSpeedKmh,
        hourPHT: trafficResult.hourPHT,

        travelMode: pathResult.travelMode,
        modeLabel: pathResult.modeLabel,
        modeSpeedKmh: pathResult.modeSpeedKmh,
        osrmProfile: pathResult.osrmProfile,

        shortestPath: pathResult.path,
        sourceNode: pathResult.sourceNode,
        targetNode: pathResult.targetNode,
        pathCoordinates: pathResult.pathCoordinates,
        pathMethod: pathResult.method,

        queueCount: totalQueue,
        currentQueue: totalQueue,
        totalInQueue: totalQueue,
        onlineJobs: activeRequests.length,
        walkInCustomerCount: walkInCount,
        activeJobs: activeRequests.filter((r) => r.status === 'printing').length,
        onlineWaitMinutes: onlineWaitTime,
        walkInWaitMinutes,
        operationalDelayMinutes,
        operationalCondition: shop.operationalCondition || 'normal',
        operationalMessage: shop.operationalMessage || '',
        walkInTrafficLevel,
        waitingTimeMinutes: waitingTime,
        estimatedWaitingTime: waitingTime,

        serviceTimeMinutes: printingTime,
        printingTimeMinutes: printingTime,
        estimatedPrintingTime: printingTime,

        estimatedTotalMinutes: totalTime,
        estimatedCompletionMinutes: totalTime,
        estimatedCompletionTime: totalTime,

        rankingWeights: RECOMMENDATION_WEIGHTS,

        rating: (Number(shop.reviewsCount || 0) > 0 && Number(shop.rating || 0) > 0) ? Number(shop.rating) : null,
        reviewsCount: Number(shop.reviewsCount || 0),
        hasReviews: Boolean(Number(shop.reviewsCount || 0) > 0 && Number(shop.rating || 0) > 0),
        recentReviews: shop.recentReviews || [],
        storefrontPhotoUrl: normalizeStorefrontPhoto(shop),
        storefrontPhotoName: shop.storefrontPhotoName || '',
        landmark: shop.landmark || '',
        locationDescription: shop.locationDescription || '',
        printers: shop.printers || [],

        estimatedCost,
        ratePerPage,
        status: isEligible ? shop.status : (!isWithinHours || !isOpen ? 'closed' : shop.status),
        isOpen: isEligible,
        isWithinHours,
        verificationStatus: shop.verificationStatus || 'pending',
        isAvailable: isEligible,
        unavailableReason: unavailableReason,
        isRecommended: false,
        services: shop.services,
        pricing: shop.pricing,
        operatingHours: shop.operatingHours,
      });
    } catch (err) {
      console.error(`Recommendation error for shop ${shop._id}:`, err.message);
    }
  }

  const available = results.filter((s) => s.isAvailable);
  const unavailable = results.filter((s) => !s.isAvailable);

  if (available.length > 0) {
    // 5-Factor Normalization: Price (25%), Distance (25%), Queue (20%), Turnaround (20%), Rating (10%)
    const minPrice = Math.min(...available.map((s) => s.estimatedCost));
    const maxPrice = Math.max(...available.map((s) => s.estimatedCost));

    const minDist = Math.min(...available.map((s) => s.distanceKm));
    const maxDist = Math.max(...available.map((s) => s.distanceKm));

    const minQueue = Math.min(...available.map((s) => s.queueCount || 0));
    const maxQueue = Math.max(...available.map((s) => s.queueCount || 0));

    const minTime = Math.min(...available.map((s) => s.estimatedCompletionTime || 1));
    const maxTime = Math.max(...available.map((s) => s.estimatedCompletionTime || 1));

    // Calculate Bayesian average for ratings
    const globalMeanRating = 4.0; // Assume a prior of 4.0 for unrated shops
    const minReviewsForConfidence = 3;

    available.forEach((s) => {
      const r = Number(s.rating || 0);
      const v = Number(s.reviewsCount || 0);
      
      if (v === 0 || !Number.isFinite(r) || !Number.isFinite(v)) {
        s.effectiveRating = globalMeanRating; // Treat unrated shops fairly
      } else {
        // Bayesian formula: ( (v * R) + (m * C) ) / (v + m)
        s.effectiveRating = ((v * r) + (minReviewsForConfidence * globalMeanRating)) / (v + minReviewsForConfidence);
      }
    });

    const minRating = Math.min(...available.map((s) => s.effectiveRating));
    const maxRating = Math.max(...available.map((s) => s.effectiveRating));

    available.forEach((s) => {
      // Lower values are better: 1.0 for best, 0.0 for worst (or 1.0 if all tied)
      const priceScore = maxPrice === minPrice ? 1.0 : (maxPrice - s.estimatedCost) / (maxPrice - minPrice);
      const distanceScore = maxDist === minDist ? 1.0 : (maxDist - s.distanceKm) / (maxDist - minDist);
      const queueScore = maxQueue === minQueue ? 1.0 : (maxQueue - (s.queueCount || 0)) / (maxQueue - minQueue);
      const serviceTimeScore = maxTime === minTime ? 1.0 : (maxTime - s.estimatedCompletionTime) / (maxTime - minTime);
      
      // Higher rating is better: 1.0 for best rating, 0.0 for worst
      const ratingScore = maxRating === minRating ? 1.0 : (s.effectiveRating - minRating) / (maxRating - minRating);

      const rawComposite = (
        priceScore * RECOMMENDATION_WEIGHTS.price +
        distanceScore * RECOMMENDATION_WEIGHTS.distance +
        queueScore * RECOMMENDATION_WEIGHTS.queue +
        serviceTimeScore * RECOMMENDATION_WEIGHTS.turnaround +
        ratingScore * RECOMMENDATION_WEIGHTS.rating
      );

      const recommendationScore = available.length === 1
        ? 95
        : Math.max(20, Math.min(99, Math.round(rawComposite * 100)));

      s.priceScore = Math.round(priceScore * 100);
      s.distanceScore = Math.round(distanceScore * 100);
      s.queueScore = Math.round(queueScore * 100);
      s.serviceTimeScore = Math.round(serviceTimeScore * 100);
      s.ratingScore = Math.round(ratingScore * 100);
      s.recommendationScore = recommendationScore;
      s.weightedScore = parseFloat((100 - recommendationScore).toFixed(2));
      s.scoreBreakdown = {
        priceScore: s.priceScore,
        distanceScore: s.distanceScore,
        queueScore: s.queueScore,
        serviceTimeScore: s.serviceTimeScore,
        ratingScore: s.ratingScore,
        weights: RECOMMENDATION_WEIGHTS,
      };
    });

    const rankComparator = (a, b) => {
      // 1. Highest recommendationScore first
      if (Math.abs(b.recommendationScore - a.recommendationScore) > 0.001) {
        return b.recommendationScore - a.recommendationScore;
      }
      // 2. Highest effective rating (Bayesian smoothed)
      if (Math.abs(b.effectiveRating - a.effectiveRating) > 0.01) {
        return b.effectiveRating - a.effectiveRating;
      }
      // 3. Lowest estimated cost
      if (Math.abs(a.estimatedCost - b.estimatedCost) > 0.01) {
        return a.estimatedCost - b.estimatedCost;
      }
      // 4. Fastest turnaround time
      if (Math.abs(a.estimatedCompletionTime - b.estimatedCompletionTime) > 0.1) {
        return a.estimatedCompletionTime - b.estimatedCompletionTime;
      }
      // 5. Shortest physical distance
      return (a.distanceMeters || 0) - (b.distanceMeters || 0);
    };

    available.sort(rankComparator);

    available[0].isRecommended = true;
    available[0].recommended = true;

    const explanationObj = generateRecommendationExplanation(available, available[0]);
    available[0].recommendationReason = explanationObj.fullText;
    available[0].recommendationSummary = explanationObj.summary;
    available[0].recommendationPoints = explanationObj.points;

    available.forEach((s) => {
      s.recommendationBadges = [];
      if (s.isRecommended) s.recommendationBadges.push('⭐ Recommended');
      if (s.estimatedCost === minPrice) s.recommendationBadges.push('Lowest Price');
      if (s.estimatedCompletionTime === minTime) s.recommendationBadges.push('Fast Turnaround');
      if (s.queueCount === minQueue && s.queueCount <= 1) s.recommendationBadges.push('Short Queue');
      if (s.distanceKm === minDist) s.recommendationBadges.push('Near You');

      const costStr = `₱${Number(s.estimatedCost || 0).toFixed(2)}`;
      const distStr = `${s.distanceKm ? parseFloat(s.distanceKm).toFixed(2) : '0.50'} km away`;
      const queueStr = (s.queueCount || 0) === 0 ? '0 in queue' : `${s.queueCount} in queue`;
      const timeStr = `~${s.estimatedCompletionTime || 2} min turnaround`;

      if (!s.recommendationPoints) {
        s.recommendationPoints = [
          `${costStr} estimated price`,
          distStr,
          queueStr,
          timeStr,
        ];
      }
      if (!s.recommendationSummary) {
        s.recommendationSummary = `Price: ${costStr} • ${distStr} • ${queueStr} • ${timeStr}`;
      }
      if (!s.recommendationReason) {
        const rLabel = s.hasReviews ? `${s.rating}★` : 'Unrated';
        s.recommendationReason = `${s.shopName}: ${costStr} est. total (₱${s.ratePerPage || 2}/pg), ${distStr}, ${queueStr}, ${timeStr}, ${rLabel}. Score: ${s.recommendationScore}%.`;
      }
    });
  }


  // Attach lightweight summary fields for consumer simplicity
  const allShops = [...available, ...unavailable];
  allShops.forEach((s) => {
    s.name = s.shopName;
    const cleanPhoto = normalizeStorefrontPhoto(s);
    s.storefrontPhotoUrl = cleanPhoto;
    s.photoUrl = cleanPhoto;
    s.recommendation = {
      score: s.recommendationScore || 0,
      label: s.isRecommended ? 'Best Match' : `${s.recommendationScore || 0}% Match`,
    };
    s.location = {
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
    };
    s.pricingSummary = {
      estimatedTotal: Number(s.estimatedCost || 0),
      baseRate: Number(s.ratePerPage || 2),
      rateUnit: 'page',
      currency: 'PHP',
    };
    s.queueSummary = {
      walkInCustomers: s.walkInCustomerCount !== undefined ? s.walkInCustomerCount : (s.walkInCustomers || 0),
      walkInTrafficLevel: s.walkInTrafficLevel || 'normal',
      operationalDelayMinutes: s.operationalDelayMinutes || 0,
      estimatedWaitMinutes: s.estimatedWaitingTime || s.waitingTimeMinutes || 0,
      onlineJobs: s.onlineJobs !== undefined ? s.onlineJobs : (s.queueCount || 0),
    };
    s.turnaround = {
      estimatedMinutes: s.estimatedCompletionTime || s.estimatedCompletionMinutes || 2,
    };
  });

  return allShops;
}

module.exports = {
  rankShops,
  isShopOpenNow,
  generateRecommendationExplanation,
  TRAVEL_MODES,
  DEFAULT_TRAVEL_MODE,
};
