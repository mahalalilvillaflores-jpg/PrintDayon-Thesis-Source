import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MapView from '../../components/map/MapView';
import MapLegend from '../../components/map/MapLegend';
import MultiStageLoader from '../../components/common/MultiStageLoader';
import { recommendationAPI, shopAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import { getRoadPolyline, clearRouteCache } from '../../utils/roadRouting';
import { GpsPositionFilter, matchToRoadNetwork, shouldRecalculateRoute, haversineDistanceMeters } from '../../utils/gpsFilter';
import {
  MapPin, Star, Navigation, RefreshCw, X, Compass, Printer,
  Clock, Users, Phone, Heart, ChevronRight, Store,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import ShopFacadeImage from '../../components/common/ShopFacadeImage';

const SITIO_BUTAY = { lat: 11.56437, lng: 124.39964, name: 'Sitio Butay, P.I. Garcia, Naval', accuracy: 15 };


export function isShopCurrentlyOpen(shop) {
  if (!shop) return false;
  if (shop.isManualClosure || (shop.temporaryClosure?.isClosed && (!shop.temporaryClosure?.reopenAt || new Date() < new Date(shop.temporaryClosure.reopenAt)))) {
    return false;
  }
  if (shop.isOpen !== undefined) {
    return Boolean(shop.isOpen);
  }
  if (shop.isAvailable === false) return false;
  if (shop.status === 'closed' || shop.status === 'temporarily_unavailable') return false;

  if (Array.isArray(shop.operatingHours) && shop.operatingHours.length > 0) {
    try {
      const now = new Date();
      const phDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = days[phDate.getDay()];
      const todaySchedule = shop.operatingHours.find((h) => h.day?.toLowerCase() === currentDay);

      if (!todaySchedule || todaySchedule.isClosed) return false;

      const [openH, openM] = (todaySchedule.open || '08:00').split(':').map(Number);
      const [closeH, closeM] = (todaySchedule.close || '17:00').split(':').map(Number);
      const nowMins = phDate.getHours() * 60 + phDate.getMinutes();
      const openMins = openH * 60 + openM;
      const closeMins = closeH * 60 + closeM;

      return nowMins >= openMins && nowMins < closeMins;
    } catch {
      return false;
    }
  }

  return shop.status === 'open' || shop.status === 'busy';
}

export function formatDistanceText(distanceMeters, distanceKm) {
  let m = null;
  if (distanceMeters !== undefined && distanceMeters !== null && !isNaN(distanceMeters) && Number(distanceMeters) > 0) {
    m = Math.round(Number(distanceMeters));
  } else if (distanceKm !== undefined && distanceKm !== null && !isNaN(distanceKm) && Number(distanceKm) > 0) {
    m = Math.round(Number(distanceKm) * 1000);
  }
  if (m === null) return 'Distance unavailable';
  if (m < 1000) {
    return `${m} m away`;
  }
  return `${(m / 1000).toFixed(2)} km away`;
}

export function formatTravelEstimate(travelMinutes, travelMode = 'walking') {
  if (travelMinutes === null || travelMinutes === undefined || isNaN(travelMinutes)) {
    return null;
  }
  const mins = Math.max(1, Math.round(Number(travelMinutes)));
  if (mins > 1440) return null; // Over 24 hours, hide unrealistic estimates

  const unit = mins === 1 ? 'min' : 'mins';
  if (travelMode === 'walking') {
    return `About ${mins} ${unit} walk`;
  }
  if (travelMode === 'vehicle') {
    return `About ${mins} ${unit} by Car`;
  }
  return `About ${mins} ${unit} by Motor`;
}

export function getShopHoursDisplay(operatingHours) {
  if (!Array.isArray(operatingHours) || operatingHours.length === 0) return 'Opening hours: 8:00 AM–5:00 PM';
  try {
    const now = new Date();
    const phDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[phDate.getDay()];
    const todaySchedule = operatingHours.find((h) => h.day?.toLowerCase() === currentDay);

    if (!todaySchedule || todaySchedule.isClosed) {
      return 'Opening hours: Closed today';
    }

    const fmt = (t) => {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    return `Opening hours: ${fmt(todaySchedule.open)}–${fmt(todaySchedule.close)}`;
  } catch {
    return 'Opening hours: 8:00 AM–5:00 PM';
  }
}

function ShopPreviewCard({ shop, onClose, onPrintHere, travelMode, isRecommended, onSwitchToRecommended, onOpenSearch }) {
  const navigate = useNavigate();
  const [isMobileExpanded, setIsMobileExpanded] = useState(true);
  const [isFavorite, setIsFavorite] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('printdayon_favorite_shops') || '[]');
      const shopId = (shop?._id || shop?.shopId || shop?.name || '').toString();
      return saved.includes(shopId);
    } catch (_) {
      return false;
    }
  });

  if (!shop) return null;

  const handleViewShop = () => {
    const sId = shop._id || shop.shopId || shop.id;
    if (sId) {
      navigate(`/shop/${sId}`);
    }
  };

  const handleToggleFavorite = () => {
    setIsFavorite((prev) => {
      const next = !prev;
      try {
        const saved = JSON.parse(localStorage.getItem('printdayon_favorite_shops') || '[]');
        const shopId = (shop._id || shop.shopId || shop.name || '').toString();
        let updated;
        if (next) {
          updated = Array.from(new Set([...saved, shopId]));
          toast.success(`Saved to favorites`, { id: 'fav-toast', duration: 1500 });
        } else {
          updated = saved.filter((id) => id !== shopId);
          toast.success(`Removed from favorites`, { id: 'fav-toast', duration: 1500 });
        }
        localStorage.setItem('printdayon_favorite_shops', JSON.stringify(updated));
      } catch (_) {}
      return next;
    });
  };

  const isOpen = isShopCurrentlyOpen(shop);
  const name = shop.shopName || shop.name || 'Printing Shop';
  const photoUrl = shop.photoUrl || shop.storefrontPhotoUrl || null;
  const isVerified = shop.verificationStatus === 'verified' || shop.isVerified === true;

  // Real database rating: if shop has 0 reviews, display 'No ratings yet'
  const rating = shop.averageRating ?? shop.rating ?? null;
  const reviewCount = Number(shop.reviewCount ?? shop.totalReviews ?? shop.reviewsCount ?? 0);
  const hasReviews = Boolean(shop.hasReviews || (reviewCount > 0 && rating !== null && Number(rating) > 0));
  const ratingVal = hasReviews ? Number(rating).toFixed(1) : null;

  const isTopPick = Boolean(
    shop.isRecommended ||
    shop.recommendation?.label === 'Best Match' ||
    shop.recommendationLabel === 'Best Match'
  );

  const pricing = shop.pricing || {};
  const baseRate = pricing.bwPerPage !== undefined
    ? Number(pricing.bwPerPage).toFixed(2)
    : (shop.ratePerPage ? Number(shop.ratePerPage).toFixed(2) : '2.00');

  const travelMinutes = shop.travelTimeMinutes ?? shop.estimatedTravelMinutes ?? null;

  // Real Queue count confirmed from database
  const onlineJobs = Number(shop.queue?.onlineJobs ?? shop.queueSummary?.onlineJobs ?? shop.onlineJobs ?? 0);
  const walkInCustomers = Number(shop.queue?.walkInCustomers ?? shop.queueSummary?.walkInCustomers ?? shop.walkInCustomerCount ?? 0);
  const totalInQueue = shop.totalInQueue !== undefined
    ? Number(shop.totalInQueue)
    : (shop.currentQueue !== undefined ? Number(shop.currentQueue) : (onlineJobs + walkInCustomers));

  // Real service time / turnaround calculation
  const turnaroundMinutes = shop.serviceTimeMinutes ?? shop.turnaround?.estimatedMinutes ?? shop.estimatedCompletionMinutes ?? shop.estimatedCompletionTime ?? null;
  let serviceEstimateText = 'Unavailable';
  if (!isOpen) {
    serviceEstimateText = 'Shop closed';
  } else if (turnaroundMinutes !== null && turnaroundMinutes !== undefined && !isNaN(turnaroundMinutes) && Number(turnaroundMinutes) > 0) {
    const mins = Math.max(1, Math.round(Number(turnaroundMinutes)));
    if (mins >= 5) {
      const minRange = Math.max(1, Math.round(mins * 0.8));
      const maxRange = Math.max(minRange + 1, Math.round(mins * 1.2));
      serviceEstimateText = `${minRange}–${maxRange} minutes`;
    } else {
      serviceEstimateText = `About ${mins} minute${mins === 1 ? '' : 's'}`;
    }
  }

  // Distance formatting
  const distanceKmVal = parseFloat(shop.distanceKm || (shop.distanceMeters ? shop.distanceMeters / 1000 : shop.location?.distanceKm) || 0);
  const distanceFormatted = distanceKmVal < 1 && distanceKmVal > 0
    ? `${Math.round(distanceKmVal * 1000)} m`
    : `${distanceKmVal.toFixed(1)} km`;

  const travelEstimateFormatted = formatTravelEstimate(travelMinutes, travelMode);

  const address = shop.location?.address || shop.address || 'Naval, Biliran';
  const rawLandmark = shop.landmark || shop.locationDescription || '';
  const landmark = rawLandmark
    ? rawLandmark
        .replace(/Near the school \(BiPSU - Biliran Province State University Main Campus\)/i, 'Near BiPSU Main Campus')
        .replace(/Near the school \(BiPSU & Cathedral School of La Naval\)/i, 'Near BiPSU & Cathedral School')
    : address;
  const hoursText = getShopHoursDisplay(shop.operatingHours);

  let availableServices = [];
  if (Array.isArray(shop.services) && shop.services.length > 0) {
    availableServices = shop.services
      .filter((s) => s.available !== false && s.name && !/hardbound/i.test(s.name))
      .map((s) => s.name);
  }
  if (availableServices.length === 0) {
    availableServices.push('Printing');
    if (pricing.photocopyBwA4 || pricing.photocopyBwLong || pricing.photocopyColor) {
      availableServices.push('Photocopy');
    }
    if (pricing.bindingCost || pricing.softbindCost) {
      availableServices.push('Bookbinding');
    }
  }

  const formatServiceName = (sName) => {
    if (/photocopy/i.test(sName)) return 'Photocopy';
    if (/softbind|spiral|ring|bookbinding|binding/i.test(sName)) return 'Bookbinding';
    if (/scanning/i.test(sName)) return 'Scanning';
    if (/lamination/i.test(sName)) return 'Lamination';
    if (/document printing|printing/i.test(sName)) return 'Printing';
    return sName;
  };

  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      {/* DESKTOP / LAPTOP / TABLET FLOATING CARD (>= 768px) */}
      <div
        className="hidden md:flex absolute top-3 right-3 md:top-4 md:right-4 z-30 w-[315px] lg:w-[340px] xl:w-[370px] max-h-[calc(100vh-120px)] md:max-h-[calc(100%-32px)] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 transition-all duration-200 font-outfit"
      >
        {/* Top Header Row with Square Thumbnail, Badges, Title, Rating, and Actions */}
        <div className="p-4 pb-3 flex items-start gap-3 bg-white dark:bg-gray-900 shrink-0">
          {/* Shop Photo Thumbnail */}
          <div className="w-14 h-14 xl:w-16 xl:h-16 rounded-2xl overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 shadow-xs">
            <ShopFacadeImage
              src={photoUrl}
              shopName={name}
              className="w-full h-full"
              textClassName="text-sm xl:text-base font-bold"
            />
          </div>

          {/* Shop Info & Badges */}
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isOpen
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isOpen ? 'Open' : 'Closed'}
              </span>

              {isVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60">
                  ✓ Verified
                </span>
              )}

              {isOpen && shop.operationalCondition && shop.operationalCondition !== 'normal' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80">
                  {shop.operationalCondition === 'high_walkin'
                    ? 'High Demand'
                    : shop.operationalCondition === 'equipment_problem'
                    ? 'Maintenance'
                    : shop.operationalCondition === 'power_interruption'
                    ? 'Power Outage'
                    : 'Service Delay'}
                  {Number(shop.operationalDelayMinutes) > 0 && ` (+${shop.operationalDelayMinutes}m)`}
                </span>
              )}

              {isTopPick ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200/60">
                  <Star size={10} fill="currentColor" strokeWidth={0} /> No. 1 Best Match
                </span>
              ) : onSwitchToRecommended ? (
                <button
                  type="button"
                  onClick={onSwitchToRecommended}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200/60 transition-colors cursor-pointer"
                  title="Switch to system-recommended store"
                >
                  <Star size={10} className="shrink-0" /> Switch to Best Match
                </button>
              ) : null}
            </div>

            {/* Shop Name */}
            <h3 className="text-sm xl:text-base font-bold text-gray-900 dark:text-white leading-snug mt-1 truncate" title={name}>
              {name}
            </h3>

            {/* Landmark / Subtitle (Complete, no truncated ellipsis like in photo) */}
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5 break-words" title={landmark}>
              {landmark}
            </p>

            {/* Rating */}
            <div className="flex items-center gap-1 mt-1 text-xs">
              {hasReviews ? (
                <>
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span className="font-bold text-gray-900 dark:text-white">{ratingVal}</span>
                  <span className="text-gray-400 font-normal">({reviewCount} review{reviewCount === 1 ? '' : 's'})</span>
                </>
              ) : (
                <span className="text-[11px] text-gray-400 font-normal">No ratings yet</span>
              )}
            </div>
          </div>

          {/* Top-right Search, Heart & Close actions */}
          <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Search other print shops"
              >
                <Search size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
              title="Save to favorites"
            >
              <Heart size={14} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center transition-colors cursor-pointer"
              title="Close card"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 dark:bg-gray-800 shrink-0" />

        {/* Scrollable Information Body */}
        <div className="p-4 py-3 flex flex-col gap-3 overflow-y-auto flex-1 font-outfit text-xs text-gray-700 dark:text-gray-300">
          {/* Operational Advisory Banner */}
          {isOpen && shop.operationalCondition && shop.operationalCondition !== 'normal' && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs shadow-2xs">
              <div className="flex items-center justify-between font-bold text-[11px]">
                <span>
                  {shop.operationalCondition === 'high_walkin'
                    ? 'High Counter Demand'
                    : shop.operationalCondition === 'equipment_problem'
                    ? 'Equipment Maintenance'
                    : shop.operationalCondition === 'power_interruption'
                    ? 'Power Interruption'
                    : 'Operational Delay'}
                </span>
                {Number(shop.operationalDelayMinutes) > 0 && (
                  <span className="font-extrabold text-amber-900 dark:text-amber-100">
                    +{shop.operationalDelayMinutes}m delay
                  </span>
                )}
              </div>
              {shop.operationalMessage && (
                <p className="mt-1 text-[11px] italic text-amber-900/90 dark:text-amber-300 m-0">
                  &ldquo;{shop.operationalMessage}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Temporary Closure Banner */}
          {!isOpen && (shop.isManualClosure || shop.closureReason || shop.advisoryMessage) && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs shadow-2xs">
              <div className="font-bold text-[11px]">
                Temporarily Closed {shop.closureReason ? `• ${shop.closureReason}` : ''}
              </div>
              {shop.advisoryMessage && (
                <p className="mt-1 text-[11px] italic text-rose-900/90 dark:text-rose-300 m-0">
                  &ldquo;{shop.advisoryMessage}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Row 1: Distance & Walk/Drive time */}
          <div className="flex items-center gap-2.5">
            <span className="text-gray-400 shrink-0 text-sm">
              {travelMode === 'walking' ? '🚶' : travelMode === 'vehicle' ? '🚗' : '🏍️'}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {distanceFormatted} <span className="text-gray-300 dark:text-gray-600 mx-1">·</span> {travelEstimateFormatted || 'Travel time unavailable'}
            </span>
          </div>

          {/* Row 2: People waiting */}
          <div className="flex items-center gap-2.5">
            <Users size={14} className="text-gray-400 shrink-0" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              People waiting: <strong className="font-bold text-gray-900 dark:text-white">{totalInQueue !== undefined && totalInQueue !== null && !isNaN(totalInQueue) ? totalInQueue : 'Unavailable'}</strong>
            </span>
          </div>

          {/* Row 3: Estimated service time */}
          <div className="flex items-center gap-2.5">
            <Clock size={14} className="text-gray-400 shrink-0" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Estimated service time: <strong className="font-bold text-gray-900 dark:text-white">{serviceEstimateText}</strong>
            </span>
          </div>

          {/* Row 4: Opening hours with chevron */}
          <div className="flex items-center justify-between gap-2 p-2 bg-gray-50/80 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800/80">
            <div className="flex items-center gap-2 min-w-0">
              <Clock size={14} className="text-gray-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-gray-900 dark:text-white text-[11px] leading-tight">Opening hours</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{hoursText.replace('Opening hours: ', '')}</span>
              </div>
            </div>
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
          </div>

          {/* Row 5: Services */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-gray-400">Services</span>
            <div className="flex flex-wrap gap-1.5">
              {availableServices.map((svc, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40"
                >
                  {formatServiceName(svc)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar: Base rate + View Shop & Order Print buttons */}
        <div className="p-4 pt-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Base rate</div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg xl:text-xl font-extrabold text-gray-900 dark:text-white">₱{baseRate}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">/page</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleViewShop}
              className="py-2.5 px-3.5 rounded-xl text-xs xl:text-sm font-bold transition-all flex items-center gap-1 cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200/60 dark:border-gray-700"
              title="View full shop profile, services, and reviews"
            >
              <span>View Shop</span>
            </button>
            <button
              type="button"
              onClick={() => onPrintHere(shop)}
              className="py-2.5 px-4 rounded-xl text-xs xl:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-blue-500/20"
              title="Proceed to submit print order"
            >
              <span>{isOpen ? 'Order Print' : 'Order Print (Closed)'}</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM SHEET (< 768px) */}
      <div
        className="flex md:hidden fixed inset-x-3 bottom-3 z-30 max-h-[82vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 transition-all duration-200 font-outfit"
      >
        {/* Drag handle */}
        <button
          type="button"
          onClick={() => setIsMobileExpanded((prev) => !prev)}
          className="w-full flex items-center justify-center pt-2 pb-1 focus:outline-none cursor-pointer"
          title={isMobileExpanded ? 'Tap to collapse details' : 'Tap to expand details'}
        >
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors" />
        </button>

        {/* Mobile Header Row */}
        <div className="px-3.5 py-2 flex items-start gap-2.5 bg-white dark:bg-gray-900 shrink-0">
          {/* Square thumbnail */}
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={name}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm">
                {initials}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                isOpen
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isOpen ? 'Open' : 'Closed'}
              </span>

              {isVerified && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60">
                  ✓ Verified
                </span>
              )}

              {isOpen && shop.operationalCondition && shop.operationalCondition !== 'normal' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80">
                  {shop.operationalCondition === 'high_walkin'
                    ? 'High Demand'
                    : shop.operationalCondition === 'equipment_problem'
                    ? 'Maintenance'
                    : shop.operationalCondition === 'power_interruption'
                    ? 'Power Outage'
                    : 'Service Delay'}
                  {Number(shop.operationalDelayMinutes) > 0 && ` (+${shop.operationalDelayMinutes}m)`}
                </span>
              )}

              {isTopPick ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200/60">
                  <Star size={10} fill="currentColor" strokeWidth={0} /> No. 1 Best Match
                </span>
              ) : onSwitchToRecommended ? (
                <button
                  type="button"
                  onClick={onSwitchToRecommended}
                  className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400 border border-brand-200/60 transition-colors cursor-pointer"
                  title="Switch to system-recommended store"
                >
                  <Star size={10} className="shrink-0" /> Switch to Best Match
                </button>
              ) : null}
            </div>

            <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight mt-0.5 truncate">
              {name}
            </h3>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5 break-words" title={landmark}>
              {landmark}
            </p>

            <div className="flex items-center gap-1 mt-0.5 text-[11px]">
              {hasReviews ? (
                <>
                  <Star size={11} className="text-amber-400 fill-amber-400" />
                  <span className="font-bold text-gray-900 dark:text-white">{ratingVal}</span>
                  <span className="text-gray-400">({reviewCount})</span>
                </>
              ) : (
                <span className="text-gray-400">No ratings yet</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Search other stores"
              >
                <Search size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleFavorite}
              className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Heart size={14} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 dark:bg-gray-800 shrink-0" />

        {/* Scrollable Mobile Body when Expanded */}
        {isMobileExpanded && (
          <div className="px-3.5 py-2.5 flex flex-col gap-2.5 overflow-y-auto flex-1 font-outfit text-xs animate-in fade-in duration-200">
            {/* Operational Advisory Banner (Mobile) */}
            {isOpen && shop.operationalCondition && shop.operationalCondition !== 'normal' && (
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs">
                <div className="flex items-center justify-between font-bold text-[10px]">
                  <span>
                    {shop.operationalCondition === 'high_walkin'
                      ? 'High Counter Demand'
                      : shop.operationalCondition === 'equipment_problem'
                      ? 'Equipment Maintenance'
                      : shop.operationalCondition === 'power_interruption'
                      ? 'Power Interruption'
                      : 'Operational Delay'}
                  </span>
                  {Number(shop.operationalDelayMinutes) > 0 && (
                    <span className="font-extrabold text-amber-900 dark:text-amber-100">
                      +{shop.operationalDelayMinutes}m delay
                    </span>
                  )}
                </div>
                {shop.operationalMessage && (
                  <p className="mt-0.5 text-[10px] italic text-amber-900/90 dark:text-amber-300 m-0">
                    &ldquo;{shop.operationalMessage}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Temporary Closure Banner (Mobile) */}
            {!isOpen && (shop.isManualClosure || shop.closureReason || shop.advisoryMessage) && (
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs">
                <div className="font-bold text-[10px]">
                  Temporarily Closed {shop.closureReason ? `• ${shop.closureReason}` : ''}
                </div>
                {shop.advisoryMessage && (
                  <p className="mt-0.5 text-[10px] italic text-rose-900/90 dark:text-rose-300 m-0">
                    &ldquo;{shop.advisoryMessage}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* 3-Column Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 bg-gray-50/90 dark:bg-gray-800/50 p-2 rounded-xl border border-gray-100 dark:border-gray-800">
              {/* Col 1 */}
              <div className="flex flex-col items-center text-center">
                <span className="text-sm leading-none mb-1">
                  {travelMode === 'walking' ? '🚶' : travelMode === 'vehicle' ? '🚗' : '🏍️'}
                </span>
                <span className="text-[11px] font-bold text-gray-900 dark:text-white leading-tight">{distanceFormatted}</span>
                <span className="text-[10px] text-gray-400 truncate max-w-full">{travelEstimateFormatted || 'Travel time'}</span>
              </div>

              {/* Col 2 */}
              <div className="flex flex-col items-center text-center border-l border-r border-gray-200/60 dark:border-gray-700/60 px-1">
                <Users size={14} className="text-gray-400 mb-1" />
                <span className="text-[10px] text-gray-400 leading-tight">People waiting</span>
                <span className="text-[11px] font-bold text-gray-900 dark:text-white mt-0.5">{totalInQueue !== undefined && totalInQueue !== null && !isNaN(totalInQueue) ? totalInQueue : '-'}</span>
              </div>

              {/* Col 3 */}
              <div className="flex flex-col items-center text-center">
                <Clock size={14} className="text-gray-400 mb-1" />
                <span className="text-[10px] text-gray-400 leading-tight">Est. service time</span>
                <span className="text-[11px] font-bold text-gray-900 dark:text-white mt-0.5 truncate max-w-full">{serviceEstimateText}</span>
              </div>
            </div>

            {/* Opening Hours */}
            <div className="flex items-center justify-between gap-2 p-2 bg-gray-50/80 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5 min-w-0">
                <Clock size={13} className="text-gray-400 shrink-0" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  <strong className="text-gray-900 dark:text-white font-bold mr-1">Opening hours:</strong>
                  {hoursText.replace('Opening hours: ', '')}
                </span>
              </div>
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
            </div>

            {/* Services Tags */}
            <div className="flex flex-wrap gap-1">
              {availableServices.map((svc, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40"
                >
                  {formatServiceName(svc)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Bottom Rate & CTA */}
        <div className="px-3.5 py-2.5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-[9px] uppercase font-bold tracking-wider text-gray-400">Base rate</div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-base font-extrabold text-gray-900 dark:text-white">₱{baseRate}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">/page</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleViewShop}
              className="py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200/60 dark:border-gray-700"
              title="View full shop profile and reviews"
            >
              <span>View Shop</span>
            </button>
            <button
              type="button"
              onClick={() => onPrintHere(shop)}
              className="py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm"
              title="Proceed to submit print order"
            >
              <span>{isOpen ? 'Order Print' : 'Order (Closed)'}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FindShopPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { socket } = useSocket() || {};

  useEffect(() => {
    try {
      localStorage.removeItem('printdayon_customer_loc');
    } catch (_) { }
  }, []);

  const [location, setLocation] = useState(SITIO_BUTAY);
  const [locationStatus, setLocationStatus] = useState('detected');
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [locationMessage, setLocationMessage] = useState('Location: Sitio Butay, Naval');

  // GPS Filter & Route Throttle Refs (Phase 1, 2, 5)
  const gpsFilterRef = useRef(new GpsPositionFilter());
  const watchIdRef = useRef(null);
  const activeRouteAbortControllerRef = useRef(null);
  const lastRoutedLocRef = useRef(null);
  const lastRoutedShopIdRef = useRef(null);
  const lastTravelModeRef = useRef(null);

  const [specs, setSpecs] = useState({
    copies: 1,
    totalPages: 10,
    colorMode: 'black_and_white',
    sided: 'single',
    paperSize: 'A4',
    binding: 'none',
  });

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [activeRoute, setActiveRoute] = useState([]);
  const [alternativeRoute, setAlternativeRoute] = useState([]);
  const [routeStats, setRouteStats] = useState({
    distanceMeters: 0,
    durationSeconds: 0,
  });

  const [travelMode, setTravelMode] = useState('motor');

  const [searchQuery, setSearchQuery] = useState(routerLocation.state?.searchQuery || '');
  const [showSearch, setShowSearch] = useState(Boolean(routerLocation.state?.searchQuery));
  const [allCatalogShops, setAllCatalogShops] = useState([]);

  const [allModeData, setAllModeData] = useState({
    walking: [],
    motor: [],
    vehicle: [],
  });

  const activeShops = useMemo(() => {
    return allModeData[travelMode]?.length > 0
      ? allModeData[travelMode]
      : shops;
  }, [allModeData, travelMode, shops]);

  const TRAVEL_MODES = [
    { key: 'walking', label: 'Walk', desc: 'On foot (4.5 km/h) • Follows pedestrian sidewalks & campus walkways' },
    { key: 'motor', label: 'Motorcycle', desc: 'Motorcycle (25 km/h) • Obeys vehicular one-way road flow' },
    { key: 'vehicle', label: 'Car', desc: 'Car / Vehicle (22 km/h) • Strictly follows one-way road loops' },
  ];

  const updateActiveRoute = useCallback(async (shop, currentLoc, mode) => {
    const loc = currentLoc || location;
    if (!shop || !loc) return;
    const shopCoords = {
      lat: shop.latitude ?? shop.lat ?? shop.location?.coordinates?.[1],
      lng: shop.longitude ?? shop.lng ?? shop.location?.coordinates?.[0],
    };
    if (!shopCoords.lat || !shopCoords.lng) return;

    const activeMode = mode || travelMode;

    // Use the actual accepted customer GPS position directly for route origin
    // Do not fabricate or snap customer across streets artificially
    const originCoords = { lat: loc.lat, lng: loc.lng };

    // Use shop's pre-calculated path coordinates if available, otherwise wait for calculated route
    let dijkstraCoords = (shop.pathCoordinates && shop.pathCoordinates.length >= 2)
      ? shop.pathCoordinates
      : [];

    if (dijkstraCoords.length >= 2) {
      setActiveRoute(dijkstraCoords);
    }
    setRouteStats({
      distanceMeters: shop.distanceMeters || Math.round((parseFloat(shop.distanceKm) || 0) * 1000) || 250,
      durationSeconds: (shop.travelTimeMinutes || 2) * 60,
    });

    // Cancel in-flight route requests to prevent race condition overrides (Phase 5)
    if (activeRouteAbortControllerRef.current) {
      activeRouteAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeRouteAbortControllerRef.current = abortController;

    // Query backend Dijkstra route to guarantee shortest path along Naval road network
    const shopId = shop._id || shop.shopId;
    if (shopId && originCoords.lat && originCoords.lng) {
      try {
        const routeRes = await recommendationAPI.getRoute(shopId, {
          lat: originCoords.lat,
          lng: originCoords.lng,
          travelMode: activeMode,
        });
        if (abortController.signal.aborted) return;
        const rData = routeRes?.data?.data || routeRes?.data;
        if (rData && rData.pathCoordinates && rData.pathCoordinates.length >= 2) {
          dijkstraCoords = rData.pathCoordinates;
          setActiveRoute(dijkstraCoords);
          const distM = rData.distanceMeters || Math.round((parseFloat(rData.distanceKm) || 0) * 1000);
          setRouteStats({
            distanceMeters: distM,
            durationSeconds: (rData.travelTimeMinutes || 2) * 60,
          });
          if (rData.distanceKm) {
            setSelectedShop((prev) => {
              if (!prev || (prev._id !== shopId && prev.shopId !== shopId)) return prev;
              return {
                ...prev,
                distanceKm: rData.distanceKm,
                distanceMeters: distM,
                travelTimeMinutes: rData.travelTimeMinutes,
              };
            });
          }
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.warn('Backend Dijkstra route notice:', err);
        }
      }
    }

    try {
      const roadData = await getRoadPolyline(originCoords, shopCoords, dijkstraCoords, activeMode);
      if (abortController.signal.aborted) return;
      if (roadData && roadData.coordinates && roadData.coordinates.length >= 2) {
        setActiveRoute(roadData.coordinates);
        if (roadData.alternativeCoordinates && roadData.alternativeCoordinates.length >= 2) {
          setAlternativeRoute(roadData.alternativeCoordinates);
        }
        if (roadData.distanceMeters > 0) {
          setRouteStats({
            distanceMeters: roadData.distanceMeters,
            durationSeconds: roadData.durationSeconds,
            alternativeDistanceMeters: roadData.alternativeDistanceMeters,
            alternativeDurationSeconds: roadData.alternativeDurationSeconds,
            savingsMeters: roadData.savingsMeters,
          });
        }
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.warn('Road routing polyline error, falling back to Dijkstra path:', err);
      }
    }
  }, [location, travelMode]);

  const handleTravelModeChange = useCallback((mode) => {
    setTravelMode(mode);
    clearRouteCache();

    const modeShops = allModeData[mode] || [];
    if (modeShops.length > 0) {
      setShops(modeShops);
      let updatedShop = null;
      if (selectedShop) {
        const selId = (selectedShop.shopId || selectedShop._id)?.toString();
        updatedShop = modeShops.find(
          (s) => (s.shopId || s._id)?.toString() === selId
        );
      }
      if (!updatedShop) {
        updatedShop = modeShops.find((s) => s.isRecommended) || modeShops[0];
      }
      if (updatedShop) {
        setSelectedShop(updatedShop);
        updateActiveRoute(updatedShop, location, mode);
      }
    } else if (location) {
      recommendationAPI.getRankedShops({
        latitude: location.lat,
        longitude: location.lng,
        limit: 5,
        travelMode: mode,
        ...specs,
      }).then((res) => {
        const fetched = res.ranked || res.shops || res.data?.ranked || res.data?.shops || [];
        if (fetched.length > 0) {
          setAllModeData((prev) => ({ ...prev, [mode]: fetched }));
          setShops(fetched);
          const selId = (selectedShop?.shopId || selectedShop?._id)?.toString();
          const target = selId
            ? fetched.find((s) => (s.shopId || s._id)?.toString() === selId) || fetched[0]
            : fetched.find((s) => s.isRecommended) || fetched[0];
          setSelectedShop(target);
          updateActiveRoute(target, location, mode);
        }
      }).catch(console.error);
    }
  }, [selectedShop, allModeData, location, specs, updateActiveRoute]);

  const handleNewGpsReading = useCallback((pos) => {
    if (!pos || !pos.coords) return;
    const { latitude, longitude, accuracy } = pos.coords;
    const timestamp = pos.timestamp || Date.now();

    const filterResult = gpsFilterRef.current.filterPosition({
      lat: latitude,
      lng: longitude,
      accuracy,
      timestamp,
    });

    if (filterResult.accepted && filterResult.position) {
      const filtered = filterResult.position;

      setLocation((prev) => {
        if (prev && prev.lat === filtered.lat && prev.lng === filtered.lng && prev.accuracy === filtered.accuracy) {
          return prev; // Prevent unnecessary React rerender if stationary
        }
        return {
          lat: filtered.lat,
          lng: filtered.lng,
          accuracy: filtered.accuracy,
          timestamp,
        };
      });
      setLocationAccuracy(filtered.accuracy);
      setLocationStatus('detected');

      const accM = Math.round(filtered.accuracy);
      if (filtered.accuracy > 40) {
        setLocationMessage(`GPS (Low accuracy ±${accM}m): ${filtered.lat.toFixed(5)}, ${filtered.lng.toFixed(5)}`);
      } else {
        setLocationMessage(`GPS locked (±${accM}m): ${filtered.lat.toFixed(5)}, ${filtered.lng.toFixed(5)}`);
      }
    }
  }, []);

  const getLocation = useCallback((isManual = false) => {
    setLocationStatus('detecting');
    setLocationMessage('Acquiring high-precision GPS coordinates…');

    if (!navigator.geolocation) {
      setLocation(SITIO_BUTAY);
      setLocationStatus('detected');
      setLocationMessage('Location fallback: Sitio Butay, Naval (Browser GPS unsupported)');
      toast.error('Browser GPS not supported.');
      return;
    }

    // Step 1 & 2: Avoid running duplicate GPS watchers
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // High accuracy positioning with maximumAge: 0 to eliminate stale/cached browser readings
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        handleNewGpsReading(pos);
        if (isManual) {
          toast.success(`GPS updated (±${Math.round(pos.coords.accuracy || 10)}m)`, { id: 'gps-locked-toast', duration: 2000 });
        }
      },
      (err) => {
        console.warn('GPS watcher notice/error:', err);
        if (isManual) {
          if (err.code === 1) {
            toast.error('Location permission denied in browser settings.');
          } else if (err.code === 2) {
            toast.error('GPS position unavailable. Check device GPS/location service.');
          } else if (err.code === 3) {
            toast.error('GPS acquisition timed out.');
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }, [handleNewGpsReading]);

  const fetchAllModes = useCallback(async () => {
    if (!location) return;
    setLoading(true);
    try {
      const baseParams = {
        latitude: location.lat,
        longitude: location.lng,
        limit: 5,
        ...specs,
      };

      const extract = (res) => {
        if (!res) return [];
        const list = (
          res?.ranked ||
          res?.shops ||
          res?.data?.ranked ||
          res?.data?.shops ||
          (Array.isArray(res?.data) ? res.data : null) ||
          (Array.isArray(res) ? res : null) ||
          []
        );
        return Array.isArray(list) ? list : [];
      };

      // 1. Fetch current active mode first for fast initial display
      let currentModeShops = [];
      try {
        const activeRes = await recommendationAPI.getRankedShops({ ...baseParams, travelMode });
        currentModeShops = extract(activeRes);
      } catch (recErr) {
        console.warn('Ranked shops query notice:', recErr);
      }

      if (currentModeShops.length > 0) {
        setAllModeData((prev) => ({ ...prev, [travelMode]: currentModeShops }));
        setShops(currentModeShops);

        const targetShopId = routerLocation.state?.selectedShopId || routerLocation.state?.shop?._id || routerLocation.state?.shop?.shopId;
        const searchQ = routerLocation.state?.searchQuery?.toLowerCase()?.trim();
        const matchedShop = targetShopId
          ? currentModeShops.find((s) => (s._id || s.shopId || '').toString() === targetShopId.toString())
          : (searchQ
            ? currentModeShops.find((s) => s.shopName?.toLowerCase().includes(searchQ) || s.services?.some((srv) => (srv.name || srv.serviceName || '')?.toLowerCase().includes(searchQ)))
            : null);

        const shopToSelect = matchedShop || routerLocation.state?.shop || currentModeShops.find((s) => s.isRecommended) || currentModeShops[0];
        if (shopToSelect) {
          setSelectedShop(shopToSelect);
          updateActiveRoute(shopToSelect, location, travelMode);
        }
      }
    } catch (err) {
      console.error('Recommendation fetch error:', err);
      // DO NOT erase existing valid shops on transient network errors!
      toast.error('Unable to refresh shop updates. Using current shop list.');
    } finally {
      setLoading(false);
    }
  }, [location, specs, travelMode, updateActiveRoute, routerLocation.state]);

  useEffect(() => {
    getLocation(false);
    
    // Fetch full catalog of shops ONCE to support searching any shop in Naval
    shopAPI.getAll({ limit: 50 }).then((res) => {
      const list = res?.data?.shops || res?.shops || [];
      if (list.length > 0) {
        setAllCatalogShops(list);
      }
    }).catch((err) => console.warn('Catalog shops fetch notice:', err));

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (activeRouteAbortControllerRef.current) {
        activeRouteAbortControllerRef.current.abort();
      }
    };
  }, [getLocation]);

  const lastFetchLocRef = useRef(null);
  const lastSpecsStrRef = useRef(JSON.stringify(specs));
  const [isOutsideServiceArea, setIsOutsideServiceArea] = useState(false);

  useEffect(() => {
    if (location) {
      const distToNaval = haversineDistanceMeters(location.lat, location.lng, SITIO_BUTAY.lat, SITIO_BUTAY.lng);
      setIsOutsideServiceArea(distToNaval > 30000); // 30km is roughly outside Biliran

      const specsChanged = lastSpecsStrRef.current !== JSON.stringify(specs);
      const lastLoc = lastFetchLocRef.current;
      
      if (!lastLoc || specsChanged) {
        lastSpecsStrRef.current = JSON.stringify(specs);
        lastFetchLocRef.current = location;
        fetchAllModes();
      } else {
        const movedFromLastFetch = haversineDistanceMeters(location.lat, location.lng, lastLoc.lat, lastLoc.lng);
        const wasOutside = haversineDistanceMeters(lastLoc.lat, lastLoc.lng, SITIO_BUTAY.lat, SITIO_BUTAY.lng) > 100;
        const isOutside = distToNaval > 100;
        
        // Trigger fetch if crossing the 100m boundary, or moving while outside the threshold
        if (wasOutside !== isOutside || (isOutside && movedFromLastFetch > 25)) {
          lastFetchLocRef.current = location;
          fetchAllModes();
        }
      }
    }
  }, [location?.lat, location?.lng, specs, fetchAllModes]);

  useEffect(() => {
    const targetShopId = routerLocation.state?.selectedShopId || routerLocation.state?.shop?._id || routerLocation.state?.shop?.shopId;
    const searchQ = routerLocation.state?.searchQuery?.toLowerCase()?.trim();
    const fromSeeLocation = Boolean(routerLocation.state?.fromSeeLocation || routerLocation.state?.selectedShopId);

    if (targetShopId && shops.length > 0) {
      const matched = shops.find((s) => (s._id || s.shopId || '').toString() === targetShopId.toString());
      if (matched) {
        setSelectedShop(matched);
        if (location) {
          updateActiveRoute(matched, location, travelMode);
        }
      }
    } else if (searchQ && shops.length > 0) {
      const matched = shops.find((s) => s.shopName?.toLowerCase().includes(searchQ) || s.services?.some((srv) => (srv.name || srv.serviceName || '')?.toLowerCase().includes(searchQ)));
      if (matched) {
        setSelectedShop(matched);
        if (location) {
          updateActiveRoute(matched, location, travelMode);
        }
      }
    } else if (routerLocation.state?.shop) {
      setSelectedShop(routerLocation.state.shop);
      if (location) {
        updateActiveRoute(routerLocation.state.shop, location, travelMode);
      }
    }
  }, [routerLocation.state, shops, location, travelMode, updateActiveRoute]);

  useEffect(() => {
    if (!socket || !location) return;

    const handleQueueChange = () => {
      fetchAllModes();
    };

    socket.on('request:new', handleQueueChange);
    socket.on('request:status', handleQueueChange);
    socket.on('queue:update', handleQueueChange);
    socket.on('shop:queue_changed', handleQueueChange);
    socket.on('shop:walk_in_traffic_changed', handleQueueChange);
    socket.on('shop:status_changed', handleQueueChange);
    socket.on('shop:updated', handleQueueChange);

    return () => {
      socket.off('request:new', handleQueueChange);
      socket.off('request:status', handleQueueChange);
      socket.off('queue:update', handleQueueChange);
      socket.off('shop:queue_changed', handleQueueChange);
      socket.off('shop:walk_in_traffic_changed', handleQueueChange);
      socket.off('shop:status_changed', handleQueueChange);
      socket.off('shop:updated', handleQueueChange);
    };
  }, [socket, location, fetchAllModes]);

  const availableShops = useMemo(() => {
    return activeShops.filter((s) => isShopCurrentlyOpen(s));
  }, [activeShops]);

  const recommendedShop = useMemo(() => {
    return availableShops.find((s) => s.isRecommended) || availableShops[0] || activeShops[0];
  }, [availableShops, activeShops]);

  const routeToPass = useMemo(() => {
    if (activeRoute && activeRoute.length >= 2) return activeRoute;
    if (selectedShop?.pathCoordinates && selectedShop.pathCoordinates.length >= 2) return selectedShop.pathCoordinates;
    if (recommendedShop?.pathCoordinates && recommendedShop.pathCoordinates.length >= 2) return recommendedShop.pathCoordinates;
    return [];
  }, [activeRoute, selectedShop, recommendedShop]);

  // Route update throttle: Only recalculate when destination changes, mode changes, or genuine significant movement occurs
  useEffect(() => {
    const targetShop = selectedShop || recommendedShop;
    if (!targetShop || !location) return;

    const shopId = (targetShop._id || targetShop.shopId || targetShop.name || '').toString();
    const shopChanged = shopId !== lastRoutedShopIdRef.current;
    const modeChanged = travelMode !== lastTravelModeRef.current;
    const movedSignificantly = shouldRecalculateRoute(lastRoutedLocRef.current, location, travelMode, 25);

    if (shopChanged || modeChanged || movedSignificantly) {
      lastRoutedShopIdRef.current = shopId;
      lastTravelModeRef.current = travelMode;
      lastRoutedLocRef.current = location;
      updateActiveRoute(targetShop, location, travelMode);
    }
  }, [location, selectedShop, recommendedShop, travelMode, updateActiveRoute]);

  const handleSelectShopForPreview = (shop) => {
    setSelectedShop(shop);
    lastRoutedShopIdRef.current = (shop._id || shop.shopId || '').toString();
    lastRoutedLocRef.current = location;
    updateActiveRoute(shop, location, travelMode);
  };

  const searchResults = useMemo(() => {
    const map = new Map();
    // 1. Add active shops (contain precalculated routing & real-time queue metrics)
    activeShops.forEach((s) => {
      const id = (s._id || s.shopId)?.toString();
      if (id) map.set(id, s);
    });
    // 2. Add catalog shops not in activeShops
    allCatalogShops.forEach((s) => {
      const id = (s._id || s.shopId)?.toString();
      if (id && !map.has(id)) {
        map.set(id, s);
      }
    });

    const combined = Array.from(map.values());
    if (!searchQuery.trim()) return combined;

    const q = searchQuery.toLowerCase().trim();
    return combined.filter((s) => {
      const nameMatch = (s.shopName || s.name || '').toLowerCase().includes(q);
      const addrMatch = (s.address || s.location?.address || '').toLowerCase().includes(q);
      const landmarkMatch = (s.landmark || s.locationDescription || '').toLowerCase().includes(q);
      const servicesMatch = Array.isArray(s.services) && s.services.some(
        (srv) => (srv.name || srv.serviceName || '').toLowerCase().includes(q)
      );
      return nameMatch || addrMatch || landmarkMatch || servicesMatch;
    });
  }, [activeShops, allCatalogShops, searchQuery]);

  const handleSelectShopFromSearch = (shop) => {
    setSelectedShop(shop);
    setShowSearch(false);

    const lat = shop.latitude ?? shop.lat ?? shop.location?.coordinates?.[1];
    const lng = shop.longitude ?? shop.lng ?? shop.location?.coordinates?.[0];
    if (lat && lng && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.flyTo({
          center: [lng, lat],
          zoom: 16.5,
          duration: 700,
          essential: true,
        });
      } catch (_) {}
    }

    lastRoutedShopIdRef.current = (shop._id || shop.shopId || '').toString();
    lastRoutedLocRef.current = location;
    updateActiveRoute(shop, location, travelMode);

    toast.success(`Selected ${shop.shopName || shop.name}`, { id: 'shop-selected-toast', duration: 1800 });
  };

  const handleRefresh = () => fetchAllModes();

  const handleConfirmShop = (shop) => {
    const { totalPages, ...cleanSpecs } = specs;
    navigate('/submit-request', { state: { shop, specs: cleanSpecs, travelMode } });
  };

  const handleLocationChangeFromMap = useCallback((coords) => {
    gpsFilterRef.current.reset(coords);
    setLocation(coords);
    setLocationAccuracy(coords.accuracy || null);
    setLocationStatus('detected');
    setLocationMessage('Location placed manually on map');
    toast.success('Location placed on map!', { id: 'map-toast', duration: 1800 });
    const targetShop = selectedShop || recommendedShop;
    if (targetShop) {
      lastRoutedLocRef.current = coords;
      updateActiveRoute(targetShop, coords, travelMode);
    }
  }, [selectedShop, recommendedShop, travelMode, updateActiveRoute]);

  const mapInstanceRef = useRef(null);

  const handleRecenter = () => {
    if (location && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.flyTo({ center: [location.lng, location.lat], zoom: 16.5, duration: 500 });
      } catch (_) {}
    }
    getLocation(true);
  };


  const handleClosePreview = () => {
    setSelectedShop(null);
    if (!recommendedShop) {
      setActiveRoute([]);
      setAlternativeRoute([]);
      setRouteStats(null);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden bg-gray-50 dark:bg-gray-950 font-outfit"
    >
      {loading && <MultiStageLoader variant="overlay" text="Finding nearby printing shops & routes..." />}

      {/* Map View occupies the entire viewport as the primary element */}
      <div className="absolute inset-0 z-[1]">
        <MapView
          shops={activeShops}
          userLocation={location}
          route={routeToPass}
          alternativeRoute={alternativeRoute}
          routeStats={routeStats}
          selectedShop={selectedShop || recommendedShop}
          travelMode={travelMode}
          height="100%"
          onShopSelect={handleSelectShopForPreview}
          onLocationChange={handleLocationChangeFromMap}
          onMapReady={(map) => { mapInstanceRef.current = map; }}
          defaultStyle="osm"
          showStyleSwitcher={false}
          showRecenter={false}
          showNavigationControl={false}
        />
      </div>

      {/* Top Floating Controls Dock (Top-Left on Desktop/Laptop/Tablet, Full Width on Mobile) */}
      <div className="absolute top-3 left-3 right-3 md:right-auto md:top-4 md:left-4 z-20 flex flex-col gap-2 max-w-[min(460px,calc(100%-24px))] pointer-events-none font-outfit">
        
        {isOutsideServiceArea && (
          <div className="bg-amber-50/95 dark:bg-amber-900/90 backdrop-blur-md border border-amber-200 dark:border-amber-800/80 rounded-xl p-2.5 shadow-md pointer-events-auto">
            <p className="text-[11.5px] sm:text-xs font-semibold text-amber-800 dark:text-amber-400 leading-tight text-center">
              Showing recommendations in Naval, Biliran (current location is outside service area)
            </p>
          </div>
        )}

        {/* Main Floating Header Pill */}
        <div className="flex items-center justify-between gap-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-2 px-3 sm:px-3.5 border border-gray-200/80 dark:border-gray-800 shadow-md pointer-events-auto">
          {/* Left: Locator Icon & Title & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Compass size={17} />
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
                Printing Shops near Naval
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                <span className={`font-semibold whitespace-nowrap ${loading ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {loading ? 'Finding shops...' : `${availableShops.length} Open`}
                </span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="truncate max-w-[130px] sm:max-w-[200px]" title={location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : ''}>
                  📍 {location?.name ? 'Sitio Butay' : (location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Sitio Butay')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Search, Recenter & Refresh Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowSearch((prev) => !prev)}
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                showSearch
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
              title="Search and choose a print shop"
            >
              <Search size={14} />
            </button>
            <button
              type="button"
              onClick={handleRecenter}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              disabled={locationStatus === 'detecting'}
              title="Center on my location"
            >
              <Navigation size={14} className={locationStatus === 'detecting' ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              disabled={loading || !location}
              title="Refresh recommendations"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search & Custom Store Finder Panel */}
        {showSearch && (
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl p-3 border border-gray-200/90 dark:border-gray-800 shadow-xl pointer-events-auto flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="relative flex items-center">
              <Search size={15} className="text-gray-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shop name, landmark, service..."
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-0.5">
              <span>{searchResults.length} store{searchResults.length === 1 ? '' : 's'} in Naval</span>
              {selectedShop && recommendedShop && (selectedShop._id || selectedShop.shopId) !== (recommendedShop._id || recommendedShop.shopId) && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectShopFromSearch(recommendedShop);
                  }}
                  className="text-brand-600 dark:text-brand-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Star size={10} className="shrink-0" /> Switch to Best Match
                </button>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5 divide-y divide-gray-100 dark:divide-gray-800/60 pr-0.5">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  <Store size={22} className="mx-auto mb-1 text-gray-400 opacity-60" />
                  No shops found matching &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                searchResults.map((s) => {
                  const sId = (s._id || s.shopId)?.toString();
                  const isCurrent = (selectedShop?._id || selectedShop?.shopId)?.toString() === sId;
                  const isRec = Boolean(s.isRecommended || s.recommendation?.label === 'Best Match');
                  const open = isShopCurrentlyOpen(s);

                  return (
                    <div
                      key={sId || s.shopName}
                      onClick={() => handleSelectShopFromSearch(s)}
                      className={`pt-1.5 first:pt-0 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isCurrent
                          ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                          isRec
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}>
                          <Store size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                              {s.shopName || s.name}
                            </span>
                            {isRec && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{s.landmark || s.address || 'Naval'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          open
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                        }`}>
                          {open ? 'Open' : 'Closed'}
                        </span>
                        {s.distanceKm !== undefined && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {formatDistanceText(s.distanceMeters, s.distanceKm)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Unreliable GPS Accuracy Warning Pill */}
        {locationAccuracy !== null && locationAccuracy > 35 && (
          <div className="flex items-center justify-between gap-2 bg-amber-500/95 dark:bg-amber-600/95 text-white backdrop-blur-md px-3 py-1.5 rounded-xl shadow-theme-sm text-[11px] pointer-events-auto border border-amber-400/60 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold shrink-0">⚠️ Weak GPS (±{Math.round(locationAccuracy)}m):</span>
              <span className="truncate">Pinpoint spot on map if needed.</span>
            </div>
          </div>
        )}

        {/* Navigation Mode Segmented Control (Directly beneath Header on left) */}
        <div className="inline-flex items-center p-1 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-xl md:rounded-full border border-gray-200/80 dark:border-gray-800 shadow-md gap-1 pointer-events-auto self-start">
          {TRAVEL_MODES.map((mode) => {
            const isActive = travelMode === mode.key;
            const icon = mode.key === 'walking' ? '🚶' : mode.key === 'motor' ? '🏍️' : '🚗';
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => handleTravelModeChange(mode.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg md:rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>{icon}</span>
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>


      {/* Bottom-left Dock: OpenStreetMap Attribution + Inline Legend */}
      <div className={`absolute bottom-3 left-3 md:bottom-4 md:left-4 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-2 pointer-events-auto ${selectedShop ? 'max-md:hidden' : ''}`}>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-gray-200/80 dark:border-gray-800 shadow-sm text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors"
          title="© OpenStreetMap contributors"
        >
          <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span>OpenStreetMap</span>
        </a>

        <div className="hidden sm:block">
          <MapLegend mode="inline" activeTravelMode={travelMode} />
        </div>
      </div>

      {/* Bottom-Right "Recenter on Me" Pill Button (Desktop / Laptop / Tablet >= 640px) matching design spec */}
      <button
        type="button"
        onClick={handleRecenter}
        disabled={locationStatus === 'detecting'}
        className="hidden sm:flex items-center gap-1.5 absolute bottom-3 right-3 md:bottom-4 md:right-4 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-md text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-gray-800 active:scale-[0.98] transition-all cursor-pointer pointer-events-auto"
        title="Center map on my location"
      >
        <Navigation size={14} className={`text-blue-600 dark:text-blue-400 ${locationStatus === 'detecting' ? 'animate-spin' : ''}`} />
        <span>Recenter on Me</span>
      </button>

      {/* Selected Shop Preview Card (Desktop/Laptop/Tablet floating card or Mobile bottom sheet) */}
      {selectedShop && (
        <ShopPreviewCard
          shop={selectedShop}
          onClose={handleClosePreview}
          onPrintHere={handleConfirmShop}
          travelMode={travelMode}
          isRecommended={Boolean(selectedShop && recommendedShop && (selectedShop._id || selectedShop.shopId)?.toString() === (recommendedShop._id || recommendedShop.shopId)?.toString())}
          onSwitchToRecommended={() => handleSelectShopFromSearch(recommendedShop)}
          onOpenSearch={() => setShowSearch(true)}
        />
      )}
    </div>
  );
}
