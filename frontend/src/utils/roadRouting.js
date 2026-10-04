/**
 * roadRouting.js
 * 
 * Multi-profile road routing utility for PrintDayon.
 * 
 * IMPORTANT ROUTING RULES:
 * 1. WALK:
 *    - Uses pedestrian routing profile (routed-foot).
 *    - Pedestrians may legally travel both directions on one-way vehicle streets
 *      where pedestrian access/sidewalks exist.
 *    - Independent from vehicle routing; does NOT query vehicle endpoints.
 * 
 * 2. MOTORCYCLE:
 *    - Uses vehicle routing profile enforcing strict one-way vehicle restrictions.
 *    - NEVER routes against one-way vehicle flow.
 *    - Does NOT query pedestrian or bike contraflow endpoints.
 * 
 * 3. CAR:
 *    - Uses vehicle routing profile enforcing strict one-way vehicle restrictions.
 *    - NEVER routes against one-way vehicle flow.
 *    - Does NOT query pedestrian or bike contraflow endpoints.
 */

// Travel mode definitions with their dedicated routing endpoints
const MODE_ROUTING_CONFIG = {
  walking: {
    key: 'walking',
    label: 'Walk',
    speedKmh: 4.5,
    endpoints: [
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
    ],
  },
  motor: {
    key: 'motor',
    label: 'Motorcycle',
    speedKmh: 25.0,
    endpoints: [
      'https://routing.openstreetmap.de/routed-car/route/v1/driving',
      'https://router.project-osrm.org/route/v1/driving',
    ],
  },
  vehicle: {
    key: 'vehicle',
    label: 'Car',
    speedKmh: 22.0,
    endpoints: [
      'https://router.project-osrm.org/route/v1/driving',
      'https://routing.openstreetmap.de/routed-car/route/v1/driving',
    ],
  },
};

export function normalizeMode(mode) {
  const m = String(mode || 'motor').toLowerCase().trim();
  if (['walking', 'walk', 'foot', 'pedestrian'].includes(m)) return 'walking';
  if (['vehicle', 'car', 'cars', 'driving', 'auto'].includes(m)) return 'vehicle';
  return 'motor';
}

const routeCache = new Map();

/**
 * Fetch road-snapped coordinates respecting the requested travel mode's directional restrictions.
 * 
 * @param {Object} start - { lat, lng }
 * @param {Object} end - { lat, lng }
 * @param {Array} fallbackCoords - Array of [lng, lat] from backend Dijkstra algorithm
 * @param {String} travelMode - 'walking', 'motor', or 'vehicle'
 * @returns {Promise<Object>} { coordinates, distanceMeters, durationSeconds, isRoadSnapped, travelMode }
 */
export async function getRoadPolyline(start, end, fallbackCoords = [], travelMode = 'motor') {
  if (!start || !end || !start.lat || !start.lng || !end.lat || !end.lng) {
    return {
      coordinates: fallbackCoords,
      distanceMeters: 0,
      durationSeconds: 0,
      isRoadSnapped: false,
      travelMode: normalizeMode(travelMode),
    };
  }

  const modeKey = normalizeMode(travelMode);
  const config = MODE_ROUTING_CONFIG[modeKey] || MODE_ROUTING_CONFIG.motor;

  const cacheKey = `${modeKey}|${start.lat.toFixed(5)},${start.lng.toFixed(5)}_${end.lat.toFixed(5)},${end.lng.toFixed(5)}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  const coordStr = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const params = 'overview=full&geometries=geojson&continue_straight=false&alternatives=true';

  // Query endpoints dedicated to this travel mode profile
  for (const endpoint of config.endpoints) {
    try {
      const url = `${endpoint}/${coordStr}?${params}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;

      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const route = data.routes[0];
        const distanceMeters = Math.round(route.distance);
        // Calculate duration based on mode-specific speed if OSRM duration is default car
        const calculatedSeconds = Math.round((distanceMeters / 1000 / config.speedKmh) * 3600);
        const durationSeconds = route.duration && modeKey === 'vehicle'
          ? Math.round(route.duration)
          : calculatedSeconds;

        let altCoords = null;
        let altDistance = null;
        let altDuration = null;

        if (data.routes[1]) {
          altCoords = data.routes[1].geometry.coordinates;
          altDistance = Math.round(data.routes[1].distance);
          altDuration = Math.round((altDistance / 1000 / config.speedKmh) * 3600);
        }

        const savingsMeters = altDistance ? Math.max(0, altDistance - distanceMeters) : 0;

        const result = {
          coordinates: route.geometry.coordinates,
          distanceMeters,
          durationSeconds: Math.max(60, durationSeconds),
          alternativeCoordinates: altCoords,
          alternativeDistanceMeters: altDistance,
          alternativeDurationSeconds: altDuration ? Math.max(60, altDuration) : null,
          savingsMeters,
          isRoadSnapped: true,
          travelMode: modeKey,
        };

        if (routeCache.size > 100) {
          const firstKey = routeCache.keys().next().value;
          routeCache.delete(firstKey);
        }
        routeCache.set(cacheKey, result);
        return result;
      }
    } catch {
      // Continue to next endpoint for this same mode
    }
  }

  // Fallback to backend Dijkstra graph path if external OSRM is unreachable
  const finalCoords = fallbackCoords?.length >= 2
    ? fallbackCoords
    : (start?.lng && end?.lng ? [[start.lng, start.lat], [end.lng, end.lat]] : []);

  return {
    coordinates: finalCoords,
    distanceMeters: 0,
    durationSeconds: 0,
    isRoadSnapped: false,
    travelMode: modeKey,
  };
}

export function clearRouteCache() {
  routeCache.clear();
}
