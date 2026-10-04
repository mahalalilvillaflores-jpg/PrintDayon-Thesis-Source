const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['user', 'shop', 'request', 'order', 'verify', 'queue', 'auth', 'system'],
      default: 'system',
      index: true,
    },
    details: {
      type: String,
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorName: {
      type: String,
      default: 'System',
    },
    actorRole: {
      type: String,
      enum: ['customer', 'shop_owner', 'admin', 'system'],
      default: 'system',
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetName: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: -1,
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
