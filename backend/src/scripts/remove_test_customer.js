const mongoose = require('mongoose');
const fs = require('fs');

async function removeTestCustomer() {
  try {
    await mongoose.connect('mongodb://localhost:27017/printdayon');
    const db = mongoose.connection.db;

    const user = await db.collection('users').findOne({ email: 'testcust123@gmail.com' });
    if (!user) {
      console.log('No test customer with email testcust123@gmail.com found.');
      return;
    }

    const userId = user._id;
    console.log('Found test customer:', user.name, user.email, userId.toString());

    const docs = await db.collection('documents').find({ customerId: userId }).toArray();
    for (const doc of docs) {
      if (doc.storagePath && fs.existsSync(doc.storagePath)) {
        try {
          fs.unlinkSync(doc.storagePath);
          console.log('Deleted file on disk:', doc.storagePath);
        } catch (fErr) {
          console.warn('Could not delete file:', doc.storagePath, fErr.message);
        }
      }
    }

    const delDocs = await db.collection('documents').deleteMany({ customerId: userId });
    console.log('Deleted documents count:', delDocs.deletedCount);

    const delReqs = await db.collection('printingrequests').deleteMany({ customerId: userId });
    console.log('Deleted printing requests count:', delReqs.deletedCount);

    const delNotifs = await db.collection('notifications').deleteMany({ userId });
    console.log('Deleted notifications count:', delNotifs.deletedCount);

    await db.collection('printingshops').updateMany(
      {},
      { $set: { currentQueue: 0, activeJobs: 0 } }
    );
    console.log('Reset all shop queues to 0.');

    const delUser = await db.collection('users').deleteOne({ _id: userId });
    console.log('Deleted user account count:', delUser.deletedCount);

    console.log('Test customer completely removed.');
  } catch (err) {
    console.error('Error removing test customer:', err);
  } finally {
    await mongoose.disconnect();
  }
}

removeTestCustomer();
