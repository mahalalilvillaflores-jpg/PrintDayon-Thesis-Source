require('dotenv').config();
const mongoose = require('mongoose');

async function sync() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon');
  console.log('Connected to MongoDB');

  const res = await mongoose.connection.db.collection('printingshops').updateMany(
    {
      $or: [
        { walkInCustomerCount: { $in: [0, null] } },
        { walkInCustomerCount: { $exists: false } }
      ]
    },
    {
      $set: {
        walkInCustomerCount: 0,
        walkInTrafficLevel: 'normal',
        walkInTrafficUpdatedAt: new Date()
      }
    }
  );

  console.log('Updated shops count:', res.modifiedCount);

  const shops = await mongoose.connection.db.collection('printingshops').find(
    {},
    { projection: { shopName: 1, walkInCustomerCount: 1, walkInTrafficLevel: 1 } }
  ).toArray();

  console.log('Current DB state:', JSON.stringify(shops, null, 2));

  await mongoose.disconnect();
}

sync().catch((err) => {
  console.error(err);
  process.exit(1);
});
