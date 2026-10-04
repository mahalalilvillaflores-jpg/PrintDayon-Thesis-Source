const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const PrintingShop = require('../src/models/PrintingShop');
const Document = require('../src/models/Document');
const PrintingRequest = require('../src/models/PrintingRequest');
const authService = require('../src/services/authService');
const shopService = require('../src/services/shopService');
const shopRepository = require('../src/repositories/shopRepository');
const requestService = require('../src/services/requestService');
const documentController = require('../src/controllers/documentController');
const { validateFileSignature, UPLOAD_DIR } = require('../src/middleware/uploadMiddleware');

describe('Phase 4: Security, Integrity & Routing Test Suite', () => {
  let customerUser1;
  let customerUser2;
  let shopOwnerUser1;
  let shopOwnerUser2;
  let newShopOwnerWithoutShop;
  let adminUser;

  let customerToken1;
  let customerToken2;
  let shopOwnerToken1;
  let shopOwnerToken2;
  let adminToken;
  let testServer;
  let baseUrl;

  let verifiedShop1;
  let verifiedShop2;
  let pendingShop;
  let rejectedShop;
  let suspendedShop;

  let customerDoc1;
  let customerDoc2;
  let orderShop1;

  before(async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    }

    // Clean up any test users
    await User.deleteMany({
      email: {
        $in: [
          'p4_cust1@test.com',
          'p4_cust2@test.com',
          'p4_owner1@test.com',
          'p4_owner2@test.com',
          'p4_newowner@test.com',
          'p4_admin@test.com',
        ],
      },
    });

    customerUser1 = await User.create({
      name: 'P4 Customer One',
      email: 'p4_cust1@test.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });

    customerUser2 = await User.create({
      name: 'P4 Customer Two',
      email: 'p4_cust2@test.com',
      password: 'Password123!',
      role: 'customer',
      isActive: true,
    });

    shopOwnerUser1 = await User.create({
      name: 'P4 Owner One',
      email: 'p4_owner1@test.com',
      password: 'Password123!',
      role: 'shop_owner',
      isActive: true,
    });

    shopOwnerUser2 = await User.create({
      name: 'P4 Owner Two',
      email: 'p4_owner2@test.com',
      password: 'Password123!',
      role: 'shop_owner',
      isActive: true,
    });

    newShopOwnerWithoutShop = await User.create({
      name: 'P4 New Owner',
      email: 'p4_newowner@test.com',
      password: 'Password123!',
      role: 'shop_owner',
      isActive: true,
    });

    adminUser = await User.create({
      name: 'P4 Admin',
      email: 'p4_admin@test.com',
      password: 'Password123!',
      role: 'admin',
      isActive: true,
    });

    // Create JWT tokens
    customerToken1 = jwt.sign({ id: customerUser1._id, role: 'customer' }, process.env.JWT_SECRET || 'test_secret');
    customerToken2 = jwt.sign({ id: customerUser2._id, role: 'customer' }, process.env.JWT_SECRET || 'test_secret');
    shopOwnerToken1 = jwt.sign({ id: shopOwnerUser1._id, role: 'shop_owner' }, process.env.JWT_SECRET || 'test_secret');
    shopOwnerToken2 = jwt.sign({ id: shopOwnerUser2._id, role: 'shop_owner' }, process.env.JWT_SECRET || 'test_secret');
    adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET || 'test_secret');

    // Create Shops
    verifiedShop1 = await PrintingShop.create({
      ownerId: shopOwnerUser1._id,
      shopName: 'P4 Verified Shop 1',
      address: 'P. Inocentes St, Naval, Biliran',
      latitude: 11.5636,
      longitude: 124.3985,
      location: { type: 'Point', coordinates: [124.3985, 11.5636] },
      status: 'open',
      verificationStatus: 'verified',
      operatingHours: [{ day: 'monday', open: '00:00', close: '23:59', isClosed: false }],
      pricing: { bwPerPage: 2.0, colorPerPage: 5.0, allowRush: true, rushFee: 20 },
      permitDocName: 'p4_verification_permit.pdf',
      permitDocUrl: '/uploads/p4_verification_permit.pdf',
      businessDocuments: [
        {
          type: 'mayors_permit',
          title: "Mayor's Permit",
          currentFile: {
            fileName: 'p4_verification_permit.pdf',
            fileUrl: '/uploads/p4_verification_permit.pdf',
            status: 'verified',
          },
        },
      ],
    });

    verifiedShop2 = await PrintingShop.create({
      ownerId: shopOwnerUser2._id,
      shopName: 'P4 Verified Shop 2',
      address: 'Castin St, Naval, Biliran',
      latitude: 11.5620,
      longitude: 124.3990,
      location: { type: 'Point', coordinates: [124.3990, 11.5620] },
      status: 'open',
      verificationStatus: 'verified',
      operatingHours: [{ day: 'monday', open: '00:00', close: '23:59', isClosed: false }],
      pricing: { bwPerPage: 2.5, colorPerPage: 6.0, allowRush: true, rushFee: 25 },
    });

    pendingShop = await PrintingShop.create({
      ownerId: new mongoose.Types.ObjectId(),
      shopName: 'P4 Pending Shop',
      address: 'Naval, Biliran',
      latitude: 11.5610,
      longitude: 124.3970,
      location: { type: 'Point', coordinates: [124.3970, 11.5610] },
      status: 'closed',
      verificationStatus: 'pending',
      pricing: { bwPerPage: 2.0, colorPerPage: 4.0 },
    });

    rejectedShop = await PrintingShop.create({
      ownerId: new mongoose.Types.ObjectId(),
      shopName: 'P4 Rejected Shop',
      address: 'Naval, Biliran',
      latitude: 11.5600,
      longitude: 124.3960,
      location: { type: 'Point', coordinates: [124.3960, 11.5600] },
      status: 'closed',
      verificationStatus: 'rejected',
      pricing: { bwPerPage: 2.0, colorPerPage: 4.0 },
    });

    suspendedShop = await PrintingShop.create({
      ownerId: new mongoose.Types.ObjectId(),
      shopName: 'P4 Suspended Shop',
      address: 'Naval, Biliran',
      latitude: 11.5590,
      longitude: 124.3950,
      location: { type: 'Point', coordinates: [124.3950, 11.5590] },
      status: 'closed',
      verificationStatus: 'suspended',
      pricing: { bwPerPage: 2.0, colorPerPage: 4.0 },
    });

    // Create test documents
    const dummyPath1 = path.join(UPLOAD_DIR, 'p4_doc1.pdf');
    fs.writeFileSync(dummyPath1, Buffer.from('%PDF-1.4\nTest PDF content 1'));

    customerDoc1 = await Document.create({
      customerId: customerUser1._id,
      originalFilename: 'Thesis_Chapter_1.pdf',
      storedFilename: 'p4_doc1.pdf',
      fileType: 'pdf',
      fileSize: 1024,
      storagePath: dummyPath1,
      pageCount: 15,
    });

    const dummyPath2 = path.join(UPLOAD_DIR, 'p4_doc2.pdf');
    fs.writeFileSync(dummyPath2, Buffer.from('%PDF-1.4\nTest PDF content 2'));

    customerDoc2 = await Document.create({
      customerId: customerUser2._id,
      originalFilename: 'Confidential_Thesis_2.pdf',
      storedFilename: 'p4_doc2.pdf',
      fileType: 'pdf',
      fileSize: 2048,
      storagePath: dummyPath2,
      pageCount: 30,
    });

    // Create order for Shop 1 with customerDoc1 and payment proof
    orderShop1 = await PrintingRequest.create({
      customerId: customerUser1._id,
      shopId: verifiedShop1._id,
      documentId: customerDoc1._id,
      status: 'pending',
      estimatedCost: 30,
      paymentProofUrl: '/uploads/p4_payment_proof.jpg',
      printingSpecifications: {
        copies: 1,
        paperSize: 'A4',
        colorMode: 'black_and_white',
        sided: 'single',
        totalPages: 15,
      },
    });

    // Write dummy assets to UPLOAD_DIR
    fs.writeFileSync(path.join(UPLOAD_DIR, 'storefront_p4_test.jpg'), Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A]));
    fs.writeFileSync(path.join(UPLOAD_DIR, 'p4_payment_proof.jpg'), Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A]));
    fs.writeFileSync(path.join(UPLOAD_DIR, 'p4_verification_permit.pdf'), Buffer.from('%PDF-1.4\nMayor Permit'));

    // Start ephemeral server for live HTTP tests
    const app = require('../src/app');
    testServer = app.listen(0);
    baseUrl = `http://127.0.0.1:${testServer.address().port}`;
  });

  // ==============================================================
  // A. SHOP VERIFICATION FLOW
  // ==============================================================
  describe('A. Shop Verification Flow', () => {
    it('1. New shop owner login/getProfile does not automatically create a verified shop', async () => {
      const loginResult = await authService.login({
        email: 'p4_newowner@test.com',
        password: 'Password123!',
      });
      assert.strictEqual(loginResult.user.shopId, null);
      assert.strictEqual(loginResult.user.requiresOnboarding, true);

      const profile = await authService.getProfile(newShopOwnerWithoutShop._id);
      assert.strictEqual(profile.shopId, null);
      assert.strictEqual(profile.requiresOnboarding, true);

      const shopInDb = await shopRepository.findByOwnerId(newShopOwnerWithoutShop._id);
      assert.strictEqual(shopInDb, null, 'No shop should be automatically created in MongoDB');
    });

    it('2. Calling getMyShop for owner without shop throws 404 with requiresOnboarding flag', async () => {
      await assert.rejects(
        async () => {
          await shopService.getMyShop(newShopOwnerWithoutShop._id);
        },
        (err) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.requiresOnboarding, true);
          return true;
        }
      );
    });

    it('3. Explicit shop creation (createShop) sets verificationStatus to pending and status to closed', async () => {
      const createdShop = await shopService.createShop(newShopOwnerWithoutShop._id, {
        shopName: "New Owner's Pending Shop",
        address: 'Naval Biliran',
        contactNumber: '09171234567',
        latitude: 11.5636,
        longitude: 124.3985,
      });

      assert.ok(createdShop);
      assert.strictEqual(createdShop.verificationStatus, 'pending');
      assert.strictEqual(createdShop.status, 'closed');

      // Cleanup newly created shop
      await PrintingShop.findByIdAndDelete(createdShop._id);
    });

    it('4. Pending shop cannot accept print requests (throws 400)', async () => {
      await assert.rejects(
        async () => {
          await requestService.submitRequest(customerUser1._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
            shopId: pendingShop._id,
            documentId: customerDoc1._id,
            customerLat: 11.56,
            customerLng: 124.39,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /pending administrator verification/i);
          return true;
        }
      );
    });

    it('5. Rejected shop cannot accept print requests (throws 400)', async () => {
      await assert.rejects(
        async () => {
          await requestService.submitRequest(customerUser1._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
            shopId: rejectedShop._id,
            documentId: customerDoc1._id,
            customerLat: 11.56,
            customerLng: 124.39,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /rejected/i);
          return true;
        }
      );
    });

    it('6. Suspended shop cannot accept print requests (throws 400)', async () => {
      await assert.rejects(
        async () => {
          await requestService.submitRequest(customerUser1._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
            shopId: suspendedShop._id,
            documentId: customerDoc1._id,
            customerLat: 11.56,
            customerLng: 124.39,
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /suspended/i);
          return true;
        }
      );
    });

    it('7. Verified shop can accept print requests', async () => {
      const order = await requestService.submitRequest(customerUser2._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
        shopId: verifiedShop2._id,
        documentId: customerDoc2._id,
        customerLat: 11.5620,
        customerLng: 124.3990,
        printingSpecs: { copies: 1, paperSize: 'A4', colorMode: 'black_and_white' },
      });
      assert.ok(order);
      assert.strictEqual(order.status, 'pending');
      assert.strictEqual(order.shopId.toString(), verifiedShop2._id.toString());
      // Cleanup
      await PrintingRequest.findByIdAndDelete(order._id);
    });

    it('8. Legitimate onboarding lifecycle: New owner -> requiresOnboarding -> explicit create (pending/closed) -> admin verify (verified) -> order accepted', async () => {
      // 1. New owner profile has requiresOnboarding
      const profile = await authService.getProfile(newShopOwnerWithoutShop._id);
      assert.strictEqual(profile.requiresOnboarding, true);
      assert.strictEqual(profile.shopId, null);

      // 2. Explicit createShop creates pending, closed shop
      const createdShop = await shopService.createShop(newShopOwnerWithoutShop._id, {
        shopName: "Legitimate Onboarded Shop",
        address: 'Almeria St, Naval Biliran',
        contactNumber: '09171234567',
        latitude: 11.5640,
        longitude: 124.3995,
      });
      assert.strictEqual(createdShop.verificationStatus, 'pending');
      assert.strictEqual(createdShop.status, 'closed');

      // 3. Admin verifies shop
      const verified = await shopService.verifyShop(createdShop._id, 'verified', adminUser._id);
      assert.strictEqual(verified.verificationStatus, 'verified');

      // 4. Owner opens shop
      await PrintingShop.findByIdAndUpdate(createdShop._id, { status: 'open' });

      // 5. Customer places order successfully
      const order = await requestService.submitRequest(customerUser1._id, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
        shopId: createdShop._id,
        documentId: customerDoc1._id,
        customerLat: 11.5640,
        customerLng: 124.3995,
        printingSpecs: { copies: 1, paperSize: 'A4', colorMode: 'black_and_white' },
      });
      assert.ok(order);
      assert.strictEqual(order.shopId.toString(), createdShop._id.toString());
      assert.strictEqual(order.status, 'pending');

      // Cleanup
      await PrintingRequest.findByIdAndDelete(order._id);
      await PrintingShop.findByIdAndDelete(createdShop._id);
    });
  });

  // ==============================================================
  // B. SHOP VISIBILITY & DISCOVERY
  // ==============================================================
  describe('B. Shop Visibility & Discovery', () => {
    it('9. Pending shop is excluded from customer recommendations (findTopNearbyEligible)', async () => {
      const eligible = await shopRepository.findTopNearbyEligible(124.3985, 11.5636);
      const containsPending = eligible.some((s) => s._id.toString() === pendingShop._id.toString());
      assert.strictEqual(containsPending, false, 'Pending shop must not appear in recommendations');
    });

    it('10. Rejected shop is excluded from customer recommendations', async () => {
      const eligible = await shopRepository.findTopNearbyEligible(124.3985, 11.5636);
      const containsRejected = eligible.some((s) => s._id.toString() === rejectedShop._id.toString());
      assert.strictEqual(containsRejected, false, 'Rejected shop must not appear in recommendations');
    });

    it('11. Suspended shop is excluded from customer recommendations', async () => {
      const eligible = await shopRepository.findTopNearbyEligible(124.3985, 11.5636);
      const containsSuspended = eligible.some((s) => s._id.toString() === suspendedShop._id.toString());
      assert.strictEqual(containsSuspended, false, 'Suspended shop must not appear in recommendations');
    });

    it('12. Verified shop is included in customer recommendations', async () => {
      const eligible = await shopRepository.findTopNearbyEligible(124.3985, 11.5636);
      const containsVerified = eligible.some((s) => s._id.toString() === verifiedShop1._id.toString());
      assert.strictEqual(containsVerified, true, 'Verified shop must appear in recommendations');
    });

    it('13. Unprivileged getAllShops queries default to verificationStatus: verified', async () => {
      const result = await shopService.getAllShops({}, { limit: 50 }, customerUser1);
      const anyUnverified = result.shops.some((s) => s.verificationStatus !== 'verified');
      assert.strictEqual(anyUnverified, false, 'Customer must never see unverified shops');
    });
  });

  // ==============================================================
  // C. ROUTE API & POLYLINE COORDINATES
  // ==============================================================
  describe('C. Route API & Polyline Coordinates', () => {
    it('14. Route endpoint validates shopId and rejects [object Object] with HTTP 400', async () => {
      const recommendationController = require('../src/controllers/recommendationController');
      let statusCalled = null;
      let jsonCalled = null;
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => { jsonCalled = data; },
          };
        },
      };

      const reqBad = {
        params: { shopId: '[object Object]' },
        query: { lat: 11.5636, lng: 124.3985 },
      };
      await recommendationController.getRouteToShop(reqBad, res, () => {});
      assert.strictEqual(statusCalled, 400);
      assert.strictEqual(jsonCalled.success, false);
      assert.match(jsonCalled.message, /valid shopid is required/i);
    });

    it('15. Route endpoint calculates and returns valid route coordinates along road network', async () => {
      const recommendationService = require('../src/services/recommendationService');
      const route = await recommendationService.getRouteToShop(11.5610, 124.3950, verifiedShop1._id, 'motor');
      assert.ok(route);
      assert.ok(route.pathCoordinates);
      assert.ok(route.pathCoordinates.length >= 2, 'Route must have at least origin and destination nodes');
      assert.ok(route.distanceMeters > 0);
    });

    it('16. Route coordinates are in strict GeoJSON [lng, lat] order', async () => {
      const recommendationService = require('../src/services/recommendationService');
      const route = await recommendationService.getRouteToShop(11.5610, 124.3950, verifiedShop1._id, 'motor');
      for (const [lng, lat] of route.pathCoordinates) {
        assert.ok(lng > 124.0 && lng < 125.0, `Expected longitude ~124.4, received ${lng}`);
        assert.ok(lat > 11.0 && lat < 12.0, `Expected latitude ~11.56, received ${lat}`);
      }
    });

    it('17. Dijkstra fallback coordinates seamlessly match polyline LineString requirements', async () => {
      const recommendationService = require('../src/services/recommendationService');
      const route = await recommendationService.getRouteToShop(11.5610, 124.3950, verifiedShop1._id, 'walking');
      const coords = route.pathCoordinates;

      const geoJsonFeature = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      };
      assert.strictEqual(geoJsonFeature.geometry.type, 'LineString');
      assert.ok(Array.isArray(geoJsonFeature.geometry.coordinates));
      assert.ok(geoJsonFeature.geometry.coordinates.length >= 2);
    });
  });

  // ==============================================================
  // D. DOCUMENT IDOR & AUTHORIZATION
  // ==============================================================
  describe('D. Document IDOR & Authorization', () => {
    it('18. Customer can access their own document', async () => {
      let statusCalled = null;
      let sendFileCalled = null;
      const req = {
        params: { id: customerDoc1._id.toString() },
        user: customerUser1,
      };
      const res = {
        status: (code) => { statusCalled = code; return res; },
        setHeader: () => {},
        sendFile: (filePath) => { sendFileCalled = filePath; },
      };

      await documentController.getDocument(req, res, () => {});
      assert.strictEqual(statusCalled, null, 'Should not return error status');
      assert.ok(sendFileCalled, 'Should stream document file to owner');
    });

    it('19. Customer cannot access another customer document (returns HTTP 403)', async () => {
      let statusCalled = null;
      let jsonCalled = null;
      const req = {
        params: { id: customerDoc2._id.toString() },
        user: customerUser1, // Customer 1 trying to access Customer 2's document
      };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => { jsonCalled = data; },
          };
        },
      };

      await documentController.getDocument(req, res, () => {});
      assert.strictEqual(statusCalled, 403);
      assert.strictEqual(jsonCalled.success, false);
      assert.match(jsonCalled.message, /access denied/i);
    });

    it('20. Authorized shop owner can access a document belonging to an order at their shop', async () => {
      let sendFileCalled = null;
      const req = {
        params: { id: customerDoc1._id.toString() }, // customerDoc1 has orderShop1 at verifiedShop1
        user: shopOwnerUser1, // Owner of verifiedShop1
      };
      const res = {
        status: () => res,
        setHeader: () => {},
        sendFile: (filePath) => { sendFileCalled = filePath; },
      };

      await documentController.getDocument(req, res, () => {});
      assert.ok(sendFileCalled, 'Shop owner must be able to view document for an order placed at their shop');
    });

    it('21. Shop owner cannot access a document belonging to another shop customer (returns HTTP 403)', async () => {
      let statusCalled = null;
      let jsonCalled = null;
      const req = {
        params: { id: customerDoc1._id.toString() }, // order placed at verifiedShop1
        user: shopOwnerUser2, // Owner of verifiedShop2 (unrelated competitor shop)
      };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => { jsonCalled = data; },
          };
        },
      };

      await documentController.getDocument(req, res, () => {});
      assert.strictEqual(statusCalled, 403);
      assert.strictEqual(jsonCalled.success, false);
      assert.match(jsonCalled.message, /access denied/i);
    });

    it('22. Shop owner cannot delete customer document (returns HTTP 403)', async () => {
      let statusCalled = null;
      let jsonCalled = null;
      const req = {
        params: { id: customerDoc1._id.toString() },
        user: shopOwnerUser1,
      };
      const res = {
        status: (code) => {
          statusCalled = code;
          return {
            json: (data) => { jsonCalled = data; },
          };
        },
      };

      await documentController.deleteDocument(req, res, () => {});
      assert.strictEqual(statusCalled, 403);
      assert.strictEqual(jsonCalled.success, false);
      assert.match(jsonCalled.message, /only the document owner or an administrator can delete/i);
    });

    it('23. Admin retains appropriate document access', async () => {
      let sendFileCalled = null;
      const req = {
        params: { id: customerDoc2._id.toString() },
        user: adminUser,
      };
      const res = {
        status: () => res,
        setHeader: () => {},
        sendFile: (filePath) => { sendFileCalled = filePath; },
      };

      await documentController.getDocument(req, res, () => {});
      assert.ok(sendFileCalled, 'Admin must retain access to documents');
    });
  });

  // ==============================================================
  // E. CROSS-SHOP ORDER IDOR
  // ==============================================================
  describe('E. Cross-Shop Order IDOR', () => {
    it('24. Customer can access own order details', async () => {
      const order = await requestService.getRequestById(orderShop1._id, customerUser1._id, 'customer');
      assert.ok(order);
      assert.strictEqual(order._id.toString(), orderShop1._id.toString());
    });

    it('25. Customer cannot access another customer order (throws 403)', async () => {
      await assert.rejects(
        async () => {
          await requestService.getRequestById(orderShop1._id, customerUser2._id, 'customer');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /access denied/i);
          return true;
        }
      );
    });

    it('26. Shop owner can access own shop order', async () => {
      const order = await requestService.getRequestById(orderShop1._id, shopOwnerUser1._id, 'shop_owner');
      assert.ok(order);
      assert.strictEqual(order._id.toString(), orderShop1._id.toString());
    });

    it('27. Shop owner cannot access another shop order (throws 403)', async () => {
      await assert.rejects(
        async () => {
          await requestService.getRequestById(orderShop1._id, shopOwnerUser2._id, 'shop_owner');
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.match(err.message, /access denied/i);
          assert.match(err.message, /your own shop/i);
          return true;
        }
      );
    });

    it('28. Admin retains access to view any order', async () => {
      const order = await requestService.getRequestById(orderShop1._id, adminUser._id, 'admin');
      assert.ok(order);
      assert.strictEqual(order._id.toString(), orderShop1._id.toString());
    });
  });

  // ==============================================================
  // F. DOCUMENT MIME & FILE SIGNATURE VALIDATION
  // ==============================================================
  describe('F. Document MIME & File Signature Validation', () => {
    const tmpDir = path.join(__dirname, 'temp_sig_test');

    before(() => {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    });

    after(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    });

    it('29. Valid PDF file with %PDF- signature is accepted', () => {
      const pdfPath = path.join(tmpDir, 'valid.pdf');
      fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.7\nSample PDF payload'));
      const result = validateFileSignature(pdfPath, 'valid.pdf', 'application/pdf');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.detectedType, 'pdf');
    });

    it('30. Valid DOCX file with ZIP PK header is accepted', () => {
      const docxPath = path.join(tmpDir, 'valid.docx');
      fs.writeFileSync(docxPath, Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00]));
      const result = validateFileSignature(docxPath, 'valid.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.detectedType, 'docx');
    });

    it('31. Valid JPEG file with 0xFF 0xD8 0xFF header is accepted', () => {
      const jpgPath = path.join(tmpDir, 'valid.jpg');
      fs.writeFileSync(jpgPath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A]));
      const result = validateFileSignature(jpgPath, 'valid.jpg', 'image/jpeg');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.detectedType, 'jpg');
    });

    it('32. Valid PNG file with PNG magic bytes is accepted', () => {
      const pngPath = path.join(tmpDir, 'valid.png');
      fs.writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
      const result = validateFileSignature(pngPath, 'valid.png', 'image/png');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.detectedType, 'png');
    });

    it('33. Spoofed MIME type (executable script pretending to be PDF) is rejected', () => {
      const fakePdfPath = path.join(tmpDir, 'malicious.pdf');
      fs.writeFileSync(fakePdfPath, Buffer.from('#!/bin/bash\necho "exploit"\n'));
      const result = validateFileSignature(fakePdfPath, 'malicious.pdf', 'application/pdf');
      assert.strictEqual(result.valid, false);
      assert.match(result.error, /invalid file signature/i);
    });

    it('34. Unsupported file type (.exe) is rejected', () => {
      const exePath = path.join(tmpDir, 'program.exe');
      fs.writeFileSync(exePath, Buffer.from([0x4D, 0x5A, 0x90, 0x00])); // MZ DOS executable header
      const result = validateFileSignature(exePath, 'program.exe', 'application/x-msdownload');
      assert.strictEqual(result.valid, false);
      assert.match(result.error, /invalid file signature/i);
    });

    it('35. Malformed/empty 0-byte file is rejected', () => {
      const emptyPath = path.join(tmpDir, 'empty.pdf');
      fs.writeFileSync(emptyPath, Buffer.alloc(0));
      const result = validateFileSignature(emptyPath, 'empty.pdf', 'application/pdf');
      assert.strictEqual(result.valid, false);
      assert.match(result.error, /file is empty or corrupted/i);
    });
  });

  // ==============================================================
  // G. PRIVATE FILES ACCESS
  // ==============================================================
  describe('G. Private Files Access Protection', () => {
    it('36. Public storefront image is accessible without authentication (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/uploads/storefront_p4_test.jpg`);
      assert.strictEqual(res.status, 200);
    });

    it('37. Direct static access to private customer document without JWT is blocked (HTTP 403)', async () => {
      const res = await fetch(`${baseUrl}/uploads/p4_doc1.pdf`);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /direct access to customer documents is forbidden/i);
    });

    it('38. Direct static access to customer document with JWT is blocked (must use API endpoint)', async () => {
      const res = await fetch(`${baseUrl}/uploads/p4_doc1.pdf`, {
        headers: { Authorization: `Bearer ${customerToken1}` },
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.message, /access via \/api\/documents\/:id/i);
    });

    it('39. Authorized customer can retrieve their private document via authenticated API', async () => {
      let sendFileCalled = null;
      const req = {
        params: { id: customerDoc1._id.toString() },
        user: customerUser1,
      };
      const res = {
        status: () => res,
        setHeader: () => {},
        sendFile: (filePath) => { sendFileCalled = filePath; },
      };
      await documentController.getDocument(req, res, () => {});
      assert.ok(sendFileCalled, 'Authorized customer must be able to retrieve own document');
    });

    it('40. Unauthorized shop owner cannot retrieve another shop customer document via API', async () => {
      let statusCalled = null;
      const req = {
        params: { id: customerDoc1._id.toString() },
        user: shopOwnerUser2, // Competitor shop owner
      };
      const res = {
        status: (code) => { statusCalled = code; return { json: () => {} }; },
      };
      await documentController.getDocument(req, res, () => {});
      assert.strictEqual(statusCalled, 403);
    });

    it('41. Private payment proof without token returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /authentication required/i);
    });

    it('42. Private verification document without token returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/uploads/p4_verification_permit.pdf`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /authentication required/i);
    });

    it('43. Authenticated but unauthorized user requesting payment proof receives HTTP 403', async () => {
      // Unrelated Customer 2
      const resCust2 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg`, {
        headers: { Authorization: `Bearer ${customerToken2}` },
      });
      assert.strictEqual(resCust2.status, 403);
      const dataCust2 = await resCust2.json();
      assert.match(dataCust2.message, /not authorized to view this payment proof/i);

      // Unrelated Shop Owner 2
      const resOwner2 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg`, {
        headers: { Authorization: `Bearer ${shopOwnerToken2}` },
      });
      assert.strictEqual(resOwner2.status, 403);
    });

    it('44. Authorized users (owning customer, receiving shop owner, admin) can access payment proof', async () => {
      // Customer 1 who placed the order
      const resCust1 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg`, {
        headers: { Authorization: `Bearer ${customerToken1}` },
      });
      assert.strictEqual(resCust1.status, 200);

      // Shop Owner 1 whose shop received the order
      const resOwner1 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg`, {
        headers: { Authorization: `Bearer ${shopOwnerToken1}` },
      });
      assert.strictEqual(resOwner1.status, 200);

      // Admin
      const resAdmin = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resAdmin.status, 200);
    });

    it('45. Authenticated unauthorized user requesting verification document receives HTTP 403', async () => {
      // Competitor Shop Owner 2
      const resOwner2 = await fetch(`${baseUrl}/uploads/p4_verification_permit.pdf`, {
        headers: { Authorization: `Bearer ${shopOwnerToken2}` },
      });
      assert.strictEqual(resOwner2.status, 403);
      const dataOwner2 = await resOwner2.json();
      assert.match(dataOwner2.message, /not authorized to view this verification document/i);

      // Unrelated Customer
      const resCust1 = await fetch(`${baseUrl}/uploads/p4_verification_permit.pdf`, {
        headers: { Authorization: `Bearer ${customerToken1}` },
      });
      assert.strictEqual(resCust1.status, 403);
    });

    it('46. Authorized users (shop owner, admin) can access verification document', async () => {
      // Owning Shop Owner 1
      const resOwner1 = await fetch(`${baseUrl}/uploads/p4_verification_permit.pdf`, {
        headers: { Authorization: `Bearer ${shopOwnerToken1}` },
      });
      assert.strictEqual(resOwner1.status, 200);

      // Admin
      const resAdmin = await fetch(`${baseUrl}/uploads/p4_verification_permit.pdf`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resAdmin.status, 200);
    });

    it('47. Unauthenticated request to /api/printing-requests/:id/payment-proof returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/printing-requests/${orderShop1._id}/payment-proof`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.match(data.message, /access denied|no token/i);
    });

    it('48. Unauthorized users requesting /api/printing-requests/:id/payment-proof receive HTTP 403', async () => {
      // Unrelated Customer 2
      const resCust2 = await fetch(`${baseUrl}/api/printing-requests/${orderShop1._id}/payment-proof`, {
        headers: { Authorization: `Bearer ${customerToken2}` },
      });
      assert.strictEqual(resCust2.status, 403);
      const dataCust2 = await resCust2.json();
      assert.match(dataCust2.message, /forbidden|not authorized/i);

      // Wrong Shop Owner 2
      const resOwner2 = await fetch(`${baseUrl}/api/printing-requests/${orderShop1._id}/payment-proof`, {
        headers: { Authorization: `Bearer ${shopOwnerToken2}` },
      });
      assert.strictEqual(resOwner2.status, 403);
      const dataOwner2 = await resOwner2.json();
      assert.match(dataOwner2.message, /forbidden|not authorized/i);
    });

    it('49. Authorized users can access payment proof via /api/printing-requests/:id/payment-proof', async () => {
      // Authorized Shop Owner 1 via Bearer header
      const resOwner1Header = await fetch(`${baseUrl}/api/printing-requests/${orderShop1._id}/payment-proof`, {
        headers: { Authorization: `Bearer ${shopOwnerToken1}` },
      });
      assert.strictEqual(resOwner1Header.status, 200);
      assert.strictEqual(resOwner1Header.headers.get('content-type'), 'image/jpeg');

      // Authorized Shop Owner 1 via ?token= query param (used by frontend img / viewer)
      const resOwner1Query = await fetch(`${baseUrl}/api/printing-requests/${orderShop1._id}/payment-proof?token=${encodeURIComponent(shopOwnerToken1)}`);
      assert.strictEqual(resOwner1Query.status, 200);
      assert.strictEqual(resOwner1Query.headers.get('content-type'), 'image/jpeg');

      // Owning Customer 1 via Bearer header and ?token=
      const resCust1 = await fetch(`${baseUrl}/api/printing-requests/${orderShop1._id}/payment-proof?token=${encodeURIComponent(customerToken1)}`);
      assert.strictEqual(resCust1.status, 200);

      // Admin via Bearer header
      const resAdmin = await fetch(`${baseUrl}/api/printing-requests/${orderShop1._id}/payment-proof`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resAdmin.status, 200);
    });

    it('50. Query-token access on /uploads/p4_payment_proof.jpg authorizes correctly and denies wrong owner', async () => {
      // Authorized Shop Owner 1 via ?token=
      const resOwner1 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg?token=${encodeURIComponent(shopOwnerToken1)}`);
      assert.strictEqual(resOwner1.status, 200);

      // Wrong Shop Owner 2 via ?token= -> HTTP 403
      const resOwner2 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg?token=${encodeURIComponent(shopOwnerToken2)}`);
      assert.strictEqual(resOwner2.status, 403);

      // Unrelated Customer 2 via ?token= -> HTTP 403
      const resCust2 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg?token=${encodeURIComponent(customerToken2)}`);
      assert.strictEqual(resCust2.status, 403);

      // Owning Customer 1 via ?token= -> HTTP 200
      const resCust1 = await fetch(`${baseUrl}/uploads/p4_payment_proof.jpg?token=${encodeURIComponent(customerToken1)}`);
      assert.strictEqual(resCust1.status, 200);
    });

    it('51. Payment proof endpoint returns 404 for nonexistent order or order without proof', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const resNotFound = await fetch(`${baseUrl}/api/printing-requests/${fakeId}/payment-proof`, {
        headers: { Authorization: `Bearer ${shopOwnerToken1}` },
      });
      assert.strictEqual(resNotFound.status, 404);
    });
  });

  after(async () => {
    if (testServer) {
      testServer.close();
    }
    try {
      await User.deleteMany({
        email: {
          $in: [
            'p4_cust1@test.com',
            'p4_cust2@test.com',
            'p4_owner1@test.com',
            'p4_owner2@test.com',
            'p4_newowner@test.com',
            'p4_admin@test.com',
          ],
        },
      });
      await PrintingShop.deleteMany({
        shopName: {
          $in: [
            'P4 Verified Shop 1',
            'P4 Verified Shop 2',
            'P4 Pending Shop',
            'P4 Rejected Shop',
            'P4 Suspended Shop',
            'Legitimate Onboarded Shop',
          ],
        },
      });
      await Document.deleteMany({
        _id: { $in: [customerDoc1?._id, customerDoc2?._id].filter(Boolean) },
      });
      await PrintingRequest.deleteMany({
        _id: { $in: [orderShop1?._id].filter(Boolean) },
      });

      try { fs.unlinkSync(path.join(UPLOAD_DIR, 'p4_doc1.pdf')); } catch (_) {}
      try { fs.unlinkSync(path.join(UPLOAD_DIR, 'p4_doc2.pdf')); } catch (_) {}
      try { fs.unlinkSync(path.join(UPLOAD_DIR, 'storefront_p4_test.jpg')); } catch (_) {}
      try { fs.unlinkSync(path.join(UPLOAD_DIR, 'p4_payment_proof.jpg')); } catch (_) {}
      try { fs.unlinkSync(path.join(UPLOAD_DIR, 'p4_verification_permit.pdf')); } catch (_) {}
    } catch (_) {}
    await mongoose.disconnect();
  });
});


