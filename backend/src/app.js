require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const compression = require('compression');

const authRoutes = require('./routes/authRoutes');
const shopRoutes = require('./routes/shopRoutes');
const documentRoutes = require('./routes/documentRoutes');
const PrintingShop = require('./models/PrintingShop');
const requestRoutes = require('./routes/requestRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const queueRoutes = require('./routes/queueRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Enable HTTP compression for compressible responses
app.use(compression());

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim().replace(/\/$/, ''));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(cleanOrigin) ||
      allowedOrigins.includes('*') ||
      cleanOrigin.endsWith('.onrender.com') ||
      cleanOrigin.includes('localhost') ||
      cleanOrigin.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Public vs Private Uploads Separation & Protection
app.use('/uploads', async (req, res, next) => {
  const filename = path.basename(req.path);

  // 1. PUBLIC ASSETS: Storefront and public shop photos
  const isStorefront = filename.startsWith('storefront_') ||
                       filename.toLowerCase().includes('storefront') ||
                       filename.toLowerCase().includes('shop_');
  if (isStorefront) {
    return next();
  }

  // 2. Check if this file is a customer print document in Document collection
  try {
    const Document = require('./models/Document');
    const isCustomerDoc = await Document.findOne({
      $or: [{ storedFilename: filename }, { storagePath: new RegExp(filename + '$') }],
    });

    if (isCustomerDoc) {
      return res.status(403).json({
        success: false,
        message: 'Direct access to customer documents is forbidden. Access via /api/documents/:id with authentication.',
      });
    }
  } catch (_) {}

  // 3. PRIVATE ASSETS (payment receipts, verification docs): Require valid authentication token
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required to access private files.',
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const User = require('./models/User');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.status === 'suspended' || user.status === 'deactivated') {
      return res.status(403).json({ success: false, message: 'Invalid or inactive user session.' });
    }
    req.user = user;

    // Administrators have full access to private files
    if (user.role === 'admin') {
      return next();
    }

    // Check if file is associated with a payment proof on PrintingRequest
    const PrintingRequest = require('./models/PrintingRequest');
    const safeRegex = (str) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const paymentOrder = await PrintingRequest.findOne({
      paymentProofUrl: new RegExp(safeRegex(filename) + '$'),
    });

    if (paymentOrder) {
      if (user.role === 'customer') {
        if (paymentOrder.customerId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view this payment proof.' });
        }
        return next();
      }
      if (user.role === 'shop_owner') {
        const PrintingShop = require('./models/PrintingShop');
        const ownsShop = await PrintingShop.exists({ _id: paymentOrder.shopId, ownerId: user._id });
        if (!ownsShop) {
          return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view this payment proof.' });
        }
        return next();
      }
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view this payment proof.' });
    }

    // Check if file is associated with a shop verification document
    const PrintingShop = require('./models/PrintingShop');
    const shopWithDoc = await PrintingShop.findOne({
      $or: [
        { dtiDocName: filename },
        { permitDocName: filename },
        { dtiDocUrl: new RegExp(filename + '$') },
        { permitDocUrl: new RegExp(filename + '$') },
        { 'businessDocuments.currentFile.fileName': filename },
        { 'businessDocuments.currentFile.fileUrl': new RegExp(filename + '$') },
        { 'businessDocuments.history.fileName': filename },
        { 'businessDocuments.history.fileUrl': new RegExp(filename + '$') },
      ],
    });

    if (shopWithDoc) {
      if (user.role === 'shop_owner' && shopWithDoc.ownerId.toString() === user._id.toString()) {
        return next();
      }
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view this verification document.' });
    }

    // Unrecognized private file: only admin is authorized
    return res.status(403).json({ success: false, message: 'Forbidden: Access to private files is restricted.' });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Persistent photo restoration: If a file is requested from /uploads/ but missing from ephemeral disk
// (e.g. after a Render redeployment or container restart), restore and serve from MongoDB
app.get('/uploads/:filename', async (req, res, next) => {
  try {
    const { filename } = req.params;
    const idMatch = filename.match(/storefront_([a-fA-F0-9]{24})/);
    const query = [
      { storefrontPhotoName: filename },
      { storefrontPhotoUrl: `/uploads/${filename}` },
      { storefrontPhotoUrl: new RegExp(filename + '$') },
    ];
    if (idMatch) {
      query.push({ _id: idMatch[1] });
    }

    const shop = await PrintingShop.findOne({ $or: query }).select('+storefrontPhotoData');

    const raw = shop?.storefrontPhotoData || (shop?.storefrontPhotoUrl?.startsWith('data:') ? shop.storefrontPhotoUrl : null);
    if (shop && raw) {
      const fs = require('fs');
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const match = raw.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer;
      let mimeType = 'image/jpeg';
      if (match) {
        mimeType = match[1];
        buffer = Buffer.from(match[2], 'base64');
      } else {
        buffer = Buffer.from(raw, 'base64');
      }

      try {
        fs.writeFileSync(path.join(uploadsDir, filename), buffer);
      } catch (_) {}

      res.set('Content-Type', mimeType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    }
    next();
  } catch (_) {
    next();
  }
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'PrintDayon API is running.', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/printing-requests', requestRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// In production, serve built frontend assets if present
const frontendDist = path.join(__dirname, '../../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFound);

app.use(errorHandler);

module.exports = app;
