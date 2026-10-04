const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const PrintingShop = require('../src/models/PrintingShop');
const Document = require('../src/models/Document');
const PrintingRequest = require('../src/models/PrintingRequest');
const requestService = require('../src/services/requestService');

describe('Option 1: Allow Print Orders When Shop Is Closed - Test Suite', () => {
  let customerUser;
  let shopOwnerUser;
  let otherShopOwnerUser;
  let openShop;
  let closedShop;
  let suspendedShop;
  let testDocument;
  let testDocument2;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    // Clean up previous test artifacts
    await User.deleteMany({ email: { $in: ['test_cust_closed@test.com', 'test_owner_closed@test.com', 'test_other_owner@test.com'] } });
    await PrintingShop.deleteMany({ shopName: { $in: ['Test Open Shop', 'Test Closed Shop', 'Test Suspended Shop'] } });

    // 1. Create test customer
    customerUser = await User.create({
      name: 'Test Customer',
      email: 'test_cust_closed@test.com',
      password: 'password123',
      role: 'customer',
      contactNumber: '09123456789',
    });

    // 2. Create test shop owner
    shopOwnerUser = await User.create({
      name: 'Test Shop Owner',
      email: 'test_owner_closed@test.com',
      password: 'password123',
      role: 'shop_owner',
      contactNumber: '09123456780',
    });

    // 3. Create another shop owner (for authorization testing)
    otherShopOwnerUser = await User.create({
      name: 'Other Shop Owner',
      email: 'test_other_owner@test.com',
      password: 'password123',
      role: 'shop_owner',
      contactNumber: '09123456781',
    });

    // 4. Create an Open Shop
    openShop = await PrintingShop.create({
      ownerId: shopOwnerUser._id,
      shopName: 'Test Open Shop',
      address: 'Castin St, Naval, Biliran',
      latitude: 11.56250,
      longitude: 124.39593,
      location: {
        type: 'Point',
        coordinates: [124.39593, 11.56250],
      },
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
      pricing: {
        bwPerPage: 2.0,
        colorPerPage: 4.0,
        rushFee: 20.0,
        allowRush: true,
      },
    });

    // 5. Create a Closed Shop (explicitly status: 'closed')
    closedShop = await PrintingShop.create({
      ownerId: shopOwnerUser._id,
      shopName: 'Test Closed Shop',
      address: 'P. Inocentes St, Naval, Biliran',
      latitude: 11.56360,
      longitude: 124.39850,
      location: {
        type: 'Point',
        coordinates: [124.39850, 11.56360],
      },
      status: 'closed',
      verificationStatus: 'verified',
      operatingHours: [
        { day: 'monday', open: '08:00', close: '17:00', isClosed: true },
        { day: 'tuesday', open: '08:00', close: '17:00', isClosed: true },
        { day: 'wednesday', open: '08:00', close: '17:00', isClosed: true },
        { day: 'thursday', open: '08:00', close: '17:00', isClosed: true },
        { day: 'friday', open: '08:00', close: '17:00', isClosed: true },
        { day: 'saturday', open: '08:00', close: '17:00', isClosed: true },
        { day: 'sunday', open: '08:00', close: '17:00', isClosed: true },
      ],
      pricing: {
        bwPerPage: 2.0,
        colorPerPage: 4.0,
        rushFee: 20.0,
        allowRush: true,
      },
    });

    // 6. Create a Suspended Shop (to verify suspension security check)
    suspendedShop = await PrintingShop.create({
      ownerId: shopOwnerUser._id,
      shopName: 'Test Suspended Shop',
      address: 'Naval, Biliran',
      latitude: 11.56360,
      longitude: 124.39850,
      location: {
        type: 'Point',
        coordinates: [124.39850, 11.56360],
      },
      status: 'open',
      verificationStatus: 'suspended',
      pricing: { bwPerPage: 2.0 },
    });

    // 7. Create customer documents
    testDocument = await Document.create({
      customerId: customerUser._id,
      originalFilename: 'THESIS-MANUSCRIPT.pdf',
      storedFilename: 'test_thesis_1234.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 1024,
      storagePath: 'uploads/test_thesis_1234.pdf',
      pageCount: 33,
    });

    testDocument2 = await Document.create({
      customerId: customerUser._id,
      originalFilename: 'THESIS-MANUSCRIPT-2.pdf',
      storedFilename: 'test_thesis_5678.pdf',
      fileType: 'pdf',
      fileSize: 500 * 1024,
      storagePath: 'uploads/test_thesis_5678.pdf',
      pageCount: 10,
    });
  });

  after(async () => {
    // Clean up created records
    if (customerUser) {
      await PrintingRequest.deleteMany({ customerId: customerUser._id });
      await Document.deleteMany({ customerId: customerUser._id });
      await User.deleteOne({ _id: customerUser._id });
    }
    if (shopOwnerUser) await User.deleteOne({ _id: shopOwnerUser._id });
    if (otherShopOwnerUser) await User.deleteOne({ _id: otherShopOwnerUser._id });
    if (openShop) await PrintingShop.deleteOne({ _id: openShop._id });
    if (closedShop) await PrintingShop.deleteOne({ _id: closedShop._id });
    if (suspendedShop) await PrintingShop.deleteOne({ _id: suspendedShop._id });
    await mongoose.disconnect();
  });

  it('1. Customer submits an order while the shop is open', async () => {
    const payload = {
      shopId: openShop._id,
      documentId: testDocument._id,
      paymentMethod: 'gcash',
      paymentProofUrl: '/uploads/test_receipt_open.jpg',
      printingSpecs: {
        totalPages: 33,
        copies: 1,
        colorMode: 'black_and_white',
        paperSize: 'A4',
        sided: 'single',
        binding: 'none',
      },
      isRush: false,
      customerLat: 11.56437,
      customerLng: 124.39964,
    };

    const order = await requestService.submitRequest(customerUser._id, payload);
    assert.ok(order._id, 'Order must be created in MongoDB');
    assert.strictEqual(order.status, 'pending', 'Initial status must be pending');
    assert.strictEqual(order.estimatedCost, 66.0, '33 pages at ₱2.00 must equal ₱66.00');
    assert.strictEqual(order.placedWhileShopClosed, false, 'Shop was open at time of order');
  });

  it('2. Customer submits an order while the shop is closed', async () => {
    const payload = {
      shopId: closedShop._id,
      documentId: testDocument._id,
      paymentMethod: 'gcash',
      paymentProofUrl: '/uploads/test_receipt_closed.jpg',
      printingSpecs: {
        totalPages: 33,
        copies: 1,
        colorMode: 'black_and_white',
        paperSize: 'A4',
        sided: 'single',
        binding: 'none',
      },
      isRush: true,
      customerLat: 11.56437,
      customerLng: 124.39964,
    };

    // Under Option 1: Must succeed without throwing a 400 error
    const order = await requestService.submitRequest(customerUser._id, payload);
    assert.ok(order._id, 'Order for closed shop must be created in MongoDB');
    assert.strictEqual(order.status, 'pending', 'Initial status must be pending');
    assert.strictEqual(order.estimatedCost, 86.0, '33 pages at ₱2.00 + ₱20.00 rush must equal ₱86.00');
    assert.strictEqual(order.placedWhileShopClosed, true, 'placedWhileShopClosed must be true');
    assert.strictEqual(order.isRush, true, 'Rush flag must be preserved');
  });

  it('3. Customer submits an order while the shop owner is logged out / offline', async () => {
    // The submission must persist to MongoDB asynchronously and independently of owner session
    const payload = {
      shopId: closedShop._id,
      documentId: testDocument2._id,
      paymentMethod: 'gcash',
      paymentProofUrl: '/uploads/test_receipt_offline.jpg',
      printingSpecs: {
        totalPages: 10,
        copies: 2,
        colorMode: 'color',
        paperSize: 'A4',
        sided: 'single',
        binding: 'none',
      },
      isRush: false,
      customerLat: 11.56437,
      customerLng: 124.39964,
    };

    const order = await requestService.submitRequest(customerUser._id, payload);
    assert.ok(order._id, 'Order must be saved to MongoDB even if shop owner is logged out');
    assert.strictEqual(order.estimatedCost, 80.0, '10 pages * 2 copies * ₱4.00 = ₱80.00');
    assert.strictEqual(order.placedWhileShopClosed, true, 'placedWhileShopClosed must be true');
  });

  it('4. Shop owner logs in / queries and retrieves previously submitted orders', async () => {
    // When owner logs in and loads orders via getShopRequests
    const result = await requestService.getShopRequests(closedShop._id, shopOwnerUser._id, {}, { page: 1, limit: 50 });
    assert.ok(Array.isArray(result.requests), 'Must return requests array');
    assert.ok(result.requests.length >= 2, 'Must contain orders submitted while closed/offline');

    const closedOrders = result.requests.filter((r) => r.placedWhileShopClosed);
    assert.ok(closedOrders.length >= 2, 'Should find orders placed while closed');
  });

  it('5. Shop owner refreshes dashboard and orders remain visible and persistent', async () => {
    const refreshed = await requestService.getShopRequests(closedShop._id, shopOwnerUser._id, { status: 'pending' }, { page: 1, limit: 10 });
    assert.ok(refreshed.total >= 2, 'Pending orders must persist across refreshes');
    refreshed.requests.forEach((r) => {
      const sId = r.shopId?._id ? r.shopId._id.toString() : r.shopId?.toString();
      assert.strictEqual(sId, closedShop._id.toString());
    });
  });

  it('6. Customer refreshes My Orders and submitted orders remain visible', async () => {
    const custOrders = await requestService.getCustomerRequests(customerUser._id, {}, { page: 1, limit: 10 });
    assert.ok(custOrders.requests.length >= 3, 'Customer must see all their submitted orders');
    const match = custOrders.requests.find((r) => {
      const sId = r.shopId?._id ? r.shopId._id.toString() : r.shopId?.toString();
      return sId === closedShop._id.toString();
    });
    assert.ok(match, 'Customer must see order placed at closed shop');
  });

  it('7. Verifies correct order status, document, page count, preferences, and total are saved', async () => {
    const pendingOrders = await PrintingRequest.find({ shopId: closedShop._id, customerId: customerUser._id });
    const target = pendingOrders.find((p) => p.isRush);

    assert.ok(target, 'Rush order should exist in MongoDB');
    assert.strictEqual(target.status, 'pending', 'Order status must be pending');
    assert.strictEqual(target.documentId.toString(), testDocument._id.toString(), 'Document ID must match');
    assert.strictEqual(target.printingSpecifications.totalPages, 33, 'Page count must be 33');
    assert.strictEqual(target.printingSpecifications.colorMode, 'black_and_white', 'Color mode must match');
    assert.strictEqual(target.estimatedCost, 86.0, 'Total cost must be ₱86.00');
    assert.strictEqual(target.rushFee, 20.0, 'Rush fee must be ₱20.00');
  });

  it('8. Invalid orders are still rejected (security and validation integrity)', async () => {
    // 8a. Non-existent shop
    const fakeShopId = new mongoose.Types.ObjectId();
    await assert.rejects(
      async () => {
        await requestService.submitRequest(customerUser._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
          shopId: fakeShopId,
          documentId: testDocument._id,
          printingSpecs: { totalPages: 1 },
        });
      },
      /Printing shop not found/i,
      'Must reject non-existent shop with 404'
    );

    // 8b. Suspended shop
    await assert.rejects(
      async () => {
        await requestService.submitRequest(customerUser._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
          shopId: suspendedShop._id,
          documentId: testDocument._id,
          printingSpecs: { totalPages: 1 },
        });
      },
      /suspended/i,
      'Must reject orders for suspended shops'
    );

    // 8c. Unauthorized document
    const otherCustId = new mongoose.Types.ObjectId();
    await assert.rejects(
      async () => {
        await requestService.submitRequest(otherCustId, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
          shopId: openShop._id,
          documentId: testDocument._id,
          printingSpecs: { totalPages: 1 },
        });
      },
      /unauthorized/i,
      'Must reject document belonging to another user'
    );
  });

  it('9. Unauthorized users cannot view or manage another shop orders', async () => {
    // otherShopOwnerUser trying to query closedShop owned by shopOwnerUser
    await assert.rejects(
      async () => {
        await requestService.getShopRequests(closedShop._id, otherShopOwnerUser._id, {}, {});
      },
      /Unauthorized/i,
      'Owner of another shop must receive 403 Unauthorized'
    );
  });

  it('10. Failed submissions or rapid retries do not create duplicates (idempotency check)', async () => {
    const payload = {
      shopId: openShop._id,
      documentId: testDocument._id,
      paymentMethod: 'gcash',
      paymentProofUrl: '/uploads/test_receipt_idempotency.jpg',
      printingSpecs: {
        totalPages: 5,
        copies: 1,
        colorMode: 'black_and_white',
      },
    };

    const first = await requestService.submitRequest(customerUser._id, payload);
    // Rapid duplicate submission within 15 seconds
    const second = await requestService.submitRequest(customerUser._id, payload);

    assert.strictEqual(first._id.toString(), second._id.toString(), 'Duplicate click within 15s must return the existing order without creating duplicate');
  });
});
