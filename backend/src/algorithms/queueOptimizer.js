
function estimatePrintingTime(specs, shopPricing) {
  const {
    copies = 1,
    totalPages = 1,
    colorMode = 'black_and_white',
    sided = 'single',
    binding = 'none',
  } = specs;

  const speedPerPageSeconds = shopPricing?.speedPerPageSeconds || 5;

  let sheets = totalPages * copies;

  if (sided === 'double') {
    sheets = Math.ceil(sheets / 2) * 1.1;
  }

  const colorMultiplier = colorMode === 'color' ? 1.8 : 1;

  let seconds = sheets * speedPerPageSeconds * colorMultiplier;

  if (binding === 'staple') seconds += 30;
  else if (binding === 'spiral') seconds += 120;
  else if (binding === 'soft_bound') seconds += 180;

  return Math.max(1, Math.ceil(seconds / 60));
}

function detectPrinterChannel(specs = {}) {
  const isColor = specs.colorMode === 'color';
  return isColor ? 'color_inkjet' : 'bw_laser';
}

function estimateWaitingTime(activeRequests, shopPricing, isRush = false, targetChannel = null) {
  if (!activeRequests || activeRequests.length === 0) return 0;

  let totalWaitMinutes = 0;

  for (const req of activeRequests) {
    // Channel-aware queuing: if targetChannel is specified, jobs only wait behind matching channel jobs (or general jobs)
    const reqChannel = req.printerChannel || detectPrinterChannel(req.printingSpecifications);
    if (targetChannel && reqChannel !== targetChannel && reqChannel !== 'general') {
      continue;
    }

    // If calculating wait time for a rush request, skip regular queued jobs (rush cuts in line)
    if (isRush && req.status !== 'printing' && !req.isRush) {
      continue;
    }

    if (req.status === 'printing' && req.printingStartedAt) {
      const elapsedMinutes = (Date.now() - new Date(req.printingStartedAt).getTime()) / 60000;
      const estimated = req.estimatedPrintingTime || estimatePrintingTime(req.printingSpecifications, shopPricing);
      const remaining = Math.max(0, estimated - elapsedMinutes);
      totalWaitMinutes += remaining;
    } else {
      const estimated = req.estimatedPrintingTime || estimatePrintingTime(req.printingSpecifications || {}, shopPricing);
      totalWaitMinutes += estimated;
    }
  }

  return Math.ceil(totalWaitMinutes);
}

function calculateEstimatedCost(specs, pricing, isRush = false) {
  const {
    copies = 1,
    totalPages = 1,
    colorMode = 'black_and_white',
    paperSize = 'A4',
    paperType = 'bond',
    serviceType = 'doc_print',
    sided = 'single',
    binding = 'none',
  } = specs;

  const {
    bwPerPage = 2,
    bwLongPerPage = 3,
    colorPerPage = 4,
    colorLongPerPage = 5,
    photocopyBwA4 = 1.5,
    photocopyBwLong = 2,
    photocopyColor = 5,
    photo3RPrice = 10,
    photo4RPrice = 15,
    photo5RPrice = 25,
    photoA4Price = 35,
    a4Multiplier = 1,
    a3Multiplier = 1.5,
    doublesidedDiscount = 0,
    bindingCost = 35,
    softbindCost = 50,
    stapleCost = 5,
    allowRush = true,
    rushFee = 20,
  } = pricing || {};

  const isLong = paperSize === 'Legal' || paperSize === 'Long';
  const isColor = colorMode === 'color';
  const isPhoto = serviceType === 'photo_print' || paperType === 'photo' || paperType === 'glossy' || paperType === 'matte' || ['4R', '3R', '5R'].includes(paperSize);

  let pricePerPage;
  if (isPhoto) {
    if (paperSize === '3R') {
      pricePerPage = photo3RPrice || 10;
    } else if (paperSize === '4R') {
      pricePerPage = photo4RPrice || 15;
    } else if (paperSize === '5R') {
      pricePerPage = photo5RPrice || 25;
    } else if (paperSize === 'A3') {
      pricePerPage = (colorPerPage || 4) * 12;
    } else {
      pricePerPage = photoA4Price || 35;
    }
    if (!isColor) {
      pricePerPage = Math.max(5, pricePerPage * 0.8);
    }
  } else if (serviceType === 'photocopy') {
    pricePerPage = isColor ? (photocopyColor || 5) : (isLong ? (photocopyBwLong || 2) : (photocopyBwA4 || 1.5));
    if (paperSize === 'A3') pricePerPage *= (a3Multiplier || 1.5);
  } else {
    if (isColor) {
      pricePerPage = isLong ? (colorLongPerPage || 5) : (colorPerPage || 4);
    } else {
      pricePerPage = isLong ? (bwLongPerPage || 3) : (bwPerPage || 2);
    }
    if (paperSize === 'A3') {
      pricePerPage *= (a3Multiplier || 1.5);
    }
  }

  let totalCost = totalPages * copies * pricePerPage;

  if (!isPhoto && sided === 'double') totalCost -= doublesidedDiscount;

  if (!isPhoto) {
    if (binding === 'spiral') totalCost += (bindingCost || 35) * copies;
    else if (binding === 'soft_bound') totalCost += (softbindCost || 50) * copies;
    else if (binding === 'staple') totalCost += (pricing?.stapleCost !== undefined ? Number(pricing.stapleCost) : (pricing?.bindingCost !== undefined ? Number(pricing.bindingCost) : (stapleCost || 5))) * copies;
    else if (binding !== 'none') totalCost += (bindingCost || 35) * copies;
  }

  if (isRush && allowRush !== false) {
    totalCost += Number(rushFee) || 20;
  }

  return Math.max(0, Math.round(totalCost * 100) / 100);
}

function getQueueStats(activeRequests, shopPricing, walkInTrafficLevel = 'normal', walkInCustomerCount = 0, operationalDelayMinutes = 0) {
  const queueCount = activeRequests.length;
  const activeJobsCount = activeRequests.filter((r) => r.status === 'printing').length;
  const onlineWaitMinutes = estimateWaitingTime(activeRequests, shopPricing);

  const count = Math.max(0, Number(walkInCustomerCount) || 0);
  const validLevels = ['normal', 'moderate', 'packed'];
  const levelProvided = validLevels.includes(walkInTrafficLevel) ? walkInTrafficLevel : null;
  const effectiveTrafficLevel = levelProvided || (count > 8 ? 'packed' : (count > 3 ? 'moderate' : 'normal'));

  let walkInWaitMinutes = 0;
  if (effectiveTrafficLevel === 'packed') {
    walkInWaitMinutes = 25;
  } else if (effectiveTrafficLevel === 'moderate') {
    walkInWaitMinutes = 10;
  } else if (count > 8) {
    walkInWaitMinutes = 25;
  } else if (count > 3) {
    walkInWaitMinutes = 10;
  }

  const opDelay = Math.max(0, Number(operationalDelayMinutes) || 0);
  const estimatedWaitingTime = onlineWaitMinutes + walkInWaitMinutes + opDelay;

  const bwQueueCount = activeRequests.filter((r) => (r.printerChannel || detectPrinterChannel(r.printingSpecifications)) === 'bw_laser').length;
  const colorQueueCount = activeRequests.filter((r) => (r.printerChannel || detectPrinterChannel(r.printingSpecifications)) === 'color_inkjet').length;
  const isHighTraffic = queueCount >= 5 || effectiveTrafficLevel === 'packed';

  return {
    queueCount,
    activeJobsCount,
    bwQueueCount,
    colorQueueCount,
    isHighTraffic,
    onlineWaitMinutes,
    walkInWaitMinutes,
    operationalDelayMinutes: opDelay,
    walkInTrafficLevel: effectiveTrafficLevel,
    walkInCustomerCount: count,
    estimatedWaitingTime,
  };
}

module.exports = {
  detectPrinterChannel,
  estimatePrintingTime,
  estimateWaitingTime,
  calculateEstimatedCost,
  getQueueStats,
};
