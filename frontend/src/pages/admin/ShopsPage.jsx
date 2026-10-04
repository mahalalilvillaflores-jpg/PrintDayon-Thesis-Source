import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { adminAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  CheckCircle2, XCircle, Clock, ShieldCheck,
  AlertTriangle, MapPin, Eye,
  Phone, Mail, Calendar, User, ChevronRight, X,
  ExternalLink, Printer, Sparkles, Trash2, FileText, Building2, Search, Layers, RotateCw,
  History, AlertCircle, LocateFixed
} from 'lucide-react';
import toast from 'react-hot-toast';

const NAVY = '#101828';
const BLUE = '#465FFF';
const TEAL = '#465FFF';
const AMBER = '#F7AD1A';
const RED = '#DC2626';

const MAP_STYLES = {
  streets: {
    id: 'streets',
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
          id: 'google-tiles-layer',
          type: 'raster',
          source: 'google-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite HD',
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
          id: 'google-hybrid-layer',
          type: 'raster',
          source: 'google-hybrid-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
  maplibre: {
    id: 'maplibre',
    name: 'OpenStreetMap',
    style: {
      version: 8,
      sources: {
        'maplibre-osm-tiles': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '© Esri, OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'maplibre-osm-layer',
          type: 'raster',
          source: 'maplibre-osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

const NAVAL_CENTER = [124.3980, 11.5628]; // Downtown Naval, Biliran (Town Plaza, Cathedral & BiPSU Commercial Zone)

function getDocStatusInfo(doc) {
  const current = doc?.currentFile;
  if (!current || !current.fileUrl) {
    return {
      status: 'pending',
      label: 'Pending Upload',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      dotClass: 'bg-slate-400',
      alert: null,
    };
  }

  if (current.status === 'rejected') {
    return {
      status: 'rejected',
      label: 'Rejected',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-500',
      alert: current.rejectionReason || 'Document was rejected by administrator.',
    };
  }

  if (current.expiresAt) {
    const expDate = new Date(current.expiresAt);
    const now = new Date();
    if (expDate < now) {
      return {
        status: 'expired',
        label: 'Expired',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500',
        alert: 'Expired — Please upload an updated document.',
      };
    }
    const daysUntilExp = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExp <= 30) {
      return {
        status: 'expiring_soon',
        label: 'Expiring Soon',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500',
        alert: `Document expires in ${daysUntilExp} day${daysUntilExp === 1 ? '' : 's'} on ${expDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
      };
    }
  }

  if (current.status === 'verified') {
    return {
      status: 'verified',
      label: 'Verified',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      alert: null,
    };
  }

  return {
    status: 'pending',
    label: 'Pending Verification',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
    alert: 'Newly uploaded document is waiting for administrator review.',
  };
}

export default function ShopsPage() {
  const { socket } = useSocket();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeLayer, setActiveLayer] = useState('maplibre');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [docModalTab, setDocModalTab] = useState('photo');
  const [isZoomed, setIsZoomed] = useState(false);
  const [deleteConfirmShop, setDeleteConfirmShop] = useState(null);
  const [docActionLoading, setDocActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [checklist, setChecklist] = useState({
    storefront: false,
    dti: false,
    permit: false,
    location: false,
  });

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedShop) {
      if (selectedShop.verificationStatus === 'verified') {
        setChecklist({ storefront: true, dti: true, permit: true, location: true });
      } else {
        setChecklist({ storefront: false, dti: false, permit: false, location: false });
      }
    }
  }, [selectedShop?._id]);

  useEffect(() => {
    if (selectedShop) {
      const updated = shops.find((s) => s._id === selectedShop._id);
      if (updated && (updated.verificationStatus !== selectedShop.verificationStatus || updated.shopName !== selectedShop.shopName)) {
        setSelectedShop(updated);
      }
    }
  }, [shops]);

  const fetchShops = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminAPI.getShops({ limit: 100 });
      const list = res.data?.shops || res.data || [];
      setShops(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch shops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchShops(true);

    const handleShopStatusChanged = (payload) => {
      if (payload?.shopId) {
        setShops((prev) =>
          prev.map((s) => {
            const sid = s._id || s.id;
            if (sid === payload.shopId) {
              return {
                ...s,
                status: payload.status || s.status,
                isOpen: payload.status ? payload.status !== 'closed' : s.isOpen,
                ...(payload.updatedShop || {}),
              };
            }
            return s;
          })
        );
      }
      fetchShops(true);
    };

    const handleShopUpdated = (payload) => {
      if (payload?.shopId && payload?.shop) {
        setShops((prev) =>
          prev.map((s) => {
            const sid = s._id || s.id;
            if (sid === payload.shopId) {
              return { ...s, ...payload.shop };
            }
            return s;
          })
        );
      }
      fetchShops(true);
    };

    socket.on('shop:submitted', handleUpdate);
    socket.on('shop:status_changed', handleShopStatusChanged);
    socket.on('shop:status', handleShopStatusChanged);
    socket.on('shop:updated', handleShopUpdated);
    socket.on('shop:verified', handleUpdate);
    socket.on('shop:deleted', handleUpdate);
    socket.on('shop:queue_changed', handleUpdate);
    socket.on('stats:update', handleUpdate);

    // Periodic liveness sync every 15s to keep real-time counts strictly up-to-date
    const interval = setInterval(() => {
      fetchShops(true);
    }, 15000);

    return () => {
      socket.off('shop:submitted', handleUpdate);
      socket.off('shop:status_changed', handleShopStatusChanged);
      socket.off('shop:status', handleShopStatusChanged);
      socket.off('shop:updated', handleShopUpdated);
      socket.off('shop:verified', handleUpdate);
      socket.off('shop:deleted', handleUpdate);
      socket.off('shop:queue_changed', handleUpdate);
      socket.off('stats:update', handleUpdate);
      clearInterval(interval);
    };
  }, [socket, fetchShops]);

  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const matchFilter =
        filter === 'all'
          ? true
          : filter === 'pending'
            ? s.verificationStatus === 'pending' || !s.verificationStatus
            : filter === 'suspended'
              ? s.verificationStatus === 'suspended' || s.verificationStatus === 'restricted' || s.status === 'suspended'
              : s.verificationStatus === filter;

      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (s.shopName || '').toLowerCase().includes(q) ||
        (s.ownerId?.name || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q);

      return matchFilter && matchSearch;
    });
  }, [shops, filter, search]);

  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const matches = shops.filter((s) => {
      const name = (s.shopName || s.name || '').toLowerCase();
      const owner = (s.ownerId?.name || s.ownerName || '').toLowerCase();
      const addr = (s.address || '').toLowerCase();
      return name.includes(q) || owner.includes(q) || addr.includes(q);
    });

    return matches
      .sort((a, b) => {
        const nameA = (a.shopName || a.name || '').toLowerCase();
        const nameB = (b.shopName || b.name || '').toLowerCase();
        const aStarts = nameA.startsWith(q);
        const bStarts = nameB.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return nameA.localeCompare(nameB);
      })
      .slice(0, 6);
  }, [shops, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
        if (!search.trim()) {
          setIsSearchOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [search]);

  const handleSelectShop = useCallback((shop) => {
    if (!shop) return;
    const name = shop.shopName || shop.name || '';
    setSearch(name);
    setShowSuggestions(false);
    setSelectedShop(shop);

    if (filter !== 'all' && filter !== shop.verificationStatus) {
      setFilter('all');
    }

    const lat = Number(shop.latitude || shop.location?.coordinates?.[1]);
    const lng = Number(shop.longitude || shop.location?.coordinates?.[0]);
    if (lat && lng && mapRef.current) {
      const isLargeScreen = typeof window !== 'undefined' && window.innerWidth >= 1024;
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 18,
        offset: isLargeScreen ? [-120, 0] : [0, 0],
        duration: 900,
        essential: true,
      });
    }
  }, [filter]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (searchSuggestions.length > 0) {
        handleSelectShop(searchSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const counts = useMemo(() => {
    const pending = shops.filter((s) => s?.verificationStatus === 'pending' || !s?.verificationStatus).length;
    const verified = shops.filter((s) => s?.verificationStatus === 'verified').length;
    const rejected = shops.filter((s) => s?.verificationStatus === 'rejected').length;
    const suspended = shops.filter((s) => s?.verificationStatus === 'suspended' || s?.verificationStatus === 'restricted' || s?.status === 'suspended').length;
    const openShops = shops.filter((s) => s?.verificationStatus === 'verified' && s?.status !== 'closed' && s?.status !== 'temporarily_unavailable' && s?.isOpen !== false).length;
    const closedShops = shops.filter((s) => s?.verificationStatus === 'verified' && (s?.status === 'closed' || s?.status === 'temporarily_unavailable' || s?.isOpen === false)).length;
    const totalQueue = shops.reduce((acc, s) => acc + (s?.currentQueue || s?.queueCount || 0), 0);
    return { all: shops.length, pending, verified, rejected, suspended, openShops, closedShops, totalQueue };
  }, [shops]);

  const getShopDocuments = useCallback((shop) => {
    if (!shop) return {
      dtiNo: '', permitNo: '', dtiDoc: '', permitDoc: '', dtiDocUrl: '', permitDocUrl: '',
      storefrontPhotoName: '', storefrontPhotoUrl: '', services: [], schedule: '',
      dtiObj: null, permitObj: null
    };
    const desc = shop.description || '';
    const dtiMatch = desc.match(/DTI No:\s*([^|]+)/i);
    const permitMatch = desc.match(/Mayor's Permit:\s*([^|]+)/i);
    const schedMatch = desc.match(/Schedule:\s*([^|]+)/i);
    const srvMatch = desc.match(/Services:\s*([^|]+)/i);

    const dtiObj = shop.businessDocuments?.find(d => d.type === 'dti') || null;
    const permitObj = shop.businessDocuments?.find(d => d.type === 'mayors_permit') || null;

    let parsedHours = '';
    if (shop.operatingHours && shop.operatingHours.length > 0) {
      const { open, close } = shop.operatingHours[0];
      parsedHours = `${open} - ${close} (${shop.operatingHours.length} days)`;
    }

    const dtiNo = dtiObj?.docNumber || shop.dtiNumber || dtiMatch?.[1]?.trim() || 'Not provided';
    const permitNo = permitObj?.docNumber || shop.mayorsPermitNumber || permitMatch?.[1]?.trim() || 'Not provided';
    const dtiDoc = dtiObj?.currentFile?.fileName || shop.dtiDocName || 'Not provided';
    const permitDoc = permitObj?.currentFile?.fileName || shop.permitDocName || 'Not provided';
    const dtiDocUrl = dtiObj?.currentFile?.fileUrl || shop.dtiDocUrl || '';
    const permitDocUrl = permitObj?.currentFile?.fileUrl || shop.permitDocUrl || '';
    const storefrontPhotoName = shop.storefrontPhotoName || 'Not provided';
    const storefrontPhotoUrl = shop.storefrontPhotoUrl || '';
    const schedule = parsedHours || schedMatch?.[1]?.trim() || 'Not provided';
    const services = shop.services?.length > 0 
      ? shop.services.map(s => s.name)
      : srvMatch?.[1]?.trim() ? srvMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];

    return {
      dtiNo, permitNo, dtiDoc, permitDoc, dtiDocUrl, permitDocUrl,
      storefrontPhotoName, storefrontPhotoUrl, schedule, services,
      dtiObj, permitObj
    };
  }, []);

  const selectedDocs = useMemo(() => getShopDocuments(selectedShop), [selectedShop, getShopDocuments]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.maplibre.style,
      center: NAVAL_CENTER,
      zoom: 15,
      maxZoom: 21,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);
    });

    map.on('click', (e) => {
      if (!e.originalEvent.defaultPrevented) {
        setSelectedShop(null);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleLayerChange = (layerKey) => {
    if (!mapRef.current || layerKey === activeLayer) return;
    setActiveLayer(layerKey);
    mapRef.current.setStyle(MAP_STYLES[layerKey].style);
  };

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredShops.forEach((shop) => {
      const lat = shop.latitude || shop.location?.coordinates?.[1];
      const lng = shop.longitude || shop.location?.coordinates?.[0];
      if (!lat || !lng) return;

      const isSelected = selectedShop?._id === shop._id;
      const isVerified = shop.verificationStatus === 'verified';
      const isPending = shop.verificationStatus === 'pending' || !shop.verificationStatus;
      const isRejected = shop.verificationStatus === 'rejected';      const borderColor = isSelected
        ? '#465FFF'
        : isVerified
          ? '#465FFF'
          : isPending
            ? '#F7AD1A'
            : '#DC2626';

      const badgeBg = isVerified ? '#465FFF' : isPending ? '#F7AD1A' : '#DC2626';

      const rawName = shop.shopName || shop.name || 'Not provided';
      let shortName = rawName;
      let monogram = rawName.slice(0, 2).toUpperCase();

      if (/LA/i.test(rawName)) {
        shortName = 'LA- Naval';
        monogram = 'LA';
      } else if (/Know/i.test(rawName)) {
        shortName = 'Know Well';
        monogram = 'KW';
      } else if (/I\.?R/i.test(rawName)) {
        shortName = 'I.R Printing';
        monogram = 'IR';
      } else if (/Biliran/i.test(rawName)) {
        shortName = 'Biliran Paper';
        monogram = 'BP';
      } else if (/Printa/i.test(rawName)) {
        shortName = 'Printa Naval';
        monogram = 'PN';
      } else if (/Braice/i.test(rawName)) {
        shortName = 'Braice Prints';
        monogram = 'BR';
      } else {
        const words = rawName.trim().split(/\s+/);
        monogram = words.length >= 2 
          ? (words[0][0] + words[1][0]).toUpperCase()
          : rawName.slice(0, 2).toUpperCase();
        shortName = words.slice(0, 2).join(' ');
      }

      const el = document.createElement('div');
      el.className = 'clean-shop-marker';
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center;">
          <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
            ${isPending ? '<div style="position:absolute; inset:-4px; border-radius:50%; background:#F7AD1A; opacity:0.35; animation:pulse 1.8s infinite;"></div>' : ''}
            ${isSelected ? '<div style="position:absolute; inset:-6px; border-radius:50%; border:2.5px dashed #465FFF; animation:spin 8s linear infinite;"></div>' : ''}
            <div style="
              width:38px; height:38px;
              border-radius:50%;
              background:white;
              border:3.5px solid ${borderColor};
              box-shadow:0 4px 14px rgba(6,63,92,0.28);
              display:flex; align-items:center; justify-content:center;
              transition:transform 0.2s ease;
              ${isSelected ? 'transform:scale(1.15);' : ''}
            ">
              <div style="
                width:100%; height:100%;
                border-radius:50%;
                background:white;
                color:${borderColor};
                display:flex; align-items:center; justify-content:center;
                font-weight:900; font-size:${monogram.length > 1 ? '13px' : '15px'};
                font-family:Inter, sans-serif;
                letter-spacing:-0.5px;
              ">
                ${monogram}
              </div>
            </div>
            <div style="
              position:absolute; bottom:-1px; right:-1px;
              width:15px; height:15px;
              border-radius:50%;
              background:${badgeBg};
              border:2px solid white;
              color:white;
              display:flex; align-items:center; justify-content:center;
              font-size:8px; font-weight:bold;
              box-shadow:0 1px 4px rgba(0,0,0,0.3);
            ">
              ${isVerified ? '✓' : isPending ? '⏳' : '✕'}
            </div>
          </div>
          <div style="
            margin-top:2px;
            background:#465FFF;
            color:white;
            font-size:10px;
            font-weight:800;
            padding:2px 7px;
            border-radius:999px;
            white-space:nowrap;
            box-shadow:0 2px 8px rgba(6,63,92,0.25);
            border:1.5px solid white;
            display:flex;
            align-items:center;
            gap:3px;
            pointer-events:none;
          ">
            <span>${shortName}</span>
          </div>
        </div>
      `;

      const popupHTML = `
        <div style="min-width:210px; font-family:Inter, sans-serif; padding:4px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <span style="font-size:9px; font-weight:800; text-transform:uppercase; padding:2px 8px; border-radius:999px; background:${badgeBg}; color:white;">
              ${isVerified ? '• Verified' : isPending ? '• Pending Review' : '• Rejected'}
            </span>
            <span style="font-size:10px; color:#64748B;">GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          </div>
          <div style="font-weight:800; font-size:14px; color:#465FFF; margin-bottom:2px;">${shop.shopName || 'Not provided'}</div>
          <div style="font-size:11px; color:#64748B; margin-bottom:4px;">${shop.address || 'Not provided'}</div>
          ${(shop.landmark || shop.locationDescription) ? `<div style="font-size:10px; font-weight:700; color:#465FFF; background:rgba(65,158,189,0.12); padding:2px 6px; border-radius:6px; margin-bottom:6px; border:1px solid rgba(65,158,189,0.3); line-height:1.3;">${shop.landmark || shop.locationDescription}</div>` : ''}
          <div style="font-size:11px; color:#334155; margin-bottom:8px;">
            <strong>Owner:</strong> ${shop.ownerId?.name || shop.ownerName || 'Not provided'}
          </div>
          <div style="display:flex; gap:6px;">
            <button
              id="inspect-btn-${shop._id}"
              style="width:100%; padding:7px 10px; border-radius:10px; background:#465FFF; color:white; font-size:11px; font-weight:700; border:none; cursor:pointer;"
            >
              Inspect & Verify
            </button>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 24, closeButton: true, maxWidth: '280px' })
        .setHTML(popupHTML);

      popup.on('open', () => {
        const btn = document.getElementById(`inspect-btn-${shop._id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedShop(shop);
            if (mapRef.current) {
              const isMobile = window.innerWidth < 768;
              mapRef.current.flyTo({ center: [lng, lat], offset: isMobile ? [0, -100] : [0, 0], zoom: 17, duration: 800 });
            }
          };
        }
      });

      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedShop(shop);
        if (mapRef.current) {
          const isMobile = window.innerWidth < 768;
          mapRef.current.flyTo({ center: [lng, lat], offset: isMobile ? [0, -100] : [0, 0], zoom: 17, duration: 800 });
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [filteredShops, selectedShop, mapLoaded]);

  const handleVerify = async (shopId, status) => {
    setActionLoading(true);
    try {
      await adminAPI.verifyShop(shopId, status);
      toast.success(`Shop ${status === 'verified' ? 'Verified & Activated' : 'Rejected'}`);
      await fetchShops(true);
      if (selectedShop?._id === shopId) {
        setSelectedShop((prev) => (prev ? { ...prev, verificationStatus: status } : null));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateShopStatus = async (shopId, status, reason = '') => {
    setActionLoading(true);
    try {
      await adminAPI.updateShopStatus(shopId, { status, reason });
      toast.success(status === 'suspended' ? 'Shop has been suspended & hidden from customer directory.' : 'Shop restriction removed & restored.');
      await fetchShops(true);
      if (selectedShop?._id === shopId) {
        setSelectedShop((prev) => (prev ? {
          ...prev,
          verificationStatus: status,
          status: status === 'suspended' ? 'closed' : prev.status,
          suspensionReason: reason
        } : null));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update shop status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyBusinessDoc = async (shopId, docType, status, reason = '') => {
    const apiDocType = docType === 'permit' ? 'mayors_permit' : docType;
    if (status === 'rejected' && !reason.trim()) {
      toast.error('Please provide a reason for rejecting the document');
      return;
    }
    setDocActionLoading(true);
    try {
      const res = await adminAPI.verifyBusinessDocument(shopId, apiDocType, {
        status,
        rejectionReason: reason.trim(),
      });
      toast.success(
        status === 'verified'
          ? 'Document verified successfully'
          : 'Document marked as rejected'
      );
      setShowRejectForm(false);
      setRejectionReasonInput('');
      const updatedShop = res.data?.shop || res.shop;
      if (updatedShop) {
        setSelectedShop(updatedShop);
        const docs = getShopDocuments(updatedShop);
        setPreviewDoc((prev) => (prev ? {
          ...prev,
          shop: updatedShop,
          doc: docs,
          rawDoc: apiDocType === 'dti' ? docs.dtiObj : docs.permitObj,
        } : null));
      }
      await fetchShops(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update document status');
    } finally {
      setDocActionLoading(false);
    }
  };

  const promptDeleteShop = (shopId, shopName) => {
    setDeleteConfirmShop({ id: shopId, name: shopName || 'this shop' });
  };

  const confirmDeleteShop = async () => {
    if (!deleteConfirmShop) return;
    setActionLoading(true);
    try {
      await adminAPI.deleteShop(deleteConfirmShop.id);
      toast.success('Shop permanently removed ');
      setSelectedShop(null);
      setDeleteConfirmShop(null);
      await fetchShops(true);
    } catch (err) {
      toast.error(err.message || 'Failed to delete shop');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshAndRecenter = useCallback(() => {
    fetchShops(true);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: NAVAL_CENTER,
        zoom: 15.5,
        pitch: 0,
        bearing: 0,
        duration: 800,
        essential: true,
      });
    }
    setSelectedShop(null);
    setShowSuggestions(false);
  }, [fetchShops]);

  return (
    <div className="h-[calc(100vh-7.5rem)] min-h-[580px] flex flex-col relative font-outfit select-none overflow-hidden rounded-2xl border border-slate-200/90 shadow-xs bg-white">

      <header className="z-30 bg-white/98 backdrop-blur-md border-b border-slate-200/90 px-3.5 sm:px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-nowrap overflow-visible">

        {/* Left: Map Layer Switcher Dropdown & Live Open / Closed Status */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative inline-flex items-center">
            <Layers size={14} className="absolute left-2.5 text-[#465FFF] pointer-events-none z-10" />
            <select
              value={activeLayer}
              onChange={(e) => handleLayerChange(e.target.value)}
              aria-label="Map style"
              className="h-[34px] pl-8 pr-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-[#101828] cursor-pointer outline-none transition-all"
            >
              <option value="maplibre">OSM (MapLibre)</option>
              <option value="streets">Google Street</option>
              <option value="satellite">Satellite HD</option>
            </select>
          </div>

          {/* Open in Naval Badge */}
          <div
            className="h-[34px] inline-flex items-center px-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 whitespace-nowrap select-none shadow-2xs"
            title="Verified printing shops currently open in Naval"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse shrink-0" />
            {counts.openShops} Open in Naval
          </div>

          {/* Closed in Naval Badge */}
          <div
            className={`h-[34px] inline-flex items-center px-3 rounded-xl text-xs font-semibold whitespace-nowrap select-none transition-colors border shadow-2xs ${
              counts.closedShops > 0
                ? 'bg-rose-50 text-[#9b0033] border-rose-200/80'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title={
              counts.closedShops > 0
                ? `${counts.closedShops} verified printing shop(s) currently closed in Naval`
                : 'No verified printing shops are currently closed in Naval'
            }
          >
            <span
              className={`w-2 h-2 rounded-full mr-1.5 shrink-0 ${
                counts.closedShops > 0 ? 'bg-[#9b0033]' : 'bg-slate-400'
              }`}
            />
            {counts.closedShops} Closed in Naval
          </div>
        </div>

        {/* Right: Verification Filter Dropdown, Expandable Search & Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter shops by verification status"
            className="h-[34px] px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/70 border border-slate-200 text-[#101828] cursor-pointer outline-none transition-all"
          >
            <option value="all">All Status ({counts.all})</option>
            <option value="verified">Verified ({counts.verified})</option>
            <option value="pending">Pending ({counts.pending})</option>
            <option value="rejected">Rejected ({counts.rejected})</option>
            <option value="suspended">Suspended ({counts.suspended})</option>
          </select>

          {!isSearchOpen && !search ? (
            <div className="shops-search-btn-wrapper relative inline-flex">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Search shops"
                className="h-[34px] w-[34px] rounded-xl bg-slate-100 hover:bg-slate-200/70 border border-slate-200 flex items-center justify-center text-[#101828] cursor-pointer transition-all"
              >
                <Search size={15} />
              </button>
              <div
                className="shops-search-tooltip"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  textAlign: 'center',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  zIndex: 50,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
                }}
              >
                <div>Search</div>
                <div style={{ opacity: 0.6, fontSize: '0.625rem' }}>Ctrl+K /</div>
              </div>
            </div>
          ) : (
            <div ref={searchContainerRef} className="relative flex items-center w-48 sm:w-64 animate-fadeIn">
              <Search
                size={14}
                className="absolute left-2.5 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search shops..."
                value={search}
                onFocus={() => {
                  if (search.trim()) setShowSuggestions(true);
                }}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (search) {
                      setSearch('');
                      setShowSuggestions(false);
                    } else {
                      setIsSearchOpen(false);
                      setShowSuggestions(false);
                    }
                  } else {
                    handleSearchKeyDown(e);
                  }
                }}
                className="h-[34px] w-full pl-8 pr-7 rounded-xl text-xs bg-white border border-[#465FFF] shadow-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearch('');
                  setShowSuggestions(false);
                  setIsSearchOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Close search"
                aria-label="Close search"
              >
                <X size={13} />
              </button>

              {/* Dropdown Options (Autocomplete Suggestions) */}
              {showSuggestions && search.trim() && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl border border-slate-200/90 shadow-xl overflow-hidden z-50 py-1 divide-y divide-slate-100">
                  {searchSuggestions.length > 0 ? (
                    searchSuggestions.map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => handleSelectShop(s)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-900 group-hover:text-[#465FFF] truncate">
                            {s.shopName || s.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            {s.address || s.landmark || 'Naval, Biliran'}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                            s.verificationStatus === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : s.verificationStatus === 'rejected'
                                ? 'bg-red-50 text-red-700 border border-red-200/60'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {s.verificationStatus || 'Pending'}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2.5 text-xs text-slate-500 text-center">
                      No shops matching "{search}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(filter !== 'all' || search) && (
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearch('');
                setShowSuggestions(false);
                setIsSearchOpen(false);
              }}
              className="h-[34px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200 cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
              title="Reset all filters"
            >
              <X size={12} className="text-slate-400" /> Reset
            </button>
          )}

          {/* Recenter Map on Downtown Naval */}
          <button
            type="button"
            onClick={handleRefreshAndRecenter}
            disabled={loading}
            aria-label="Recenter map on Downtown Naval"
            title="Recenter map on Downtown Naval"
            className="h-[34px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#101828] text-xs font-semibold transition-all border border-slate-200 cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-60"
          >
            <LocateFixed size={14} className={`text-[#465FFF] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Recenter Downtown</span>
          </button>
        </div>

      </header>

      <div className="relative flex-1 w-full h-full bg-slate-100 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Recenter Control on Map (Downtown Naval) */}
        <button
          type="button"
          onClick={handleRefreshAndRecenter}
          aria-label="Recenter on Downtown Naval"
          title="Recenter on Downtown Naval"
          className="absolute top-28 right-2.5 z-10 w-[29px] h-[29px] bg-white hover:bg-slate-50 text-slate-700 hover:text-[#465FFF] rounded shadow-md border border-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-95"
        >
          <LocateFixed size={16} />
        </button>

        <div className="absolute left-4 bottom-4 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-md">
          {[
            { color: '#465FFF', label: `Verified (${counts.verified})` },
            { color: '#F7AD1A', label: `Pending (${counts.pending})` },
            { color: '#DC2626', label: `Rejected (${counts.rejected})` },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid white',
                  boxShadow: `0 0 0 1.5px ${color}`,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <span className="text-[11px] font-bold text-slate-700">{label}</span>
            </div>
          ))}
        </div>

        {selectedShop && (
          <aside className="absolute z-20 bg-white border border-slate-200/90 shadow-[0_20px_50px_rgba(15,39,71,0.25)] flex flex-col overflow-hidden transition-all duration-200
            inset-x-2 bottom-2 max-h-[50vh] rounded-2xl animate-in slide-in-from-bottom-6
            md:inset-x-auto md:top-4 md:bottom-4 md:right-4 md:w-[380px] md:max-h-none md:rounded-2xl md:slide-in-from-right-6">

            <div className="pt-2 pb-2.5 px-3 sm:px-4 sm:pt-3.5 sm:pb-3.5 bg-white border-b border-[#D9E2EC] flex flex-col justify-between shrink-0 space-y-1.5 sm:space-y-2">
              {/* Mobile Drag Indicator */}
              <div className="w-8 h-1 bg-slate-300 rounded-full mx-auto mb-1 shrink-0 md:hidden" />

              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
                  selectedShop.verificationStatus === 'verified'
                    ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                    : selectedShop.verificationStatus === 'rejected'
                      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                      : 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                }`}>
                  {selectedShop.verificationStatus === 'verified' ? (
                    <>
                      <CheckCircle2 size={12} className="text-[#15803D]" />
                      <span>VERIFIED PARTNER</span>
                    </>
                  ) : selectedShop.verificationStatus === 'rejected' ? (
                    <>
                      <XCircle size={12} className="text-[#B91C1C]" />
                      <span>APPLICATION REJECTED</span>
                    </>
                  ) : (
                    <>
                      <Clock size={12} className="text-[#B45309]" />
                      <span>PENDING VERIFICATION</span>
                    </>
                  )}
                </span>
                <button
                  onClick={() => setSelectedShop(null)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-[#52627A] hover:text-[#172033] flex items-center justify-center transition-colors cursor-pointer"
                  title="Close sidebar"
                  aria-label="Close shop details"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-[#0D9488] border border-teal-200 flex items-center justify-center font-black text-base shadow-2xs shrink-0">
                  {selectedShop.shopName ? selectedShop.shopName.slice(0, 2).toUpperCase() : 'SP'}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[#163A5F] leading-tight m-0 tracking-tight truncate">
                    {selectedShop.shopName}
                  </h2>
                  <div className="text-xs text-[#52627A] font-medium truncate mt-0.5">
                    {selectedShop.ownerId?.name || selectedShop.ownerName || 'Lander Aragon'} • Commercial Printing &amp; Services
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-1.5 sm:px-2 pt-0.5 pb-2.5 space-y-1.5 text-xs font-medium text-[#172033] scrollbar-thin bg-[#F8FAFC]">

              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-[#D9E2EC] shadow-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#163A5F] font-extrabold text-xs tracking-wider uppercase">
                  <MapPin size={14} className="text-[#465FFF]" />
                  <span>LOCATION DETAILS</span>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#52627A] uppercase tracking-wider mb-0.5">
                    EXACT LOCATION
                  </div>
                  <div className="text-sm font-bold text-[#172033] leading-snug">
                    {selectedShop.address || 'Vicentillo Extension, Brgy. P.I. Garcia, Naval, Biliran'}
                  </div>
                </div>

                <div className="p-2 bg-[#F0FDF4] rounded-lg border border-[#BBF7D0]">
                  <div className="text-[10px] font-bold text-[#15803D] uppercase tracking-wider">
                    LANDMARK / PROXIMITY
                  </div>
                  <div className="text-xs font-bold text-[#14532D] mt-0.5 leading-relaxed">
                    {selectedShop.landmark || selectedShop.locationDescription || 'Near the school (BiPSU - Biliran Province State University Main Campus)'}
                  </div>
                </div>
              </div>

              <div className="p-2 sm:p-2.5 bg-white rounded-xl border border-[#D9E2EC] shadow-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#163A5F] font-extrabold text-xs tracking-wider uppercase">
                  <User size={14} className="text-[#465FFF]" />
                  <span>OWNER PROFILE</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-[#52627A] uppercase tracking-wider flex items-center gap-1.5">
                      <User size={13} className="text-[#52627A]" /> OWNER NAME
                    </span>
                    <span className="font-bold text-[#172033] text-xs sm:text-sm">
                      {selectedShop.ownerId?.name || selectedShop.ownerName || 'Lander Aragon'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-[#52627A] uppercase tracking-wider flex items-center gap-1.5">
                      <Mail size={13} className="text-[#52627A]" /> EMAIL ADDRESS
                    </span>
                    <a href={`mailto:${selectedShop.ownerId?.email || 'laprinting@gmail.com'}`} className="font-semibold text-[#0D9488] hover:underline text-xs truncate max-w-[190px]">
                      {selectedShop.ownerId?.email || 'laprinting@gmail.com'}
                    </a>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[10px] font-bold text-[#52627A] uppercase tracking-wider flex items-center gap-1.5">
                      <Phone size={13} className="text-[#52627A]" /> CELLPHONE NUMBER
                    </span>
                    <a href={`tel:${selectedShop.contactNumber || '+639274673299'}`} className="font-bold text-[#172033] text-xs hover:text-[#465FFF]">
                      {selectedShop.contactNumber || '+63 927 467 3299'}
                    </a>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#465FFF]/10 rounded-2xl border border-[#465FFF]/25 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#465FFF] text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-[#465FFF]" /> Submitted Proofs (KYC)
                  </div>
                  <span className="text-[10px] font-extrabold text-[#465FFF] bg-white px-2 py-0.5 rounded-md border border-[#465FFF]/30">
                    3 Proofs
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
                      Storefront / Equipment Proof
                    </div>
                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      Physical Presence
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedDocs.storefrontPhotoUrl && selectedDocs.storefrontPhotoUrl.startsWith('data:image') && (
                        <img
                          src={selectedDocs.storefrontPhotoUrl}
                          alt="Storefront Thumbnail"
                          className="w-7 h-7 rounded-md object-cover border border-slate-200 shrink-0"
                        />
                      )}
                      <span className="text-slate-700 font-medium truncate max-w-[140px]" title={selectedDocs.storefrontPhotoName}>
                        {selectedDocs.storefrontPhotoName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDocModalTab(selectedDocs.storefrontPhotoUrl ? 'photo' : 'metadata');
                        setIsZoomed(false);
                        setPreviewDoc({ type: 'storefront', shop: selectedShop, doc: selectedDocs });
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-[#465FFF] text-slate-700 hover:text-white font-bold text-[10px] rounded-lg border border-slate-200 shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Eye size={11} /> Inspect Photo
                    </button>
                  </div>
                </div>

                {/* DTI Registration Card */}
                {(() => {
                  const dtiStatus = getDocStatusInfo(selectedDocs.dtiObj || {
                    currentFile: {
                      fileUrl: selectedDocs.dtiDocUrl,
                      fileName: selectedDocs.dtiDoc,
                      status: selectedShop.verificationStatus === 'verified' ? 'verified' : 'pending',
                    }
                  });
                  const hasHistory = (selectedDocs.dtiObj?.history?.length || 0) > 0;
                  return (
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
                          <FileText size={12} className="text-[#465FFF]" />
                          DTI Registration
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${dtiStatus.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dtiStatus.dotClass}`} />
                          {dtiStatus.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>No: <strong className="text-slate-800">{selectedDocs.dtiNo}</strong></span>
                        {selectedDocs.dtiObj?.currentFile?.expiresAt && (
                          <span>Exp: {new Date(selectedDocs.dtiObj.currentFile.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          {selectedDocs.dtiDocUrl && selectedDocs.dtiDocUrl.startsWith('data:image') && (
                            <img
                              src={selectedDocs.dtiDocUrl}
                              alt="DTI Thumbnail"
                              className="w-7 h-7 rounded-md object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <span className="text-slate-700 font-medium truncate max-w-[130px]" title={selectedDocs.dtiDoc}>
                            {selectedDocs.dtiDoc}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasHistory && (
                            <button
                              type="button"
                              onClick={() => {
                                setDocModalTab('history');
                                setShowRejectForm(false);
                                setRejectionReasonInput('');
                                setPreviewDoc({ type: 'dti', shop: selectedShop, doc: selectedDocs, rawDoc: selectedDocs.dtiObj });
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                              title="View Document History"
                            >
                              <History size={11} /> {selectedDocs.dtiObj.history.length}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDocModalTab(selectedDocs.dtiDocUrl ? 'photo' : 'metadata');
                              setIsZoomed(false);
                              setShowRejectForm(false);
                              setRejectionReasonInput('');
                              setPreviewDoc({ type: 'dti', shop: selectedShop, doc: selectedDocs, rawDoc: selectedDocs.dtiObj });
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-[#465FFF] text-slate-700 hover:text-white font-bold text-[10px] rounded-lg border border-slate-200 shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Eye size={11} /> Inspect
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Mayor's Business Permit Card */}
                {(() => {
                  const permitStatus = getDocStatusInfo(selectedDocs.permitObj || {
                    currentFile: {
                      fileUrl: selectedDocs.permitDocUrl,
                      fileName: selectedDocs.permitDoc,
                      status: selectedShop.verificationStatus === 'verified' ? 'verified' : 'pending',
                    }
                  });
                  const hasHistory = (selectedDocs.permitObj?.history?.length || 0) > 0;
                  return (
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
                          <Building2 size={12} className="text-[#465FFF]" />
                          Mayor's Business Permit
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${permitStatus.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${permitStatus.dotClass}`} />
                          {permitStatus.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>No: <strong className="text-slate-800">{selectedDocs.permitNo}</strong></span>
                        {selectedDocs.permitObj?.currentFile?.expiresAt && (
                          <span>Exp: {new Date(selectedDocs.permitObj.currentFile.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          {selectedDocs.permitDocUrl && selectedDocs.permitDocUrl.startsWith('data:image') && (
                            <img
                              src={selectedDocs.permitDocUrl}
                              alt="Permit Thumbnail"
                              className="w-7 h-7 rounded-md object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <span className="text-slate-700 font-medium truncate max-w-[130px]" title={selectedDocs.permitDoc}>
                            {selectedDocs.permitDoc}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {hasHistory && (
                            <button
                              type="button"
                              onClick={() => {
                                setDocModalTab('history');
                                setShowRejectForm(false);
                                setRejectionReasonInput('');
                                setPreviewDoc({ type: 'permit', shop: selectedShop, doc: selectedDocs, rawDoc: selectedDocs.permitObj });
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] rounded-lg border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                              title="View Document History"
                            >
                              <History size={11} /> {selectedDocs.permitObj.history.length}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDocModalTab(selectedDocs.permitDocUrl ? 'photo' : 'metadata');
                              setIsZoomed(false);
                              setShowRejectForm(false);
                              setRejectionReasonInput('');
                              setPreviewDoc({ type: 'permit', shop: selectedShop, doc: selectedDocs, rawDoc: selectedDocs.permitObj });
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-[#465FFF] text-slate-700 hover:text-white font-bold text-[10px] rounded-lg border border-slate-200 shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Eye size={11} /> Inspect
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {selectedShop.verificationStatus !== 'verified' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#465FFF] uppercase tracking-wider text-[10px] flex items-center gap-1">
                      Anti-Scam Audit Checklist
                    </span>
                    <span className="font-extrabold text-[10px] text-[#465FFF] bg-[#465FFF]/15 px-2 py-0.5 rounded border border-[#465FFF]/30">
                      {Object.values(checklist).filter(Boolean).length}/4 Verified
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {[
                      { key: 'storefront', label: 'Storefront photo confirms physical equipment in Naval' },
                      { key: 'dti', label: 'DTI registration & business name match owner application' },
                      { key: 'permit', label: 'LGU Mayor\'s business permit is active in Naval' },
                      { key: 'location', label: 'GPS coordinates verified within Naval boundaries' },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start gap-2 text-[11px] text-slate-800 font-medium cursor-pointer select-none hover:text-slate-950"
                      >
                        <input
                          type="checkbox"
                          checked={checklist[item.key]}
                          onChange={(e) => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="w-3.5 h-3.5 mt-0.5 rounded text-[#465FFF] focus:ring-[#465FFF] border-slate-300"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Schedule:</span>
                  <span className="font-bold text-slate-900">{selectedDocs.schedule}</span>
                </div>
                {selectedDocs.services.length > 0 && (
                  <div>
                    <div className="text-slate-500 font-bold uppercase text-[10px] mb-1">Services Offered:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedDocs.services.map((srv, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 text-[10px] font-bold">
                          {srv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Current Queue</div>
                  <div className="text-lg font-black text-[#465FFF] mt-0.5">{selectedShop.currentQueue || 0}</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Orders</div>
                  <div className="text-lg font-black text-[#465FFF] mt-0.5">{selectedShop.totalOrders || 0}</div>
                </div>
              </div>

            </div>

            <div className="p-2 sm:p-2.5 bg-white border-t border-[#D9E2EC] space-y-1.5 shrink-0">
              {selectedShop.verificationStatus === 'suspended' ? (
                <>
                  <button
                    onClick={() => handleUpdateShopStatus(selectedShop._id, 'verified')}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#15803D] hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Lift Suspension &amp; Reactivate Shop
                  </button>
                  <div className="border-t border-[#D9E2EC] my-0.5" />
                  <button
                    onClick={() => promptDeleteShop(selectedShop._id, selectedShop.shopName)}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={12} className="text-[#B91C1C]" />
                    Delete Shop Record
                  </button>
                </>
              ) : selectedShop.verificationStatus === 'verified' ? (
                <>
                  <button
                    onClick={() => {
                      const reason = window.prompt('Enter reason for suspending this shop (will be logged & notified):');
                      if (reason && reason.trim()) {
                        handleUpdateShopStatus(selectedShop._id, 'suspended', reason.trim());
                      }
                    }}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] font-bold text-xs border border-[#FECACA] transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <AlertCircle size={13} className="text-[#DC2626]" />
                    Suspend Shop
                  </button>

                  <button
                    onClick={() => handleVerify(selectedShop._id, 'pending')}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#B45309] font-bold text-xs border border-[#FDE68A] transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    <AlertTriangle size={13} className="text-[#B45309]" />
                    Revoke Verification
                  </button>

                  <div className="border-t border-[#D9E2EC] my-0.5" />

                  <button
                    onClick={() => promptDeleteShop(selectedShop._id, selectedShop.shopName)}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={12} className="text-[#B91C1C]" />
                    Delete Shop Record
                  </button>
                </>
              ) : selectedShop.verificationStatus === 'rejected' ? (
                <>
                  <button
                    onClick={() => handleVerify(selectedShop._id, 'verified')}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#15803D] hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Re-evaluate &amp; Activate Shop
                  </button>
                  <div className="border-t border-[#D9E2EC] my-0.5" />
                  <button
                    onClick={() => promptDeleteShop(selectedShop._id, selectedShop.shopName)}
                    disabled={actionLoading}
                    className="w-full py-1.5 px-3 rounded-lg text-[#B91C1C] hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Delete Shop Record
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleVerify(selectedShop._id, 'verified')}
                    disabled={actionLoading || Object.values(checklist).filter(Boolean).length < 4}
                    className={`w-full py-1.5 px-3 rounded-lg font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                      Object.values(checklist).filter(Boolean).length === 4
                        ? 'bg-[#15803D] hover:bg-emerald-800 text-white shadow-emerald-800/25 cursor-pointer'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    {Object.values(checklist).filter(Boolean).length === 4
                      ? 'Verify & Activate Shop'
                      : `Complete Anti-Scam Checks (${Object.values(checklist).filter(Boolean).length}/4)`}
                  </button>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      onClick={() => handleVerify(selectedShop._id, 'rejected')}
                      disabled={actionLoading}
                      className="py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-red-50 text-[#B91C1C] font-bold text-xs border border-slate-200 hover:border-[#FECACA] transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                    <button
                      onClick={() => promptDeleteShop(selectedShop._id, selectedShop.shopName)}
                      disabled={actionLoading}
                      className="py-1.5 px-3 rounded-lg text-[#52627A] hover:text-[#B91C1C] hover:bg-slate-100 text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>

          </aside>
        )}

      </div>

      {previewDoc && (() => {
        const photoUrl = previewDoc.type === 'storefront'
          ? previewDoc.doc.storefrontPhotoUrl
          : previewDoc.type === 'dti'
            ? previewDoc.doc.dtiDocUrl
            : previewDoc.doc.permitDocUrl;

        const docFileName = previewDoc.type === 'storefront'
          ? previewDoc.doc.storefrontPhotoName
          : previewDoc.type === 'dti'
            ? previewDoc.doc.dtiDoc
            : previewDoc.doc.permitDoc;

        const docNumber = previewDoc.type === 'storefront'
          ? 'Physical Proof'
          : previewDoc.type === 'dti'
            ? previewDoc.doc.dtiNo
            : previewDoc.doc.permitNo;

        const modalTitle = previewDoc.type === 'storefront'
          ? 'Physical Shop & Storefront Proof'
          : previewDoc.type === 'dti'
            ? 'DTI Certificate of Registration'
            : 'Naval Mayor\'s Business Permit';

        const hasPhoto = Boolean(photoUrl && photoUrl.startsWith('data:image'));
        const isPdf = Boolean(photoUrl && (photoUrl.endsWith('.pdf') || photoUrl.includes('.pdf')));
        const isDocManaged = previewDoc.type === 'dti' || previewDoc.type === 'permit';
        const docObj = previewDoc.rawDoc || (previewDoc.type === 'dti' ? previewDoc.doc.dtiObj : previewDoc.doc.permitObj);
        const statusInfo = isDocManaged
          ? getDocStatusInfo(docObj || {
              currentFile: {
                fileUrl: photoUrl,
                fileName: docFileName,
                status: previewDoc.shop.verificationStatus === 'verified' ? 'verified' : 'pending',
              }
            })
          : null;
        const historyList = docObj?.history || [];

        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
              
              <div className="px-5 py-3.5 bg-[#465FFF] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-white" />
                  <div>
                    <h3 className="text-sm font-bold m-0 text-white leading-tight">
                      {modalTitle}
                    </h3>
                    <div className="text-[11px] text-slate-300 font-mono">
                      {docNumber} • {previewDoc.shop.shopName}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPreviewDoc(null);
                    setShowRejectForm(false);
                    setRejectionReasonInput('');
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="px-5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDocModalTab('photo')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      docModalTab === 'photo'
                        ? 'bg-white text-[#465FFF] shadow-xs border border-slate-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Uploaded Document {hasPhoto && '•'}
                  </button>
                  {isDocManaged && (
                    <button
                      type="button"
                      onClick={() => setDocModalTab('history')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        docModalTab === 'history'
                          ? 'bg-white text-[#465FFF] shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <History size={12} /> Version History ({historyList.length})
                    </button>
                  )}
                  {previewDoc.type !== 'storefront' && (
                    <button
                      type="button"
                      onClick={() => setDocModalTab('metadata')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        docModalTab === 'metadata'
                          ? 'bg-white text-[#465FFF] shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Certified Record Format
                    </button>
                  )}
                </div>

                {docModalTab === 'photo' && hasPhoto && (
                  <button
                    type="button"
                    onClick={() => setIsZoomed(z => !z)}
                    className="px-2.5 py-1 text-xs font-bold bg-white text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isZoomed ? 'Fit to Window' : 'Zoom In (100%)'}
                  </button>
                )}
              </div>

              <div className="p-5 overflow-y-auto bg-slate-50/60 flex-1 space-y-3">
                {/* Status Alert Banner */}
                {isDocManaged && statusInfo && statusInfo.alert && (
                  <div className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs ${
                    statusInfo.status === 'expired' || statusInfo.status === 'rejected'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : statusInfo.status === 'expiring_soon'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    {statusInfo.status === 'expired' || statusInfo.status === 'rejected' ? (
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    ) : statusInfo.status === 'expiring_soon' ? (
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                    ) : (
                      <Clock size={15} className="shrink-0 mt-0.5 text-blue-600" />
                    )}
                    <div>
                      <div className="font-bold">
                        {statusInfo.status === 'rejected'
                          ? 'Document Rejected by Admin'
                          : statusInfo.status === 'expired'
                          ? 'Document Expired'
                          : statusInfo.status === 'expiring_soon'
                          ? 'Expiration Warning'
                          : 'Pending Admin Verification'}
                      </div>
                      <div className="text-[11px] opacity-90 mt-0.5">{statusInfo.alert}</div>
                    </div>
                  </div>
                )}

                {docModalTab === 'photo' ? (
                  hasPhoto ? (
                    <div className="space-y-3">
                      <div className="bg-slate-900 rounded-2xl p-2 flex items-center justify-center overflow-auto border border-slate-800 shadow-inner min-h-[300px] max-h-[460px]">
                        <img
                          src={photoUrl}
                          alt="Uploaded Document"
                          className={`rounded-xl object-contain transition-all duration-200 ${
                            isZoomed ? 'w-auto max-w-none cursor-zoom-out' : 'max-h-[420px] w-auto max-w-full cursor-zoom-in'
                          }`}
                          onClick={() => setIsZoomed(z => !z)}
                        />
                      </div>

                      <div className="p-3 bg-white rounded-2xl border border-slate-200 text-xs flex items-center justify-between text-slate-600">
                        <div>
                          <div className="font-bold text-slate-800">{docFileName}</div>
                          <div className="text-[11px] text-slate-400">
                            {previewDoc.type === 'storefront'
                              ? 'Physical store proof located in Naval, Biliran'
                              : 'Owner uploaded high-resolution business document'}
                          </div>
                        </div>
                        {statusInfo && (
                          <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] border flex items-center gap-1 ${statusInfo.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : photoUrl ? (
                    <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-4 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#465FFF]/10 text-[#465FFF] flex items-center justify-center mx-auto">
                        <FileText size={28} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{docFileName || 'Document Record'}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Digital file record uploaded with document registration number <strong className="font-mono text-slate-700">{docNumber}</strong>.
                        </p>
                      </div>
                      <div className="flex justify-center gap-2 pt-2">
                        <a
                          href={photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl bg-[#465FFF] hover:bg-[#142e70] text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <ExternalLink size={13} /> Open File in New Tab
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#465FFF]/15 text-[#465FFF] flex items-center justify-center mx-auto">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{docFileName || 'Document Attached'}</h4>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                          {previewDoc.type === 'storefront'
                            ? 'No physical storefront photo was attached during initial registration.'
                            : `The partner registered document number ${docNumber}.`}
                        </p>
                      </div>
                      {previewDoc.type !== 'storefront' && (
                        <button
                          type="button"
                          onClick={() => setDocModalTab('metadata')}
                          className="px-3.5 py-2 rounded-xl bg-[#465FFF] hover:bg-[#142e70] text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                        >
                          Inspect Certified Digital Record 
                        </button>
                      )}
                    </div>
                  )
                ) : docModalTab === 'history' ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <History size={14} className="text-[#465FFF]" />
                        Version History &amp; Audit Trail
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Previous versions are archived and preserved when shop owners update expiring documents.
                      </p>
                    </div>

                    {historyList.length === 0 ? (
                      <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                        No previous versions on record. This is the initial document upload.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {historyList.map((ver, idx) => {
                          const vNum = historyList.length - idx;
                          return (
                            <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                                    v{vNum}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800 truncate max-w-[220px]" title={ver.fileName}>
                                    {ver.fileName || 'Archived Document'}
                                  </span>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                  ver.status === 'verified'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : ver.status === 'rejected'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : ver.status === 'expired'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {ver.status ? ver.status.toUpperCase() : 'ARCHIVED'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                                <div>
                                  <span>Uploaded: </span>
                                  <strong className="text-slate-700">
                                    {ver.uploadedAt ? new Date(ver.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                  </strong>
                                </div>
                                <div>
                                  <span>Archived: </span>
                                  <strong className="text-slate-700">
                                    {ver.archivedAt ? new Date(ver.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                  </strong>
                                </div>
                                {ver.expiresAt && (
                                  <div className="col-span-2">
                                    <span>Valid Until: </span>
                                    <strong className="text-slate-700">
                                      {new Date(ver.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </strong>
                                  </div>
                                )}
                              </div>

                              {ver.rejectionReason && (
                                <div className="p-2 bg-rose-50 rounded-lg border border-rose-200 text-[10px] text-rose-700">
                                  <strong>Rejection Note:</strong> {ver.rejectionReason}
                                </div>
                              )}

                              {ver.fileUrl && (
                                <div className="pt-1 border-t border-slate-100 flex justify-end">
                                  <a
                                    href={ver.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#465FFF] hover:underline"
                                  >
                                    <ExternalLink size={11} /> Open Archived File
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-sm relative overflow-hidden font-serif">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] text-8xl font-black rotate-[-30deg]">
                      {previewDoc.type === 'dti' ? 'DTI PHILIPPINES' : 'MUNICIPALITY OF NAVAL'}
                    </div>

                    <div className="text-center pb-3 border-b-2 border-slate-800 space-y-0.5">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans">Republic of the Philippines</div>
                      {previewDoc.type === 'dti' ? (
                        <>
                          <div className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">Department of Trade and Industry</div>
                          <div className="text-[9px] text-slate-500 font-sans">Region VIII · Biliran Provincial Office</div>
                          <div className="text-sm font-bold text-[#465FFF] pt-1 font-serif">CERTIFICATE OF BUSINESS NAME REGISTRATION</div>
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-black text-slate-900 uppercase tracking-wider font-sans">Municipality of Naval, Biliran</div>
                          <div className="text-[9px] text-slate-500 font-sans">Office of the Municipal Mayor · Business Permits &amp; Licensing Office</div>
                          <div className="text-sm font-bold text-[#465FFF] pt-1 font-serif">OFFICIAL MAYOR'S BUSINESS PERMIT</div>
                        </>
                      )}
                    </div>

                    <div className="py-4 space-y-3 text-xs font-sans">
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Document Number</span>
                          <strong className="font-mono text-[#465FFF]">{docNumber}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold">Status</span>
                          <strong className="text-[#465FFF]">{statusInfo ? `● ${statusInfo.label}` : '● Valid & Registered'}</strong>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Registered Business Name:</div>
                        <div className="text-sm font-black text-[#465FFF]">{previewDoc.shop.shopName}</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Business Owner / Proprietor:</div>
                        <div className="text-xs font-bold text-slate-800">
                          {previewDoc.shop.ownerId?.name || previewDoc.shop.ownerName || 'Verified Partner'}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Registered Physical Location:</div>
                        <div className="text-xs text-slate-700">{previewDoc.shop.address || 'Naval, Biliran'}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                        <div>
                          <span>Date Uploaded:</span> <strong>{docObj?.currentFile?.uploadedAt ? new Date(docObj.currentFile.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Aug 2026'}</strong>
                        </div>
                        <div>
                          <span>Valid Until:</span> <strong>{docObj?.currentFile?.expiresAt ? new Date(docObj.currentFile.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Dec 31, 2026'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex items-center justify-between font-sans">
                      <div className="text-[9px] text-slate-400 font-mono">
                        VERIFIED VIA PRINTDAYON LGU PORTAL
                      </div>
                      <div className="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-300 text-teal-800 text-[9px] font-extrabold flex items-center gap-1">
                        <CheckCircle2 size={11} /> AUTHENTICATED
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer with Verification Actions */}
              <div className="px-5 py-3 bg-white border-t border-slate-200">
                {isDocManaged ? (
                  showRejectForm ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        Reason for Document Rejection <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        placeholder="E.g., Document expired, blurry scan, illegible permit number, or mismatching shop name..."
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowRejectForm(false);
                            setRejectionReasonInput('');
                          }}
                          disabled={docActionLoading}
                          className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyBusinessDoc(previewDoc.shop._id, previewDoc.type, 'rejected', rejectionReasonInput)}
                          disabled={docActionLoading || !rejectionReasonInput.trim()}
                          className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <XCircle size={13} /> Confirm Rejection
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {statusInfo && (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${statusInfo.badgeClass}`}>
                            <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
                          </span>
                        )}
                        {docObj?.currentFile?.expiresAt && (
                          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                            Valid until: {new Date(docObj.currentFile.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRejectForm(true)}
                          disabled={docActionLoading}
                          className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject
                        </button>

                        <button
                          type="button"
                          onClick={() => handleVerifyBusinessDoc(previewDoc.shop._id, previewDoc.type, 'verified')}
                          disabled={docActionLoading}
                          className="px-3.5 py-1.5 rounded-xl bg-[#15803D] hover:bg-emerald-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} /> Verify Document
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDoc(null);
                            setShowRejectForm(false);
                            setRejectionReasonInput('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(null)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Close Preview
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {deleteConfirmShop && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 size={26} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900 m-0">Delete Printing Shop?</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                Are you sure you want to permanently delete <strong className="text-slate-800 font-bold">"{deleteConfirmShop.name}"</strong>? This will remove all associated shop records from PrintDayon.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmShop(null)}
                disabled={actionLoading}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteShop}
                disabled={actionLoading}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip Hover Styles */}
      <style>{`
        .shops-search-btn-wrapper .shops-search-tooltip {
          visibility: hidden;
          opacity: 0;
          transition: opacity 0.15s ease, transform 0.15s ease;
          transform: translate(-50%, 4px) !important;
        }
        .shops-search-btn-wrapper:hover .shops-search-tooltip {
          visibility: visible;
          opacity: 1;
          transform: translate(-50%, 0) !important;
        }
      `}</style>
    </div>
  );
}
