const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const PrintingShop = require('../src/models/PrintingShop');
const User = require('../src/models/User');
const shopService = require('../src/services/shopService');

describe('Storefront Facade Photo Delete Service & File Safety Tests', () => {
  let ownerUser;
  let testShop;
  let sampleFilePath;
  let sampleFilename;

  before(async () => {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon_test');
      }

      // Create test shop owner
      ownerUser = await User.create({
        name: 'Facade Owner Test',
        email: `facade_owner_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'shop_owner',
        isEmailVerified: true,
      });

      // Create physical test file in uploads
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      sampleFilename = `test_facade_${Date.now()}.jpg`;
      sampleFilePath = path.join(uploadsDir, sampleFilename);
      fs.writeFileSync(sampleFilePath, 'fake_image_content');

      // Create shop with storefront photo and logo
      testShop = await PrintingShop.create({
        ownerId: ownerUser._id,
        shopName: 'Facade Test Print Shop',
        address: 'Naval, Biliran',
        landmark: 'Near BiPSU',
        contactNumber: '09123456789',
        latitude: 11.5628,
        longitude: 124.3980,
        location: { type: 'Point', coordinates: [124.3980, 11.5628] },
        storefrontPhotoUrl: `/uploads/${sampleFilename}`,
        storefrontPhotoName: sampleFilename,
        storefrontPhotoData: 'data:image/jpeg;base64,ZmFrZV9pbWFnZV9jb250ZW50',
        dtiDocUrl: '/uploads/dti_doc_keep.pdf',
        permitDocUrl: '/uploads/permit_doc_keep.pdf',
        verificationStatus: 'verified',
      });
    } catch (err) {
      console.error('BEFORE HOOK ERROR:', err);
      throw err;
    }
  });

  after(async () => {
    if (testShop) await PrintingShop.findByIdAndDelete(testShop._id);
    if (ownerUser) await User.findByIdAndDelete(ownerUser._id);
    if (fs.existsSync(sampleFilePath)) {
      try { fs.unlinkSync(sampleFilePath); } catch (e) {}
    }
  });

  it('should successfully delete storefront facade photo for authorized owner', async () => {
    try {
      assert.strictEqual(fs.existsSync(sampleFilePath), true, 'Sample file should exist before deletion');

      const updatedShop = await shopService.deleteStorefrontPhoto(ownerUser._id);

      // Check DB state
      assert.strictEqual(updatedShop.storefrontPhotoUrl, '');
      assert.strictEqual(updatedShop.storefrontPhotoName, '');
      assert.strictEqual(updatedShop.storefrontPhotoData, '');

      // Check file safety: Facade photo file was unlinked safely
      assert.strictEqual(fs.existsSync(sampleFilePath), false, 'Facade photo file should be unlinked from disk');

      // Check file safety: Other shop files are intact
      assert.strictEqual(updatedShop.dtiDocUrl, '/uploads/dti_doc_keep.pdf');
      assert.strictEqual(updatedShop.permitDocUrl, '/uploads/permit_doc_keep.pdf');
    } catch (err) {
      console.error('TEST ERROR:', err);
      throw err;
    }
  });

  it('should handle idempotency when deleting facade photo if already empty', async () => {
    const updatedShop = await shopService.deleteStorefrontPhoto(ownerUser._id);
    assert.strictEqual(updatedShop.storefrontPhotoUrl, '');
  });
});
