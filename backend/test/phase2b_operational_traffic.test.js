const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const PrintingShop = require('../src/models/PrintingShop');
const Document = require('../src/models/Document');
const PrintingRequest = require('../src/models/PrintingRequest');
const shopService = require('../src/services/shopService');
const requestService = require('../src/services/requestService');
const { getQueueStats, calculateEstimatedCost } = require('../src/algorithms/queueOptimizer');
const { rankShops } = require('../src/algorithms/recommendationEngine');

describe('Phase 2B: Operational Status and Walk-In Traffic Synchronization Test Suite', () => {
  let customerUser;
  let authorizedOwner;
  let unauthorizedOwner;
  let testShop;
  let testDoc;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    // Clean up test data
    await User.deleteMany({
      email: { $in: ['p2b_customer@test.com', 'p2b_owner@test.com', 'p2b_unauthorized@test.com'] },
    });
    await PrintingShop.deleteMany({ shopName: 'Phase 2B Test Printing Shop' });

    customerUser = await User.create({
      name: 'P2B Customer',
      email: 'p2b_customer@test.com',
      password: 'password123',
      role: 'customer',
      contactNumber: '09123456789',
    });

    authorizedOwner = await User.create({
      name: 'P2B Authorized Owner',
      email: 'p2b_owner@test.com',
      password: 'password123',
      role: 'shop_owner',
      contactNumber: '09123456780',
    });

    unauthorizedOwner = await User.create({
      name: 'P2B Unauthorized Owner',
      email: 'p2b_unauthorized@test.com',
      password: 'password123',
      role: 'shop_owner',
      contactNumber: '09123456781',
    });

    testShop = await PrintingShop.create({
      ownerId: authorizedOwner._id,
      shopName: 'Phase 2B Test Printing Shop',
      address: 'Naval, Biliran',
      latitude: 11.5606,
      longitude: 124.3986,
      location: { type: 'Point', coordinates: [124.3986, 11.5606] },
      contactNumber: '09123456780',
      status: 'open',
      verificationStatus: 'verified',
      walkInTrafficLevel: 'normal',
      walkInCustomerCount: 0,
      operationalCondition: 'normal',
      operationalMessage: '',
      operationalDelayMinutes: 0,
      pricing: {
        bwPerPage: 2.0,
        colorPerPage: 5.0,
        stapleCost: 5.0,
        bindingCost: 35.0,
        softbindCost: 50.0,
        allowRush: true,
        rushFee: 20.0,
      },
      operatingHours: [
        { day: 'monday', open: '00:00', close: '23:59', isClosed: false },
        { day: 'tuesday', open: '00:00', close: '23:59', isClosed: false },
        { day: 'wednesday', open: '00:00', close: '23:59', isClosed: false },
        { day: 'thursday', open: '00:00', close: '23:59', isClosed: false },
        { day: 'friday', open: '00:00', close: '23:59', isClosed: false },
        { day: 'saturday', open: '00:00', close: '23:59', isClosed: false },
        { day: 'sunday', open: '00:00', close: '23:59', isClosed: false },
      ],
    });

    testDoc = await Document.create({
      customerId: customerUser._id,
      originalFilename: 'test_phase2b.pdf',
      storedFilename: 'test_phase2b_123.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      storagePath: 'uploads/test_phase2b_123.pdf',
      pageCount: 5,
    });
  });

  after(async () => {
    await User.deleteMany({
      email: { $in: ['p2b_customer@test.com', 'p2b_owner@test.com', 'p2b_unauthorized@test.com'] },
    });
    await PrintingShop.deleteMany({ shopName: 'Phase 2B Test Printing Shop' });
    await Document.deleteMany({ customerId: customerUser._id });
    await PrintingRequest.deleteMany({ customerId: customerUser._id });
    await mongoose.disconnect();
  });

  it('1. Each operational condition displays the correct customer-facing status', async () => {
    const conditions = ['normal', 'service_delay', 'high_walkin', 'equipment_problem', 'power_interruption'];

    for (const cond of conditions) {
      const updated = await shopService.updateOperationalStatus(testShop._id, authorizedOwner._id, {
        condition: cond,
        delayMinutes: cond === 'normal' ? 0 : 15,
        message: `Condition is ${cond}`,
      });
      assert.strictEqual(updated.operationalCondition, cond);

      // Verify enriched retrieval
      const fetched = await shopService.getShopById(testShop._id, customerUser);
      assert.strictEqual(fetched.operationalCondition, cond);
    }
  });

  it('2. An operational message appears when configured and is omitted when empty', async () => {
    // With message
    await shopService.updateOperationalStatus(testShop._id, authorizedOwner._id, {
      condition: 'equipment_problem',
      delayMinutes: 20,
      message: 'Printer 1 maintenance in progress',
    });
    let fetched = await shopService.getShopById(testShop._id, customerUser);
    assert.strictEqual(fetched.operationalMessage, 'Printer 1 maintenance in progress');
    assert.strictEqual(fetched.operationalDelayMinutes, 20);

    // Empty message
    await shopService.updateOperationalStatus(testShop._id, authorizedOwner._id, {
      condition: 'normal',
      delayMinutes: 0,
      message: '',
    });
    fetched = await shopService.getShopById(testShop._id, customerUser);
    assert.strictEqual(fetched.operationalMessage, '');
    assert.strictEqual(fetched.operationalDelayMinutes, 0);
  });

  it('3. Operational delay is incorporated into estimates exactly once', () => {
    const mockPricing = { speedPerPageSeconds: 5 };
    const mockActiveQueue = [
      {
        status: 'printing', paymentStatus: 'verified',
        printingStartedAt: new Date(Date.now() - 30000), // 30 sec ago
        estimatedPrintingTime: 5,
        printingSpecifications: { totalPages: 10, copies: 1 },
      },
    ];

    // Case A: 0 delay, normal traffic (0 walk-in wait)
    const statsNoDelay = getQueueStats(mockActiveQueue, mockPricing, 'normal', 0, 0);
    // Case B: 15 minutes operational delay, normal traffic
    const statsWithDelay = getQueueStats(mockActiveQueue, mockPricing, 'normal', 0, 15);
    assert.strictEqual(
      statsWithDelay.estimatedWaitingTime,
      statsNoDelay.estimatedWaitingTime + 15,
      'Operational delay must be incorporated into estimated waiting time exactly once'
    );
    assert.strictEqual(statsWithDelay.operationalDelayMinutes, 15);

    // Case C: Recommendation ranking includes operationalDelayMinutes exactly once
    const fakeShop = {
      _id: new mongoose.Types.ObjectId(),
      shopName: 'Delay Test Shop',
      latitude: 11.5606,
      longitude: 124.3986,
      status: 'open',
      verificationStatus: 'verified',
      operatingHours: [{ day: 'monday', open: '00:00', close: '23:59', isClosed: false }],
      pricing: { bwPerPage: 2.0 },
      walkInCustomerCount: 0,
      walkInTrafficLevel: 'normal',
      operationalDelayMinutes: 25,
      operationalCondition: 'service_delay',
    };

    const ranked = rankShops([fakeShop], 11.5606, 124.3986, { totalPages: 5, copies: 1 });
    assert.ok(ranked.length > 0);
    const shopResult = ranked[0];
    assert.strictEqual(shopResult.operationalDelayMinutes, 25);
    assert.ok(
      shopResult.estimatedWaitingTime >= 25,
      'Waiting time in ranking must include the 25 min operational delay'
    );
    assert.strictEqual(
      shopResult.estimatedCompletionTime,
      shopResult.travelTimeMinutes + shopResult.estimatedWaitingTime + shopResult.estimatedPrintingTime,
      'Turnaround must equal travel + wait + print with no double counting'
    );
  });

  it('4. Zero walk-in count does not incorrectly erase a separately configured traffic level', async () => {
    // Owner sets traffic level to packed with 0 count
    await shopService.updateWalkInCount(testShop._id, authorizedOwner._id, 0, 'packed');

    const fetched = await shopService.getShopById(testShop._id, customerUser);
    assert.strictEqual(fetched.walkInCustomerCount, 0);
    assert.strictEqual(
      fetched.walkInTrafficLevel,
      'packed',
      'Zero walk-in count must not overwrite explicitly configured packed traffic level'
    );

    // Verify queue stats respects packed traffic level even with 0 count
    const stats = getQueueStats([], { speedPerPageSeconds: 5 }, fetched.walkInTrafficLevel, fetched.walkInCustomerCount, 0);
    assert.strictEqual(stats.walkInTrafficLevel, 'packed');
    assert.strictEqual(stats.walkInWaitMinutes, 25, 'Packed traffic should apply 25 min counter wait');
  });

  it('5. Walk-in count cannot be negative', async () => {
    await assert.rejects(
      async () => {
        await shopService.updateWalkInCount(testShop._id, authorizedOwner._id, -5, 'normal');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /cannot be negative|non-negative/i);
        return true;
      }
    );
  });

  it('6. Invalid traffic-level values are rejected', async () => {
    await assert.rejects(
      async () => {
        await shopService.updateWalkInCount(testShop._id, authorizedOwner._id, 2, 'super_crowded');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /invalid walk-in traffic level/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await shopService.updateWalkInTraffic(testShop._id, authorizedOwner._id, 'extreme');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        return true;
      }
    );
  });

  it('7. An authorized shop owner can save and retrieve their traffic settings', async () => {
    const updated = await shopService.updateWalkInCount(testShop._id, authorizedOwner._id, 7, 'moderate');
    assert.strictEqual(updated.walkInCustomerCount, 7);
    assert.strictEqual(updated.walkInTrafficLevel, 'moderate');

    const retrieved = await shopService.getMyShop(authorizedOwner._id);
    assert.strictEqual(retrieved.walkInCustomerCount, 7);
    assert.strictEqual(retrieved.walkInTrafficLevel, 'moderate');
  });

  it('8. An unauthorized user cannot modify another shop settings', async () => {
    await assert.rejects(
      async () => {
        await shopService.updateWalkInCount(testShop._id, unauthorizedOwner._id, 10, 'packed');
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /unauthorized/i);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await shopService.updateOperationalStatus(testShop._id, unauthorizedOwner._id, {
          condition: 'service_delay',
          delayMinutes: 30,
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        return true;
      }
    );
  });

  it('9. Saved values persist after reload', async () => {
    await shopService.updateWalkInCount(testShop._id, authorizedOwner._id, 4, 'moderate');
    await shopService.updateOperationalStatus(testShop._id, authorizedOwner._id, {
      condition: 'high_walkin',
      delayMinutes: 10,
      message: 'High counter volume',
    });

    // Query fresh from MongoDB
    const persisted = await PrintingShop.findById(testShop._id);
    assert.strictEqual(persisted.walkInCustomerCount, 4);
    assert.strictEqual(persisted.walkInTrafficLevel, 'moderate');
    assert.strictEqual(persisted.operationalCondition, 'high_walkin');
    assert.strictEqual(persisted.operationalDelayMinutes, 10);
    assert.strictEqual(persisted.operationalMessage, 'High counter volume');
  });

  it('10. Temporary closures remain distinct from operational conditions', async () => {
    // Normal operational condition
    await shopService.updateOperationalStatus(testShop._id, authorizedOwner._id, {
      condition: 'normal',
      delayMinutes: 0,
      message: '',
    });

    // Activate temporary closure
    await shopService.setTemporaryClosure(testShop._id, authorizedOwner._id, {
      reason: 'power_outage',
      advisoryMessage: 'Brownout in area',
      reopenType: 'manual',
    });

    const closed = await shopService.getShopById(testShop._id, customerUser);
    assert.strictEqual(closed.isOpen, false, 'A temporarily closed shop must NOT appear open');
    assert.strictEqual(closed.isManualClosure, true);
    assert.strictEqual(closed.advisoryMessage, 'Brownout in area');

    // Reopen shop
    await shopService.reopenShop(testShop._id, authorizedOwner._id);
    const reopened = await shopService.getShopById(testShop._id, customerUser);
    assert.strictEqual(reopened.isOpen, true, 'Reopened shop within operating hours must appear open');
    assert.strictEqual(reopened.isManualClosure, false);
  });

  it('11. Customers can still submit orders when the shop is closed', async () => {
    try {
      // Ensure shop is temporarily closed
      await shopService.setTemporaryClosure(testShop._id, authorizedOwner._id, {
        reason: 'closing_early',
        advisoryMessage: 'Early closing for inventory',
        reopenType: 'manual',
      });

      const closedShop = await shopService.getShopById(testShop._id, customerUser);
      assert.strictEqual(closedShop.isOpen, false);

      // Customer places order while shop is closed
      const request = await requestService.submitRequest(customerUser._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
        shopId: testShop._id,
        documentId: testDoc._id,
        printingSpecs: {
          paperSize: 'A4',
          colorMode: 'black_and_white',
          copies: 1,
          totalPages: 5,
          sided: 'single',
          binding: 'staple',
        },
        customerLat: 11.5606,
        customerLng: 124.3986,
        travelMode: 'motor',
      });

      assert.ok(request._id);
      assert.strictEqual(request.placedWhileShopClosed, true, 'Order must record placedWhileShopClosed = true');
      assert.strictEqual(request.status, 'pending');

      // Reopen shop for subsequent tests
      await shopService.reopenShop(testShop._id, authorizedOwner._id);
    } catch (e) {
      console.error('TEST 11 FAILED WITH:', e.message, e.stack);
      throw e;
    }
  });

  it('12. Phase 2A pricing and order calculations remain correct', () => {
    const pricing = {
      bwPerPage: 2.0,
      bwLongPerPage: 3.0,
      colorPerPage: 5.0,
      colorLongPerPage: 6.0,
      stapleCost: 5.0,
      bindingCost: 35.0,
      softbindCost: 50.0,
      allowRush: true,
      rushFee: 20.0,
    };

    // 10 pages B&W, 2 copies, with staple (₱5 * 2) = 10 * 2 * 2 + 10 = ₱50.00
    const costStaple = calculateEstimatedCost(
      { totalPages: 10, copies: 2, colorMode: 'black_and_white', paperSize: 'A4', binding: 'staple' },
      pricing,
      false
    );
    assert.strictEqual(costStaple, 50.0);

    // With rush fee (+₱20) = ₱70.00
    const costRush = calculateEstimatedCost(
      { totalPages: 10, copies: 2, colorMode: 'black_and_white', paperSize: 'A4', binding: 'staple' },
      pricing,
      true
    );
    assert.strictEqual(costRush, 70.0);

    // Spiral binding (₱35 * 2 = ₱70) + 10 * 2 * 2 = ₱110.00
    const costSpiral = calculateEstimatedCost(
      { totalPages: 10, copies: 2, colorMode: 'black_and_white', paperSize: 'A4', binding: 'spiral' },
      pricing,
      false
    );
    assert.strictEqual(costSpiral, 110.0);
  });
});
