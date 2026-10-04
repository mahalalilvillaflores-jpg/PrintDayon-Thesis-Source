const { describe, it } = require('node:test');
const assert = require('node:assert');

// 1. Core routing and algorithms
const { getShortestPath, dijkstra, normalizeTravelMode, TRAVEL_MODES } = require('../src/algorithms/dijkstra');
const { navalGraph, nodeCoordinates } = require('../src/config/navalGraph');
const { estimatePrintingTime, estimateWaitingTime, calculateEstimatedCost, getQueueStats } = require('../src/algorithms/queueOptimizer');
const { computeAdjustedTravelTime } = require('../src/algorithms/trafficMultiplier');
const { getEffectiveShopStatus, isShopOpenNow } = require('../src/utils/shopHelper');

describe('System Consistency & Regression Test Suite', () => {

  describe('Phase 1 & 2: Dijkstra Routing & Road Geometry Integrity', () => {
    it('should calculate valid road paths through multiple intersections (no straight diagonal lines)', () => {
      // Test route between Sitio Butay (N021) and Naval Central / Redaza (N024)
      const customerLoc = { lat: 11.56437, lng: 124.39964 }; // Sitio Butay
      const shopLoc = { lat: 11.56250, lng: 124.39593 };     // Know-well / Redaza

      const result = getShortestPath(
        navalGraph,
        nodeCoordinates,
        customerLoc.lat,
        customerLoc.lng,
        shopLoc.lat,
        shopLoc.lng,
        'motor'
      );

      assert.strictEqual(result.found, true, 'Dijkstra route must be found');
      assert.ok(result.distanceMeters > 0, 'Distance in meters must be positive');
      assert.ok(result.path.length >= 2, 'Graph path must traverse at least 2 intersection nodes');
      assert.ok(result.pathCoordinates.length >= 3, 'Road path coordinates must contain >= 3 points, never collapsed into a 2-point straight diagonal line');
      
      // Coordinates must match valid Naval bounding box
      result.pathCoordinates.forEach(([lng, lat]) => {
        assert.ok(lat >= 11.55 && lat <= 11.60, `Latitude ${lat} must be within Naval municipality`);
        assert.ok(lng >= 124.38 && lng <= 124.42, `Longitude ${lng} must be within Naval municipality`);
      });
    });

    it('should distinguish speeds and durations across walking, motorcycle, and vehicle modes', () => {
      const customerLoc = { lat: 11.56437, lng: 124.39964 };
      const shopLoc = { lat: 11.56250, lng: 124.39593 };

      const walkRoute = getShortestPath(navalGraph, nodeCoordinates, customerLoc.lat, customerLoc.lng, shopLoc.lat, shopLoc.lng, 'walking');
      const motorRoute = getShortestPath(navalGraph, nodeCoordinates, customerLoc.lat, customerLoc.lng, shopLoc.lat, shopLoc.lng, 'motor');
      const carRoute = getShortestPath(navalGraph, nodeCoordinates, customerLoc.lat, customerLoc.lng, shopLoc.lat, shopLoc.lng, 'vehicle');

      assert.strictEqual(walkRoute.travelMode, 'walking');
      assert.strictEqual(motorRoute.travelMode, 'motor');
      assert.strictEqual(carRoute.travelMode, 'vehicle');

      // Walking speed is 4.5 km/h, Motor is 25 km/h -> walk duration must be noticeably greater
      assert.ok(walkRoute.rawMinutes > motorRoute.rawMinutes, 'Walking duration must be longer than motorcycle duration');
      assert.strictEqual(walkRoute.modeSpeedKmh, 4.5);
      assert.strictEqual(motorRoute.modeSpeedKmh, 25.0);
      assert.strictEqual(carRoute.modeSpeedKmh, 22.0);
    });

    it('should normalize travel mode aliases properly', () => {
      assert.strictEqual(normalizeTravelMode('walk'), 'walking');
      assert.strictEqual(normalizeTravelMode('foot'), 'walking');
      assert.strictEqual(normalizeTravelMode('motorcycle'), 'motor');
      assert.strictEqual(normalizeTravelMode('tricycle'), 'motor');
      assert.strictEqual(normalizeTravelMode('car'), 'vehicle');
      assert.strictEqual(normalizeTravelMode('driving'), 'vehicle');
    });
  });

  describe('Phase 3 & 4: Queue Optimization & Pricing Formula Consistency', () => {
    const mockPricing = {
      bwPerPage: 2.0,
      colorPerPage: 6.0,
      a4Multiplier: 1.0,
      legalMultiplier: 1.25,
      bindingCost: 35.0,
      speedPerPageSeconds: 4,
    };

    it('should calculate estimated printing cost strictly by business rules without NaN', () => {
      const specsBW = {
        copies: 2,
        totalPages: 10,
        colorMode: 'black_and_white',
        paperSize: 'A4',
        binding: 'none',
        isRush: false,
      };

      const costBW = calculateEstimatedCost(specsBW, mockPricing);
      // 2 copies * 10 pages * 2.0 = 40.0
      assert.strictEqual(costBW, 40.0, 'B&W 20 total pages should be 40.00');

      const specsColorWithBinding = {
        copies: 1,
        totalPages: 5,
        colorMode: 'color',
        paperSize: 'A4',
        binding: 'staple',
        isRush: false,
      };

      const costColor = calculateEstimatedCost(specsColorWithBinding, mockPricing);
      // (1 * 5 * 6.0) + 35.0 = 65.0
      assert.strictEqual(costColor, 65.0, 'Color 5 pages + 35 binding should be 65.00');
    });

    it('should estimate waiting time consistently based on active queue jobs and walk-ins', () => {
      const activeQueue = [
        { pageCount: 20, copies: 1, status: 'printing', paymentStatus: 'verified' },
        { pageCount: 50, copies: 1, status: 'queued', paymentStatus: 'verified' },
      ];

      const waitMinutes = estimateWaitingTime(activeQueue, mockPricing);
      assert.ok(waitMinutes >= 1, 'Waiting time for active queue jobs must be >= 1 minute');

      const stats = getQueueStats(activeQueue, mockPricing, 'moderate', 4);
      assert.strictEqual(stats.queueCount, 2);
      assert.strictEqual(stats.activeJobsCount, 1);
      assert.strictEqual(stats.walkInCustomerCount, 4);
      assert.ok(stats.estimatedWaitingTime >= waitMinutes);
    });
  });

  describe('Phase 5: Operational Schedule and Status Integrity', () => {
    it('should correctly evaluate open/closed schedule without crashing on empty schedules', () => {
      const closedShop = getEffectiveShopStatus({ operatingHours: [] });
      assert.strictEqual(closedShop.isOpen, false);

      const openShop = {
        status: 'open',
        verificationStatus: 'verified',
        operatingHours: [
          { day: 'monday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'tuesday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'wednesday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'thursday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'friday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'saturday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'sunday', open: '00:00', close: '23:59', isClosed: false },
        ],
      };

      const result = getEffectiveShopStatus(openShop);
      assert.strictEqual(result.isOpen, true);
      assert.strictEqual(result.isWithinHours, true);
    });

    it('should respect temporary closure overrides even within operating hours', () => {
      const temporarilyClosedShop = {
        status: 'open',
        verificationStatus: 'verified',
        operatingHours: [
          { day: 'monday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'tuesday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'wednesday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'thursday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'friday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'saturday', open: '00:00', close: '23:59', isClosed: false },
          { day: 'sunday', open: '00:00', close: '23:59', isClosed: false },
        ],
        temporaryClosure: {
          isClosed: true,
          reason: 'power_outage',
          customReason: 'Brownout in Naval',
          reopenAt: new Date(Date.now() + 3600000), // 1 hour in future
        },
      };

      const result = getEffectiveShopStatus(temporarilyClosedShop);
      assert.strictEqual(result.isOpen, false);
      assert.strictEqual(result.isManualClosure, true);
      assert.strictEqual(result.status, 'closed');
    });
  });

  describe('Phase 6: Data Persistence & Model Schema Integrity', () => {
    it('should support persistent storefrontPhotoData field in PrintingShop model', () => {
      const PrintingShop = require('../src/models/PrintingShop');
      const schemaPaths = Object.keys(PrintingShop.schema.paths);
      assert.ok(schemaPaths.includes('storefrontPhotoData'), 'PrintingShop schema must have storefrontPhotoData path');
      assert.ok(schemaPaths.includes('storefrontPhotoUrl'), 'PrintingShop schema must have storefrontPhotoUrl path');
      assert.ok(schemaPaths.includes('storefrontPhotoName'), 'PrintingShop schema must have storefrontPhotoName path');
      assert.ok(schemaPaths.includes('graphNodeId'), 'PrintingShop schema must have graphNodeId path');
    });
  });
});
