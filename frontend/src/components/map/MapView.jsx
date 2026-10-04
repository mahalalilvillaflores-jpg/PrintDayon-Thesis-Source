import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, LocateFixed } from 'lucide-react';

const NAVAL_CENTER = [124.3980, 11.5628];

const MAP_STYLES = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    style: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'background-base',
          type: 'background',
          paint: {
            'background-color': '#f1f5f9',
          },
        },
        {
          id: 'osm-tiles-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  google: {
    id: 'google',
    name: 'Google Street',
    style: {
      version: 8,
      sources: {
        'google-tiles': {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          ],
          tileSize: 256,
          attribution: '© Google Maps',
          maxzoom: 22,
        },
      },
      layers: [
        {
          id: 'background-base',
          type: 'background',
          paint: {
            'background-color': '#f1f5f9',
          },
        },
        {
          id: 'google-tiles-layer',
          type: 'raster',
          source: 'google-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  hybrid: {
    id: 'hybrid',
    name: 'Satellite Hybrid',
    style: {
      version: 8,
      sources: {
        'google-hybrid-tiles': {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
          ],
          tileSize: 256,
          attribution: '© Google Maps',
          maxzoom: 22,
        },
      },
      layers: [
        {
          id: 'background-base',
          type: 'background',
          paint: {
            'background-color': '#0b132b',
          },
        },
        {
          id: 'google-hybrid-layer',
          type: 'raster',
          source: 'google-hybrid-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
};

export default function MapView({
  shops = [],
  userLocation,
  route = [],
  alternativeRoute = [],
  routeStats = null,
  selectedShop = null,
  travelMode = 'motor',
  height = '500px',
  onShopSelect,
  onLocationChange,
  onMapReady,
  initialZoom = 16,
  center,
  showRecenter = true,
  showStyleSwitcher = true,
  showNavigationControl = true,
  styleSwitcherPosition = 'top-left',
  styleSwitcherVariant = 'dropdown',
  defaultStyle = 'osm',
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const routeBadgeMarkerRef = useRef(null);
  const altRouteBadgeMarkerRef = useRef(null);
  const currentRouteCoordsRef = useRef([]);
  const currentAltRouteCoordsRef = useRef([]);
  const lastFittedRouteKeyRef = useRef('');
  const onShopSelectRef = useRef(onShopSelect);
  const onLocationChangeRef = useRef(onLocationChange);
  const svgOverlayRef = useRef(null);
  const updateSvgRouteRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [activeStyleKey, setActiveStyleKey] = useState(defaultStyle || 'osm');
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const styleMenuRef = useRef(null);

  const updateSvgRoute = useCallback(() => {
    const map = mapRef.current || mapInstance;
    const svg = svgOverlayRef.current;
    if (!map || !svg) return;

    const coords = currentRouteCoordsRef.current;
    const altCoords = currentAltRouteCoordsRef.current;
    const isWalking = travelMode === 'walking';

    // Preserve defs filter
    const defs = svg.querySelector('defs');
    svg.innerHTML = '';
    if (defs) svg.appendChild(defs);

    const projectToPath = (pts) => {
      if (!pts || pts.length < 2) return '';
      const points = pts.map((c) => {
        try {
          const p = map.project([c[0], c[1]]);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        } catch (_) {
          return null;
        }
      }).filter(Boolean);
      return points.length >= 2 ? `M ${points.join(' L ')}` : '';
    };

    // Draw alternative route if available
    if (altCoords && altCoords.length >= 2) {
      const altD = projectToPath(altCoords);
      if (altD) {
        const altPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        altPath.setAttribute('d', altD);
        altPath.setAttribute('fill', 'none');
        altPath.setAttribute('stroke', '#94A3B8');
        altPath.setAttribute('stroke-width', '4');
        altPath.setAttribute('stroke-dasharray', '6 5');
        altPath.setAttribute('stroke-linecap', 'round');
        altPath.setAttribute('stroke-linejoin', 'round');
        altPath.setAttribute('opacity', '0.75');
        svg.appendChild(altPath);
      }
    }

    // Draw main active Dijkstra shortest path
    if (coords && coords.length >= 2) {
      const d = projectToPath(coords);
      if (d) {
        if (!isWalking) {
          // 1. Soft ground shadow
          const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          shadow.setAttribute('d', d);
          shadow.setAttribute('fill', 'none');
          shadow.setAttribute('stroke', 'rgba(15, 23, 42, 0.22)');
          shadow.setAttribute('stroke-width', '11');
          shadow.setAttribute('stroke-linecap', 'round');
          shadow.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(shadow);

          // 2. High-contrast casing border
          const casing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          casing.setAttribute('d', d);
          casing.setAttribute('fill', 'none');
          casing.setAttribute('stroke', '#1E3A8A');
          casing.setAttribute('stroke-width', '8');
          casing.setAttribute('stroke-linecap', 'round');
          casing.setAttribute('stroke-linejoin', 'round');
          casing.setAttribute('opacity', '0.95');
          svg.appendChild(casing);

          // 3. Vibrant Royal Blue polyline
          const mainPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          mainPath.setAttribute('d', d);
          mainPath.setAttribute('fill', 'none');
          mainPath.setAttribute('stroke', '#2563EB');
          mainPath.setAttribute('stroke-width', '5.5');
          mainPath.setAttribute('stroke-linecap', 'round');
          mainPath.setAttribute('stroke-linejoin', 'round');
          mainPath.setAttribute('filter', 'url(#route-glow)');
          svg.appendChild(mainPath);

          // 4. Inner neon core
          const core = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          core.setAttribute('d', d);
          core.setAttribute('fill', 'none');
          core.setAttribute('stroke', '#93C5FD');
          core.setAttribute('stroke-width', '2');
          core.setAttribute('stroke-linecap', 'round');
          core.setAttribute('stroke-linejoin', 'round');
          svg.appendChild(core);
        } else {
          // Walking mode: Teal dashed polyline
          const casing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          casing.setAttribute('d', d);
          casing.setAttribute('fill', 'none');
          casing.setAttribute('stroke', '#0F766E');
          casing.setAttribute('stroke-width', '7');
          casing.setAttribute('stroke-linecap', 'round');
          casing.setAttribute('stroke-linejoin', 'round');
          casing.setAttribute('opacity', '0.4');
          svg.appendChild(casing);

          const walkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          walkPath.setAttribute('d', d);
          walkPath.setAttribute('fill', 'none');
          walkPath.setAttribute('stroke', '#0D9488');
          walkPath.setAttribute('stroke-width', '5');
          walkPath.setAttribute('stroke-linecap', 'round');
          walkPath.setAttribute('stroke-linejoin', 'round');
          walkPath.setAttribute('stroke-dasharray', '8 6');
          svg.appendChild(walkPath);
        }
      }
    }

    // Draw GPS accuracy radius indicator around customer position
    const loc = userLocation;
    if (loc && loc.lat && loc.lng) {
      try {
        const accMeters = (loc.accuracy && loc.accuracy > 4) ? loc.accuracy : 18;
        const centerPt = map.project([loc.lng, loc.lat]);
        const edgePt = map.project([loc.lng, loc.lat + (accMeters / 111320)]);
        const radiusPx = Math.max(12, Math.min(220, Math.abs(centerPt.y - edgePt.y)));

        const accCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        accCircle.setAttribute('cx', centerPt.x.toFixed(1));
        accCircle.setAttribute('cy', centerPt.y.toFixed(1));
        accCircle.setAttribute('r', radiusPx.toFixed(1));
        accCircle.setAttribute('fill', 'rgba(37, 99, 235, 0.12)');
        accCircle.setAttribute('stroke', 'rgba(37, 99, 235, 0.35)');
        accCircle.setAttribute('stroke-width', '1.5');
        accCircle.setAttribute('stroke-dasharray', '4 3');
        svg.appendChild(accCircle);
      } catch (_) {}
    }
  }, [mapInstance, travelMode, userLocation]);

  useEffect(() => {
    updateSvgRouteRef.current = updateSvgRoute;
    updateSvgRoute();
  }, [updateSvgRoute]);

  useEffect(() => {
    onShopSelectRef.current = onShopSelect;
  }, [onShopSelect]);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    const handleCloseMenu = (e) => {
      if (styleMenuRef.current && !styleMenuRef.current.contains(e.target)) {
        setShowStyleMenu(false);
      }
    };
    if (showStyleMenu) {
      document.addEventListener('click', handleCloseMenu);
      document.addEventListener('touchend', handleCloseMenu);
    }
    return () => {
      document.removeEventListener('click', handleCloseMenu);
      document.removeEventListener('touchend', handleCloseMenu);
    };
  }, [showStyleMenu]);

  // Center update effect - guard against jumping on minute GPS updates or array reference changes
  const lastCenterRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current || mapInstance;
    if (map && center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      const prev = lastCenterRef.current;
      if (!prev || Math.hypot(prev[0] - center[0], prev[1] - center[1]) > 0.0006) {
        lastCenterRef.current = center;
        try {
          map.flyTo({ center, zoom: initialZoom, duration: 400 });
        } catch (_) {}
      }
    }
  }, [center, mapInstance, initialZoom]);

  const ensureRouteLayers = useCallback((map) => {
    if (!map) return false;
    try {
      if (!map.getStyle() || !map.getStyle().layers) return false;

      if (!map.getSource('dijkstra-route')) {
        map.addSource('dijkstra-route', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: currentRouteCoordsRef.current?.length >= 2
              ? [{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: currentRouteCoordsRef.current,
                  },
                  properties: {},
                }]
              : [],
          },
        });
      }

      if (!map.getSource('alternative-route')) {
        map.addSource('alternative-route', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: currentAltRouteCoordsRef.current?.length >= 2
              ? [{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: currentAltRouteCoordsRef.current,
                  },
                  properties: {},
                }]
              : [],
          },
        });
      }

      const isWalking = travelMode === 'walking';

      if (!map.getLayer('alternative-route-line')) {
        map.addLayer({
          id: 'alternative-route-line',
          type: 'line',
          source: 'alternative-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#94A3B8',
            'line-dasharray': [2.5, 2],
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 2,
              13, 3.8,
              16, 5.8,
              19, 8,
            ],
            'line-opacity': 0.85,
          },
        });
      }

      if (!map.getLayer('dijkstra-route-shadow')) {
        map.addLayer({
          id: 'dijkstra-route-shadow',
          type: 'line',
          source: 'dijkstra-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': 'rgba(15, 23, 42, 0.22)',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 4.5,
              13, 7.5,
              16, 11,
              19, 15,
            ],
            'line-blur': 3,
            'line-opacity': 0.65,
          },
        });
      }

      if (!map.getLayer('dijkstra-route-casing')) {
        map.addLayer({
          id: 'dijkstra-route-casing',
          type: 'line',
          source: 'dijkstra-route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isWalking ? '#0F766E' : '#1E3A8A',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 4.5,
              13, 8,
              16, 11,
              19, 15,
            ],
            'line-opacity': isWalking ? 0.35 : 0.95,
          },
        });
      }

      // Solid polyline for Car and Motorcycle
      if (!map.getLayer('dijkstra-route-vehicle')) {
        map.addLayer({
          id: 'dijkstra-route-vehicle',
          type: 'line',
          source: 'dijkstra-route',
          layout: {
            'visibility': !isWalking ? 'visible' : 'none',
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#2563EB',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 3,
              13, 6,
              16, 8.5,
              19, 12,
            ],
            'line-opacity': 1,
          },
        });
      }

      // Inner glow line for Car and Motorcycle (GPS aesthetic)
      if (!map.getLayer('dijkstra-route-inner')) {
        map.addLayer({
          id: 'dijkstra-route-inner',
          type: 'line',
          source: 'dijkstra-route',
          layout: {
            'visibility': !isWalking ? 'visible' : 'none',
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#93C5FD',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 1.2,
              13, 2.2,
              16, 3.5,
              19, 5,
            ],
            'line-opacity': 0.85,
          },
        });
      }

      // Dashed polyline for Walk mode
      if (!map.getLayer('dijkstra-route-walk')) {
        map.addLayer({
          id: 'dijkstra-route-walk',
          type: 'line',
          source: 'dijkstra-route',
          layout: {
            'visibility': isWalking ? 'visible' : 'none',
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#0D9488',
            'line-dasharray': [2.5, 2],
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              10, 3.2,
              13, 5.8,
              16, 8.5,
              19, 11.5,
            ],
            'line-opacity': 1,
          },
        });
      }

      // Clean up legacy layer if present
      if (map.getLayer('dijkstra-route-line')) {
        try { map.removeLayer('dijkstra-route-line'); } catch (_) {}
      }

      // Synchronize visibility of all route layers according to current travelMode
      if (map.getLayer('dijkstra-route-walk')) {
        map.setLayoutProperty('dijkstra-route-walk', 'visibility', isWalking ? 'visible' : 'none');
      }
      if (map.getLayer('dijkstra-route-vehicle')) {
        map.setLayoutProperty('dijkstra-route-vehicle', 'visibility', !isWalking ? 'visible' : 'none');
      }
      if (map.getLayer('dijkstra-route-inner')) {
        map.setLayoutProperty('dijkstra-route-inner', 'visibility', !isWalking ? 'visible' : 'none');
      }
      if (map.getLayer('dijkstra-route-casing')) {
        map.setPaintProperty('dijkstra-route-casing', 'line-color', isWalking ? '#0F766E' : '#1E3A8A');
        map.setPaintProperty('dijkstra-route-casing', 'line-opacity', isWalking ? 0.35 : 0.95);
      }

      // Ensure all route layers sit above raster basemap layers
      const routeLayers = [
        'dijkstra-route-shadow',
        'dijkstra-route-casing',
        'alternative-route-line',
        'dijkstra-route-vehicle',
        'dijkstra-route-inner',
        'dijkstra-route-walk',
      ];
      routeLayers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          try {
            map.moveLayer(layerId);
          } catch (_) {}
        }
      });

      return true;
    } catch (e) {
      console.warn('Could not add route layers:', e);
      return false;
    }
  }, [travelMode]);

  const updateRouteOnMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (!map.getStyle() || !map.getStyle().layers) return;
    } catch (_) {
      return;
    }

    ensureRouteLayers(map);

    const coords = currentRouteCoordsRef.current;
    const altCoords = currentAltRouteCoordsRef.current;

    const source = map.getSource('dijkstra-route');
    if (source) {
      if (coords && coords.length >= 2) {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {},
          }],
        });

        // Fit camera only when destination shop changes or mode changes, NOT on every minor GPS fluctuation
        const targetShopId = (selectedShop?._id || selectedShop?.shopId || selectedShop?.name || 'default').toString();
        const targetRouteKey = `${targetShopId}_${travelMode}`;
        if (targetRouteKey !== lastFittedRouteKeyRef.current) {
          lastFittedRouteKeyRef.current = targetRouteKey;
          try {
            const bounds = coords.reduce(
              (b, coord) => b.extend(coord),
              new maplibregl.LngLatBounds(coords[0], coords[0])
            );
            if (altCoords && altCoords.length > 1) {
              altCoords.forEach((c) => bounds.extend(c));
            }
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const isDegenerate = Math.abs(ne.lng - sw.lng) < 0.00005 && Math.abs(ne.lat - sw.lat) < 0.00005;
            if (isDegenerate) {
              map.flyTo({ center: coords[0], zoom: 16.5, duration: 400 });
            } else {
              map.fitBounds(bounds, { padding: 65, maxZoom: 17, duration: 400 });
            }
          } catch (_) {}
        }
      } else {
        source.setData({
          type: 'FeatureCollection',
          features: [],
        });
        lastFittedRouteKeyRef.current = '';
      }
    }

    const altSource = map.getSource('alternative-route');
    if (altSource) {
      if (altCoords && altCoords.length >= 2) {
        altSource.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: altCoords,
            },
            properties: {},
          }],
        });
      } else {
        altSource.setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
    }

    try {
      map.triggerRepaint();
    } catch (_) {}

    updateSvgRoute();
  }, [ensureRouteLayers, updateSvgRoute]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const center = userLocation
      ? [userLocation.lng, userLocation.lat]
      : NAVAL_CENTER;

    const selectedStyleObj = MAP_STYLES[activeStyleKey]?.style || MAP_STYLES.osm.style;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: selectedStyleObj,
      center: center,
      zoom: initialZoom,
      pitchWithRotate: false,
      attributionControl: false,
      maxZoom: 19.5,
      minZoom: 11,
    });
    mapRef.current = map;
    setMapInstance(map);
    if (onMapReady) {
      onMapReady(map);
    }

    // Mount dedicated SVG route overlay inside MapLibre canvas container
    // Positioned at z-index 2 (above WebGL canvas tiles at z-index 0, but beneath HTML markers at z-index 10-50)
    try {
      const canvasContainer = map.getCanvasContainer();
      if (canvasContainer) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'maplibre-svg-route-overlay');
        svg.style.position = 'absolute';
        svg.style.inset = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '2';
        svg.style.overflow = 'visible';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML = `
          <filter id="route-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#2563EB" floodOpacity="0.45" />
          </filter>
        `;
        svg.appendChild(defs);

        if (canvasContainer.firstChild && canvasContainer.firstChild.nextSibling) {
          canvasContainer.insertBefore(svg, canvasContainer.firstChild.nextSibling);
        } else {
          canvasContainer.appendChild(svg);
        }
        svgOverlayRef.current = svg;
      }
    } catch (e) {
      console.warn('Could not attach SVG overlay to canvas container:', e);
    }

    if (showNavigationControl) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
      const geolocate = new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: false,
        showUserLocation: false,
      });
      geolocate.on('geolocate', (e) => {
        if (onLocationChangeRef.current && e?.coords) {
          onLocationChangeRef.current({
            lat: Number(e.coords.latitude.toFixed(6)),
            lng: Number(e.coords.longitude.toFixed(6)),
            accuracy: e.coords.accuracy ? Math.round(e.coords.accuracy) : null,
            timestamp: e.timestamp || Date.now(),
          });
        }
      });
      map.addControl(geolocate, 'top-right');
    }

    map.on('click', (e) => {
      if (onLocationChangeRef.current) {
        onLocationChangeRef.current({
          lat: Number(e.lngLat.lat.toFixed(6)),
          lng: Number(e.lngLat.lng.toFixed(6)),
        });
      }
    });

    map.on('error', (e) => {
      console.warn('MapLibre notice:', e?.error?.message || e);
    });

    const handleStyleReady = () => {
      try {
        if (!map.getStyle()?.layers) return;
      } catch (_) {
        return;
      }
      setMapLoaded(true);
      ensureRouteLayers(map);
      updateRouteOnMap();
    };

    if (map.isStyleLoaded()) {
      handleStyleReady();
    }

    map.on('load', handleStyleReady);
    map.on('style.load', handleStyleReady);
    map.on('styledata', () => {
      if (map.isStyleLoaded()) {
        handleStyleReady();
      }
    });

    const handleMapMovement = () => {
      if (updateSvgRouteRef.current) {
        updateSvgRouteRef.current();
      }
    };
    map.on('move', handleMapMovement);
    map.on('zoom', handleMapMovement);
    map.on('resize', handleMapMovement);
    map.on('render', handleMapMovement);

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      map.off('move', handleMapMovement);
      map.off('zoom', handleMapMovement);
      map.off('resize', handleMapMovement);
      map.off('render', handleMapMovement);
      resizeObserver.disconnect();
      if (svgOverlayRef.current && svgOverlayRef.current.parentNode) {
        try { svgOverlayRef.current.parentNode.removeChild(svgOverlayRef.current); } catch (_) {}
      }
      svgOverlayRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (userMarkerRef.current) {
        try { userMarkerRef.current.remove(); } catch (_) {}
        userMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, []);

  const switchMapStyle = (key) => {
    setShowStyleMenu(false);
    if (!mapRef.current || !MAP_STYLES[key]) return;
    if (key === activeStyleKey) return;
    setActiveStyleKey(key);
    try {
      const map = mapRef.current;
      map.setStyle(MAP_STYLES[key].style);
      const onStyleSwitchReady = () => {
        setMapLoaded(true);
        ensureRouteLayers(map);
        updateRouteOnMap();
      };
      map.once('style.load', onStyleSwitchReady);
      map.once('styledata', onStyleSwitchReady);
    } catch (err) {
      console.error('Error switching map style:', err);
    }
  };

  useEffect(() => {
    const map = mapRef.current || mapInstance;
    if (!map) return;

    if (userLocation && userLocation.lat && userLocation.lng) {
      const existing = userMarkerRef.current;
      const el = existing?.getElement();

      // If marker already exists and is attached to this active map, update position smoothly
      if (existing && el && el.parentNode && existing._map === map) {
        existing.setLngLat([userLocation.lng, userLocation.lat]);
        return;
      }

      // If marker was detached or map was recreated, cleanly remove old instance
      if (existing) {
        try { existing.remove(); } catch (_) {}
        userMarkerRef.current = null;
      }

      const markerEl = document.createElement('div');
      markerEl.className = 'user-location-marker';
      markerEl.style.zIndex = '50';
      markerEl.style.cursor = 'grab';
      markerEl.style.width = '48px';
      markerEl.style.height = '48px';
      markerEl.style.display = 'flex';
      markerEl.style.alignItems = 'center';
      markerEl.style.justifyContent = 'center';
      markerEl.style.pointerEvents = 'auto';
      markerEl.innerHTML = `
        <div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
          <!-- Soft radar pulse halo -->
          <div style="position:absolute; width:40px; height:40px; border-radius:50%; background:rgba(37,99,235,0.22); border:1.5px solid rgba(37,99,235,0.45); animation:gps-radar-ping 2.5s cubic-bezier(0,0,0.2,1) infinite; pointer-events:none;"></div>
          <!-- Solid Blue Center Dot with Pure White Ring Border & Depth Shadow -->
          <div style="position:relative; width:18px; height:18px; border-radius:50%; background:#2563EB; border:3.5px solid #FFFFFF; box-shadow:0 2px 8px rgba(37,99,235,0.65), 0 1px 3px rgba(0,0,0,0.25); z-index:3;"></div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(`
        <div style="font-weight:700; font-size:12px; color:#0a0a0a; display:flex; flex-direction:column; gap:2px; font-family:Inter,sans-serif;">
          <div>Customer Location</div>
          <div style="font-size:10px; color:#64748B; font-weight:500;">
            ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}${userLocation.accuracy ? ` (±${Math.round(userLocation.accuracy)}m)` : ''}
          </div>
          <div style="font-size:9px; color:#94A3B8; margin-top:2px;">Drag to adjust position</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: markerEl, draggable: true, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .setPopup(popup)
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current({
            lat: Number(lngLat.lat.toFixed(6)),
            lng: Number(lngLat.lng.toFixed(6)),
          });
        }
      });

      userMarkerRef.current = marker;
    } else if (userMarkerRef.current) {
      try { userMarkerRef.current.remove(); } catch (_) {}
      userMarkerRef.current = null;
    }
  }, [mapInstance, userLocation]);

  // Update shop markers on map
  useEffect(() => {
    const map = mapRef.current || mapInstance;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers
    shops.forEach((shop, index) => {
      try {
        const lat = shop.latitude ?? shop.lat ?? shop.location?.coordinates?.[1] ?? shop.location?.lat;
        const lng = shop.longitude ?? shop.lng ?? shop.location?.coordinates?.[0] ?? shop.location?.lng;
        
        if (!lat || !lng) return;

      const isRecommended = shop.isRecommended || shop.recommended;
      const isOpen = shop.isOpen !== false && shop.status !== 'closed' && shop.status !== 'temporarily_unavailable';
      const queueCount = shop.queueCount ?? shop.currentQueue ?? 0;
      
      const markerColor = !isOpen ? '#94a3b8' : isRecommended ? '#19398d' : '#3b82f6';

      let monogram = 'SP';
      let shortName = shop.shopName || shop.name || 'Shop';
      const rawName = shop.shopName || shop.name;
      if (rawName) {
        const words = rawName.trim().split(/\s+/);
        monogram = words.length >= 2 
          ? (words[0][0] + words[1][0]).toUpperCase()
          : rawName.slice(0, 2).toUpperCase();
        shortName = words.slice(0, 2).join(' ');
      }

      const isSelected = Boolean(
        selectedShop && (
          (selectedShop._id && (shop._id === selectedShop._id || shop.shopId === selectedShop._id)) ||
          (selectedShop.shopId && (shop.shopId === selectedShop.shopId || shop._id === selectedShop.shopId)) ||
          (selectedShop.name && (shop.name === selectedShop.name || shop.shopName === selectedShop.name)) ||
          (selectedShop.shopName && (shop.shopName === selectedShop.shopName || shop.name === selectedShop.shopName))
        )
      );

      const pinEl = document.createElement('div');
      pinEl.className = 'shop-pin-marker';
      pinEl.style.cursor = 'pointer';
      pinEl.style.userSelect = 'none';
      pinEl.style.zIndex = isSelected ? '100' : isRecommended ? '50' : '10';
      pinEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center;">
          <div class="shop-pin-inner" style="position:relative; display:flex; flex-direction:column; align-items:center; transition:transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);">
            ${isSelected ? '<div style="position:absolute; top:-4px; width:44px; height:44px; border-radius:14px; border:2.5px solid #19398d; background:rgba(25,57,141,0.18);"></div>' : ''}
            
            <!-- Pin Badge with Printer / Store Icon -->
            <div style="
              width: 38px; height: 38px;
              border-radius: 12px;
              background: ${!isOpen ? 'linear-gradient(135deg, #64748B, #475569)' : isSelected ? 'linear-gradient(135deg, #19398d, #2563EB)' : isRecommended ? 'linear-gradient(135deg, #1E3A8A, #2563EB)' : 'linear-gradient(135deg, #2563EB, #60A5FA)'};
              border: 2.5px solid #FFFFFF;
              box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22);
              display: flex; align-items: center; justify-content: center;
              color: #FFFFFF;
              position: relative;
            ">
              <!-- Printer / Storefront Icon or Star for Best Match -->
              ${isRecommended ? ' \
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"> \
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon> \
                </svg> \
              ' : ' \
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"> \
                  <path d="M6 9V2h12v7"></path> \
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path> \
                  <rect x="6" y="14" width="12" height="8" rx="1"></rect> \
                </svg> \
              '}

              <!-- Status Dot (Open: green check, Closed: red cross) -->
              <div style="
                position: absolute;
                top: -3px; right: -3px;
                width: 14px; height: 14px;
                border-radius: 50%;
                background: ${isOpen ? '#10B981' : '#EF4444'};
                border: 2px solid #FFFFFF;
                color: #FFFFFF;
                display: flex; align-items: center; justify-content: center;
                font-size: 8px; font-weight: 900;
                box-shadow: 0 1px 4px rgba(0,0,0,0.25);
              ">
                ${isOpen ? '✓' : '✕'}
              </div>
            </div>

            <!-- Pointer Triangle Pin Tip -->
            <div style="
              width: 0; height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-top: 6px solid ${!isOpen ? '#475569' : isSelected ? '#19398d' : isRecommended ? '#1E3A8A' : '#2563EB'};
              margin-top: -1px;
            "></div>

            <!-- Shop Name Tag Below -->
            <div style="
              margin-top: 3px;
              background: #FFFFFF;
              border: 1px solid ${isSelected ? '#19398d' : '#CBD5E1'};
              border-radius: 6px;
              padding: 2px 7px;
              font-size: 10px;
              font-weight: 800;
              color: ${isSelected ? '#19398d' : '#0F172A'};
              white-space: nowrap;
              max-width: 115px;
              overflow: hidden;
              text-overflow: ellipsis;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
              font-family: Inter, system-ui, sans-serif;
              display: flex;
              align-items: center;
              gap: 3px;
            ">
              <span>${shortName}</span>
            </div>
          </div>
        </div>
      `;

      let queueBadgeColor = '#dcfce7';
      let queueTextColor = '#166534';
      let queueLabel = 'Low Wait';
      if (!isOpen) {
        queueBadgeColor = '#f3f4f6';
        queueTextColor = '#6b7280';
        queueLabel = 'Closed';
      } else if (queueCount >= 6) {
        queueBadgeColor = '#fee2e2';
        queueTextColor = '#991b1b';
        queueLabel = 'Heavy Queue';
      } else if (queueCount >= 3) {
        queueBadgeColor = '#fef3c7';
        queueTextColor = '#92400e';
        queueLabel = 'Moderate';
      }

      const innerEl = pinEl.querySelector('.shop-pin-inner');
      if (innerEl) {
        pinEl.addEventListener('mouseenter', () => {
          innerEl.style.transform = 'scale(1.18)';
        });
        pinEl.addEventListener('mouseleave', () => {
          innerEl.style.transform = 'scale(1)';
        });
      }

      const popupHTML = `
        <div style="min-width: 210px; font-family: Inter, sans-serif; padding: 2px;">
          ${isRecommended ? `
            <div style="font-size:10px; font-weight:700; color:#19398d; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; display:flex; align-items:center; gap:3px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              No. 1 Best Match
            </div>
          ` : ''}
          <div style="font-weight:700; font-size:14px; color:#0a0a0a; margin-bottom:2px;">
            ${shop.shopName || shop.name || 'Printing Shop'}
          </div>
          <div style="font-size:11px; color:#64748B; margin-bottom:6px; line-height:1.3;">
            ${shop.address || 'Naval, Biliran'}
          </div>

          <div style="display:inline-block; font-size:10px; font-weight:700; background:${queueBadgeColor}; color:${queueTextColor}; padding:2px 6px; border-radius:4px; margin-bottom:6px;">
            People waiting: ${queueCount}
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; font-size:11px; color:#334155; margin-bottom:8px; padding:6px 8px; background:#f8fafc; border-radius:8px; border:1px solid #e3e3e3;">
            <div>Distance: ${shop.distanceMeters ? (shop.distanceMeters < 1000 ? `${shop.distanceMeters} m` : `${(shop.distanceMeters/1000).toFixed(2)} km`) : (shop.distanceKm ? `${shop.distanceKm} km` : '0 m')}</div>
            <div>Travel: ${shop.travelTimeMinutes ?? shop.travelTime ?? 0}m</div>
            <div>Queue: ${shop.waitingTimeMinutes ?? shop.estimatedWaitingTime ?? 0}m</div>
            <div>Service: ${shop.serviceTimeMinutes ?? shop.estimatedPrintingTime ?? 1}m</div>
          </div>

          ${(shop.estimatedCompletionMinutes || shop.estimatedCompletionTime || shop.completionTime) ? `
            <div style="padding:6px; background:#eef2fc; border:1px solid #d2defc; border-radius:8px; text-align:center; margin-bottom:8px;">
              <div style="font-size:9px; color:#19398d; font-weight:700; text-transform:uppercase;">Estimated Completion Time</div>
              <div style="font-size:15px; font-weight:800; color:#19398d;">About ${shop.estimatedCompletionMinutes ?? shop.estimatedCompletionTime ?? shop.completionTime} mins</div>
            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:6px;">
            <span style="font-weight:700; color:${isOpen ? '#16A34A' : '#9b0033'}">
              ● ${isOpen ? 'Open Now' : 'Closed'}
            </span>
            <span style="font-weight:700; color:#0a0a0a;">
              Rating: ${shop.rating && Number(shop.rating) > 0 ? Number(shop.rating).toFixed(1) : 'No ratings yet'}
            </span>
          </div>

          <button id="btn-select-${shop.shopId || shop._id}" style="
            width: 100%;
            background: #19398d;
            color: white;
            border: none;
            padding: 7px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            font-family: Inter, sans-serif;
            transition: background 0.15s;
          ">
            Select This Shop
          </button>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 18, maxWidth: '280px' }).setHTML(popupHTML);

      popup.on('open', () => {
        const btn = document.getElementById(`btn-select-${shop.shopId || shop._id}`);
        if (btn) {
          btn.onclick = () => {
            onShopSelect?.(shop);
          };
        }
      });

      const marker = new maplibregl.Marker({ element: pinEl, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);

      pinEl.addEventListener('click', (e) => {
        e.stopPropagation();
        onShopSelectRef.current?.(shop);
      });

        markersRef.current.push(marker);
      } catch (err) {
        console.warn('Error rendering shop marker:', err);
      }
    });
  }, [mapInstance, shops, selectedShop]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (!map.getStyle()?.layers) return;
    } catch (_) {
      return;
    }
    const isWalking = travelMode === 'walking';

    try {
      ensureRouteLayers(map);
      if (map.getLayer('dijkstra-route-walk')) {
        map.setLayoutProperty('dijkstra-route-walk', 'visibility', isWalking ? 'visible' : 'none');
      }
      if (map.getLayer('dijkstra-route-vehicle')) {
        map.setLayoutProperty('dijkstra-route-vehicle', 'visibility', !isWalking ? 'visible' : 'none');
      }
      if (map.getLayer('dijkstra-route-inner')) {
        map.setLayoutProperty('dijkstra-route-inner', 'visibility', !isWalking ? 'visible' : 'none');
      }
      if (map.getLayer('dijkstra-route-casing')) {
        map.setPaintProperty('dijkstra-route-casing', 'line-color', isWalking ? '#0F766E' : '#1E3A8A');
        map.setPaintProperty('dijkstra-route-casing', 'line-opacity', isWalking ? 0.35 : 0.95);
      }
      map.triggerRepaint();
    } catch (_) {}
  }, [travelMode, ensureRouteLayers]);

  useEffect(() => {
    const normalize = (pts) => (pts || []).map((pt) => {
      if (Array.isArray(pt)) {
        return pt[0] > 50 ? [Number(pt[0]), Number(pt[1])] : [Number(pt[1]), Number(pt[0])];
      }
      if (pt && typeof pt === 'object' && ('lng' in pt || 'lon' in pt) && 'lat' in pt) {
        return [Number(pt.lng ?? pt.lon), Number(pt.lat)];
      }
      return null;
    }).filter((pt) => pt && !isNaN(pt[0]) && !isNaN(pt[1]));

    let coordinates = normalize(route);
    const altCoordinates = normalize(alternativeRoute);

    // Bulletproof Fallback: If route prop is empty or has < 2 points, extract from selectedShop & userLocation
    if (coordinates.length < 2 && selectedShop) {
      if (selectedShop.pathCoordinates && Array.isArray(selectedShop.pathCoordinates) && selectedShop.pathCoordinates.length >= 2) {
        coordinates = normalize(selectedShop.pathCoordinates);
      } else if (userLocation && userLocation.lat && userLocation.lng) {
        const shopLat = selectedShop.latitude ?? selectedShop.lat ?? selectedShop.location?.coordinates?.[1] ?? selectedShop.location?.lat;
        const shopLng = selectedShop.longitude ?? selectedShop.lng ?? selectedShop.location?.coordinates?.[0] ?? selectedShop.location?.lng;
        if (shopLat && shopLng) {
          coordinates = [
            [Number(userLocation.lng), Number(userLocation.lat)],
            [Number(shopLng), Number(shopLat)],
          ];
        }
      }
    }

    currentRouteCoordsRef.current = coordinates;
    currentAltRouteCoordsRef.current = altCoordinates;

    const map = mapRef.current || mapInstance;
    if (!map) return;

    const runUpdate = () => {
      try {
        if (map.getStyle()?.layers) {
          updateRouteOnMap();
        }
      } catch (_) {}
      updateSvgRoute();
    };

    runUpdate();
    map.once('load', runUpdate);
    map.once('style.load', runUpdate);
    map.once('styledata', runUpdate);

    return () => {
      if (routeBadgeMarkerRef.current) {
        routeBadgeMarkerRef.current.remove();
        routeBadgeMarkerRef.current = null;
      }
      if (altRouteBadgeMarkerRef.current) {
        altRouteBadgeMarkerRef.current.remove();
        altRouteBadgeMarkerRef.current = null;
      }
    };
  }, [mapInstance, route, alternativeRoute, routeStats, travelMode, selectedShop, userLocation, mapLoaded, updateRouteOnMap]);

  useEffect(() => {
    const map = mapRef.current || mapInstance;
    if (!map || !shops.length) return;

    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    shops.forEach(s => {
      const lat = s.lat || s.latitude;
      const lng = s.lng || s.longitude;
      if (lat && lng) {
        bounds.extend([lng, lat]);
        hasPoints = true;
      }
    });

    if (userLocation?.lat && userLocation?.lng) {
      bounds.extend([userLocation.lng, userLocation.lat]);
      hasPoints = true;
    }

    if (hasPoints && !route?.length) {
      try {
        map.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 600 });
      } catch (_) {}
    }
  }, [mapInstance, shops, userLocation, route]);

  const handleRecenterOnUser = () => {
    if (mapRef.current && userLocation?.lat && userLocation?.lng) {
      mapRef.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 16,
        essential: true,
        duration: 700,
      });
    }
  };

  const switcherPositionStyles = {
    'top-left': { position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 25 },
    'top-right': { position: 'absolute', top: '4.25rem', right: '0.75rem', zIndex: 25 },
    'bottom-left': { position: 'absolute', bottom: '4.25rem', left: '1rem', zIndex: 25 },
    'bottom-left-card': { position: 'absolute', bottom: 'calc(58vh + 0.5rem)', left: '1rem', zIndex: 25 },
    'bottom-right': { position: 'absolute', bottom: '3.5rem', right: '0.75rem', zIndex: 25 },
  };

  return (
    <div
      style={{ height, width: '100%', position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f1f5f9' }}
      className={className}
    >
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', flex: 1, background: '#f1f5f9' }} />

      {showStyleSwitcher && (
        <div
          style={switcherPositionStyles[styleSwitcherPosition] || switcherPositionStyles['top-left']}
          className={styleSwitcherPosition === 'bottom-left-card' ? 'md:!bottom-[4.25rem]' : ''}
          ref={styleMenuRef}
        >
          {styleSwitcherVariant === 'pills' ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(10px)',
                borderRadius: '0.65rem',
                padding: '0.22rem',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                gap: '0.2rem',
              }}
            >
              <div style={{ padding: '0 0.35rem', display: 'flex', alignItems: 'center', color: '#64748B' }}>
                <Layers size={13} color="#19398d" />
              </div>
              {Object.entries(MAP_STYLES).map(([key, item]) => {
                const isActive = activeStyleKey === key;
                const label = key === 'google' ? 'Google' : key === 'hybrid' ? 'Satellite' : 'OSM';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchMapStyle(key)}
                    style={{
                      padding: '0.35rem 0.7rem',
                      borderRadius: '0.45rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 750 : 500,
                      background: isActive ? '#19398d' : 'transparent',
                      color: isActive ? '#ffffff' : '#64748B',
                      boxShadow: isActive ? '0 2px 6px rgba(25, 57, 141, 0.3)' : 'none',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      whiteSpace: 'nowrap',
                      touchAction: 'manipulation',
                    }}
                    title={item.name}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowStyleMenu((prev) => !prev)}
                title="Change Map View"
                style={{
                  background: 'white',
                  border: '1px solid #e3e3e3',
                  borderRadius: '0.75rem',
                  padding: '0.5rem 0.85rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#0a0a0a',
                  cursor: 'pointer',
                  userSelect: 'none',
                  touchAction: 'manipulation',
                }}
              >
                <Layers size={14} color="#19398d" />
                <span>{MAP_STYLES[activeStyleKey]?.name || 'OpenStreetMap'}</span>
              </button>

              {showStyleMenu && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: styleSwitcherPosition.startsWith('bottom') ? 'auto' : 'calc(100% + 0.35rem)',
                    bottom: styleSwitcherPosition.startsWith('bottom') ? 'calc(100% + 0.35rem)' : 'auto',
                    left: styleSwitcherPosition.endsWith('right') ? 'auto' : 0,
                    right: styleSwitcherPosition.endsWith('right') ? 0 : 'auto',
                    background: 'white',
                    border: '1px solid #e3e3e3',
                    borderRadius: '0.75rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    padding: '0.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    minWidth: '165px',
                    zIndex: 50,
                  }}
                >
                  {Object.entries(MAP_STYLES).map(([key, item]) => {
                    const isSelected = activeStyleKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          switchMapStyle(key);
                        }}
                        style={{
                          padding: '0.55rem 0.75rem',
                          minHeight: '38px',
                          border: 'none',
                          borderRadius: '0.5rem',
                          background: isSelected ? '#eef2fc' : 'transparent',
                          color: isSelected ? '#19398d' : '#334155',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.78rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          userSelect: 'none',
                          touchAction: 'manipulation',
                          pointerEvents: 'auto',
                        }}
                      >
                        <span>{item.name}</span>
                        {isSelected && <span style={{ fontSize: '11px', fontWeight: 800, color: '#19398d' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showRecenter && userLocation && (
        <button
          onClick={handleRecenterOnUser}
          title="Center map on my location"
          style={{
            position: 'absolute',
            bottom: '0.625rem',
            right: '0.625rem',
            zIndex: 10,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            height: '34px',
            padding: '0 0.75rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#19398d',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#eef2fc')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)')}
        >
          <LocateFixed size={14} className="text-[#19398d]" />
          <span>Recenter on Me</span>
        </button>
      )}
    </div>
  );
}
