/**
 * PrintDayon Centralized Pricing Calculator
 *
 * Implements 100% parity with backend queueOptimizer.js (calculateEstimatedCost).
 * Used across SubmitRequestPage, Order Summary, Review & Payment, and shop detail previews.
 */

export const STANDARD_DEFAULT_RATES = {
  bwPerPage: 2,
  bwLongPerPage: 3,
  colorPerPage: 4,
  colorLongPerPage: 5,
  photocopyBwA4: 1.5,
  photocopyBwLong: 2,
  photocopyColor: 5,
  photo3RPrice: 10,
  photo4RPrice: 15,
  photo5RPrice: 25,
  photoA4Price: 35,
  a4Multiplier: 1,
  a3Multiplier: 1.5,
  doublesidedDiscount: 0,
  bindingCost: 35,
  softbindCost: 50,
  stapleCost: 5,
  allowRush: true,
  rushFee: 20,
};

/**
 * Calculates billable page count from a custom page range string like "1-5, 8, 11-15"
 *
 * @param {string} customPageRange - comma-separated list of ranges or single pages
 * @param {number|null} totalPages - max total pages of the document for clamping
 * @returns {number|null} count of billable pages
 */
export function parseCustomPageCount(customPageRange, totalPages = null) {
  if (!customPageRange || typeof customPageRange !== 'string' || !customPageRange.trim()) {
    return totalPages || null;
  }

  const parts = customPageRange.split(',');
  const selectedPages = new Set();
  const maxPages = totalPages ? Number(totalPages) : null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [rawStart, rawEnd] = trimmed.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(rawStart) && !isNaN(rawEnd) && rawEnd >= rawStart) {
        const start = Math.max(1, rawStart);
        const end = maxPages ? Math.min(rawEnd, maxPages) : rawEnd;
        if (end >= start) {
          for (let p = start; p <= end; p++) {
            selectedPages.add(p);
          }
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num > 0) {
        if (!maxPages || num <= maxPages) {
          selectedPages.add(num);
        }
      }
    }
  }

  return selectedPages.size > 0 ? selectedPages.size : (totalPages || null);
}

/**
 * Calculates total print job price matching backend/src/algorithms/queueOptimizer.js:calculateEstimatedCost
 *
 * @param {Object} specs - Printing specifications
 * @param {Object|null} pricing - Selected shop's pricing structure
 * @param {boolean} isRush - Whether rush order queue priority is requested
 * @param {Object} meta - Optional metadata: { hasDocument, customPageCount }
 * @returns {Object} Full breakdown of rates, components, and final total
 */
export function calculatePrintJobPrice(specs = {}, pricing = null, isRush = false, meta = {}) {
  const mergedPricing = {
    ...STANDARD_DEFAULT_RATES,
    ...(pricing || {}),
  };

  const hasShopRates = Boolean(pricing && (
    pricing.bwPerPage !== undefined ||
    pricing.colorPerPage !== undefined ||
    pricing.photoA4Price !== undefined
  ));

  const totalPagesRaw = (specs.pageRange === 'custom' && (meta.customPageCount || specs.customPageCount))
    ? (meta.customPageCount || specs.customPageCount)
    : (specs.totalPages ?? meta.detectedPages ?? meta.uploadedDocPageCount ?? null);

  const billablePages = totalPagesRaw !== null && totalPagesRaw !== undefined && !isNaN(Number(totalPagesRaw)) && Number(totalPagesRaw) > 0
    ? Math.floor(Number(totalPagesRaw))
    : 0;

  const hasValidPageCount = billablePages > 0;
  const copies = Math.max(1, Number(specs.copies || 1));

  const isColor = specs.colorMode === 'color';
  const paperSize = specs.paperSize || 'A4';
  const isLong = paperSize === 'Legal' || paperSize === 'Long';
  const serviceType = specs.serviceType || 'doc_print';
  const paperType = specs.paperType || 'bond';
  const isPhoto = serviceType === 'photo_print' || paperType === 'photo' || paperType === 'glossy' || paperType === 'matte' || ['4R', '3R', '5R'].includes(paperSize);

  let pricePerPage = 2;
  if (isPhoto) {
    if (paperSize === '3R') pricePerPage = Number(mergedPricing.photo3RPrice ?? 10);
    else if (paperSize === '4R') pricePerPage = Number(mergedPricing.photo4RPrice ?? 15);
    else if (paperSize === '5R') pricePerPage = Number(mergedPricing.photo5RPrice ?? 25);
    else if (paperSize === 'A3') pricePerPage = Number(mergedPricing.colorPerPage ?? 4) * 12;
    else pricePerPage = Number(mergedPricing.photoA4Price ?? 35);

    if (!isColor) {
      pricePerPage = Math.max(5, Math.round(pricePerPage * 0.8));
    }
  } else if (serviceType === 'photocopy') {
    pricePerPage = isColor
      ? Number(mergedPricing.photocopyColor ?? 5)
      : (isLong ? Number(mergedPricing.photocopyBwLong ?? 2) : Number(mergedPricing.photocopyBwA4 ?? 1.5));
    if (paperSize === 'A3') pricePerPage *= Number(mergedPricing.a3Multiplier ?? 1.5);
  } else {
    if (isColor) {
      pricePerPage = isLong ? Number(mergedPricing.colorLongPerPage ?? 5) : Number(mergedPricing.colorPerPage ?? 4);
    } else {
      pricePerPage = isLong ? Number(mergedPricing.bwLongPerPage ?? 3) : Number(mergedPricing.bwPerPage ?? 2);
    }
    if (paperSize === 'A3') pricePerPage *= Number(mergedPricing.a3Multiplier ?? 1.5);
  }

  if (!hasValidPageCount) {
    return {
      canCalculate: false,
      hasValidPageCount: false,
      hasShopRates,
      baseRate: pricePerPage,
      pages: 0,
      copies,
      printCost: 0,
      doubleSidedDiscount: 0,
      bindingCost: 0,
      rushFee: 0,
      totalCost: 0,
      isPhoto,
      isColor,
      rateLabel: `₱${pricePerPage.toFixed(2)}/page`,
    };
  }

  const printCost = billablePages * copies * pricePerPage;
  const doubleSidedDiscount = (!isPhoto && specs.sided === 'double') ? (Number(mergedPricing.doublesidedDiscount) || 0) : 0;

  let bindingCost = 0;
  if (!isPhoto) {
    if (specs.binding === 'spiral') bindingCost = Number(mergedPricing.bindingCost ?? 35) * copies;
    else if (specs.binding === 'soft_bound') bindingCost = Number(mergedPricing.softbindCost ?? 50) * copies;
    else if (specs.binding === 'staple') bindingCost = Number(mergedPricing.stapleCost ?? 5) * copies;
    else if (specs.binding && specs.binding !== 'none') bindingCost = Number(mergedPricing.bindingCost ?? 35) * copies;
  }

  const rushFee = (isRush && mergedPricing.allowRush !== false) ? Number(mergedPricing.rushFee ?? 20) : 0;
  const totalCost = Math.max(0, Math.round((printCost - doubleSidedDiscount + bindingCost + rushFee) * 100) / 100);

  return {
    canCalculate: true,
    hasValidPageCount: true,
    hasShopRates,
    baseRate: pricePerPage,
    pages: billablePages,
    copies,
    printCost,
    doubleSidedDiscount,
    bindingCost,
    rushFee,
    totalCost,
    isPhoto,
    isColor,
    rateLabel: `₱${pricePerPage.toFixed(2)}/page`,
  };
}

/**
 * Generates an authoritative Page Range summary label
 *
 * @param {Object} specs - Specifications object with pageRange, totalPages
 * @param {number|null} customPageCount - Billable count for custom range
 * @param {string} customPageRange - Raw custom page range string like "1-5, 8"
 * @param {number|null} fallbackTotalPages - Detected total pages if not in specs
 * @returns {string} e.g. "All pages (33)" or "Custom (1-5 • 5 pages)" or "—"
 */
export function formatPageRangeSummary(specs = {}, customPageCount = null, customPageRange = '', fallbackTotalPages = null) {
  const total = specs.totalPages ?? fallbackTotalPages ?? null;

  if (specs.pageRange === 'custom') {
    const pages = customPageCount || parseCustomPageCount(customPageRange, total) || total;
    if (pages && Number(pages) > 0) {
      const trimmedRange = customPageRange?.trim();
      const pageWord = Number(pages) === 1 ? 'page' : 'pages';
      if (trimmedRange) {
        return `Custom: ${trimmedRange} (${pages} ${pageWord})`;
      }
      return `Custom (${pages} ${pageWord})`;
    }
    return 'Custom (range required)';
  }

  // All Pages mode
  if (total && Number(total) > 0) {
    return `All pages (${total})`;
  }

  return '—';
}
