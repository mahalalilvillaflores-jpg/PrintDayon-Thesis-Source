const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10');
const UPLOAD_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = ALLOWED_TYPES[file.mimetype] || path.extname(file.originalname).slice(1);
    const uniqueName = `${uuidv4()}.${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, JPG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

function validateFileSignature(filePath, originalname, declaredMime) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'Uploaded file not found on disk.' };
  }

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(512);
  const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
  fs.closeSync(fd);

  if (bytesRead < 4) {
    return { valid: false, error: 'File is empty or corrupted.' };
  }

  // PDF signature: starts with %PDF- (0x25 0x50 0x44 0x46 0x2D)
  const isPdf = buffer.slice(0, 5).toString('ascii') === '%PDF-';

  // PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
                buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;

  // JPEG signature: 0xFF 0xD8 0xFF
  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

  // DOCX / ZIP signature: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;

  // WEBP signature: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
  const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
                 buffer.slice(8, 12).toString('ascii') === 'WEBP';

  const ext = path.extname(originalname).toLowerCase();

  if (isPdf) {
    if (ext && ext !== '.pdf') {
      return { valid: false, error: 'File extension mismatch for PDF document.' };
    }
    return { valid: true, detectedType: 'pdf', mimeType: 'application/pdf' };
  }

  if (isPng) {
    if (ext && ext !== '.png') {
      return { valid: false, error: 'File extension mismatch for PNG image.' };
    }
    return { valid: true, detectedType: 'png', mimeType: 'image/png' };
  }

  if (isJpeg) {
    if (ext && ext !== '.jpg' && ext !== '.jpeg') {
      return { valid: false, error: 'File extension mismatch for JPEG image.' };
    }
    return { valid: true, detectedType: 'jpg', mimeType: 'image/jpeg' };
  }

  if (isZip) {
    if (ext && ext !== '.docx') {
      return { valid: false, error: 'File extension mismatch for DOCX document.' };
    }
    return { valid: true, detectedType: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }

  if (isWebp) {
    if (ext && ext !== '.webp') {
      return { valid: false, error: 'File extension mismatch for WEBP image.' };
    }
    return { valid: true, detectedType: 'webp', mimeType: 'image/webp' };
  }

  return { valid: false, error: 'Invalid file signature. File contents do not match allowed formats (PDF, DOCX, JPG, PNG).' };
}

const verifyFileSignature = (req, res, next) => {
  if (!req.file) return next();
  const result = validateFileSignature(req.file.path, req.file.originalname, req.file.mimetype);
  if (!result.valid) {
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (_) {}
    return res.status(400).json({
      success: false,
      message: result.error,
    });
  }
  req.file.detectedType = result.detectedType;
  req.file.validatedMimeType = result.mimeType;
  next();
};

module.exports = { upload, UPLOAD_DIR, validateFileSignature, verifyFileSignature };
