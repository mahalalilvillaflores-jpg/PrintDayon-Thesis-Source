import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin, Upload, CheckCircle2,
  ArrowRight, ArrowLeft, Eye, EyeOff, Clock,
  Loader2, User, Mail, Phone,
  ShieldCheck, Check, Navigation, X
} from 'lucide-react';
import { toast } from '../../components/ui/Toast';
import { authAPI, shopAPI } from '../../services/api';
import { STOREFRONT_PRESETS, SAMPLE_VERIFICATION_PRESETS } from '../../utils/shopAssetPresets';

const NAVAL_CENTER = { lat: 11.5765, lng: 124.4063 };

const POPULAR_SERVICES = [
  'Document Printing',
  'Photocopy / Xerox',
  'Bookbinding & Finishing',
  'Softbind & Thermal Binding',
  'Spiral / Ring Binding',
  'Document Scanning',
  'Lamination',
  'Rush Orders',
];

const LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export default function PartnerRegisterPage() {
  const [step, setStep] = useState(1);
  const [mapLayer, setMapLayer] = useState('streets');
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [selectedServices, setSelectedServices] = useState([
    'Document Printing',
    'Photocopy / Xerox',
    'Bookbinding & Finishing'
  ]);
  const [availableServicesList, setAvailableServicesList] = useState(POPULAR_SERVICES);
  const [customService, setCustomService] = useState('');

  const [form, setForm] = useState({
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactNumber: '',

    shopName: '',
    address: '',
    landmark: '',
    buildingDetails: '',
    latitude: NAVAL_CENTER.lat,
    longitude: NAVAL_CENTER.lng,
    openTime: '08:00',
    closeTime: '17:00',
    description: '',

    dtiNumber: '',
    mayorsPermitNumber: '',
    dtiDocName: '',
    permitDocName: '',
    dtiDocUrl: '',
    permitDocUrl: '',
    storefrontPhotoName: '',
    storefrontPhotoUrl: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const reverseGeocodeRef = useRef(null);

  const reverseGeocode = async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr = data.address;
          const parts = [
            addr.amenity || addr.building || addr.shop || addr.office || '',
            addr.road || addr.pedestrian || addr.street || addr.footway || '',
            addr.neighbourhood || addr.suburb || (addr.quarter ? `Brgy. ${addr.quarter}` : (addr.village ? `Brgy. ${addr.village}` : '')),
            addr.city || addr.municipality || addr.town || 'Naval',
            addr.province || addr.state || 'Biliran'
          ].filter(Boolean);

          const formatted = [...new Set(parts)].join(', ') || data.display_name;
          if (formatted) {
            setForm(prev => ({ ...prev, address: formatted }));
          }
        }
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  };

  useEffect(() => {
    reverseGeocodeRef.current = reverseGeocode;
  });

  const handleAddressChange = (val) => {
    setForm(prev => ({ ...prev, address: val }));
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(val + ' Naval Biliran')}&countrycodes=ph&limit=5&addressdetails=1`
        );
        if (res.ok) {
          let items = await res.json();
          if (!items || items.length === 0) {
            const fallbackRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(val)}&countrycodes=ph&viewbox=124.3,11.5,124.6,11.7&bounded=0&limit=5&addressdetails=1`
            );
            if (fallbackRes.ok) items = await fallbackRes.json();
          }
          setSearchResults(items || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleSelectLocation = (item) => {
    const newLat = parseFloat(parseFloat(item.lat).toFixed(6));
    const newLng = parseFloat(parseFloat(item.lon).toFixed(6));

    const addr = item.address;
    let formatted = '';
    if (addr) {
      const parts = [
        item.name || addr.amenity || addr.building || '',
        addr.road || addr.pedestrian || addr.street || '',
        addr.neighbourhood || addr.suburb || (addr.quarter ? `Brgy. ${addr.quarter}` : (addr.village ? `Brgy. ${addr.village}` : '')),
        addr.city || addr.municipality || addr.town || 'Naval',
        addr.province || addr.state || 'Biliran'
      ].filter(Boolean);
      formatted = [...new Set(parts)].join(', ') || item.display_name;
    } else {
      formatted = item.display_name;
    }

    setForm(prev => ({
      ...prev,
      latitude: newLat,
      longitude: newLng,
      address: formatted || item.display_name
    }));

    setShowDropdown(false);

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [newLng, newLat], zoom: 17, duration: 500 });
    }
    if (markerRef.current) {
      markerRef.current.setLngLat([newLng, newLat]);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setLocatingUser(false);
        setForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 17, duration: 500 });
        }
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        }
        if (reverseGeocodeRef.current) {
          reverseGeocodeRef.current(lat, lng);
        }
        toast.success('Location detected from device GPS');
      },
      () => {
        setLocatingUser(false);
        toast.error('Could not retrieve GPS location.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const toggleService = (srv) => {
    setSelectedServices(prev =>
      prev.includes(srv) ? prev.filter(s => s !== srv) : [...prev, srv]
    );
  };

  const handleAddCustomService = () => {
    const trimmed = customService.trim();
    if (!trimmed) return;
    if (!availableServicesList.includes(trimmed)) {
      setAvailableServicesList(prev => [...prev, trimmed]);
    }
    if (!selectedServices.includes(trimmed)) {
      setSelectedServices(prev => [...prev, trimmed]);
    }
    setCustomService('');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (step !== 2 || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: LIBERTY_STYLE,
      center: [form.longitude, form.latitude],
      zoom: 16.5,
      maxZoom: 19,
      minZoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    const pinEl = document.createElement('div');
    pinEl.className = 'location-picker-pin';
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
          box-shadow:0 6px 16px rgba(65,158,189,0.55);
        ">
        </div>
      </div>
    `;

    const marker = new maplibregl.Marker({ element: pinEl, draggable: true, anchor: 'bottom' })
      .setLngLat([form.longitude, form.latitude])
      .addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      const lat = parseFloat(lngLat.lat.toFixed(6));
      const lng = parseFloat(lngLat.lng.toFixed(6));
      setForm(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      if (reverseGeocodeRef.current) {
        reverseGeocodeRef.current(lat, lng);
      }
    });

    map.on('click', (e) => {
      const lat = parseFloat(e.lngLat.lat.toFixed(6));
      const lng = parseFloat(e.lngLat.lng.toFixed(6));
      marker.setLngLat(e.lngLat);
      setForm(prev => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      map.flyTo({ center: e.lngLat, zoom: map.getZoom(), duration: 300 });
      if (reverseGeocodeRef.current) {
        reverseGeocodeRef.current(lat, lng);
      }
    });

    map.on('load', () => {
      if (!map.getSource('esri-satellite-src')) {
        map.addSource('esri-satellite-src', {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 16,
        });

        const layers = map.getStyle()?.layers || [];
        let firstLabelLayerId = null;
        for (const layer of layers) {
          if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
            firstLabelLayerId = layer.id;
            break;
          }
        }

        map.addLayer(
          {
            id: 'satellite-hybrid-layer',
            type: 'raster',
            source: 'esri-satellite-src',
            layout: {
              visibility: mapLayer === 'satellite' ? 'visible' : 'none',
            },
            paint: {
              'raster-opacity': 1,
            },
          },
          firstLabelLayerId
        );
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [step]);

  const handleLayerSwitch = (layerKey) => {
    setMapLayer(layerKey);
    if (mapRef.current && mapRef.current.getLayer('satellite-hybrid-layer')) {
      mapRef.current.setLayoutProperty(
        'satellite-hybrid-layer',
        'visibility',
        layerKey === 'satellite' ? 'visible' : 'none'
      );
    }
  };

  const handleFileUpload = (nameField, urlField, e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        e.target.value = '';
        return toast.error('File size exceeds 5MB limit.');
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm(prev => ({
          ...prev,
          [nameField]: file.name,
          [urlField]: event.target.result,
        }));
        toast.success(`Attached ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (nameField, urlField) => {
    setForm(prev => ({ ...prev, [nameField]: '', [urlField]: '' }));
  };

  const hasMinLength = form.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(form.password);
  const hasNumber = /\d/.test(form.password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(form.password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  const handleNextStep = (e) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      if (!form.contactNumber || !/^09\d{9}$/.test(form.contactNumber)) {
        return setError('Cellphone number must be a valid 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
      }
      if (form.password !== form.confirmPassword) {
        return setError('Passwords do not match. Please verify your password.');
      }
      if (!isPasswordValid) {
        return setError(
          'Password must be at least 8 characters long and include an uppercase letter, a number, and a special character (!@#$).'
        );
      }
      if (!agreedToPrivacy) {
        return setError('Please acknowledge and agree to the Data Privacy Act (RA 10173) & Terms.');
      }
      setStep(2);
    } else if (step === 2) {
      if (!form.shopName || !form.address) {
        return setError('Please enter your shop name and pinpoint the address on the map.');
      }
      if (!form.description) {
        return setError('Please provide a short description for your shop.');
      }
      if (selectedServices.length === 0) {
        return setError('Please select at least one printing service tag.');
      }
      setStep(3);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.dtiNumber || !form.mayorsPermitNumber) {
      return setError('Please enter your business registration numbers for DTI and Mayor\'s Permit.');
    }
    if (!form.dtiDocUrl || !form.permitDocUrl || !form.storefrontPhotoUrl) {
      return setError('Please attach all 3 required verification proofs (Storefront, DTI, Mayor\'s Permit).');
    }

    if (form.latitude < 11.50 || form.latitude > 11.66 || form.longitude < 124.34 || form.longitude > 124.48) {
      return setError('Anti-Scam Alert: Pinned location is outside Naval, Biliran municipality boundaries.');
    }

    setLoading(true);
    try {
      const authRes = await authAPI.register({
        name: form.ownerName,
        email: form.email,
        password: form.password,
        contactNumber: form.contactNumber,
        role: 'shop_owner',
      });

      const token = authRes?.data?.token;
      if (token) {
        localStorage.setItem('pd_token', token);
        localStorage.setItem('pd_user', JSON.stringify(authRes.data.user));
      }

      const fullAddress = form.buildingDetails?.trim()
        ? `${form.buildingDetails.trim()}, ${form.address}`
        : form.address;

      await shopAPI.create({
        shopName: form.shopName,
        address: fullAddress,
        landmark: form.landmark || '',
        locationDescription: form.landmark || '',
        latitude: form.latitude,
        longitude: form.longitude,
        contactNumber: form.contactNumber,
        dtiNumber: form.dtiNumber,
        mayorsPermitNumber: form.mayorsPermitNumber,
        dtiDocName: form.dtiDocName,
        permitDocName: form.permitDocName,
        dtiDocUrl: form.dtiDocUrl,
        permitDocUrl: form.permitDocUrl,
        storefrontPhotoName: form.storefrontPhotoName,
        storefrontPhotoUrl: form.storefrontPhotoUrl,
        description: form.description,
        services: selectedServices.map(name => ({ name, available: true })),
        operatingHours: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(day => ({
          day, open: form.openTime, close: form.closeTime
        })),
      });

      setSubmitted(true);
      toast.success('Partner application submitted! Admin will inspect and verify your shop.');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 relative font-outfit overflow-y-auto bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/naval_aerial_bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />

      <main className="w-full max-w-[520px] my-auto relative z-10 py-2 sm:py-3">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.25)] p-4 sm:p-5 transition-all font-outfit">
          {/* Brand & Title Header */}
          <div className="text-center mb-2.5">
            <Link
              to="/"
              title="Back to Homepage"
              className="inline-flex justify-center no-underline mb-1 hover:opacity-90 transition-all"
            >
              <img src="/logo.png" alt="PrintDayon Logo" className="h-10 sm:h-11 w-auto object-contain" />
            </Link>

            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Shop Owner Registration
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Join the Naval digital print network and receive verified print orders
            </p>
          </div>

          {!submitted ? (
            <>
              {/* Step Progress Bar */}
              <div className="flex items-center justify-between gap-1 sm:gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                <div className={`flex items-center gap-1.5 text-[11px] sm:text-xs ${step === 1 ? 'font-bold text-[#465FFF] dark:text-[#6881ff]' : step > 1 ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-normal text-slate-400 dark:text-slate-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step === 1 ? 'bg-[#465FFF] text-white' : step > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                    {step > 1 ? '✓' : '1'}
                  </span>
                  <span className="hidden xs:inline">Step 1</span>
                  <span className="truncate">Credentials</span>
                </div>

                <span className="text-slate-300 dark:text-slate-600 text-[10px] shrink-0 select-none">→</span>

                <div className={`flex items-center gap-1.5 text-[11px] sm:text-xs ${step === 2 ? 'font-bold text-[#465FFF] dark:text-[#6881ff]' : step > 2 ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-normal text-slate-400 dark:text-slate-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step === 2 ? 'bg-[#465FFF] text-white' : step > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                    {step > 2 ? '✓' : '2'}
                  </span>
                  <span className="hidden xs:inline">Step 2</span>
                  <span className="truncate">Shop Details</span>
                </div>

                <span className="text-slate-300 dark:text-slate-600 text-[10px] shrink-0 select-none">→</span>

                <div className={`flex items-center gap-1.5 text-[11px] sm:text-xs ${step === 3 ? 'font-bold text-[#465FFF] dark:text-[#6881ff]' : 'font-normal text-slate-400 dark:text-slate-500'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step === 3 ? 'bg-[#465FFF] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                    3
                  </span>
                  <span className="hidden xs:inline">Step 3</span>
                  <span className="truncate">Location</span>
                </div>
              </div>

              {error && (
                <div className="mb-2.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[#9b0033] text-xs font-medium flex items-start gap-2 animate-shake">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#9b0033] mt-1 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

                  {step === 1 && (
                    <form onSubmit={handleNextStep} className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                            Owner Name *
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              required
                              autoComplete="name"
                              value={form.ownerName}
                              onChange={e => setForm({ ...form, ownerName: e.target.value })}
                              placeholder="Full Name"
                              className="w-full h-10 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                            />
                            <div className="absolute right-2.5 text-slate-400 pointer-events-none flex items-center">
                              <User size={14} />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                            Cellphone Number *
                          </label>
                          <div className="relative flex items-center">
                            <div className="absolute left-2.5 flex items-center text-slate-500 dark:text-slate-400 font-semibold text-xs select-none pointer-events-none pr-1.5 border-r border-slate-200 dark:border-slate-700">
                              <span>+63</span>
                            </div>
                            <input
                              type="tel"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={11}
                              required
                              autoComplete="tel"
                              value={form.contactNumber}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                setForm({ ...form, contactNumber: val });
                              }}
                              placeholder="09XXXXXXXXX"
                              className="w-full h-10 pl-[48px] pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                            />
                            <div className="absolute right-2.5 text-slate-400 pointer-events-none flex items-center">
                              <Phone size={14} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                          Email Address *
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="owner@example.com"
                            className="w-full h-10 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                          />
                          <div className="absolute right-2.5 text-slate-400 pointer-events-none flex items-center">
                            <Mail size={14} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                            Password *
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              autoComplete="new-password"
                              value={form.password}
                              onChange={e => setForm({ ...form, password: e.target.value })}
                              placeholder="Min. 8 chars, 1 uppercase, 1 symbol"
                              className="w-full h-10 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors cursor-pointer"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                            Confirm Password *
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              autoComplete="new-password"
                              value={form.confirmPassword}
                              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                              placeholder="Re-enter your password"
                              className="w-full h-10 px-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors cursor-pointer"
                              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                            >
                              {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {form.password.length > 0 && (
                        <div className="grid grid-cols-2 gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px]">
                          <div className={`flex items-center gap-1 font-medium ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasMinLength ? '✓' : '○'}</span>
                            <span>8+ characters</span>
                          </div>
                          <div className={`flex items-center gap-1 font-medium ${hasUppercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasUppercase ? '✓' : '○'}</span>
                            <span>Uppercase (A-Z)</span>
                          </div>
                          <div className={`flex items-center gap-1 font-medium ${hasNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasNumber ? '✓' : '○'}</span>
                            <span>Number (0-9)</span>
                          </div>
                          <div className={`flex items-center gap-1 font-medium ${hasSpecial ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                            <span>{hasSpecial ? '✓' : '○'}</span>
                            <span>Symbol (!@#$)</span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-100/70 dark:hover:bg-slate-800/80 cursor-pointer transition-all">
                          <input
                            type="checkbox"
                            checked={agreedToPrivacy}
                            onChange={e => setAgreedToPrivacy(e.target.checked)}
                            className="mt-0.5 rounded text-[#465FFF] focus:ring-[#465FFF]/20 h-3.5 w-3.5 shrink-0 accent-[#465FFF] cursor-pointer"
                          />
                          <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-tight">
                            I agree to the collection of shop details per <strong className="font-semibold text-slate-900 dark:text-white">Philippine Data Privacy Act (RA 10173)</strong> and accept Partner Terms.
                          </span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={!agreedToPrivacy}
                        className={`w-full h-11 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 mt-1 ${
                          agreedToPrivacy
                            ? 'text-white bg-[#465FFF] hover:bg-[#3b52e6] active:scale-[0.99] shadow-sm shadow-[#465FFF]/25 cursor-pointer'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed shadow-none'
                        }`}
                      >
                        <span>Next: Shop & Map Location</span>
                        <ArrowRight size={15} />
                      </button>
                    </form>
                  )}

                  {step === 2 && (
                    <form onSubmit={handleNextStep} className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Shop Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Naval QuickPrint Center"
                            value={form.shopName}
                            onChange={e => setForm({ ...form, shopName: e.target.value })}
                            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Operating Schedule (Mon-Sat) *
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              required
                              value={form.openTime}
                              onChange={e => setForm({ ...form, openTime: e.target.value })}
                              className="w-1/2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white outline-none transition-all"
                            />
                            <span className="text-xs font-bold text-slate-400">to</span>
                            <input
                              type="time"
                              required
                              value={form.closeTime}
                              onChange={e => setForm({ ...form, closeTime: e.target.value })}
                              className="w-1/2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Shop Description *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Student-friendly printing and document services"
                          value={form.description}
                          onChange={e => setForm({ ...form, description: e.target.value })}
                          className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                          <span>Services Offered *</span>
                          <span className="text-[11px] text-slate-400 font-normal lowercase tracking-normal">Select all that apply</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {availableServicesList.map((srv) => {
                            const isSelected = selectedServices.includes(srv);
                            return (
                              <button
                                key={srv}
                                type="button"
                                onClick={() => toggleService(srv)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#465FFF] text-white border-[#465FFF] shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {isSelected ? '✓ ' : ''}{srv}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Add other service (e.g. Tarpaulin, ID Photo)"
                            value={customService}
                            onChange={e => setCustomService(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomService();
                              }
                            }}
                            className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none flex-1 max-w-[280px]"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomService}
                            disabled={!customService.trim()}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            + Add Service
                          </button>
                        </div>
                      </div>

                      <div className="relative" ref={dropdownRef}>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Street Address / Landmark *
                        </label>

                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Search street or landmark in Naval"
                            value={form.address}
                            onChange={e => handleAddressChange(e.target.value)}
                            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                            className="w-full h-10 px-3.5 pr-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                          />

                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {isSearching && (
                              <Loader2 size={14} className="text-[#465FFF] animate-spin mr-1" />
                            )}
                            <button
                              type="button"
                              onClick={handleUseCurrentLocation}
                              disabled={locatingUser}
                              className="text-xs text-white font-semibold flex items-center gap-1 bg-[#465FFF] hover:bg-[#3b52e6] px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-xs"
                              title="Use current device GPS location"
                            >
                              {locatingUser ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Navigation size={12} />
                              )}
                              <span>GPS</span>
                            </button>
                          </div>
                        </div>

                        {showDropdown && searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                            {searchResults.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectLocation(item)}
                                className="w-full text-left px-3.5 py-2 hover:bg-[#465FFF]/10 transition-colors flex items-start gap-2.5 group cursor-pointer"
                              >
                                <MapPin size={15} className="text-[#465FFF] shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {item.name || item.display_name.split(',')[0]}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.display_name}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm relative">
                        <div ref={mapContainerRef} className="w-full h-full" />

                        <div className="absolute top-2 left-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-800 z-10 flex items-center gap-1.5 pointer-events-none">
                          {isGeocoding ? (
                            <>
                              <Loader2 size={11} className="animate-spin text-[#465FFF]" />
                              <span className="text-[#465FFF]">Detecting location...</span>
                            </>
                          ) : (
                            <>
                              <MapPin size={11} className="text-[#465FFF]" />
                              <span>{form.latitude}, {form.longitude}</span>
                            </>
                          )}
                        </div>

                        <div className="absolute top-2 right-12 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-0.5 rounded-lg border border-slate-200 dark:border-slate-850 z-10 flex items-center text-[10px] font-semibold shadow-xs">
                          <button
                            type="button"
                            onClick={() => handleLayerSwitch('streets')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              mapLayer === 'streets'
                                ? 'bg-[#465FFF] text-white shadow-2xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Streets
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLayerSwitch('satellite')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                              mapLayer === 'satellite'
                                ? 'bg-[#465FFF] text-white shadow-2xs'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Satellite
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                            <span>Landmark</span>
                            <span className="text-[10px] text-[#465FFF] font-medium lowercase tracking-normal">e.g. Near BiPSU</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Beside Cathedral"
                            value={form.landmark}
                            onChange={e => setForm({ ...form, landmark: e.target.value })}
                            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Building / Floor (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 2nd Floor, Unit 3B"
                            value={form.buildingDetails}
                            onChange={e => setForm({ ...form, buildingDetails: e.target.value })}
                            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ArrowLeft size={16} />
                          <span>Back</span>
                        </button>
                        <button
                          type="submit"
                          className="h-11 rounded-xl text-white font-bold text-sm bg-[#465FFF] hover:bg-[#3b52e6] active:scale-[0.99] shadow-md shadow-[#465FFF]/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <span>Next: Permits</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </form>
                  )}

                  {step === 3 && (
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                      <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/70 dark:border-blue-900/50 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-2.5">
                        <ShieldCheck size={18} className="text-[#465FFF] shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold text-blue-950 dark:text-blue-200">Partner Verification Documents</strong>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                            Please provide your business numbers and proof documents below. All submissions are verified by Admin before public listing.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            DTI / SEC Number *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="DTI or SEC Number"
                            value={form.dtiNumber}
                            onChange={e => setForm({ ...form, dtiNumber: e.target.value })}
                            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Mayor's Business Permit *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Mayor's Permit Number"
                            value={form.mayorsPermitNumber}
                            onChange={e => setForm({ ...form, mayorsPermitNumber: e.target.value })}
                            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#465FFF] focus:ring-2 focus:ring-[#465FFF]/20 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-900/40 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                              Quick Preset Storefront Photos
                            </span>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              Saves Cloud Storage
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {STOREFRONT_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  setForm((prev) => ({
                                    ...prev,
                                    storefrontPhotoName: preset.title,
                                    storefrontPhotoUrl: preset.url,
                                  }));
                                  toast.success(`Selected "${preset.title}" preset`);
                                }}
                                className={`relative p-1.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                                  form.storefrontPhotoUrl === preset.url
                                    ? 'border-[#465FFF] bg-white dark:bg-slate-800 ring-2 ring-[#465FFF]/20 shadow-xs'
                                    : 'border-indigo-100 dark:border-indigo-900/50 bg-white/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'
                                }`}
                              >
                                <img
                                  src={preset.thumbnail}
                                  alt={preset.title}
                                  className="w-full h-12 rounded-lg object-cover"
                                />
                                <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                                  {preset.title}
                                </span>
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-indigo-100/60 dark:border-indigo-900/40">
                            <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                              Evaluating or testing registration?
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  dtiDocName: SAMPLE_VERIFICATION_PRESETS.dtiCertificate.name,
                                  dtiDocUrl: SAMPLE_VERIFICATION_PRESETS.dtiCertificate.url,
                                  permitDocName: SAMPLE_VERIFICATION_PRESETS.mayorsPermit.name,
                                  permitDocUrl: SAMPLE_VERIFICATION_PRESETS.mayorsPermit.url,
                                }));
                                toast.success('Loaded sample verification proofs!');
                              }}
                              className="text-[11px] font-bold text-[#465FFF] dark:text-[#6881ff] hover:underline cursor-pointer"
                            >
                              Auto-fill Sample Docs
                            </button>
                          </div>
                        </div>

                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                          <span>3 Verification Proofs (JPG, PNG, PDF)</span>
                          <span className="text-[10px] text-white font-semibold bg-[#465FFF] px-2 py-0.5 rounded-full">
                            3 Required
                          </span>
                        </label>

                        <div className="px-3.5 py-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 hover:border-[#465FFF] dark:hover:border-[#465FFF] transition-all flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {form.storefrontPhotoUrl ? (
                              <img
                                src={form.storefrontPhotoUrl}
                                alt="Storefront Preview"
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#465FFF] to-[#2563EB] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                1
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                Storefront &amp; Equipment Proof
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {form.storefrontPhotoName ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check size={12} /> {form.storefrontPhotoName}
                                  </span>
                                ) : (
                                  'Photo of signage or printing machines'
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {form.storefrontPhotoName && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFile('storefrontPhotoName', 'storefrontPhotoUrl')}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Remove file"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-xs">
                              <Upload size={12} className="inline mr-1 text-[#465FFF]" /> {form.storefrontPhotoName ? 'Change' : 'Attach'}
                              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={e => handleFileUpload('storefrontPhotoName', 'storefrontPhotoUrl', e)} />
                            </label>
                          </div>
                        </div>

                        <div className="px-3.5 py-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 hover:border-[#465FFF] dark:hover:border-[#465FFF] transition-all flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {form.dtiDocUrl && (form.dtiDocUrl.startsWith('data:image') || form.dtiDocUrl.startsWith('http') || form.dtiDocUrl.startsWith('/uploads')) ? (
                              <img
                                src={form.dtiDocUrl}
                                alt="DTI Preview"
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#465FFF] to-[#2563EB] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                2
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                DTI Registration Certificate
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {form.dtiDocName ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check size={12} /> {form.dtiDocName}
                                  </span>
                                ) : (
                                  'Photo or scan of DTI Certificate'
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {form.dtiDocName && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFile('dtiDocName', 'dtiDocUrl')}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Remove file"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-xs">
                              <Upload size={12} className="inline mr-1 text-[#465FFF]" /> {form.dtiDocName ? 'Change' : 'Attach'}
                              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileUpload('dtiDocName', 'dtiDocUrl', e)} />
                            </label>
                          </div>
                        </div>

                        <div className="px-3.5 py-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 hover:border-[#465FFF] dark:hover:border-[#465FFF] transition-all flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {form.permitDocUrl && (form.permitDocUrl.startsWith('data:image') || form.permitDocUrl.startsWith('http') || form.permitDocUrl.startsWith('/uploads')) ? (
                              <img
                                src={form.permitDocUrl}
                                alt="Permit Preview"
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#465FFF] to-[#2563EB] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                3
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                Mayor's Business Permit Copy
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {form.permitDocName ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check size={12} /> {form.permitDocName}
                                  </span>
                                ) : (
                                  'Photo of valid permit for Naval LGU'
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {form.permitDocName && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFile('permitDocName', 'permitDocUrl')}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Remove file"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-xs">
                              <Upload size={12} className="inline mr-1 text-[#465FFF]" /> {form.permitDocName ? 'Change' : 'Attach'}
                              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileUpload('permitDocName', 'permitDocUrl', e)} />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400 font-normal">Registering:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[250px]">{form.shopName || 'Printing Shop'} ({selectedServices.length} services)</strong>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ArrowLeft size={16} />
                          <span>Back</span>
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="h-12 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-[#465FFF] via-[#3B50DF] to-[#2563EB] hover:from-[#3B50DF] hover:to-[#1D4ED8] active:scale-[0.98] shadow-[0_4px_16px_rgba(70,95,255,0.3)] hover:shadow-[0_8px_24px_rgba(70,95,255,0.4)] flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>Submit Application</span>
                              <CheckCircle2 size={16} />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Bottom Navigation Links */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px] sm:text-xs">
                    <div className="text-slate-500 dark:text-slate-400">
                      Already have a partner account?{' '}
                      <Link to="/login" className="font-semibold text-[#465FFF] dark:text-[#6881ff] hover:underline">
                        Partner Sign-In
                      </Link>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Looking for student printing?{' '}
                      <Link to="/register" className="font-semibold text-[#465FFF] dark:text-[#6881ff] hover:underline">
                        Customer Sign-Up
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#EBF2FF] dark:bg-[#465FFF]/20 text-[#465FFF] dark:text-[#6881ff] border border-blue-200 dark:border-[#465FFF]/40 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                    <CheckCircle2 size={30} />
                  </div>

                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1 tracking-tight">
                    Application Submitted
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
                    Thank you for applying to partner with PrintDayon. Your application is now in the administrative verification queue.
                  </p>

                  <div className="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-left space-y-2.5 mb-6 text-xs sm:text-sm">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">Application Status</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                        <Clock size={12} /> Under Review
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">Shop Name</span>
                      <span className="font-bold text-[#465FFF] dark:text-[#6881ff]">{form.shopName || 'Printing Shop'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">Address</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                        {form.buildingDetails ? `${form.buildingDetails}, ${form.address}` : (form.address || 'Naval, Biliran')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400 font-normal">Est. Verification</span>
                      <span className="text-[#465FFF] dark:text-[#6881ff] font-bold">Within 24 Hours</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      to="/"
                      className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm no-underline text-center flex items-center justify-center transition-colors"
                    >
                      Back to Home
                    </Link>
                    <Link
                      to="/login"
                      className="h-12 rounded-xl text-white font-bold text-xs sm:text-sm bg-gradient-to-r from-[#465FFF] via-[#3B50DF] to-[#2563EB] hover:from-[#3B50DF] hover:to-[#1D4ED8] no-underline text-center flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(70,95,255,0.3)] hover:shadow-[0_8px_24px_rgba(70,95,255,0.4)]"
                    >
                      Go to Login
                    </Link>
                  </div>
                </div>
              )}
        </div>
      </main>
    </div>
  );
}
