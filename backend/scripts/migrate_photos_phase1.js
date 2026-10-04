const fs = require('fs');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function migrate() {
  console.log('Connecting to MongoDB for Phase 1 photo migration...');
  await mongoose.connect(process.env.MONGO_URI);

  const PrintingShop = require('../src/models/PrintingShop');
  const shops = await PrintingShop.find({}).select('+storefrontPhotoData');

  console.log(`Found ${shops.length} shops to inspect.`);

  for (const shop of shops) {
    const rawPhoto = shop.storefrontPhotoUrl || '';
    if (rawPhoto.startsWith('data:')) {
      console.log(`Migrating base64 photo for ${shop.shopName}...`);
      
      const match = rawPhoto.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = 'png';
      if (match) {
        const mime = match[1];
        if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
        else if (mime.includes('webp')) ext = 'webp';
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(rawPhoto, 'base64');
      }

      const filename = `storefront_${shop._id}.${ext}`;
      const filePath = path.join(uploadsDir, filename);

      // Write binary file to uploads directory
      fs.writeFileSync(filePath, buffer);
      console.log(`  Wrote ${buffer.length} bytes to ${filename}`);

      // Update MongoDB record: store original base64 in select: false field, set clean URL
      shop.storefrontPhotoData = rawPhoto;
      shop.storefrontPhotoUrl = `/uploads/${filename}`;
      if (!shop.storefrontPhotoName) {
        shop.storefrontPhotoName = filename;
      }
      await shop.save();
      console.log(`  Updated shop ${shop.shopName} -> storefrontPhotoUrl: ${shop.storefrontPhotoUrl}`);
    } else {
      console.log(`Shop ${shop.shopName} already has URL: ${rawPhoto}`);
    }
  }

  console.log('Migration completed successfully.');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
