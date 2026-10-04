const mongoose = require('mongoose');

const orderStatusHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrintingRequest',
      required: true,
      index: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrintingRequest',
    },
    status: {
      type: String,
      enum: [
        'pending',
        'submitted',
        'accepted',
        'queued',
        'printing',
        'ready',
        'ready_for_pickup',
        'picked_up',
        'completed',
        'declined',
        'rejected',
        'cancelled',
        'on_hold',
      ],
      required: true,
    },
    message: {
      type: String,
      default: '',
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Alias for compatibility with snake_case requirement: changed_by
    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    collection: 'order_status_history',
  }
);

// Pre-save hook to ensure both camelCase and snake_case properties match
orderStatusHistorySchema.pre('save', function () {
  if (this.orderId && !this.order_id) this.order_id = this.orderId;
  if (this.order_id && !this.orderId) this.orderId = this.order_id;
  if (this.changedBy && !this.changed_by) this.changed_by = this.changedBy;
  if (this.changed_by && !this.changedBy) this.changedBy = this.changed_by;
  if (this.createdAt && !this.created_at) this.created_at = this.createdAt;
  if (this.created_at && !this.createdAt) this.createdAt = this.created_at;
});

orderStatusHistorySchema.index({ orderId: 1, createdAt: 1 });
orderStatusHistorySchema.index({ orderId: 1, status: 1 });

module.exports = mongoose.model('OrderStatusHistory', orderStatusHistorySchema);
