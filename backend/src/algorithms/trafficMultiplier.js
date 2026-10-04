
const NAVAL_TRAFFIC_WINDOWS = [
  {
    label: 'Early Morning',
    startHour: 5,
    endHour: 7,
    multiplier: 0.90,
    reason: 'Light early traffic — market vendors and school buses starting',
  },
  {
    label: 'Morning Rush',
    startHour: 7,
    endHour: 9,
    multiplier: 0.68,
    reason: 'Peak school & office hour — Naval Central School, BiPSU, government offices',
  },
  {
    label: 'Mid-Morning',
    startHour: 9,
    endHour: 11,
    multiplier: 0.95,
    reason: 'Light traffic — most commuters already at destination',
  },
  {
    label: 'Lunch Rush',
    startHour: 11,
    endHour: 13,
    multiplier: 0.78,
    reason: 'Lunch break congestion — Naval Public Market & town center',
  },
  {
    label: 'Afternoon',
    startHour: 13,
    endHour: 16,
    multiplier: 0.92,
    reason: 'Moderate afternoon traffic',
  },
  {
    label: 'Afternoon Rush',
    startHour: 16,
    endHour: 19,
    multiplier: 0.72,
    reason: 'Peak dismissal hour — school children, government workers, market closing',
  },
  {
    label: 'Evening',
    startHour: 19,
    endHour: 21,
    multiplier: 0.88,
    reason: 'Moderate evening traffic — evening market and sari-sari activity',
  },
  {
    label: 'Night',
    startHour: 21,
    endHour: 24,
    multiplier: 1.00,
    reason: 'Free-flow — minimal traffic',
  },
  {
    label: 'Late Night / Early Dawn',
    startHour: 0,
    endHour: 5,
    multiplier: 1.00,
    reason: 'Free-flow — very low traffic',
  },
];

const { normalizeTravelMode } = require('./dijkstra');

function getTrafficMultiplier(hourPHT, travelMode = 'tricycle') {
  const normalizedMode = typeof normalizeTravelMode === 'function' ? normalizeTravelMode(travelMode) : travelMode;
  const window = NAVAL_TRAFFIC_WINDOWS.find(
    (w) => hourPHT >= w.startHour && hourPHT < w.endHour
  ) || NAVAL_TRAFFIC_WINDOWS[NAVAL_TRAFFIC_WINDOWS.length - 1];

  let multiplier = window.multiplier;

  if (normalizedMode === 'walking') {
    const slowdown = 1.0 - multiplier;
    multiplier = 1.0 - slowdown * 0.4;
  }

  return {
    multiplier: parseFloat(multiplier.toFixed(4)),
    label: window.label,
    reason: window.reason,
  };
}

function getCurrentPHTHour() {
  const now = new Date();
  return (now.getUTCHours() + 8) % 24;
}

function computeAdjustedTravelTime(distanceMeters, baseSpeedKmh, travelMode = 'tricycle') {
  const normalizedMode = typeof normalizeTravelMode === 'function' ? normalizeTravelMode(travelMode) : travelMode;
  const hourPHT = getCurrentPHTHour();
  const traffic = getTrafficMultiplier(hourPHT, normalizedMode);

  const effectiveSpeedKmh = baseSpeedKmh * traffic.multiplier;
  const distanceKm = distanceMeters / 1000;
  const rawMinutes = (distanceKm / effectiveSpeedKmh) * 60;
  const travelTimeMinutes = distanceMeters < 50 ? 1 : Math.max(1, Math.round(rawMinutes));

  return {
    travelTimeMinutes,
    rawTravelTimeMinutes: parseFloat(rawMinutes.toFixed(2)),
    effectiveSpeedKmh: parseFloat(effectiveSpeedKmh.toFixed(2)),
    trafficMultiplier: traffic.multiplier,
    trafficLabel: traffic.label,
    trafficReason: traffic.reason,
    hourPHT,
    travelMode: normalizedMode,
  };
}

module.exports = {
  NAVAL_TRAFFIC_WINDOWS,
  getTrafficMultiplier,
  getCurrentPHTHour,
  computeAdjustedTravelTime,
};
