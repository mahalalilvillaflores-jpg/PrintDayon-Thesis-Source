/**
 * PrintDayon Queue & Workload Calculation Utilities
 * 
 * Provides centralized, consistent printing time and queue workload estimations
 * across the PrintDayon frontend, matching the core business logic in
 * backend/src/algorithms/queueOptimizer.js.
 */

/**
 * Estimates the printing duration (in minutes) for a single job based on its
 * printing specifications and shop pricing/speed parameters.
 *
 * @param {Object} job - Printing request object
 * @param {Object} shopPricing - Shop pricing configuration (e.g. speedPerPageSeconds)
 * @returns {number} Estimated printing time in minutes (minimum 1)
 */
export function estimateJobPrintingTime(job, shopPricing = {}) {
  // If the job has an explicitly stored estimatedPrintingTime > 0, honor it
  if (typeof job?.estimatedPrintingTime === 'number' && job.estimatedPrintingTime > 0) {
    return job.estimatedPrintingTime;
  }

  const specs = job?.printingSpecifications || {};
  const totalPages = Math.max(1, Number(specs.totalPages) || 1);
  const copies = Math.max(1, Number(specs.copies) || 1);
  const colorMode = specs.colorMode || 'black_and_white';
  const sided = specs.sided || 'single';
  const binding = specs.binding || 'none';

  // Default to 5 seconds per page if not specified in shop pricing
  const speedPerPageSeconds = Number(shopPricing?.speedPerPageSeconds) || 5;

  let sheets = totalPages * copies;
  if (sided === 'double') {
    sheets = Math.ceil(sheets / 2) * 1.1;
  }

  const colorMultiplier = colorMode === 'color' ? 1.8 : 1;
  let seconds = sheets * speedPerPageSeconds * colorMultiplier;

  // Additional handling time for binding options
  if (binding === 'staple') seconds += 30;
  else if (binding === 'spiral') seconds += 120;
  else if (binding === 'soft_bound') seconds += 180;

  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Detects the printer channel for a job ('color_inkjet' or 'bw_laser').
 *
 * @param {Object} job - Printing request object
 * @returns {string} 'color_inkjet' or 'bw_laser'
 */
export function detectPrinterChannel(job) {
  if (job?.printerChannel && job.printerChannel !== 'general') {
    return job.printerChannel;
  }
  const colorMode = job?.printingSpecifications?.colorMode;
  return colorMode === 'color' ? 'color_inkjet' : 'bw_laser';
}

/**
 * Calculates the remaining processing time in minutes for a specific job:
 * - Ready / Completed / Cancelled / Rejected: 0 min (no remaining printing work)
 * - Printing: Remaining time based on elapsed minutes since printing started
 * - Queued / Accepted: Full estimated printing duration
 *
 * @param {Object} job - Printing request object
 * @param {Object} shopPricing - Shop pricing configuration
 * @returns {number} Remaining time in minutes
 */
export function getRemainingJobTime(job, shopPricing = {}) {
  if (!job || ['ready', 'completed', 'rejected', 'cancelled'].includes(job.status)) {
    return 0;
  }

  const totalEstimated = estimateJobPrintingTime(job, shopPricing);

  if (job.status === 'printing' && job.printingStartedAt) {
    const elapsedMinutes = (Date.now() - new Date(job.printingStartedAt).getTime()) / 60000;
    return Math.max(0, Math.ceil(totalEstimated - elapsedMinutes));
  }

  return totalEstimated;
}

/**
 * Computes queue statistics and workload breakdown for a list of requests.
 *
 * @param {Array} requests - All requests for the shop
 * @param {Object} shopPricing - Shop pricing configuration
 * @returns {Object} Calculated queue stats (printing, waiting, ready, queueTime, printer workloads)
 */
export function calculateQueueStats(requests = [], shopPricing = {}) {
  const list = Array.isArray(requests) ? requests : (requests?.requests || []);

  // Filter to active stages: accepted, queued, printing, ready
  const activeQueue = list.filter(r => ['accepted', 'queued', 'printing', 'ready'].includes(r.status));

  const printingJobs = activeQueue.filter(r => r.status === 'printing');
  const queuedJobs = activeQueue.filter(r => ['accepted', 'queued'].includes(r.status));
  const readyJobs = activeQueue.filter(r => r.status === 'ready');

  // Jobs that still require printing: printing, queued, accepted
  // Note: Ready jobs have already finished printing and do NOT contribute to queue time.
  const remainingWorkloadJobs = activeQueue.filter(r => r.status !== 'ready');

  let bwPrinting = 0;
  let bwWaiting = 0;
  let bwEstMinutes = 0;

  let colorPrinting = 0;
  let colorWaiting = 0;
  let colorEstMinutes = 0;

  for (const job of remainingWorkloadJobs) {
    const channel = detectPrinterChannel(job);
    const remainingMins = getRemainingJobTime(job, shopPricing);

    if (channel === 'color_inkjet') {
      if (job.status === 'printing') {
        colorPrinting++;
      } else {
        colorWaiting++;
      }
      colorEstMinutes += remainingMins;
    } else {
      // Default to bw_laser
      if (job.status === 'printing') {
        bwPrinting++;
      } else {
        bwWaiting++;
      }
      bwEstMinutes += remainingMins;
    }
  }

  // Queue Time represents estimated remaining processing workload of current active + waiting print jobs
  const totalWaitMinutes = bwEstMinutes + colorEstMinutes;

  return {
    printingCount: printingJobs.length,
    queuedCount: queuedJobs.length,
    readyCount: readyJobs.length,
    totalCount: activeQueue.length,
    totalWaitMinutes,
    bwPrinting,
    bwWaiting,
    bwEstMinutes,
    colorPrinting,
    colorWaiting,
    colorEstMinutes,
  };
}
