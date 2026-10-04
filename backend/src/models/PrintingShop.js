const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  available: { type: Boolean, default: true },
  price: { type: Number, default: 0 },
  pricingOptions: {
    type: [{
      label: { type: String, default: '' },
      price: { type: Number, default: 0 },
    }],
    default: [],
  },
}, { strict: false });

const pricingSchema = new mongoose.Schema({
  bwPerPage: { type: Number, default: 2 },
  bwLongPerPage: { type: Number, default: 3 },
  colorPerPage: { type: Number, default: 4 },
  colorLongPerPage: { type: Number, default: 5 },
  photocopyBwA4: { type: Number, default: 1.5 },
  photocopyBwLong: { type: Number, default: 2 },
  photocopyColor: { type: Number, default: 5 },
  photo3RPrice: { type: Number, default: 10 },
  photo4RPrice: { type: Number, default: 15 },
  photo5RPrice: { type: Number, default: 25 },
  photoA4Price: { type: Number, default: 35 },
  bindingCost: { type: Number, default: 35 },
  softbindCost: { type: Number, default: 50 },
  stapleCost: { type: Number, default: 5 },
  a4Multiplier: { type: Number, default: 1 },
  a3Multiplier: { type: Number, default: 1.5 },
  legalMultiplier: { type: Number, default: 1.5 },
  doublesidedDiscount: { type: Number, default: 0 },
  speedPerPageSeconds: { type: Number, default: 5 },
  allowRush: { type: Boolean, default: true },
  rushFee: { type: Number, default: 20 },
});

const operatingHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
  open: { type: String, default: '08:00' },
  close: { type: String, default: '17:00' },
  isClosed: { type: Boolean, default: false },
});

const documentVersionSchema = new mongoose.Schema({
  docNumber: { type: String, default: '' },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, default: 'application/pdf' },
  fileSize: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired'],
    default: 'pending',
  },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectionReason: { type: String, default: '' },
});

const businessDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['dti', 'mayors_permit', 'barangay_clearance', 'bir', 'other'],
    required: true,
  },
  title: { type: String, required: true },
  docNumber: { type: String, default: '' },
  currentFile: {
    fileName: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileType: { type: String, default: 'application/pdf' },
    fileSize: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'expired'],
      default: 'pending',
    },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '' },
  },
  history: {
    type: [documentVersionSchema],
    default: [],
  },
});

const printingShopSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shopName: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
      maxlength: [100, 'Shop name cannot exceed 100 characters'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    landmark: { type: String, default: '' },
    locationDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    gcashName: { type: String, default: '' },
    gcashNumber: { type: String, default: '' },
    mayaNumber: { type: String, default: '' },
    dtiNumber: { type: String, default: '' },
    mayorsPermitNumber: { type: String, default: '' },
    dtiDocName: { type: String, default: '' },
    permitDocName: { type: String, default: '' },
    dtiDocUrl: { type: String, default: '' },
    permitDocUrl: { type: String, default: '' },
    businessDocuments: {
      type: [businessDocumentSchema],
      default: [],
    },
    storefrontPhotoName: { type: String, default: '' },
    storefrontPhotoUrl: { type: String, default: '' },
    storefrontPhotoData: { type: String, select: false, default: '' },
    verificationNotes: { type: String, default: '' },
    antiScamChecklist: { type: Object, default: {} },
    services: { type: [serviceSchema], default: [] },
    pricing: { type: pricingSchema, default: () => ({}) },
    operatingHours: { type: [operatingHoursSchema], default: [] },
    temporaryClosure: {
      isClosed: { type: Boolean, default: false },
      reason: {
        type: String,
        enum: ['closing_early', 'temporary_closure', 'power_outage', 'equipment_problem', 'emergency', 'other', ''],
        default: '',
      },
      customReason: { type: String, default: '' },
      advisoryMessage: { type: String, default: '' },
      reopenType: {
        type: String,
        enum: ['next_scheduled_opening', 'specific_time', 'manual'],
        default: 'next_scheduled_opening',
      },
      reopenAt: { type: Date, default: null },
      closedAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'busy', 'temporarily_unavailable'],
      default: 'closed',
    },
    walkInTrafficLevel: {
      type: String,
      enum: ['normal', 'moderate', 'packed'],
      default: 'normal',
    },
    walkInCustomerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    walkInTrafficUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    operationalCondition: {
      type: String,
      enum: ['normal', 'high_walkin', 'power_interruption', 'equipment_problem', 'temporary_delay', 'service_delay', 'closed'],
      default: 'normal',
    },
    operationalMessage: {
      type: String,
      default: '',
    },
    operationalDelayMinutes: {
      type: Number,
      default: 0,
    },
    operationalUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'needs_update', 'suspended', 'restricted'],
      default: 'pending',
    },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '' },
    suspensionReason: { type: String, default: '' },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    currentQueue: { type: Number, default: 0 },
    activeJobs: { type: Number, default: 0 },
    isAcceptingRequests: { type: Boolean, default: true },
    graphNodeId: { type: String, default: null },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0 },
    recentReviews: [
      {
        customerName: { type: String, default: 'Customer' },
        isAnonymous: { type: Boolean, default: false },
        rating: { type: Number, default: 5 },
        printQuality: { type: Number, default: 5 },
        speedRating: { type: Number, default: 5 },
        tags: [{ type: String }],
        comment: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    printers: [
      {
        name: { type: String, default: 'Laser Printer #1' },
        type: { type: String, enum: ['laser_bw', 'color_inkjet', 'heavy_duty_copier', 'plotter'], default: 'laser_bw' },
        status: { type: String, enum: ['online', 'busy', 'maintenance', 'out_of_paper'], default: 'online' },
        ppmSpeed: { type: Number, default: 20 },
      },
    ],
  },
  { timestamps: true }
);

printingShopSchema.index({ location: '2dsphere' });
printingShopSchema.index({ ownerId: 1 });
printingShopSchema.index({ status: 1, verificationStatus: 1 });

module.exports = mongoose.model('PrintingShop', printingShopSchema);
