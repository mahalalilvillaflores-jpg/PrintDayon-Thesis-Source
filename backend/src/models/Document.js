const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrintingRequest',
      default: null,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storedFilename: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'jpg', 'jpeg', 'png'],
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    pageCount: {
      type: Number,
      default: null,
    },
    isDeletedFromStorage: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    retentionExpiresAt: {
      type: Date,
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

documentSchema.index({ customerId: 1 });
documentSchema.index({ requestId: 1 });
documentSchema.index({ isDeletedFromStorage: 1, retentionExpiresAt: 1 });

module.exports = mongoose.model('Document', documentSchema);
