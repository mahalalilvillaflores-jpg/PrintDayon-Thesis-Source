/**
 * shopAssetPresets.js
 * Centralized catalog for shop storefront photos, verification document presets,
 * and asset URL resolution helpers to prevent MongoDB storage exhaustion.
 */

// Production API Base URL fallback
const API_BASE = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : window.location.origin
);

/**
 * Resolves any asset URL (relative backend upload, absolute URL, or preset).
 * If the path starts with '/uploads', it prefixes the backend API origin.
 */
export function resolveAssetUrl(pathOrUrl, fallback = '/images/default-storefront.jpg') {
  if (!pathOrUrl) return fallback;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('/uploads')) {
    return `${API_BASE}${pathOrUrl}`;
  }
  return pathOrUrl;
}

/**
 * High-performance, lightweight storefront photo presets
 * Using optimized CDN URLs (Unsplash printshop/stationery imagery)
 * Prevents bloating MongoDB Atlas 512MB free-tier storage.
 */
export const STOREFRONT_PRESETS = [
  {
    id: 'modern_print_hub',
    title: 'Modern Digital Print Center',
    category: 'Commercial Print Hub',
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'campus_copy_station',
    title: 'Campus Document & Thesis Hub',
    category: 'University Printing',
    url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'speedy_copy_express',
    title: 'Express Xerox & Graphics Shop',
    category: 'High-Volume Copying',
    url: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=200&q=70',
  },
  {
    id: 'creative_studio_lab',
    title: 'Creative Media & Binding Studio',
    category: 'Specialty & Bookbinding',
    url: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=200&q=70',
  },
];

/**
 * Sample verification document presets for testing/thesis evaluation
 * Stored as clean reference URLs instead of multi-megabyte binary dumps in MongoDB.
 */
export const SAMPLE_VERIFICATION_PRESETS = {
  dtiCertificate: {
    name: 'Sample_DTI_BNRS_Registration_2026.pdf',
    url: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf',
  },
  mayorsPermit: {
    name: 'Sample_Naval_Mayors_Business_Permit_2026.pdf',
    url: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf',
  },
};
