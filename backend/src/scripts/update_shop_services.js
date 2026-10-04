const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/printdayon');

    await mongoose.connection.db.collection('printingshops').updateOne(
      { shopName: { $regex: /LA.*Naval/i } },
      {
        $set: {
          services: [
            { name: 'Document Printing', available: true },
            { name: 'Photocopy / Xerox', available: true },
            { name: 'Bookbinding & Finishing', available: true },
            { name: 'Document Scanning', available: true },
          ],
          'pricing.bwPerPage': 2,
          'pricing.bwLongPerPage': 3,
          'pricing.colorPerPage': 4,
          'pricing.colorLongPerPage': 5,
          'pricing.photocopyBwA4': 1.5,
          'pricing.photocopyBwLong': 2,
          'pricing.photocopyColor': 5,
          'pricing.bindingCost': 35,
          'pricing.softbindCost': 50,
        },
      }
    );

    await mongoose.connection.db.collection('printingshops').updateOne(
      { shopName: { $regex: /Know.*Well/i } },
      {
        $set: {
          services: [
            { name: 'Document Printing', available: true },
            { name: 'Photocopy / Xerox', available: true },
            { name: 'Full Sublimation', available: true },
            { name: 'Tarpaulin Printing', available: true },
          ],
          'pricing.bwPerPage': 2,
          'pricing.bwLongPerPage': 3,
          'pricing.colorPerPage': 4,
          'pricing.colorLongPerPage': 5,
          'pricing.photocopyBwA4': 1.5,
          'pricing.photocopyBwLong': 2,
          'pricing.photocopyColor': 5,
        },
        $unset: {
          'pricing.bindingCost': '',
          'pricing.softbindCost': '',
          'pricing.hardboundCost': '',
        },
      }
    );

    await mongoose.connection.db.collection('printingshops').updateOne(
      { shopName: { $regex: /I\.?R/i } },
      {
        $set: {
          services: [
            { name: 'Document Printing', available: true },
            { name: 'Photocopy / Xerox', available: true },
            { name: 'Bookbinding & Finishing', available: true },
            { name: 'Document Scanning', available: true },
            { name: 'Lamination & ID', available: true },
          ],
          'pricing.bwPerPage': 2,
          'pricing.bwLongPerPage': 3,
          'pricing.colorPerPage': 4,
          'pricing.colorLongPerPage': 5,
          'pricing.photocopyBwA4': 1.5,
          'pricing.photocopyBwLong': 2,
          'pricing.photocopyColor': 5,
          'pricing.bindingCost': 35,
          'pricing.softbindCost': 50,
        },
      }
    );

    const shops = await mongoose.connection.db.collection('printingshops').find({}).toArray();
    for (const s of shops) {
      console.log('--- Shop:', s.shopName);
      console.log('Services:', s.services.map(x => x.name));
      console.log('Pricing:', s.pricing);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}

run();
