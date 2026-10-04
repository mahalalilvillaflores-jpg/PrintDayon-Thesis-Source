const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'request_submitted',
        'request_accepted',
        'request_rejected',
        'request_queued',
        'request_printing',
        'request_ready',
        'request_picked_up',
        'request_completed',
        'request_cancelled',
        'request_on_hold',
        'request_new',
        'shop_note',
        'delay_alert',
        'shop_closed',
        'service_delay',
        'shop_verified',
        'shop_rejected',
        'system',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrintingRequest',
      default: null,
    },
    relatedShopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrintingShop',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
