const mongoose = require('mongoose');

const printingSpecificationsSchema = new mongoose.Schema({
  copies: { type: Number, default: 1, min: 1 },
  serviceType: {
    type: String,
    enum: ['doc_print', 'photo_print', 'thesis_binding', 'photocopy'],
    default: 'doc_print',
  },
  paperSize: {
    type: String,
    enum: ['A4', 'A3', 'A5', 'B5', 'Legal', 'Letter', 'Long', '4R', '3R', '5R'],
    default: 'A4',
  },
  paperType: {
    type: String,
    enum: ['bond', 'glossy', 'matte', 'photo'],
    default: 'bond',
  },
  coverColor: {
    type: String,
    default: 'maroon',
  },
  colorMode: {
    type: String,
    enum: ['black_and_white', 'color'],
    default: 'black_and_white',
  },
  sided: {
    type: String,
    enum: ['single', 'double'],
    default: 'single',
  },
  pageRange: { type: String, default: 'all' },
  totalPages: { type: Number, default: 1 },
  binding: {
    type: String,
    enum: ['none', 'staple', 'spiral', 'soft_bound'],
    default: 'none',
  },
  additionalInstructions: { type: String, default: '' },
});

const printingRequestSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PrintingShop',
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    printingSpecifications: {
      type: printingSpecificationsSchema,
      default: () => ({}),
    },
    isRush: { type: Boolean, default: false },
    rushFee: { type: Number, default: 0 },
    placedWhileShopClosed: { type: Boolean, default: false },
    pricingSnapshot: {
      bwPerPage: { type: Number, default: 0 },
      bwLongPerPage: { type: Number, default: 0 },
      colorPerPage: { type: Number, default: 0 },
      colorLongPerPage: { type: Number, default: 0 },
      bindingCost: { type: Number, default: 0 },
      rushFee: { type: Number, default: 0 },
      calculatedCost: { type: Number, default: 0 },
    },
    printerChannel: {
      type: String,
      enum: ['bw_laser', 'color_inkjet', 'general'],
      default: 'general',
    },
    assignedPrinterName: { type: String, default: '' },
    travelMode: {
      type: String,
      enum: ['walking', 'motor', 'vehicle'],
      default: 'motor',
    },
    estimatedCost: { type: Number, default: 0 },
    estimatedTravelTime: { type: Number, default: 0 },
    estimatedWaitingTime: { type: Number, default: 0 },
    estimatedPrintingTime: { type: Number, default: 0 },
    estimatedCompletionTime: { type: Number, default: 0 },
    queuePosition: { type: Number, default: null },
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
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: 'gcash',
      // GCash is the only accepted payment method for new orders.
      // 'maya' is tolerated ONLY on pre-existing records so historical orders remain loadable/savable.
      validate: {
        validator(v) {
          if (v === 'gcash') return true;
          return v === 'maya' && !this.isNew;
        },
        message: 'Only GCash payment is accepted.',
      },
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid_verifying', 'verified'],
      default: 'paid_verifying',
    },
    paymentRefNumber: { type: String, default: '' },
    paymentProofUrl: { type: String, default: '' },
    paymentProofData: { type: String, default: '' },
    claimCode: { type: String, default: '' },
    timeSavedMinutes: { type: Number, default: 0 },
    
    platformFee: { type: Number, default: 0 },
    shopEarnings: { type: Number, default: 0 },
    
    rejectionReason: { type: String, default: '' },
    cancellationReason: { type: String, default: '' },

    shopNotes: [
      {
        category: {
          type: String,
          enum: ['file_issue', 'layout_issue', 'power_outage', 'equipment_maintenance', 'general_delay', 'custom'],
          default: 'custom',
        },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        authorName: { type: String, default: '' },
      }
    ],
    delayNotice: {
      isDelayed: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      estimatedDelayMinutes: { type: Number, default: 0 },
      reportedAt: { type: Date, default: null },
    },

    submittedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    queuedAt: { type: Date, default: null },
    printingStartedAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    onHoldAt: { type: Date, default: null },

    review: {
      rating: { type: Number, min: 1, max: 5, default: null },
      printQuality: { type: Number, min: 1, max: 5, default: null },
      speedRating: { type: Number, min: 1, max: 5, default: null },
      tags: [{ type: String }],
      isAnonymous: { type: Boolean, default: false },
      comment: { type: String, default: '' },
      reviewedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

printingRequestSchema.index({ customerId: 1, status: 1 });
printingRequestSchema.index({ shopId: 1, status: 1 });
printingRequestSchema.index({ shopId: 1, 'review.rating': 1 });
printingRequestSchema.index({ status: 1 });
printingRequestSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('PrintingRequest', printingRequestSchema);
