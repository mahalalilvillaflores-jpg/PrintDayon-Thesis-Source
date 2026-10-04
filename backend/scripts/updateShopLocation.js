const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/printdayon';

async function updateLocations() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // 1. Update LA- Naval Printing Press
  const resLA = await mongoose.connection.db.collection('printingshops').updateMany(
    { shopName: { $regex: /LA/i } },
    {
      $set: {
        address: 'Vicentillo Extension, Brgy. P.I. Garcia, Naval, Biliran',
        landmark: 'Near BiPSU Main Campus',
        locationDescription: 'Near BiPSU Main Campus',
        latitude: 11.563591,
        longitude: 124.398505,
        location: {
          type: 'Point',
          coordinates: [124.398505, 11.563591],
        },
      },
    }
  );
  console.log(`Updated LA- Naval Printing Press: ${resLA.modifiedCount} document(s).`);

  // 2. Update Know Well Systems
  const resKW = await mongoose.connection.db.collection('printingshops').updateMany(
    { shopName: { $regex: /Know/i } },
    {
      $set: {
        address: 'Redaza Street, Naval, Biliran',
        landmark: 'Near Naval Central School & Cathedral',
        locationDescription: 'Near Naval Central School & Cathedral',
      },
    }
  );
  console.log(`Updated Know Well Systems: ${resKW.modifiedCount} document(s).`);

  // 3. Update I.R Printing Shop
  const resIR = await mongoose.connection.db.collection('printingshops').updateMany(
    { shopName: { $regex: /I\.?R/i } },
    {
      $set: {
        address: 'Caneja Street, Naval, Biliran',
        landmark: 'Near Naval Commercial Center & Public Market',
        locationDescription: 'Near Naval Commercial Center & Public Market',
      },
    }
  );
  console.log(`Updated I.R Printing Shop: ${resIR.modifiedCount} document(s).`);

  const shops = await mongoose.connection.db.collection('printingshops').find({}).toArray();
  console.log('\n--- Current Database Printing Shops ---');
  shops.forEach((s) => {
    console.log(`Shop: ${s.shopName}`);
    console.log(`  Address:  ${s.address}`);
    console.log(`  Landmark: ${s.landmark}`);
    console.log(`  Coords:   [${s.latitude}, ${s.longitude}]\n`);
  });

  await mongoose.disconnect();
}

updateLocations().catch((err) => {
  console.error(err);
  process.exit(1);
});
