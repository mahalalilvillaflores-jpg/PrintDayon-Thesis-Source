const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '../../uploads');

function getUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

/**
 * Ensures storefront photo URL is a lightweight file path (/uploads/storefront_<shopId>.<ext>),
 * never a massive Base64 string in JSON API payloads.
 */
function normalizeStorefrontPhoto(shop) {
  if (!shop) return '';
  const rawUrl = shop.storefrontPhotoUrl || '';
  if (!rawUrl.startsWith('data:')) {
    return rawUrl;
  }

  // It's a Base64 data URL: convert to binary file on disk & return clean URL
  try {
    const dir = getUploadsDir();
    const match = rawUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = 'png';
    if (match) {
      const mime = match[1];
      if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else if (mime.includes('webp')) ext = 'webp';
      buffer = Buffer.from(match[2], 'base64');
    } else {
      buffer = Buffer.from(rawUrl, 'base64');
    }

    const shopId = shop._id || shop.id || 'unknown';
    const filename = `storefront_${shopId}.${ext}`;
    const filePath = path.join(dir, filename);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, buffer);
    }

    // Return clean URL path
    return `/uploads/${filename}`;
  } catch (err) {
    console.warn('[photoHelper] Error normalizing storefront photo:', err.message);
    return rawUrl;
  }
}

/**
 * Automatic background migration on server startup:
 * Inspects all shops in the active database and ensures no Base64 strings linger in storefrontPhotoUrl.
 */
async function autoMigrateShopPhotos() {
  try {
    const PrintingShop = require('../models/PrintingShop');
    const shopsWithBase64 = await PrintingShop.find({
      storefrontPhotoUrl: { $regex: '^data:' }
    }).select('+storefrontPhotoData');

    if (!shopsWithBase64 || shopsWithBase64.length === 0) {
      return;
    }

    console.log(`[photoHelper] Found ${shopsWithBase64.length} shops with base64 photos to auto-migrate...`);
    const dir = getUploadsDir();

    for (const shop of shopsWithBase64) {
      const raw = shop.storefrontPhotoUrl;
      const match = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let ext = 'png';
      if (match) {
        const mime = match[1];
        if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
        else if (mime.includes('webp')) ext = 'webp';
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(raw, 'base64');
      }

      const filename = `storefront_${shop._id}.${ext}`;
      const filePath = path.join(dir, filename);

      fs.writeFileSync(filePath, buffer);

      shop.storefrontPhotoData = raw;
      shop.storefrontPhotoUrl = `/uploads/${filename}`;
      if (!shop.storefrontPhotoName) {
        shop.storefrontPhotoName = filename;
      }
      await shop.save();
      console.log(`[photoHelper] Auto-migrated ${shop.shopName} -> /uploads/${filename}`);
    }
  } catch (err) {
    console.warn('[photoHelper] Auto-migration notice:', err.message);
  }
}

module.exports = {
  normalizeStorefrontPhoto,
  autoMigrateShopPhotos,
  getUploadsDir,
};
