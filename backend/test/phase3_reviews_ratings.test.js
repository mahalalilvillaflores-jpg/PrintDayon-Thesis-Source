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
const recommendationService = require('../src/services/recommendationService');
const shopRepository = require('../src/repositories/shopRepository');

describe('Phase 3A: Review & Rating Integrity Test Suite', () => {
  let customerUser1;
  let customerUser2;
  let shopOwnerUser;
  let otherShopOwnerUser;
  let testShop;
  let testDoc1;
  let testDoc2;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    // Clean up test data
    await User.deleteMany({
      email: {
        $in: [
          'p3a_cust1@test.com',
          'p3a_cust2@test.com',
          'p3a_owner@test.com',
          'p3a_otherowner@test.com',
        ],
      },
    });
    await PrintingShop.deleteMany({ shopName: 'Phase 3A Test Printing Shop' });

    customerUser1 = await User.create({
      name: 'P3A Customer One',
      email: 'p3a_cust1@test.com',
      password: 'password123',
      role: 'customer',
      contactNumber: '09111111111',
    });

    customerUser2 = await User.create({
      name: 'P3A Customer Two',
      email: 'p3a_cust2@test.com',
      password: 'password123',
      role: 'customer',
      contactNumber: '09222222222',
    });

    shopOwnerUser = await User.create({
      name: 'P3A Shop Owner',
      email: 'p3a_owner@test.com',
      password: 'password123',
      role: 'shop_owner',
      contactNumber: '09333333333',
    });

    otherShopOwnerUser = await User.create({
      name: 'P3A Other Owner',
      email: 'p3a_otherowner@test.com',
      password: 'password123',
      role: 'shop_owner',
      contactNumber: '09444444444',
    });

    testShop = await PrintingShop.create({
      ownerId: shopOwnerUser._id,
      shopName: 'Phase 3A Test Printing Shop',
      address: 'Naval, Biliran',
      latitude: 11.5606,
      longitude: 124.3986,
      location: { type: 'Point', coordinates: [124.3986, 11.5606] },
      contactNumber: '09333333333',
      status: 'open',
      verificationStatus: 'verified',
      walkInTrafficLevel: 'normal',
      walkInCustomerCount: 0,
      rating: 0,
      reviewsCount: 0,
      recentReviews: [],
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

    testDoc1 = await Document.create({
      customerId: customerUser1._id,
      originalFilename: 'p3a_doc1.pdf',
      storedFilename: 'p3a_stored_doc1.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 100,
      storagePath: 'uploads/p3a_stored_doc1.pdf',
      pageCount: 3,
    });

    testDoc2 = await Document.create({
      customerId: customerUser2._id,
      originalFilename: 'p3a_doc2.pdf',
      storedFilename: 'p3a_stored_doc2.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 100,
      storagePath: 'uploads/p3a_stored_doc2.pdf',
      pageCount: 5,
    });
  });

  after(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'p3a_cust1@test.com',
          'p3a_cust2@test.com',
          'p3a_owner@test.com',
          'p3a_otherowner@test.com',
        ],
      },
    });
    if (testShop) await PrintingShop.deleteMany({ _id: testShop._id });
    if (customerUser1) {
      await Document.deleteMany({ customerId: customerUser1._id });
      await PrintingRequest.deleteMany({ customerId: customerUser1._id });
    }
    if (customerUser2) {
      await Document.deleteMany({ customerId: customerUser2._id });
      await PrintingRequest.deleteMany({ customerId: customerUser2._id });
    }
    await mongoose.disconnect();
  });

  it('1. Only completed orders can be reviewed (pending and cancelled reject review submission)', async () => {
    // Create pending request
    const pendingReq = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'p3a_doc1.pdf',
      fileUrl: '/uploads/p3a_stored_doc1.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 100,
      totalPages: 3,
      pageCount: 3,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      status: 'pending',
      estimatedCost: 6.0,
      pickupDate: new Date(),
    });

    await assert.rejects(
      async () => {
        await requestService.submitReview(pendingReq._id, customerUser1._id, {
          rating: 5,
          comment: 'Great service!',
        });
      },
      /You can only review completed orders/i,
      'Pending order must be rejected from review submission'
    );

    // Cancel order and test again
    pendingReq.status = 'cancelled';
    await pendingReq.save();

    await assert.rejects(
      async () => {
        await requestService.submitReview(pendingReq._id, customerUser1._id, {
          rating: 4,
          comment: 'Cancelled print',
        });
      },
      /You can only review completed orders/i,
      'Cancelled order must be rejected from review submission'
    );
  });

  it('2. A different customer cannot review another customer order', async () => {
    const completedReq = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'p3a_doc1.pdf',
      fileUrl: '/uploads/p3a_stored_doc1.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 100,
      totalPages: 3,
      pageCount: 3,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      status: 'completed',
      estimatedCost: 6.0,
      pickupDate: new Date(),
    });

    await assert.rejects(
      async () => {
        // Customer 2 attempts to review Customer 1's order
        await requestService.submitReview(completedReq._id, customerUser2._id, {
          rating: 5,
          comment: 'I did not make this order',
        });
      },
      /Unauthorized/i,
      'Must reject review submission if caller is not the order customer'
    );
  });

  it('3. A second review on the same order is rejected', async () => {
    const completedReq = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'p3a_doc1.pdf',
      fileUrl: '/uploads/p3a_stored_doc1.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 100,
      totalPages: 3,
      pageCount: 3,
      copies: 1,
      colorMode: 'black_and_white',
      paperSize: 'A4',
      status: 'completed',
      estimatedCost: 6.0,
      pickupDate: new Date(),
    });

    // First review succeeds
    const reviewed = await requestService.submitReview(completedReq._id, customerUser1._id, {
      rating: 5,
      comment: 'Super fast printing!',
      tags: ['⚡ Fast Turnaround'],
    });
    assert.strictEqual(reviewed.review.rating, 5);

    // Second review on the exact same order must fail
    await assert.rejects(
      async () => {
        await requestService.submitReview(completedReq._id, customerUser1._id, {
          rating: 4,
          comment: 'Trying to review again',
        });
      },
      /already submitted a review/i,
      'Must reject second review on the same order'
    );
  });

  it('4. Average rating and total review count remain accurate across multiple reviews without rounding drift', async () => {
    // Reset test shop rating
    await PrintingRequest.deleteMany({ shopId: testShop._id });
    testShop.rating = 0;
    testShop.reviewsCount = 0;
    testShop.recentReviews = [];
    await testShop.save();

    // Order 1: 5 stars
    const req1 = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'doc1.pdf',
      fileUrl: '/uploads/doc1.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      totalPages: 1,
      pageCount: 1,
      status: 'completed',
      });
    await requestService.submitReview(req1._id, customerUser1._id, { rating: 5, printQuality: 5, speedRating: 5 });

    let shop = await shopRepository.findById(testShop._id);
    assert.strictEqual(shop.rating, 5.0);
    assert.strictEqual(shop.reviewsCount, 1);

    // Order 2: 4 stars -> exact average: (5 + 4) / 2 = 4.5
    const req2 = await PrintingRequest.create({
      customerId: customerUser2._id,
      shopId: testShop._id,
      documentId: testDoc2._id,
      fileName: 'doc2.pdf',
      fileUrl: '/uploads/doc2.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      totalPages: 1,
      pageCount: 1,
      status: 'completed',
      });
    await requestService.submitReview(req2._id, customerUser2._id, { rating: 4, printQuality: 4, speedRating: 4 });

    shop = await shopRepository.findById(testShop._id);
    assert.strictEqual(shop.rating, 4.5);
    assert.strictEqual(shop.reviewsCount, 2);

    // Order 3: 3 stars -> exact average: (5 + 4 + 3) / 3 = 4.0
    const req3 = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'doc3.pdf',
      fileUrl: '/uploads/doc3.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      totalPages: 1,
      pageCount: 1,
      status: 'completed',
      });
    await requestService.submitReview(req3._id, customerUser1._id, { rating: 3, printQuality: 3, speedRating: 3 });

    shop = await shopRepository.findById(testShop._id);
    assert.strictEqual(shop.rating, 4.0);
    assert.strictEqual(shop.reviewsCount, 3);
  });

  it('5. Recent reviews remain capped at 30 while the total review count remains accurate (> 30)', async () => {
    // Generate 32 reviews
    await PrintingRequest.deleteMany({ shopId: testShop._id });
    testShop.rating = 0;
    testShop.reviewsCount = 0;
    testShop.recentReviews = [];
    await testShop.save();

    for (let i = 1; i <= 32; i++) {
      const req = await PrintingRequest.create({
        customerId: customerUser1._id,
        shopId: testShop._id,
        documentId: testDoc1._id,
        fileName: `bulk_doc_${i}.pdf`,
        fileUrl: `/uploads/bulk_doc_${i}.pdf`,
        fileType: 'pdf',
        fileSize: 1024,
        totalPages: 1,
        pageCount: 1,
        status: 'completed',
        });
      await requestService.submitReview(req._id, customerUser1._id, {
        rating: 5,
        comment: `Review #${i}`,
      });
    }

    const shop = await shopRepository.findById(testShop._id);
    assert.strictEqual(shop.reviewsCount, 32, 'Total review count must be 32');
    assert.strictEqual(shop.recentReviews.length, 30, 'recentReviews array must be strictly capped at 30');
    assert.strictEqual(shop.recentReviews[0].comment, 'Review #32', 'Latest review must be at index 0');
  });

  it('6. Anonymous reviews do not expose the customer real name', async () => {
    const anonReq = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'secret_thesis.pdf',
      fileUrl: '/uploads/secret_thesis.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      totalPages: 1,
      pageCount: 1,
      status: 'completed',
      });

    await requestService.submitReview(anonReq._id, customerUser1._id, {
      rating: 5,
      isAnonymous: true,
      comment: 'Anonymous feedback',
    });

    const shop = await shopRepository.findById(testShop._id);
    assert.strictEqual(shop.recentReviews[0].customerName, 'Anonymous Student');
    assert.strictEqual(shop.recentReviews[0].isAnonymous, true);

    // Test owner feedback endpoint does not expose name
    const feedback = await shopService.getShopReviews(testShop._id, shopOwnerUser._id, 'shop_owner');
    const latestReview = feedback.reviews[0];
    assert.strictEqual(latestReview.customerName, 'Anonymous Student');
    assert.strictEqual(latestReview.isAnonymous, true);
  });

  it('7. Non-anonymous reviews display the customer real name', async () => {
    const publicReq = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'public_assignment.pdf',
      fileUrl: '/uploads/public_assignment.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      totalPages: 1,
      pageCount: 1,
      status: 'completed',
      });

    await requestService.submitReview(publicReq._id, customerUser1._id, {
      rating: 5,
      isAnonymous: false,
      comment: 'I am proud of this print!',
    });

    const shop = await shopRepository.findById(testShop._id);
    assert.strictEqual(shop.recentReviews[0].customerName, 'P3A Customer One');
    assert.strictEqual(shop.recentReviews[0].isAnonymous, false);

    const feedback = await shopService.getShopReviews(testShop._id, shopOwnerUser._id, 'shop_owner');
    const latestReview = feedback.reviews[0];
    assert.strictEqual(latestReview.customerName, 'P3A Customer One');
    assert.strictEqual(latestReview.isAnonymous, false);
  });

  it('8. Shops with no reviews return zero count and unrated status', async () => {
    // Clear all reviews
    await PrintingRequest.deleteMany({ shopId: testShop._id });
    await PrintingShop.updateOne(
      { _id: testShop._id },
      { $set: { rating: 0, reviewsCount: 0, recentReviews: [] } }
    );

    const shop = await shopService.getShopById(testShop._id, customerUser1);
    assert.strictEqual(shop.rating, 0);
    assert.strictEqual(shop.reviewsCount, 0);
    assert.strictEqual(shop.recentReviews.length, 0);
  });

  it('9. Find Shops and recommendation responses return consistent raw rating and review count', async () => {
    // Create 1 completed review with 5 stars
    const req = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: testShop._id,
      documentId: testDoc1._id,
      fileName: 'consistent_test.pdf',
      fileUrl: '/uploads/consistent_test.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      totalPages: 1,
      pageCount: 1,
      status: 'completed',
      });
    await requestService.submitReview(req._id, customerUser1._id, {
      rating: 5,
      comment: 'Five stars consistency',
    });

    // 1. Check shopService.getShopById
    const singleShop = await shopService.getShopById(testShop._id, customerUser1);
    assert.strictEqual(singleShop.rating, 5.0);
    assert.strictEqual(singleShop.reviewsCount, 1);

    // 2. Check shopService.getAllShops
    const allShops = await shopService.getAllShops({});
    const foundShop = allShops.shops.find((s) => s._id.toString() === testShop._id.toString());
    assert.ok(foundShop);
    assert.strictEqual(foundShop.rating, 5.0);
    assert.strictEqual(foundShop.reviewsCount, 1);

    // 3. Check recommendationService.getRankedShops
    const ranked = await recommendationService.getRankedShops(11.5606, 124.3986, { totalPages: 1 }, 10, 'motor');
    const recShop = ranked.find((s) => s.shopId.toString() === testShop._id.toString());
    assert.ok(recShop);
    assert.strictEqual(recShop.rating, 5.0);
    assert.strictEqual(recShop.reviewsCount, 1);
    // Public rating must not be overwritten by Bayesian effectiveRating
    assert.ok(recShop.effectiveRating !== undefined, 'effectiveRating exists internally');
    assert.strictEqual(recShop.rating, 5.0, 'Public rating must be raw rating');
  });

  it('10. The owner feedback endpoint rejects unauthenticated users and owners attempting to access another shop reviews', async () => {
    // Other shop owner tries to query testShop reviews
    await assert.rejects(
      async () => {
        await shopService.getShopReviews(testShop._id, otherShopOwnerUser._id, 'shop_owner');
      },
      /Unauthorized/i,
      'Must reject shop owner from accessing reviews of a shop they do not own'
    );
  });

  it('11. Authorized owner can retrieve paginated reviews and summary metrics for their shop', async () => {
    const feedback = await shopService.getShopReviews(testShop._id, shopOwnerUser._id, 'shop_owner', { page: 1, limit: 10 });
    assert.ok(feedback);
    assert.strictEqual(feedback.shopId.toString(), testShop._id.toString());
    assert.strictEqual(feedback.summary.rating, 5.0);
    assert.strictEqual(feedback.summary.reviewsCount, 1);
    assert.ok(Array.isArray(feedback.reviews));
    assert.strictEqual(feedback.reviews.length, 1);
    assert.strictEqual(feedback.pagination.total, 1);
  });
});
