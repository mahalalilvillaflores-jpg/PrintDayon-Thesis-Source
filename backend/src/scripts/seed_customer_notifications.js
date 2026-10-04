const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://localhost:27017/printdayon');
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'mahalalilvillaflores03@gmail.com' });
    if (!user) {
      console.log('Customer user not found');
      return;
    }

    const updateResult = await mongoose.connection.db.collection('notifications').updateMany(
      { userId: user._id },
      { '$set': { isRead: false } }
    );
    console.log('Updated notifications count:', updateResult.modifiedCount);

    const count = await mongoose.connection.db.collection('notifications').countDocuments({ userId: user._id, isRead: false });
    console.log('Verified unread notifications in DB:', count);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
