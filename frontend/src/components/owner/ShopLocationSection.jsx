import { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Navigation, Info, Crosshair } from 'lucide-react';
import toast from 'react-hot-toast';

const OSM_STYLE = {
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
};

export default function ShopLocationSection({ form, setForm }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Parse lat/lng values safely
  const currentLat = parseFloat(form.latitude) || 11.5628;
  const currentLng = parseFloat(form.longitude) || 124.3980;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_STYLE,
      center: [currentLng, currentLat],
      zoom: 16.5,
      maxZoom: 19,
      minZoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    const pinEl = document.createElement('div');
    pinEl.className = 'shop-location-picker-pin';
    pinEl.style.cursor = 'grab';
    pinEl.innerHTML = `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
        <div style="
          width:32px; height:32px;
          background:#465FFF;
          border:3px solid white;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 6px 16px rgba(70,95,255,0.45);
        ">
          <div style="width:10px; height:10px; background:white; border-radius:50%; transform:rotate(45deg);"></div>
        </div>
      </div>
    `;

    const marker = new maplibregl.Marker({ element: pinEl, draggable: true, anchor: 'bottom' })
      .setLngLat([currentLng, currentLat])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      const newLat = parseFloat(lngLat.lat.toFixed(6));
      const newLng = parseFloat(lngLat.lng.toFixed(6));
      setForm((prev) => ({
        ...prev,
        latitude: newLat,
        longitude: newLng,
      }));
    });

    map.on('click', (e) => {
      const newLat = parseFloat(e.lngLat.lat.toFixed(6));
      const newLng = parseFloat(e.lngLat.lng.toFixed(6));
      marker.setLngLat(e.lngLat);
      setForm((prev) => ({
        ...prev,
        latitude: newLat,
        longitude: newLng,
      }));
      map.flyTo({ center: e.lngLat, zoom: map.getZoom(), duration: 300 });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (markerRef.current) markerRef.current.remove();
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update map marker & position if form.latitude / form.longitude change externally
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      const currentPos = markerRef.current.getLngLat();
      if (Math.abs(currentPos.lat - lat) > 0.00001 || Math.abs(currentPos.lng - lng) > 0.00001) {
        markerRef.current.setLngLat([lng, lat]);
        mapRef.current.flyTo({ center: [lng, lat], duration: 400 });
      }
    }
  }, [form.latitude, form.longitude]);

  // Geolocation handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        if (mapRef.current && markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
          mapRef.current.flyTo({ center: [lng, lat], zoom: 17, duration: 500 });
        }
        toast.success('Acquired current GPS location!');
        setGettingLocation(false);
      },
      (err) => {
        setGettingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission was denied. Please select your location on the map.');
        } else {
          toast.error('Could not acquire location. Please pin your shop on the map.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
      {/* Header & Subtitle */}
      <div>
        <h2 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
          <MapPin size={16} className="text-[#465FFF] shrink-0" />
          Shop Location
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-0">
          Set your shop address and exact map location so customers can find you easily.
        </p>
      </div>

      {/* Field Hierarchy */}
      <div className="space-y-4">
        {/* 1. Street Address (Full Width) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Street Address *
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="e.g. P.I. Garcia St., Corner Castin St., Naval, Biliran"
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF]"
            required
          />
        </div>

        {/* 2 & 3. Landmark Reference & Pickup Directions (2-Column Grid on Desktop, Stacked on Mobile) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Landmark Reference
            </label>
            <input
              type="text"
              value={form.landmark}
              onChange={(e) => setForm((prev) => ({ ...prev, landmark: e.target.value }))}
              placeholder="e.g. Across BiPSU Oval / Near Municipal Gymnasium"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Pickup Directions / Store Guidance
            </label>
            <input
              type="text"
              value={form.locationDescription}
              onChange={(e) => setForm((prev) => ({ ...prev, locationDescription: e.target.value }))}
              placeholder="e.g. 2nd Floor, Room 204, Commercial Building"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#465FFF]/20 focus:border-[#465FFF]"
            />
          </div>
        </div>

        {/* 4. Map Location Section */}
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Map Location
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Confirm that the pin is placed directly on your shop.
            </span>
          </div>

          {/* Map Container */}
          <div className="relative w-full h-[280px] sm:h-[320px] md:h-[360px] lg:h-[400px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-inner">
            <div ref={mapContainerRef} className="w-full h-full" />
            <div className="absolute top-2.5 left-2.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-xs pointer-events-none flex items-center gap-1.5">
              <Crosshair size={12} className="text-[#465FFF]" />
              Click map or drag marker to set exact location
            </div>
          </div>

          {/* Location Actions */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={gettingLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#465FFF] bg-[#465FFF]/10 hover:bg-[#465FFF]/20 border border-[#465FFF]/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Navigation size={13} className={gettingLocation ? 'animate-spin' : ''} />
                {gettingLocation ? 'Acquiring GPS...' : 'Use My Current Location'}
              </button>
            </div>
          </div>
        </div>

        {/* 5. Read-Only Technical Geographic Information (Latitude / Longitude) */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                Location Coordinates
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block">
                Automatically generated from your selected map location.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Latitude</span>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {typeof form.latitude === 'number' ? form.latitude.toFixed(6) : form.latitude || '11.562800'}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Longitude</span>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {typeof form.longitude === 'number' ? form.longitude.toFixed(6) : form.longitude || '124.398000'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 m-0 flex items-center gap-1.5 italic">
            <Info size={12} className="text-slate-400 shrink-0" />
            Coordinates are automatically generated from the map.
          </p>
        </div>
      </div>
    </div>
  );
}
