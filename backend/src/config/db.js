const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGO_URI or MONGODB_URI environment variable is missing.');
    }
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    try {
      const { autoMigrateShopPhotos } = require('../utils/photoHelper');
      autoMigrateShopPhotos().catch((e) => console.warn('[db] autoMigrateShopPhotos error:', e.message));
    } catch (_) {}
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
