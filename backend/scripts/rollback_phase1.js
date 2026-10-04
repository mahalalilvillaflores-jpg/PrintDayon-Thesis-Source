const fs = require('fs');
const path = require('path');
require('dotenv').config();
const mongoose = require('mongoose');

const backupPath = path.join(__dirname, 'shops_backup_phase1.json');

async function rollback() {
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file not found at ' + backupPath);
  }

  const shopsBackup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  console.log(`Connecting to MongoDB to rollback ${shopsBackup.length} shops...`);
  await mongoose.connect(process.env.MONGO_URI);

  const PrintingShop = require('../src/models/PrintingShop');

  for (const shop of shopsBackup) {
    await PrintingShop.findByIdAndUpdate(shop._id, {
      storefrontPhotoUrl: shop.storefrontPhotoUrl,
      storefrontPhotoData: shop.storefrontPhotoData,
      storefrontPhotoName: shop.storefrontPhotoName,
    });
    console.log(`Rolled back ${shop.shopName}`);
  }

  console.log('Rollback complete.');
  await mongoose.disconnect();
}

rollback().catch(err => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
