const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Shop = require('../src/models/PrintingShop');
const PrintingRequest = require('../src/models/PrintingRequest');
const Document = require('../src/models/Document');
const requestService = require('../src/services/requestService');

describe('Phase 4: Payment Proof Persistence & Misleading GCash Labels', () => {
  let customerId, shopOwnerId, shopId, documentId;

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon_test');
    await User.deleteMany({});
    await Shop.deleteMany({});
    await PrintingRequest.deleteMany({});
    await Document.deleteMany({});

    const shopOwner = await User.create({
      name: 'Owner', email: 'owner_pp@test.com', password: 'Password123!', role: 'shop_owner'
    });
    shopOwnerId = shopOwner._id;

    const customer = await User.create({
      name: 'Customer', email: 'customer_pp@test.com', password: 'Password123!', role: 'customer'
    });
    customerId = customer._id;

    const shop = await Shop.create({
      ownerId: shopOwnerId, shopName: 'Test Shop PP',
      address: 'Test Address', latitude: 11.1, longitude: 124.1,
      location: { type: 'Point', coordinates: [124.1, 11.1] },
      verificationStatus: 'verified', isOperational: true,
      pricing: { bwPerPage: 2 }
    });
    shopId = shop._id;

    const doc = await Document.create({
      customerId: customerId, originalFilename: 'test.pdf',
      storedFilename: 'test.pdf', storagePath: '/uploads/test.pdf',
      pageCount: 1, fileSize: 1024, fileType: 'pdf', status: 'active'
    });
    documentId = doc._id;
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('TEST A & B: Submitting an order with a valid payment proof URL correctly persists it', async () => {
    const proofUrl = '/uploads/fake-receipt-123.jpg';

    const request = await requestService.submitRequest(customerId, { paymentMethod: 'gcash', paymentProofUrl: '/uploads/test.jpg', 
      shopId, documentId,
      customerLat: 11.2, customerLng: 124.2, travelMode: 'motor',
      printingSpecs: { serviceType: 'doc_print', copies: 1, totalPages: 1 },
      paymentRefNumber: 'GCash Receipt Attached',
      paymentProofUrl: proofUrl
    });

    assert.strictEqual(request.paymentProofUrl, proofUrl);
    assert.strictEqual(request.paymentStatus, 'paid_verifying');
    
    const dbOrder = await PrintingRequest.findById(request._id);
    assert.strictEqual(dbOrder.paymentProofUrl, proofUrl);
  });

  it('TEST C: Shop owner receives the order with the correct paymentProofUrl', async () => {
    const result = await requestService.getShopRequests(shopId, shopOwnerId, {}, { limit: 10, page: 1 });
    assert.ok(result.requests.length > 0);
    assert.strictEqual(result.requests[0].paymentProofUrl, '/uploads/fake-receipt-123.jpg');
  });

  it('TEST D: Payment proof endpoint retrieves the correct URL (simulated via db check)', async () => {
    // The endpoint essentially retrieves the order and returns its paymentProofUrl.
    const result = await requestService.getShopRequests(shopId, shopOwnerId, {}, { limit: 10, page: 1 });
    assert.strictEqual(result.requests[0].paymentProofUrl, '/uploads/fake-receipt-123.jpg');
  });

  it('TEST E: Missing proof URL is rejected — GCash proof required before ordering', async () => {
    await PrintingRequest.deleteMany({});
    // The system now enforces GCash + proof upload before order creation.
    // Submitting with an empty paymentProofUrl must throw a 400 error.
    await assert.rejects(
      async () => {
        await requestService.submitRequest(customerId, {
          shopId,
          documentId,
          paymentMethod: 'gcash',
          paymentProofUrl: '',
          paymentRefNumber: 'Pending Receipt Upload',
          customerLat: 11.2,
          customerLng: 124.2,
          travelMode: 'motor',
          printingSpecs: { serviceType: 'doc_print', copies: 1, totalPages: 1 },
        });
      },
      (err) => {
        assert.ok(
          err.statusCode === 400 || /receipt|payment|GCash/i.test(err.message),
          'Expected payment validation error but got: ' + err.message
        );
        return true;
      },
      'Must reject order submission with an empty payment proof URL'
    );
  });
});
