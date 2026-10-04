/**
 * gpsFilter.js
 * 
 * Production-Grade Geolocation Filter & Map-Matching Engine for PrintDayon Thesis.
 * 
 * PHASES ADDRESSED:
 * 1. Accuracy-Aware Position Filtering (Eliminates jitter when stationary).
 * 2. Anomaly / Multipath Teleportation Rejection.
 * 3. Dynamic Accuracy Deadband (Adapts to satellite/WiFi precision).
 * 4. Sustained Movement Recognition & Exponential Smoothing.
 * 5. Naval Road Network Map-Matching & Route Starting-Point Alignment.
 * 6. Off-Route Detection & Rerouting Rate-Limiter.
 */

/**
 * High-precision spherical Haversine formula (distance in meters)
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate initial bearing from point A to point B in degrees (0 - 360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Project a coordinate onto a line segment between nodeA and nodeB.
 * Returns the closest point on the segment and perpendicular distance in meters.
 */
export function projectPointOntoSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  // Flat-earth approximation for micro-distances (< 500m)
  const degLenLat = 110574; // meters per degree latitude
  const degLenLng = 111320 * Math.cos((pLat * Math.PI) / 180);

  const px = (pLng - aLng) * degLenLng;
  const py = (pLat - aLat) * degLenLat;
  const bx = (bLng - aLng) * degLenLng;
  const by = (bLat - aLat) * degLenLat;

  const segLenSq = bx * bx + by * by;
  if (segLenSq === 0) {
    return {
      lat: aLat,
      lng: aLng,
      distanceMeters: Math.hypot(px, py),
      t: 0,
    };
  }

  // Projection parameter clamped between [0, 1]
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  const dist = haversineDistanceMeters(pLat, pLng, projLat, projLng);

  return {
    lat: Number(projLat.toFixed(6)),
    lng: Number(projLng.toFixed(6)),
    distanceMeters: Math.round(dist),
    t,
  };
}

/**
 * Key Naval Road Segments for Local Map-Matching
 */
export const NAVAL_ROAD_SEGMENTS = [
  // Vicentillo / BiPSU corridor
  { id: 'S01', name: 'Vicentillo St Ext', a: { lat: 11.56437, lng: 124.39964 }, b: { lat: 11.56620, lng: 124.39850 }, modes: ['walking', 'motor', 'vehicle'] },
  { id: 'S02', name: 'BiPSU Campus Walkway', a: { lat: 11.56550, lng: 124.39900 }, b: { lat: 11.56620, lng: 124.39850 }, modes: ['walking'] },
  // Padre Inocentes corridor
  { id: 'S03', name: 'Padre Inocentes South', a: { lat: 11.55836, lng: 124.39485 }, b: { lat: 11.56250, lng: 124.39593 }, modes: ['walking', 'motor', 'vehicle'] },
  { id: 'S04', name: 'Padre Inocentes Central', a: { lat: 11.56250, lng: 124.39593 }, b: { lat: 11.56500, lng: 124.40050 }, modes: ['walking', 'motor', 'vehicle'] },
  // Redaza Street
  { id: 'S05', name: 'Redaza Street', a: { lat: 11.56250, lng: 124.39593 }, b: { lat: 11.56500, lng: 124.39700 }, modes: ['walking', 'motor', 'vehicle'] },
  // Caneja Street
  { id: 'S06', name: 'Caneja Street', a: { lat: 11.56048, lng: 124.39648 }, b: { lat: 11.56500, lng: 124.39700 }, modes: ['walking', 'motor', 'vehicle'] },
  // Poblacion South
  { id: 'S07', name: 'Poblacion Southway', a: { lat: 11.56780, lng: 124.40150 }, b: { lat: 11.56950, lng: 124.40300 }, modes: ['walking', 'motor', 'vehicle'] },
  // Market & Plaza loop
  { id: 'S08', name: 'Plaza-Market Way', a: { lat: 11.57650, lng: 124.40630 }, b: { lat: 11.57500, lng: 124.40550 }, modes: ['walking', 'motor', 'vehicle'] },
  { id: 'S09', name: 'Ballesteros St', a: { lat: 11.57550, lng: 124.40650 }, b: { lat: 11.57650, lng: 124.40630 }, modes: ['walking', 'motor', 'vehicle'] },
];

/**
 * Snap coordinate to nearest viable road segment if within acceptable threshold.
 */
export function matchToRoadNetwork(lat, lng, travelMode = 'motor', maxSnapMeters = 22) {
  if (!lat || !lng) return { lat, lng, isSnapped: false };

  let bestMatch = null;
  let minDistance = Infinity;

  for (const seg of NAVAL_ROAD_SEGMENTS) {
    if (seg.modes && !seg.modes.includes(travelMode)) continue;
    const proj = projectPointOntoSegment(lat, lng, seg.a.lat, seg.a.lng, seg.b.lat, seg.b.lng);
    if (proj.distanceMeters < minDistance) {
      minDistance = proj.distanceMeters;
      bestMatch = {
        lat: proj.lat,
        lng: proj.lng,
        street: seg.name,
        distanceMeters: proj.distanceMeters,
      };
    }
  }

  if (bestMatch && minDistance <= maxSnapMeters) {
    return {
      lat: bestMatch.lat,
      lng: bestMatch.lng,
      street: bestMatch.street,
      distanceMeters: minDistance,
      isSnapped: true,
    };
  }

  return {
    lat,
    lng,
    distanceMeters: minDistance,
    isSnapped: false,
  };
}

/**
 * GpsPositionFilter
 * 
 * Maintains a stable, filtered representation of user location.
 * Eliminates stationary jitter, rejects GPS noise, and detects sustained movement.
 */
export class GpsPositionFilter {
  constructor(options = {}) {
    this.minDeadbandRadiusMeters = options.minDeadbandRadiusMeters ?? 7.5;
    this.maxDeadbandRadiusMeters = options.maxDeadbandRadiusMeters ?? 26.0;
    this.deadbandAccuracyMultiplier = options.deadbandAccuracyMultiplier ?? 0.65;
    this.maxAcceptableSpeedMs = options.maxAcceptableSpeedMs ?? 42.0; // ~150 km/h
    this.unreliableAccuracyThresholdM = options.unreliableAccuracyThresholdM ?? 80;
    this.debug = options.debug ?? (process.env.NODE_ENV !== 'production');

    this.lastAccepted = null;
    this.lastRaw = null;
    this.stationaryReadingsCount = 0;
    this.consecutiveMovementCount = 0;
  }

  reset(newCoords = null) {
    if (newCoords && newCoords.lat && newCoords.lng) {
      this.lastAccepted = {
        lat: Number(newCoords.lat.toFixed(6)),
        lng: Number(newCoords.lng.toFixed(6)),
        accuracy: newCoords.accuracy ? Math.round(newCoords.accuracy) : 10,
        timestamp: Date.now(),
        isStationary: true,
      };
      this.lastRaw = { ...this.lastAccepted };
    } else {
      this.lastAccepted = null;
      this.lastRaw = null;
    }
    this.stationaryReadingsCount = 0;
    this.consecutiveMovementCount = 0;
  }

  filterPosition(raw) {
    if (!raw || typeof raw.lat !== 'number' || typeof raw.lng !== 'number' || isNaN(raw.lat) || isNaN(raw.lng)) {
      return {
        accepted: false,
        reason: 'invalid_coordinates',
        position: this.lastAccepted,
      };
    }

    const lat = Number(raw.lat.toFixed(6));
    const lng = Number(raw.lng.toFixed(6));
    const accuracy = typeof raw.accuracy === 'number' && !isNaN(raw.accuracy) ? Math.round(raw.accuracy) : 15;
    const timestamp = typeof raw.timestamp === 'number' && raw.timestamp > 0 ? raw.timestamp : Date.now();

    const currentRaw = { lat, lng, accuracy, timestamp };
    this.lastRaw = currentRaw;

    // 1. Initial GPS lock
    if (!this.lastAccepted) {
      const isUnreliable = accuracy > this.unreliableAccuracyThresholdM;
      this.lastAccepted = {
        lat,
        lng,
        accuracy,
        timestamp,
        isStationary: true,
        isLowAccuracy: isUnreliable,
      };
      if (this.debug) {
        console.log('[GPS Filter] Initial GPS lock acquired:', { lat, lng, accuracy, isUnreliable });
      }
      return {
        accepted: true,
        isStationary: true,
        isLowAccuracy: isUnreliable,
        distanceMeters: 0,
        reason: 'initial_lock',
        position: { ...this.lastAccepted },
      };
    }

    // 2. Reject out-of-order or stale timestamps
    if (timestamp < this.lastAccepted.timestamp) {
      if (this.debug) console.warn('[GPS Filter] Stale GPS reading rejected:', { timestamp, last: this.lastAccepted.timestamp });
      return {
        accepted: false,
        reason: 'stale_timestamp',
        position: { ...this.lastAccepted },
      };
    }

    const dtSeconds = Math.max(0.1, (timestamp - this.lastAccepted.timestamp) / 1000);
    const distanceM = haversineDistanceMeters(this.lastAccepted.lat, this.lastAccepted.lng, lat, lng);
    const speedMs = distanceM / dtSeconds;

    // 3. Accuracy Upgrade Check:
    // If a much higher accuracy reading arrives (e.g. true GPS satellite fix replaces cell tower fix),
    // immediately adopt the high-precision fix, even if the cell tower was located meters away!
    if (this.lastAccepted && this.lastAccepted.accuracy > 35 && accuracy <= 30) {
      if (this.debug) {
        console.log('[GPS Filter] Upgrading inaccurate initial lock to high-precision satellite fix:', {
          fromAccuracy: this.lastAccepted.accuracy,
          toAccuracy: accuracy,
          distanceM: Math.round(distanceM),
          coords: { lat, lng },
        });
      }
      this.lastAccepted = {
        lat,
        lng,
        accuracy,
        timestamp,
        isStationary: true,
        isLowAccuracy: false,
      };
      this.stationaryReadingsCount = 0;
      this.consecutiveMovementCount = 0;
      return {
        accepted: true,
        isStationary: true,
        isLowAccuracy: false,
        distanceMeters: distanceM,
        deadbandMeters: Math.max(this.minDeadbandRadiusMeters, accuracy * this.deadbandAccuracyMultiplier),
        reason: 'accuracy_upgrade',
        position: { ...this.lastAccepted },
      };
    }

    // 4. Reject teleportation anomalies (e.g. WiFi cell tower bouncing across town during active tracking)
    if (speedMs > this.maxAcceptableSpeedMs && accuracy > 20) {
      if (this.debug) {
        console.warn('[GPS Filter] Speed anomaly rejected:', { speedKmh: Math.round(speedMs * 3.6), distanceM: Math.round(distanceM), accuracy });
      }
      return {
        accepted: false,
        reason: 'speed_anomaly',
        distanceMeters: distanceM,
        position: { ...this.lastAccepted },
      };
    }

    // 4. Compute dynamic deadband based on reported horizontal accuracy
    // When accuracy is 12m, deadband is ~8m. When accuracy is 30m, deadband is ~20m.
    const deadbandM = Math.max(
      this.minDeadbandRadiusMeters,
      Math.min(this.maxDeadbandRadiusMeters, accuracy * this.deadbandAccuracyMultiplier)
    );

    // 5. Stationary Deadband Check
    // If movement is below the accuracy noise floor, the user is stationary!
    if (distanceM < deadbandM) {
      this.stationaryReadingsCount++;
      this.consecutiveMovementCount = 0;

      // Allow accuracy to improve if a tighter satellite lock arrives while stationary
      if (accuracy < this.lastAccepted.accuracy) {
        this.lastAccepted.accuracy = accuracy;
      }
      this.lastAccepted.timestamp = timestamp;
      this.lastAccepted.isStationary = true;

      return {
        accepted: true,
        isStationary: true,
        isLowAccuracy: this.lastAccepted.accuracy > this.unreliableAccuracyThresholdM,
        distanceMeters: distanceM,
        deadbandMeters: deadbandM,
        reason: 'stationary_deadband_absorbed',
        position: { ...this.lastAccepted },
      };
    }

    // 6. Sustained Movement Check
    // If reading is genuinely outside deadband, verify that accuracy is credible
    this.consecutiveMovementCount++;
    this.stationaryReadingsCount = 0;

    // If accuracy is poor (> 70m) and distance is marginal, do not jump yet
    if (accuracy > 70 && distanceM < 40) {
      if (this.debug) console.warn('[GPS Filter] Poor accuracy movement rejected:', { distanceM, accuracy });
      return {
        accepted: false,
        reason: 'poor_accuracy_drift',
        distanceMeters: distanceM,
        position: { ...this.lastAccepted },
      };
    }

    // 7. Smooth position update (Exponential Smoothing for walking / gentle movement)
    let newLat = lat;
    let newLng = lng;

    if (distanceM < 30) {
      // Weight gives more trust to higher accuracy readings
      const alpha = Math.min(0.85, Math.max(0.4, 1.0 - (accuracy / 120)));
      newLat = this.lastAccepted.lat + (lat - this.lastAccepted.lat) * alpha;
      newLng = this.lastAccepted.lng + (lng - this.lastAccepted.lng) * alpha;
    }

    this.lastAccepted = {
      lat: Number(newLat.toFixed(6)),
      lng: Number(newLng.toFixed(6)),
      accuracy,
      timestamp,
      isStationary: false,
      isLowAccuracy: accuracy > this.unreliableAccuracyThresholdM,
    };

    if (this.debug) {
      console.log('[GPS Filter] Position updated smoothly:', {
        lat: this.lastAccepted.lat,
        lng: this.lastAccepted.lng,
        distM: Math.round(distanceM),
        accuracy,
      });
    }

    return {
      accepted: true,
      isStationary: false,
      isLowAccuracy: accuracy > this.unreliableAccuracyThresholdM,
      distanceMeters: distanceM,
      deadbandMeters: deadbandM,
      reason: 'sustained_movement',
      position: { ...this.lastAccepted },
    };
  }
}

/**
 * Determine whether route recalculation is genuinely warranted.
 * Prevents continuous API spam on minor fluctuations.
 */
export function shouldRecalculateRoute(lastRoutedLoc, currentLoc, travelMode = 'motor', minDistanceMeters = 30) {
  if (!lastRoutedLoc || !currentLoc) return true;
  if (!lastRoutedLoc.lat || !lastRoutedLoc.lng || !currentLoc.lat || !currentLoc.lng) return true;

  const dist = haversineDistanceMeters(
    lastRoutedLoc.lat,
    lastRoutedLoc.lng,
    currentLoc.lat,
    currentLoc.lng
  );

  // If customer moved less than threshold, do NOT recalculate route
  const dynamicThreshold = travelMode === 'walking' ? Math.max(22, minDistanceMeters) : Math.max(35, minDistanceMeters);
  return dist >= dynamicThreshold;
}
