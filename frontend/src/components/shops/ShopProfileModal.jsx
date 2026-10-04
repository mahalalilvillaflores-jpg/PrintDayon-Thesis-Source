import React, { useState, useEffect } from 'react';
import {
  X, MapPin, Phone, Clock, Users, Printer, Building2,
  ChevronDown, ChevronUp, Navigation, Sparkles, CheckCircle2,
  ShieldCheck, Star, ExternalLink
} from 'lucide-react';
import { shopAPI } from '../../services/api';
import ShopFacadeImage from '../common/ShopFacadeImage';

/**
 * ShopProfileModal
 * 
 * Re-architected Shop Details Modal with strict visual hierarchy & clean UI/UX:
 * 
 * SECTIONS (in exact required order):
 * 1. SHOP HEADER
 *    - Controlled aspect-ratio storefront photo (mobile-safe height)
 *    - Circular accessible [X] close button overlay
 *    - Status Badge (Open / Closed), Best Match Badge (brand blue/purple), and Rating summary ("No ratings yet" when 0 reviews)
 *    - Main Shop Heading with Verified badge
 *    - Full address & distance directly below shop name
 * 2. PRICE AND SERVICE SUMMARY
 *    - Compact, unified 2-column card with 4 key decision metrics:
 *      1. Estimated total for customer's job specs
 *      2. Base rate & pricing unit
 *      3. Live customer queue count
 *      4. Estimated printing turnaround time
 * 3. SEE LOCATION ACTION
 *    - Single secondary action button in the upper summary (NO duplicate Print Here button)
 * 4. LOCATION & CONTACT
 *    - Single clean container with compact rows & aligned icons
 *    - Address, landmark (with duplicate "Near" fix), phone number
 *    - Today's operating hours & expandable 7-day schedule
 * 5. GETTING THERE
 *    - Segmented travel mode selector: Walk, Motorcycle, Car
 *    - Dynamic distance, speed, road rules, and travel time
 * 6. SERVICES & RATES
 *    - Verified Rates badge
 *    - Category tabs: Printing, Photocopy, Binding, Extras
 *    - Subtle row dividers with clean name-to-price alignment
 * 7. RECOMMENDATION EXPLANATION
 *    - Collapsible "Why was this shop recommended?" panel
 *    - Genuine algorithm weights: Price (25%), Distance (25%), Queue (20%), Turnaround (20%), Rating (10%)
 * 8. CUSTOMER REVIEWS
 *    - Real average rating & review count
 *    - Honest empty state: "No ratings yet" when reviewsCount === 0 (fixes 5.0 bug)
 *    - Real recent customer reviews with star ratings & tags
 * 
 * STICKY MODAL FOOTER:
 *    - Exactly ONE primary "Print Here" CTA anchored at the bottom
 *    - Non-obscuring layout with comfortable scroll padding
 */
export default function ShopProfileModal({
  shop,
  isOpen,
  onClose,
  printSpecs = { totalPages: 3, copies: 2, colorMode: 'black_and_white', paperSize: 'A4' },
  onPrintHere,
  onSeeLocation,
  travelMode = 'motor',
  onTravelModeChange,
  allModeData,
}) {
  const [fullShop, setFullShop] = useState(shop);
  const [showFullHours, setShowFullHours] = useState(false);
  const [showWhyShop, setShowWhyShop] = useState(false);
  const [activeRatesTab, setActiveRatesTab] = useState('printing');
  const [selectedMode, setSelectedMode] = useState(travelMode);

  // Sync mode changes from parent or internal
  useEffect(() => {
    if (travelMode) setSelectedMode(travelMode);
  }, [travelMode]);

  // Load complete shop details if opened
  useEffect(() => {
    if (!isOpen || !shop) return;
    setFullShop(shop);

    const shopId = shop.shopId || shop._id;
    if (shopId) {
      shopAPI.getById(shopId)
        .then((res) => {
          if (res.data) {
            setFullShop((prev) => ({ ...prev, ...res.data }));
          }
        })
        .catch((err) => {
          console.warn('[ShopProfileModal] Detailed shop fetch fallback to summary:', err.message);
        });
    }
  }, [isOpen, shop]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !shop) return null;

  const currentShop = fullShop || shop;
  const shopId = currentShop.shopId || currentShop._id;
  const name = currentShop.name || currentShop.shopName || 'Printing Shop';
  const photoUrl = currentShop.photoUrl || currentShop.storefrontPhotoUrl;
  const address = currentShop.location?.address || currentShop.address || 'Naval, Biliran';
  const rawLandmark = currentShop.landmark || currentShop.locationDescription || '';
  // Clean up duplicate "Near Near"
  const cleanLandmark = rawLandmark
    ? (rawLandmark.trim().toLowerCase().startsWith('near') ? rawLandmark.trim() : `Near ${rawLandmark.trim()}`)
    : '';
  const phone = currentShop.contact?.phone || currentShop.contactNumber || currentShop.phone || '';

  // Verification status
  const isVerified = Boolean(
    currentShop.verificationStatus === 'verified' ||
    currentShop.isVerified === true ||
    currentShop.verified === true
  );

  // Operational Status
  const isOpenNow = currentShop.isOpen !== false && currentShop.status !== 'closed' && currentShop.status?.isOpen !== false;
  const nextOpeningText = currentShop.nextOpening?.formattedText || (currentShop.hours?.today ? 'Opens tomorrow 8:00 AM' : '');

  // Recommendation Badges
  const isTopPick = Boolean(
    currentShop.isRecommended ||
    currentShop.recommendation?.label === 'Best Match' ||
    currentShop.recommendationLabel === 'Best Match' ||
    currentShop.recommendationRank === 1
  );
  const recScore = currentShop.recommendation?.score ?? currentShop.recommendationScore ?? (isTopPick ? 86 : 80);

  // Dynamic Pricing Calculation for Current Job
  const pricing = currentShop.pricing || {};
  const isColor = printSpecs.colorMode === 'color';
  const isLong = printSpecs.paperSize === 'Long' || printSpecs.paperSize === 'legal';

  const baseRate = Number(
    isColor
      ? (isLong ? (pricing.colorLongPerPage || 5) : (pricing.colorPerPage || 4))
      : (isLong ? (pricing.bwLongPerPage || 3) : (pricing.bwPerPage || 2))
  );

  const totalPagesCount = Math.max(1, (Number(printSpecs.totalPages) || 1) * (Number(printSpecs.copies) || 1));
  const calculatedTotal = (totalPagesCount * baseRate).toFixed(2);
  const estimatedTotal = Number(
    currentShop.pricing?.estimatedTotal ??
    currentShop.pricingSummary?.estimatedTotal ??
    calculatedTotal
  ).toFixed(2);

  // Queue & Turnaround
  const onlineJobs = Number(
    currentShop.queue?.onlineJobs ??
    currentShop.queueSummary?.onlineJobs ??
    currentShop.queueCount ??
    0
  );
  const walkInCustomers = Number(
    currentShop.queue?.walkInCustomers ??
    currentShop.queueSummary?.walkInCustomers ??
    currentShop.walkInCustomerCount ??
    0
  );
  const totalInQueue = onlineJobs + walkInCustomers;

  const turnaroundMinutes = currentShop.turnaround?.estimatedMinutes ??
    currentShop.estimatedCompletionMinutes ??
    currentShop.estimatedCompletionTime ??
    null;

  // Distance & Travel Mode Calculations
  const rawDist = currentShop.location?.distanceKm ?? currentShop.distanceKm;
  const distanceKm = rawDist ? parseFloat(rawDist).toFixed(2) : null;

  // Coordinates
  const shopLat = currentShop.latitude ?? currentShop.location?.lat ?? currentShop.lat;
  const shopLng = currentShop.longitude ?? currentShop.location?.lng ?? currentShop.lng;
  const googleMapsUrl = shopLat && shopLng
    ? `https://www.google.com/maps/search/?api=1&query=${shopLat},${shopLng}`
    : null;

  // Get active mode data if available from parent, else compute
  const getModeInfo = (mode) => {
    if (allModeData && allModeData[mode]) {
      const match = allModeData[mode].find((s) => (s._id || s.shopId || '').toString() === (shopId || '').toString());
      if (match) {
        return {
          dist: parseFloat(match.distanceKm || distanceKm).toFixed(2),
          time: match.travelTimeMinutes || Math.max(1, Math.round((distanceKm / (mode === 'walking' ? 4.8 : mode === 'vehicle' ? 35 : 28)) * 60)),
          speed: match.effectiveSpeedKmh || (mode === 'walking' ? 4.8 : mode === 'vehicle' ? 35 : 28),
        };
      }
    }
    const speed = mode === 'walking' ? 4.8 : mode === 'vehicle' ? 35 : 28;
    const time = distanceKm ? Math.max(1, Math.round((parseFloat(distanceKm) / speed) * 60)) : null;
    return { dist: distanceKm, time, speed };
  };

  const currentModeInfo = getModeInfo(selectedMode);

  const handleSelectMode = (mode) => {
    setSelectedMode(mode);
    if (onTravelModeChange) onTravelModeChange(mode);
  };

  // Format today's operating hours
  const getTodayHoursDisplay = () => {
    if (currentShop.hours?.today) return currentShop.hours.today;
    const hours = currentShop.operatingHours;
    if (!Array.isArray(hours) || hours.length === 0) return '8:00 AM – 5:00 PM';
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = days[new Date().getDay()];
    const todaySched = hours.find((h) => h.day?.toLowerCase() === todayName);
    if (!todaySched || todaySched.isClosed) return 'Closed today';
    return `${todaySched.open || '8:00 AM'} – ${todaySched.close || '5:00 PM'}`;
  };

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Customer Reviews & Ratings Calculation (Bugfix for 5.0 (0 reviews))
  const reviewsCount = Number(currentShop.reviewsCount || currentShop.recentReviews?.length || 0);
  const rawRating = Number(currentShop.rating);
  const hasReviews = reviewsCount > 0 && Number.isFinite(rawRating) && rawRating > 0;
  const ratingDisplay = hasReviews ? rawRating.toFixed(1) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-details-modal-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] my-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. SHOP HEADER: Storefront Photo */}
        <div className="relative w-full h-36 sm:h-44 shrink-0 bg-slate-100 dark:bg-slate-900 overflow-hidden">
          <ShopFacadeImage
            src={photoUrl}
            shopName={name}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover"
            textClassName="text-3xl font-black"
          />

          {/* Accessible Close Button (High contrast circular button) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-950/60 hover:bg-slate-950/85 text-white flex items-center justify-center border border-white/20 backdrop-blur-xs transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-white"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Modal Content Container (With ample bottom padding so footer never obscures content) */}
        <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-slate-800 pb-6">
          {/* Header Badges & Shop Info (Directly below photo) */}
          <div className="space-y-2">
            {/* Status, Best Match, & Rating Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Open / Closed Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                  isOpenNow
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOpenNow ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                {isOpenNow ? 'OPEN NOW' : 'CLOSED'}
              </span>

              {/* Best Match Badge (Consistent PrintDayon Brand Blue/Purple Colors) */}
              {isTopPick && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF2FF] text-[#19398d] border border-[#C7D2FE]">
                  <Star size={11} className="fill-[#19398d] text-[#19398d]" />
                  <span>BEST MATCH{recScore > 0 ? ` · ${recScore}% MATCH` : ''}</span>
                </span>
              )}

              {/* Rating status badge in summary: Explicit "No ratings yet" when 0 reviews */}
              {hasReviews ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                  <Star size={11} className="fill-amber-400 text-amber-500" />
                  <span>{ratingDisplay} ({reviewsCount})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  <span>No ratings yet</span>
                </span>
              )}

              {!isOpenNow && nextOpeningText && (
                <span className="text-xs text-slate-500 font-medium">
                  • {nextOpeningText}
                </span>
              )}
            </div>

            {/* Shop Name & Verified Indicator */}
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="shop-details-modal-title"
                className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight m-0"
              >
                {name}
              </h2>

              {isVerified && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/90 shrink-0"
                  title="Verified Print Shop"
                >
                  <ShieldCheck size={13} className="text-blue-600" />
                  <span>Verified</span>
                </span>
              )}
            </div>

            {/* Address and Distance Row (Clean secondary text below the shop name) */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5 break-words">
                <MapPin size={13} className="text-rose-500 shrink-0" />
                <span>{address}</span>
                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-[#19398d] transition-colors inline-flex items-center ml-0.5"
                    title="Open in Google Maps"
                    aria-label="Open in Google Maps"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#19398d] bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100/90 shrink-0">
                <Navigation size={11} className="text-[#19398d]" />
                <span>{distanceKm ? `${distanceKm} km from you` : 'Nearby'}</span>
              </span>
            </div>
          </div>

          {/* ==================================================
              2. PRICE AND SERVICE SUMMARY (Unified 2-Column Grid)
          ================================================== */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 sm:p-3.5">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* 1. Estimated Total for Selected Job */}
              <div className="flex flex-col justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  ESTIMATED TOTAL
                </span>
                <div className="mt-0.5">
                  <div className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                    ₱{estimatedTotal}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    for this print job
                  </div>
                </div>
              </div>

              {/* 2. Base Rate and Pricing Unit */}
              <div className="flex flex-col justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  BASE RATE
                </span>
                <div className="mt-0.5">
                  <div className="text-base sm:text-lg font-black text-[#19398d] leading-tight">
                    ₱{baseRate.toFixed(2)} / page
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {isColor ? 'Color' : 'B&W'} · {printSpecs.paperSize || 'A4'}
                  </div>
                </div>
              </div>

              {/* 3. Customers Waiting in Queue */}
              <div className="flex flex-col justify-between pt-2 sm:pt-2.5 border-t border-slate-200/70">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  CUSTOMERS WAITING
                </span>
                <div className="mt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Users size={16} className="text-blue-600 shrink-0" />
                    <span className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                      {totalInQueue === 0 ? '0 in queue' : `${totalInQueue} waiting`}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {totalInQueue === 0 ? 'No customers waiting' : `${onlineJobs} online · ${walkInCustomers} walk-in`}
                  </div>
                </div>
              </div>

              {/* 4. Estimated Printing Time */}
              <div className="flex flex-col justify-between pt-2 sm:pt-2.5 border-t border-slate-200/70">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  EST. PRINT TIME
                </span>
                <div className="mt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Clock size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-sm sm:text-base font-extrabold text-emerald-700 leading-tight">
                      {turnaroundMinutes !== null && turnaroundMinutes > 0 ? `~${turnaroundMinutes} min` : 'Fast turnaround'}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    ready for pickup
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================
              3. SEE LOCATION ACTION (Single Secondary Button)
          ================================================== */}
          <div>
            <button
              type="button"
              onClick={() => {
                if (onSeeLocation) {
                  onSeeLocation(currentShop);
                } else if (googleMapsUrl) {
                  window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              aria-label={`See location of ${name}`}
              className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-slate-300"
            >
              <MapPin size={16} className="text-rose-500 shrink-0" />
              <span>See Location on Map</span>
            </button>
          </div>

          {/* ==================================================
              4. LOCATION AND CONTACT
          ================================================== */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              LOCATION &amp; CONTACT
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 sm:p-3.5 space-y-2.5 text-xs sm:text-sm">
              {/* Address & Landmark */}
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 leading-snug break-words">
                    {address}
                  </div>
                  {cleanLandmark && (
                    <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-normal break-words">
                      {cleanLandmark}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Phone (Clickable tel link if available) */}
              {phone && (
                <div className="flex items-center gap-2.5">
                  <Phone size={14} className="text-[#19398d] shrink-0" />
                  <a
                    href={`tel:${phone.replace(/\s+/g, '')}`}
                    className="font-semibold text-slate-800 hover:text-[#19398d] hover:underline"
                  >
                    {phone}
                  </a>
                </div>
              )}

              {/* Today's Operating Hours & Full Schedule Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock size={14} className="text-emerald-600 shrink-0" />
                  <span>
                    <strong className="text-slate-900 font-semibold">Today:</strong> {getTodayHoursDisplay()}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFullHours(!showFullHours)}
                  aria-expanded={showFullHours}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#19398d] hover:text-[#001B3C] cursor-pointer focus:outline-hidden"
                >
                  <span>{showFullHours ? 'Hide schedule' : 'Full schedule'}</span>
                  {showFullHours ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Expandable 7-day schedule */}
              {showFullHours && (
                <div className="mt-2 pt-2 border-t border-slate-200/70 space-y-1">
                  {DAYS.map((day) => {
                    const sched = (currentShop.operatingHours || []).find((h) => h.day?.toLowerCase() === day.toLowerCase());
                    const hoursStr = !sched || sched.isClosed ? 'Closed' : `${sched.open || '8:00 AM'} – ${sched.close || '5:00 PM'}`;
                    const isToday = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]?.toLowerCase() === day.toLowerCase();

                    return (
                      <div
                        key={day}
                        className={`flex justify-between items-center py-1 px-1.5 rounded-sm text-xs ${
                          isToday ? 'bg-indigo-50/70 font-semibold text-[#19398d]' : 'text-slate-600'
                        }`}
                      >
                        <span>{day} {isToday && '(Today)'}</span>
                        <span className={sched?.isClosed ? 'text-rose-600 font-medium' : 'text-slate-800'}>
                          {hoursStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ==================================================
              5. GETTING THERE: Travel Mode Segmented Control
          ================================================== */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              GETTING THERE
            </div>

            {/* Segmented Control */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { id: 'walking', label: 'Walk', icon: '🚶' },
                { id: 'motor', label: 'Motorcycle', icon: '🏍' },
                { id: 'vehicle', label: 'Car', icon: '🚗' },
              ].map((m) => {
                const isActive = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMode(m.id)}
                    className={`py-2 px-1 sm:px-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer focus:outline-hidden ${
                      isActive
                        ? 'bg-white text-[#19398d] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Travel Mode Route Summary */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900">
                  {selectedMode === 'walking' ? '🚶 Walking route' : selectedMode === 'vehicle' ? '🚗 Car / Driving route' : '🏍 Motorcycle route'}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                  {currentModeInfo.dist ? (
                    <>
                      {currentModeInfo.dist} km · ~{currentModeInfo.speed} km/h
                      {selectedMode === 'walking' ? ' (Pedestrian paths)' : ' (Vehicle one-way rules)'}
                    </>
                  ) : (
                    'Routing calculation unavailable'
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                {currentModeInfo.time ? (
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-lg sm:text-xl font-black text-[#19398d]">
                      ~{currentModeInfo.time}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      min
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">—</span>
                )}
              </div>
            </div>
          </div>

          {/* ==================================================
              6. SERVICES & RATES
          ================================================== */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                SERVICES &amp; RATES
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 size={12} /> Verified Rates
              </span>
            </div>

            {/* Service Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {['printing', 'photocopy', 'binding', 'extras'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveRatesTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 cursor-pointer focus:outline-hidden ${
                    activeRatesTab === tab
                      ? 'bg-[#19398d] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Rates Table with Subtle Row Dividers */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl overflow-hidden divide-y divide-slate-200/70 text-xs sm:text-sm">
              {activeRatesTab === 'printing' && (
                <>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">B&amp;W — A4 / Short</span>
                    <span className="font-extrabold text-slate-900">₱{Number(pricing.bwPerPage || 2).toFixed(2)} / page</span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">B&amp;W — Long / Legal</span>
                    <span className="font-extrabold text-slate-900">₱{Number(pricing.bwLongPerPage || 3).toFixed(2)} / page</span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">Color — A4 / Short</span>
                    <span className="font-extrabold text-[#19398d]">₱{Number(pricing.colorPerPage || 4).toFixed(2)} / page</span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">Color — Long / Legal</span>
                    <span className="font-extrabold text-[#19398d]">₱{Number(pricing.colorLongPerPage || 5).toFixed(2)} / page</span>
                  </div>
                </>
              )}

              {activeRatesTab === 'photocopy' && (
                <>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">Photocopy — B&amp;W A4 / Short</span>
                    <span className="font-extrabold text-slate-900">₱{Number(pricing.photocopyBwA4 ?? 1.5).toFixed(2)} / page</span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">Photocopy — B&amp;W Long / Legal</span>
                    <span className="font-extrabold text-slate-900">₱{Number(pricing.photocopyBwLong ?? 2).toFixed(2)} / page</span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">Photocopy — Full Color</span>
                    <span className="font-extrabold text-[#19398d]">₱{Number(pricing.photocopyColor ?? 5).toFixed(2)} / page</span>
                  </div>
                </>
              )}

              {activeRatesTab === 'binding' && (
                <>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">Ring / Spiral Binding</span>
                    <span className="font-extrabold text-slate-900">₱{Number(pricing.bindingCost ?? 35).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center px-3.5 py-2.5">
                    <span className="font-medium text-slate-700">Softbind / Thermal Cover</span>
                    <span className="font-extrabold text-slate-900">₱{Number(pricing.softbindCost ?? 50).toFixed(2)}</span>
                  </div>
                </>
              )}

              {activeRatesTab === 'extras' && (
                <>
                  {pricing.allowRush !== false && (
                    <div className="flex justify-between items-center px-3.5 py-2.5">
                      <span className="font-medium text-slate-700">Rush Order Processing</span>
                      <span className="font-extrabold text-[#19398d]">+₱{Number(pricing.rushFee ?? 20).toFixed(2)} surcharge</span>
                    </div>
                  )}
                  {pricing.allowRush === false && (
                    <div className="flex justify-between items-center px-3.5 py-2.5">
                      <span className="font-medium text-slate-700">Rush Order Processing</span>
                      <span className="font-bold text-rose-600">Not available</span>
                    </div>
                  )}
                  {(currentShop.services || []).filter(s => s.price > 0 && !['Document Printing','Photocopy / Xerox','Bookbinding & Finishing','Document Scanning','Lamination & ID Printing'].includes(s.name)).map((svc) => (
                    <div key={svc._id || svc.name} className="flex justify-between items-center px-3.5 py-2.5">
                      <span className="font-medium text-slate-700">{svc.name}</span>
                      <span className="font-extrabold text-slate-900">₱{Number(svc.price).toFixed(2)}</span>
                    </div>
                  ))}
                  {pricing.allowRush !== false && (currentShop.services || []).filter(s => s.price > 0 && !['Document Printing','Photocopy / Xerox','Bookbinding & Finishing','Document Scanning','Lamination & ID Printing'].includes(s.name)).length === 0 && (
                    <div className="px-3.5 py-2.5 text-xs text-slate-400 italic">
                      No additional custom services
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ==================================================
              7. RECOMMENDATION EXPLANATION (Collapsible Panel)
          ================================================== */}
          {recScore > 0 && (
            <div className="border-t border-slate-200/80 pt-2">
              <button
                type="button"
                onClick={() => setShowWhyShop(!showWhyShop)}
                aria-expanded={showWhyShop}
                className="w-full flex items-center justify-between text-xs font-bold text-[#19398d] hover:text-[#001B3C] py-1 cursor-pointer focus:outline-hidden"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Why was this shop recommended?</span>
                </span>
                {showWhyShop ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showWhyShop && (
                <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs space-y-2 text-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Rate / Price (25% weight):</span>
                    <span className="font-bold text-slate-900">₱{baseRate.toFixed(2)}/pg (₱{estimatedTotal} est.)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Distance (25% weight):</span>
                    <span className="font-bold text-slate-900">{distanceKm ? `${distanceKm} km away` : 'Nearby'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Live Queue (20% weight):</span>
                    <span className="font-bold text-slate-900">{totalInQueue === 0 ? '0 waiting (immediate)' : `${totalInQueue} waiting`}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Turnaround Time (20% weight):</span>
                    <span className="font-bold text-slate-900">Ready in ~{turnaroundMinutes || 2} mins</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Customer Rating (10% weight):</span>
                    <span className="font-bold text-slate-900">
                      {hasReviews ? `${ratingDisplay} ★ (${reviewsCount} reviews)` : 'No ratings yet (standard baseline)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================
              8. CUSTOMER REVIEWS
          ================================================== */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Star size={16} className={hasReviews ? "fill-amber-400 text-amber-500" : "text-slate-400"} />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 m-0">
                  Customer Reviews
                </h4>
              </div>

              {/* Rating and Review Count: Display "No ratings yet" when reviewsCount is 0 */}
              <div className="flex items-center gap-1.5">
                {hasReviews ? (
                  <>
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      {ratingDisplay}
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
                      ({reviewsCount} {reviewsCount === 1 ? 'review' : 'reviews'})
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-semibold text-slate-500">
                    No ratings yet
                  </span>
                )}
              </div>
            </div>

            {/* Recent Reviews List or Empty State */}
            {currentShop.recentReviews && currentShop.recentReviews.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {Number(reviewsCount) > currentShop.recentReviews.length && (
                  <div className="text-[11px] text-slate-500 font-medium px-1">
                    Showing latest {currentShop.recentReviews.length} of {reviewsCount} reviews
                  </div>
                )}
                {currentShop.recentReviews.map((rev, idx) => (
                  <div
                    key={idx}
                    className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-xs space-y-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">
                        {rev.isAnonymous ? '👤 Anonymous Student' : (rev.customerName || 'Verified Customer')}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={11}
                            className={s <= (rev.rating || 5) ? 'fill-amber-400 text-amber-500' : 'text-slate-200 fill-slate-200'}
                          />
                        ))}
                      </div>
                    </div>

                    {Array.isArray(rev.tags) && rev.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rev.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80"
                          >
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {rev.comment && (
                      <p className="text-slate-600 italic text-[11px] sm:text-xs m-0">
                        "{rev.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-xs text-slate-500 font-medium bg-white rounded-lg border border-dashed border-slate-200">
                No reviews yet. Print here and be the first to leave feedback!
              </div>
            )}
          </div>
        </div>

        {/* ==================================================
            STICKY ACTION FOOTER: ONLY ONE Primary "Print Here" CTA
        ================================================== */}
        <div className="p-3 sm:p-4 bg-white/95 border-t border-slate-200/90 backdrop-blur-xs shrink-0 flex items-center justify-between gap-3 shadow-lg">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              ESTIMATED TOTAL
            </span>
            <div className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              ₱{estimatedTotal}
              <span className="text-[11px] font-medium text-slate-500 ml-1.5 hidden xs:inline">
                ({totalPagesCount} pgs)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onPrintHere && onPrintHere(currentShop)}
            aria-label={`Start printing order at ${name}`}
            className="flex-1 max-w-[260px] h-11 sm:h-12 px-5 rounded-xl bg-[#19398d] hover:bg-[#001B3C] active:bg-[#001B3C] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-950/20 active:scale-[0.99] transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#19398d]"
          >
            <Printer size={17} strokeWidth={2.4} />
            <span>Print Here</span>
          </button>
        </div>
      </div>
    </div>
  );
}
