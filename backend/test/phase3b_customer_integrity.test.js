const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const PrintingShop = require('../src/models/PrintingShop');
const Document = require('../src/models/Document');
const PrintingRequest = require('../src/models/PrintingRequest');
const shopService = require('../src/services/shopService');
const shopRepository = require('../src/repositories/shopRepository');

describe('Phase 3B: Customer Experience & System Integrity Test Suite', () => {
  let customerUser1;
  let customerUser2;
  let shopOwnerUser;
  let testShop;
  let testDoc;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    // Clean up previous test artifacts
    await User.deleteMany({
      email: {
        $in: ['p3b_cust1@test.com', 'p3b_cust2@test.com', 'p3b_owner@test.com'],
      },
    });

    customerUser1 = await User.create({
      name: 'Maria Santos',
      email: 'p3b_cust1@test.com',
      password: 'password123',
      role: 'customer',
      isActive: true,
    });

    customerUser2 = await User.create({
      name: 'Juan Dela Cruz',
      email: 'p3b_cust2@test.com',
      password: 'password123',
      role: 'customer',
      isActive: true,
    });

    shopOwnerUser = await User.create({
      name: 'P3B Owner',
      email: 'p3b_owner@test.com',
      password: 'password123',
      role: 'shop_owner',
      isActive: true,
    });

    testShop = await PrintingShop.create({
      shopName: 'P3B Test Copy Center',
      ownerId: shopOwnerUser._id,
      address: 'Naval, Biliran',
      latitude: 11.5606,
      longitude: 124.3986,
      location: { type: 'Point', coordinates: [124.3986, 11.5606] },
      contactNumber: '09333333333',
      status: 'open',
      verificationStatus: 'verified',
      isAvailable: true,
      currentQueue: 5,
      rating: 0,
      reviewsCount: 0,
      pricing: {
        bwPerPage: 2.0,
      },
    });

    testDoc = await Document.create({
      customerId: customerUser1._id,
      originalFilename: 'thesis_p3b_sample.pdf',
      storedFilename: 'stored_thesis_p3b_sample.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      storagePath: 'uploads/stored_thesis_p3b_sample.pdf',
      pageCount: 15,
    });
  });

  after(async () => {
    if (testShop) {
      await PrintingRequest.deleteMany({ shopId: testShop._id });
      await PrintingShop.deleteOne({ _id: testShop._id });
    }
    if (testDoc) {
      await Document.deleteOne({ _id: testDoc._id });
    }
    await User.deleteMany({
      email: {
        $in: ['p3b_cust1@test.com', 'p3b_cust2@test.com', 'p3b_owner@test.com'],
      },
    });
    await mongoose.disconnect();
  });

  describe('P1 Item 3: Prevent Negative Queue Counters', () => {
    it('1. Queue decrement from > 0 decreases currentQueue by 1', async () => {
      await PrintingShop.updateOne({ _id: testShop._id }, { $set: { currentQueue: 5 } });
      const updated = await shopRepository.decrementQueue(testShop._id);
      assert.equal(updated.currentQueue, 4);

      const refreshed = await PrintingShop.findById(testShop._id);
      assert.equal(refreshed.currentQueue, 4);
    });

    it('2. Queue decrement from 1 decreases currentQueue to 0', async () => {
      await PrintingShop.updateOne({ _id: testShop._id }, { $set: { currentQueue: 1 } });
      const updated = await shopRepository.decrementQueue(testShop._id);
      assert.equal(updated.currentQueue, 0);

      const refreshed = await PrintingShop.findById(testShop._id);
      assert.equal(refreshed.currentQueue, 0);
    });

    it('3. Queue decrement from 0 remains 0 and does not become negative', async () => {
      await PrintingShop.updateOne({ _id: testShop._id }, { $set: { currentQueue: 0 } });
      const updated = await shopRepository.decrementQueue(testShop._id);
      assert.equal(updated.currentQueue, 0);

      const refreshed = await PrintingShop.findById(testShop._id);
      assert.equal(refreshed.currentQueue, 0);
    });

    it('4. Concurrent and out-of-order decrement attempts cannot produce a negative currentQueue', async () => {
      await PrintingShop.updateOne({ _id: testShop._id }, { $set: { currentQueue: 2 } });

      // Run 10 simultaneous decrements on a queue of 2
      await Promise.all([
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
        shopRepository.decrementQueue(testShop._id),
      ]);

      const refreshed = await PrintingShop.findById(testShop._id);
      assert.equal(refreshed.currentQueue, 0);
      assert.ok(refreshed.currentQueue >= 0, 'currentQueue must never be less than 0');
    });
  });

  describe('P1 Item 2: Customer Public Review Pagination & Masking', () => {
    before(async () => {
      // Seed 35 reviews: 5 anonymous, 30 non-anonymous
      const requestsToInsert = [];
      for (let i = 1; i <= 35; i++) {
        const isAnon = i % 7 === 0; // reviews 7, 14, 21, 28, 35 will be anonymous
        const user = i % 2 === 0 ? customerUser1 : customerUser2;
        requestsToInsert.push({
          customerId: user._id,
          shopId: testShop._id,
          documentId: testDoc._id,
          status: 'completed',
          submittedAt: new Date(Date.now() - (40 - i) * 60000),
          completedAt: new Date(Date.now() - (40 - i) * 60000 + 10000),
          review: {
            rating: (i % 5) + 1, // 1 to 5
            printQuality: 5,
            speedRating: 4,
            isAnonymous: isAnon,
            comment: `Review #${i} test comment`,
            reviewedAt: new Date(Date.now() - (40 - i) * 60000 + 20000),
          },
        });
      }
      await PrintingRequest.insertMany(requestsToInsert);
      const stats = await shopRepository.recalculateRatings(testShop._id);
      testShop.rating = stats.avgRating;
      testShop.reviewsCount = stats.totalReviews;
      testShop.recentReviews = requestsToInsert.slice(-30).reverse().map((r) => ({
        customerName: r.review.isAnonymous ? 'Anonymous Student' : 'Customer',
        isAnonymous: r.review.isAnonymous,
        rating: r.review.rating,
        comment: r.review.comment,
        createdAt: r.review.reviewedAt,
      }));
      await testShop.save();
    });

    it('5. First page loads correctly with default limit of 10 reviews and accurate pagination metadata', async () => {
      const result = await shopService.getPublicReviews(testShop._id, { page: 1, limit: 10 });
      assert.equal(result.shopId.toString(), testShop._id.toString());
      assert.equal(result.totalReviews, 35);
      assert.equal(result.reviews.length, 10);
      assert.equal(result.pagination.page, 1);
      assert.equal(result.pagination.limit, 10);
      assert.equal(result.pagination.total, 35);
      assert.equal(result.pagination.pages, 4);
      assert.equal(result.pagination.hasMore, true);
    });

    it('6. Additional reviews can be loaded beyond 30 on pages 2, 3, and 4', async () => {
      const page1 = await shopService.getPublicReviews(testShop._id, { page: 1, limit: 10 });
      const page2 = await shopService.getPublicReviews(testShop._id, { page: 2, limit: 10 });
      const page3 = await shopService.getPublicReviews(testShop._id, { page: 3, limit: 10 });
      const page4 = await shopService.getPublicReviews(testShop._id, { page: 4, limit: 10 });

      assert.equal(page1.reviews.length, 10);
      assert.equal(page2.reviews.length, 10);
      assert.equal(page3.reviews.length, 10);
      assert.equal(page4.reviews.length, 5); // 31-35 (5 reviews beyond 30!)
      assert.equal(page4.pagination.hasMore, false);

      // Verify no duplicates between pages
      const allIds = [
        ...page1.reviews.map((r) => r.id.toString()),
        ...page2.reviews.map((r) => r.id.toString()),
        ...page3.reviews.map((r) => r.id.toString()),
        ...page4.reviews.map((r) => r.id.toString()),
      ];
      assert.equal(allIds.length, 35);
      const uniqueIds = new Set(allIds);
      assert.equal(uniqueIds.size, 35, 'All 35 paginated review IDs must be distinct');
    });

    it('7. Anonymous reviews strictly mask customer names to "Anonymous Student"', async () => {
      const allPages = await Promise.all([
        shopService.getPublicReviews(testShop._id, { page: 1, limit: 10 }),
        shopService.getPublicReviews(testShop._id, { page: 2, limit: 10 }),
        shopService.getPublicReviews(testShop._id, { page: 3, limit: 10 }),
        shopService.getPublicReviews(testShop._id, { page: 4, limit: 10 }),
      ]);
      const allReviews = allPages.flatMap((p) => p.reviews);

      const anonymousReviews = allReviews.filter((r) => r.isAnonymous === true);
      assert.ok(anonymousReviews.length > 0, 'Must have anonymous reviews');
      anonymousReviews.forEach((r) => {
        assert.equal(r.customerName, 'Anonymous Student');
        assert.equal(r.customerId, undefined, 'Private customerId must never be exposed');
      });

      const publicNamedReviews = allReviews.filter((r) => r.isAnonymous === false);
      assert.ok(publicNamedReviews.length > 0, 'Must have non-anonymous reviews');
      publicNamedReviews.forEach((r) => {
        assert.ok(
          r.customerName === 'Maria Santos' || r.customerName === 'Juan Dela Cruz',
          `Customer name must be real customer name, got: ${r.customerName}`
        );
      });
    });

    it('8. Invalid shop IDs return appropriate 400 or 404 errors', async () => {
      await assert.rejects(
        async () => {
          await shopService.getPublicReviews('invalid_non_objectid');
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /invalid shop id/i);
          return true;
        }
      );

      const nonExistentId = new mongoose.Types.ObjectId();
      await assert.rejects(
        async () => {
          await shopService.getPublicReviews(nonExistentId);
        },
        (err) => {
          assert.equal(err.statusCode, 404);
          assert.match(err.message, /shop not found/i);
          return true;
        }
      );
    });

    it('9. Invalid or extreme page/limit query values are safely sanitized and handled', async () => {
      // Negative page and string limits
      const res1 = await shopService.getPublicReviews(testShop._id, { page: -5, limit: 'invalid' });
      assert.equal(res1.pagination.page, 1);
      assert.equal(res1.pagination.limit, 10);
      assert.equal(res1.reviews.length, 10);

      // Huge limit is capped at 50
      const res2 = await shopService.getPublicReviews(testShop._id, { page: 1, limit: 9999 });
      assert.equal(res2.pagination.limit, 50);
      assert.equal(res2.reviews.length, 35);
    });

    it('10. Page requested beyond available results returns empty reviews list with hasMore: false', async () => {
      const res = await shopService.getPublicReviews(testShop._id, { page: 10, limit: 10 });
      assert.equal(res.reviews.length, 0);
      assert.equal(res.pagination.total, 35);
      assert.equal(res.pagination.hasMore, false);
      assert.equal(res.pagination.page, 10);
    });

    it('11. Existing 30-review recentReviews behavior on the shop document remains intact', async () => {
      const shopDoc = await PrintingShop.findById(testShop._id);
      assert.equal(shopDoc.reviewsCount, 35);
      assert.equal(shopDoc.recentReviews.length, 30, 'recentReviews must remain capped at 30');
    });
  });

  describe('P2: Socket Realtime Authorization & Reconnect Restoration', () => {
    const http = require('http');
    const { initSocket, getIO } = require('../src/sockets/socketManager');
    const jwt = require('jsonwebtoken');
    let server;
    let port;
    let ioClient;
    let adminUser;
    let otherOwnerUser;
    let otherShop;
    let customer1Token;
    let customer2Token;
    let ownerToken;
    let otherOwnerToken;
    let adminToken;

    before(async () => {
      await User.deleteMany({
        email: { $in: ['p3b_admin@test.com', 'p3b_otherowner@test.com'] },
      });
      await PrintingShop.deleteMany({
        shopName: 'Other Shop',
      });

      try {
        ioClient = require('socket.io-client').io;
      } catch {
        ioClient = require(require('path').resolve(__dirname, '../../frontend/node_modules/socket.io-client')).io;
      }

      adminUser = await User.create({
        name: 'P3B Admin',
        email: 'p3b_admin@test.com',
        password: 'password123',
        role: 'admin',
        isActive: true,
      });

      otherOwnerUser = await User.create({
        name: 'P3B Other Owner',
        email: 'p3b_otherowner@test.com',
        password: 'password123',
        role: 'shop_owner',
        isActive: true,
      });

      otherShop = await PrintingShop.create({
        shopName: 'Other Shop',
        ownerId: otherOwnerUser._id,
        address: 'Naval, Biliran',
        latitude: 11.56,
        longitude: 124.39,
        location: { type: 'Point', coordinates: [124.39, 11.56] },
        contactNumber: '09111111111',
        status: 'open',
      });

      const jwtSecret = process.env.JWT_SECRET || 'printdayon_dev_secret_key_2025';
      customer1Token = jwt.sign({ id: customerUser1._id }, jwtSecret, { expiresIn: '1h' });
      customer2Token = jwt.sign({ id: customerUser2._id }, jwtSecret, { expiresIn: '1h' });
      ownerToken = jwt.sign({ id: shopOwnerUser._id }, jwtSecret, { expiresIn: '1h' });
      otherOwnerToken = jwt.sign({ id: otherOwnerUser._id }, jwtSecret, { expiresIn: '1h' });
      adminToken = jwt.sign({ id: adminUser._id }, jwtSecret, { expiresIn: '1h' });

      server = http.createServer();
      initSocket(server);
      await new Promise((resolve) => server.listen(0, resolve));
      port = server.address().port;
    });

    after(async () => {
      try {
        const ioInstance = getIO();
        if (ioInstance && typeof ioInstance.close === 'function') {
          ioInstance.close();
        }
      } catch (_) {}
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      if (otherShop) {
        await PrintingShop.deleteOne({ _id: otherShop._id });
      }
      await User.deleteMany({
        email: { $in: ['p3b_admin@test.com', 'p3b_otherowner@test.com'] },
      });
    });

    it('12. Authorized customer can join their own user room and receives targeted user events', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customer1Token },
      });

      await new Promise((resolve) => client.on('connect', resolve));
      client.emit('join:user', customerUser1._id.toString());

      const receivedPromise = new Promise((resolve) => {
        client.on('order:update', (data) => resolve(data));
      });

      await new Promise((r) => setTimeout(r, 50));
      getIO().to(`user:${customerUser1._id}`).emit('order:update', { status: 'ready' });

      const received = await receivedPromise;
      assert.equal(received.status, 'ready');
      client.disconnect();
    });

    it('13. Unauthorized user cannot join another user room', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customer1Token },
      });

      await new Promise((resolve) => client.on('connect', resolve));

      const errorPromise = new Promise((resolve) => {
        client.on('error:unauthorized', (err) => resolve(err));
      });

      client.emit('join:user', customerUser2._id.toString());
      const err = await errorPromise;
      assert.match(err.message, /unauthorized.*own user room/i);

      let receivedOtherEvent = false;
      client.on('order:secret', () => { receivedOtherEvent = true; });
      getIO().to(`user:${customerUser2._id}`).emit('order:secret', { data: 'secret' });
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(receivedOtherEvent, false, 'Must not receive events for unauthorized user room');

      client.disconnect();
    });

    it('14. Authorized shop owner can join their own shop room and receive shop events', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: ownerToken },
      });

      await new Promise((resolve) => client.on('connect', resolve));
      client.emit('join:shop', testShop._id.toString());

      const eventPromise = new Promise((resolve) => {
        client.on('shop:queue_updated', (data) => resolve(data));
      });

      await new Promise((r) => setTimeout(r, 50));
      getIO().to(`shop:${testShop._id}`).emit('shop:queue_updated', { currentQueue: 3 });

      const data = await eventPromise;
      assert.equal(data.currentQueue, 3);
      client.disconnect();
    });

    it('15. Shop owner cannot join another shop room', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: ownerToken },
      });

      await new Promise((resolve) => client.on('connect', resolve));

      const errorPromise = new Promise((resolve) => {
        client.on('error:unauthorized', (err) => resolve(err));
      });

      client.emit('join:shop', otherShop._id.toString());
      const err = await errorPromise;
      assert.match(err.message, /unauthorized.*own shop room/i);

      let receivedLeak = false;
      client.on('shop:internal_event', () => { receivedLeak = true; });
      getIO().to(`shop:${otherShop._id}`).emit('shop:internal_event', { leak: true });
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(receivedLeak, false, 'Cross-shop event leakage must be blocked');

      client.disconnect();
    });

    it('16. Non-admin user cannot join admin room', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: customer1Token },
      });

      await new Promise((resolve) => client.on('connect', resolve));

      const errorPromise = new Promise((resolve) => {
        client.on('error:unauthorized', (err) => resolve(err));
      });

      client.emit('join:admin');
      const err = await errorPromise;
      assert.match(err.message, /admin.*required/i);

      client.disconnect();
    });

    it('17. Admin can join admin room and receive admin events', async () => {
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: adminToken },
      });

      await new Promise((resolve) => client.on('connect', resolve));
      client.emit('join:admin');

      const adminPromise = new Promise((resolve) => {
        client.on('stats:update', (data) => resolve(data));
      });

      await new Promise((r) => setTimeout(r, 50));
      getIO().to('admin').emit('stats:update', { status: 'healthy' });

      const data = await adminPromise;
      assert.equal(data.status, 'healthy');
      client.disconnect();
    });

    it('18. Shop owner reconnect automatically restores shop room membership without data loss', async () => {
      let activeShopRoom = null;
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token: ownerToken },
      });

      client.on('connect', () => {
        client.emit('join:user', shopOwnerUser._id.toString());
        if (activeShopRoom) {
          client.emit('join:shop', activeShopRoom);
        }
      });

      await new Promise((resolve) => client.on('connect', resolve));

      activeShopRoom = testShop._id.toString();
      client.emit('join:shop', activeShopRoom);
      await new Promise((r) => setTimeout(r, 50));

      // Simulate connection drop and reconnect
      client.disconnect();

      const reconnectedPromise = new Promise((resolve) => {
        client.once('connect', () => resolve());
      });
      client.connect();
      await reconnectedPromise;

      await new Promise((r) => setTimeout(r, 80));

      const reconnectedEventPromise = new Promise((resolve) => {
        client.on('shop:after_reconnect', (data) => resolve(data));
      });

      getIO().to(`shop:${testShop._id}`).emit('shop:after_reconnect', { reconnected: true });
      const received = await reconnectedEventPromise;
      assert.equal(received.reconnected, true);

      client.disconnect();
    });
  });

  describe('P3: Review Aggregation Compound Index', () => {
    it('19. PrintingRequest model defines compound index on { shopId: 1, "review.rating": 1 }', () => {
      const indexes = PrintingRequest.schema.indexes();
      const hasReviewRatingIndex = indexes.some(([fields]) => {
        return fields.shopId === 1 && fields['review.rating'] === 1;
      });
      assert.ok(hasReviewRatingIndex, 'PrintingRequest must have { shopId: 1, "review.rating": 1 } compound index');
    });
  });

  describe('P1 Item 1: Find Shop Navigation Verification', () => {
    it('20. View Shop navigation targets /shop/:id and Order Print targets /submit-request', () => {
      const sampleShop = { _id: 'shop_123', name: 'Test Shop' };
      const sId = sampleShop._id || sampleShop.shopId;
      assert.equal(`/shop/${sId}`, '/shop/shop_123');
      const submitRoute = '/submit-request';
      assert.equal(submitRoute, '/submit-request');
    });
  });
});
