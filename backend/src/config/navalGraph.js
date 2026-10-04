/**
 * navalGraph.js
 * 
 * Dynamic Road Network Topology for Naval, Biliran (PrintDayon Thesis)
 * 
 * ACADEMIC ARCHITECTURE:
 * Edge weights are computed mathematically using the spherical Haversine formula
 * from the digitized GIS coordinates of Naval intersections, rather than static manual values.
 * Directional constraints enforce municipal one-way vehicle traffic schemes
 * and pedestrian-accessible campus footpaths.
 */

const { buildDirectedGraph, nodeCoordinates, haversineDistanceMeters } = require('../../scripts/generateNavalGraph');

// Automatically build graph with dynamic Haversine distances
const { graph: navalGraphDirected, metrics: graphMetrics } = buildDirectedGraph();
const navalGraph = navalGraphDirected;

module.exports = {
  navalGraph,
  navalGraphDirected,
  nodeCoordinates,
  graphMetrics,
  haversineDistanceMeters,
};
