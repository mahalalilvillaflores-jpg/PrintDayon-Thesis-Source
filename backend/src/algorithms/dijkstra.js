class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(node) {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].dist <= this.heap[i].dist) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].dist < this.heap[smallest].dist) smallest = left;
      if (right < n && this.heap[right].dist < this.heap[smallest].dist) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

function dijkstra(graph, source, target, travelMode = 'motor') {
  const modeKey = normalizeTravelMode(travelMode);
  const dist = {};
  const prev = {};
  const visited = new Set();
  const pq = new MinHeap();

  for (const node in graph) {
    dist[node] = Infinity;
    prev[node] = null;
  }
  dist[source] = 0;
  pq.push({ node: source, dist: 0 });

  while (!pq.isEmpty()) {
    const { node: current, dist: currentDist } = pq.pop();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === target) break;

    const neighbors = graph[current] || [];
    for (const edge of neighbors) {
      const { to, weight, allowedModes } = edge;

      // Mode & Road restriction filter:
      // If the edge specifies allowedModes, ensure the current travelMode is permitted
      if (allowedModes && Array.isArray(allowedModes)) {
        if (!allowedModes.includes(modeKey)) {
          continue; // Skip: travel mode cannot use this road/path or is opposing one-way traffic
        }
      }

      if (visited.has(to)) continue;
      const newDist = currentDist + weight;
      if (newDist < dist[to]) {
        dist[to] = newDist;
        prev[to] = current;
        pq.push({ node: to, dist: newDist });
      }
    }
  }

  const path = [];
  let curr = target;
  while (curr !== null) {
    path.unshift(curr);
    curr = prev[curr];
  }

  const distance = dist[target];
  const found = path[0] === source && distance !== Infinity;

  return {
    distance: found ? distance : Infinity,
    path: found ? path : [],
    found,
  };
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function normalizeTravelMode(mode) {
  if (!mode) return 'motor';
  const m = String(mode).toLowerCase().trim();
  if (['walking', 'walk', 'foot', 'pedestrian'].includes(m)) return 'walking';
  if (['motor', 'motorbike', 'motorcycle', 'scooter', 'tricycle', 'trike'].includes(m)) return 'motor';
  if (['vehicle', 'car', 'cars', 'driving', 'auto', 'automobile'].includes(m)) return 'vehicle';
  return 'motor';
}

const TRAVEL_MODES = {
  walking: { key: 'walking', label: 'Walking', speedKmh: 4.5, osrmProfile: 'foot' },
  motor: { key: 'motor', label: 'Motorcycle', speedKmh: 25.0, osrmProfile: 'bike' },
  vehicle: { key: 'vehicle', label: 'Car', speedKmh: 22.0, osrmProfile: 'driving' },
};

TRAVEL_MODES.walk = TRAVEL_MODES.walking;
TRAVEL_MODES.foot = TRAVEL_MODES.walking;
TRAVEL_MODES.pedestrian = TRAVEL_MODES.walking;
TRAVEL_MODES.motorbike = TRAVEL_MODES.motor;
TRAVEL_MODES.motorcycle = TRAVEL_MODES.motor;
TRAVEL_MODES.tricycle = TRAVEL_MODES.motor;
TRAVEL_MODES.trike = TRAVEL_MODES.motor;
TRAVEL_MODES.car = TRAVEL_MODES.vehicle;
TRAVEL_MODES.cars = TRAVEL_MODES.vehicle;
TRAVEL_MODES.driving = TRAVEL_MODES.vehicle;

const DEFAULT_TRAVEL_MODE = 'motor';

const AVERAGE_SPEED_KMH = TRAVEL_MODES.motor.speedKmh;

function findNearestNode(nodeCoordinates, lat, lng, graph = null, modeKey = null) {
  let nearestNode = null;
  let minDist = Infinity;

  for (const [nodeId, coords] of Object.entries(nodeCoordinates)) {
    // If graph and modeKey are specified, ensure the node is accessible for the travel mode
    if (graph && modeKey && modeKey !== 'walking') {
      const outbound = graph[nodeId] || [];
      const hasOutbound = outbound.some((e) => !e.allowedModes || e.allowedModes.includes(modeKey));
      if (!hasOutbound) continue;
    }

    const d = haversineDistance(lat, lng, coords.lat, coords.lng);
    if (d < minDist) {
      minDist = d;
      nearestNode = nodeId;
    }
  }

  return nearestNode;
}

function getShortestPath(graph, nodeCoordinates, customerLat, customerLng, shopLat, shopLng, travelMode = DEFAULT_TRAVEL_MODE) {
  const modeKey = normalizeTravelMode(travelMode);
  const mode = TRAVEL_MODES[modeKey] || TRAVEL_MODES[DEFAULT_TRAVEL_MODE];
  const speedKmh = mode.speedKmh;

  const sourceNode = findNearestNode(nodeCoordinates, customerLat, customerLng, graph, modeKey);
  const targetNode = findNearestNode(nodeCoordinates, shopLat, shopLng, graph, modeKey);

  const directDistance = Math.round(haversineDistance(customerLat, customerLng, shopLat, shopLng));

  if (sourceNode && targetNode) {
    let result = dijkstra(graph, sourceNode, targetNode, modeKey);

    if (result.found && result.distance !== Infinity) {
      let distanceMeters = result.distance;
      let pathCoordinates = [
        [customerLng, customerLat],
        ...result.path.map((nodeId) => {
          const node = nodeCoordinates[nodeId];
          return node ? [node.lng, node.lat] : null;
        }).filter(Boolean),
        [shopLng, shopLat],
      ];

      if (sourceNode === targetNode || distanceMeters === 0) {
        distanceMeters = directDistance;
        pathCoordinates = [
          [customerLng, customerLat],
          [shopLng, shopLat],
        ];
      } else {
        const accessLegCustomer = haversineDistance(
          customerLat, customerLng,
          nodeCoordinates[sourceNode].lat, nodeCoordinates[sourceNode].lng
        );
        const accessLegShop = haversineDistance(
          shopLat, shopLng,
          nodeCoordinates[targetNode].lat, nodeCoordinates[targetNode].lng
        );
        distanceMeters = Math.round(distanceMeters + accessLegCustomer + accessLegShop);

        // Preserve the full road network geometry from source to target
        // Do not collapse realistic street intersection turns into straight diagonal lines
      }

      const rawMinutes = (distanceMeters / 1000 / speedKmh) * 60;
      const travelTimeMinutes = distanceMeters < 50 ? 1 : Math.max(1, Math.round(rawMinutes));

      return {
        distanceMeters,
        distanceKm: (distanceMeters / 1000).toFixed(2),
        travelTimeMinutes,
        rawMinutes: parseFloat(rawMinutes.toFixed(2)),
        travelMode: modeKey,
        modeLabel: mode.label,
        modeSpeedKmh: speedKmh,
        osrmProfile: mode.osrmProfile,
        path: result.path,
        sourceNode,
        targetNode,
        pathCoordinates,
        method: 'dijkstra',
        found: true,
      };
    }
  }

  const distanceMeters = Math.round(haversineDistance(customerLat, customerLng, shopLat, shopLng));
  const rawMinutes = (distanceMeters / 1000 / speedKmh) * 60;
  const travelTimeMinutes = distanceMeters < 50 ? 1 : Math.max(1, Math.round(rawMinutes));

  return {
    distanceMeters,
    distanceKm: (distanceMeters / 1000).toFixed(2),
    travelTimeMinutes,
    rawMinutes: parseFloat(rawMinutes.toFixed(2)),
    travelMode: modeKey,
    modeLabel: mode.label,
    modeSpeedKmh: speedKmh,
    osrmProfile: mode.osrmProfile,
    path: [],
    sourceNode: sourceNode || null,
    targetNode: targetNode || null,
    pathCoordinates: [
      [customerLng, customerLat],
      [shopLng, shopLat],
    ],
    method: 'haversine_fallback',
    found: false,
  };
}

module.exports = {
  TRAVEL_MODES,
  DEFAULT_TRAVEL_MODE,
  AVERAGE_SPEED_KMH,
  normalizeTravelMode,
  dijkstra,
  haversineDistance,
  findNearestNode,
  getShortestPath,
  MinHeap,
};
