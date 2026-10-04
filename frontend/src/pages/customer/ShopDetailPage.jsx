import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin, Star, Navigation, Clock, Users, Printer,
  ArrowLeft, CheckCircle2, Phone, ShieldCheck, MessageSquare,
  AlertOctagon, AlertCircle, ExternalLink, CreditCard,
  Building2, Sparkles, ChevronDown, ChevronUp, Calendar,
  Copy, Layers, Info
} from 'lucide-react';
import StatusBadge from '../../components/ui/StatusBadge';
import { shopAPI } from '../../services/api';
import ShopFacadeImage from '../../components/common/ShopFacadeImage';

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllHours, setShowAllHours] = useState(false);
  const [publicReviews, setPublicReviews] = useState([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [totalReviewsCount, setTotalReviewsCount] = useState(0);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);

  useEffect(() => {
    const fetchShop = async () => {
      setLoading(true);
      try {
        const [res, revRes] = await Promise.all([
          shopAPI.getById(shopId),
          shopAPI.getPublicReviews(shopId, { page: 1, limit: 10 }).catch(() => null),
        ]);
        setShop(res.data);
        if (revRes?.data?.data) {
          setPublicReviews(revRes.data.data.reviews || []);
          setTotalReviewsCount(revRes.data.data.pagination?.total ?? res.data?.reviewsCount ?? 0);
          setHasMoreReviews(Boolean(revRes.data.data.pagination?.hasMore));
          setReviewPage(1);
        } else {
          setPublicReviews(res.data?.recentReviews || []);
          setTotalReviewsCount(res.data?.reviewsCount || 0);
          setHasMoreReviews(false);
        }
      } catch (err) {
        console.error('Error fetching shop:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
  }, [shopId]);

  const handleLoadMoreReviews = async () => {
    if (loadingMoreReviews || !hasMoreReviews) return;
    setLoadingMoreReviews(true);
    try {
      const nextPage = reviewPage + 1;
      const revRes = await shopAPI.getPublicReviews(shopId, { page: nextPage, limit: 10 });
      if (revRes?.data?.data) {
        const newReviews = revRes.data.data.reviews || [];
        setPublicReviews((prev) => [...prev, ...newReviews]);
        setReviewPage(nextPage);
        setHasMoreReviews(Boolean(revRes.data.data.pagination?.hasMore));
        if (revRes.data.data.pagination?.total !== undefined) {
          setTotalReviewsCount(revRes.data.data.pagination.total);
        }
      }
    } catch (err) {
      console.error('Error loading more reviews:', err);
    } finally {
      setLoadingMoreReviews(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full py-16 text-center">
        <div className="w-10 h-10 border-4 border-[#1E429F] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="text-slate-500 font-medium text-sm">Loading printing shop profile...</div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 text-center shadow-md">
        <Building2 size={40} className="mx-auto text-slate-400 mb-3" />
        <h2 className="text-lg font-bold text-[#101828] dark:text-white mb-2">Shop Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">The requested printing shop could not be found or is unavailable.</p>
        <button
          onClick={() => navigate('/find-shop')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E429F] text-white text-xs font-bold border-none cursor-pointer hover:bg-[#354EDB]"
        >
          <ArrowLeft size={16} /> Back to Find Shops
        </button>
      </div>
    );
  }

  const pricing = shop.pricing || {};
  const lat = shop.latitude || shop.location?.coordinates?.[1] || 11.5765;
  const lng = shop.longitude || shop.location?.coordinates?.[0] || 124.4063;

  const standardCategoryNames = [
    'document printing',
    'photocopy / xerox',
    'photocopy',
    'bookbinding & finishing',
    'bookbinding',
    'document scanning',
    'scanning',
    'lamination & id printing',
    'lamination',
  ];

  const customServices = (shop.services || []).filter((s) => {
    const name = (typeof s === 'string' ? s : s?.name || '').trim().toLowerCase();
    if (!name) return false;
    return !standardCategoryNames.includes(name);
  });

  const hasExplicitPhotocopy = (shop.services || []).some((s) => {
    const name = (typeof s === 'string' ? s : s?.name || '').trim().toLowerCase();
    const isAvail = typeof s === 'string' ? true : s?.available !== false;
    return isAvail && /photocopy|xerox/i.test(name);
  });

  const isPhotocopyAvailable = (shop.services && shop.services.length > 0)
    ? hasExplicitPhotocopy
    : (pricing.photocopyBwA4 != null || pricing.photocopyBwLong != null || pricing.photocopyColor != null);

  // Format today's operating hours
  const getTodayHoursDisplay = () => {
    if (!Array.isArray(shop.operatingHours) || shop.operatingHours.length === 0) {
      return 'Mon–Sat: 8:00 AM – 5:00 PM';
    }
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const phDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayName = days[phDate.getDay()];
    const todaySched = shop.operatingHours.find((h) => h.day?.toLowerCase() === todayName);

    if (!todaySched || todaySched.isClosed) return 'Closed today';
    const fmt = (t) => {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    return `${fmt(todaySched.open)} – ${fmt(todaySched.close)}`;
  };

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Top Back Navigation */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#1E429F] transition-colors bg-transparent border-none cursor-pointer p-0"
      >
        <ArrowLeft size={16} /> Back to Shop Discovery
      </button>

      {/* Hero Card: Facade Photo & Header Identity */}
      <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Facade Photo Hero Header */}
        <div className="relative w-full h-56 sm:h-72 bg-slate-900 overflow-hidden">
          <ShopFacadeImage
            src={shop.storefrontPhotoUrl}
            shopName={shop.shopName}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover object-center"
            textClassName="text-4xl sm:text-5xl"
          />

          {/* Gradient Overlay for Title readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent" />

          {/* Badges on Top of Photo */}
          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={shop.isOpen ? 'open' : 'closed'} />
            {shop.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-600/90 text-white backdrop-blur-xs border border-blue-400/40">
                <ShieldCheck size={13} /> Verified Shop
              </span>
            )}
            {shop.operationalCondition && shop.operationalCondition !== 'normal' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/90 text-white backdrop-blur-xs shadow-xs">
                <AlertCircle size={13} />
                <span>
                  {shop.operationalCondition === 'high_walkin'
                    ? 'High Demand'
                    : shop.operationalCondition === 'equipment_problem'
                    ? 'Equipment Maintenance'
                    : shop.operationalCondition === 'power_interruption'
                    ? 'Power Interruption'
                    : 'Service Delay'}
                </span>
                {shop.operationalDelayMinutes > 0 && (
                  <span className="opacity-90 font-medium">
                    (+{shop.operationalDelayMinutes}m)
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Title & Key Meta on bottom of hero image */}
          <div className="absolute bottom-4 left-4 right-4 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white m-0 drop-shadow-md">
                {shop.shopName}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200 mt-1.5 drop-shadow-sm">
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-rose-400" />
                  {shop.landmark ? `${shop.landmark}, ` : ''}{shop.address || 'Naval, Biliran'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  {shop.reviewsCount > 0 && shop.rating && Number(shop.rating) > 0 ? (
                    <>
                      <strong className="text-white">{Number(shop.rating).toFixed(1)}</strong>
                      <span className="text-slate-300">({shop.reviewsCount} {Number(shop.reviewsCount) === 1 ? 'review' : 'reviews'})</span>
                    </>
                  ) : (
                    <span className="text-slate-300">No ratings yet</span>
                  )}
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={() => navigate('/submit-request', { state: { shop } })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-sm shadow-xl transition-all cursor-pointer border-none bg-[#465FFF] hover:bg-[#354EDB] text-white hover:scale-[1.02]"
            >
              <Printer size={18} />
              <span>{shop.isOpen ? 'Print Here' : 'Order Print Job (Shop Closed)'}</span>
            </button>
          </div>
        </div>

        {/* Storefront Guidance Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#1E429F] shrink-0" />
            <span>
              <strong>Physical Pickup Store:</strong> Look for this physical storefront when claiming your printed documents.
            </span>
          </div>
          {shop.contactNumber && (
            <a
              href={`tel:${shop.contactNumber}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E429F] dark:text-sky-400 hover:underline no-underline"
            >
              <Phone size={13} /> {shop.contactNumber}
            </a>
          )}
        </div>
      </div>

      {/* Temporary Closure Banner (If manually closed or advisory active) */}
      {shop.isManualClosure ? (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-3.5">
          <AlertOctagon size={22} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-rose-800 dark:text-rose-300">
              Temporarily Closed • {shop.closureReason || 'Advisory'}
            </div>
            {shop.reopenFormatted && (
              <div className="text-xs font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                Expected reopening: {shop.reopenFormatted}
              </div>
            )}
            {shop.advisoryMessage && (
              <p className="text-xs text-rose-800/90 dark:text-rose-200 mt-1 italic m-0">
                &ldquo;{shop.advisoryMessage}&rdquo;
              </p>
            )}
          </div>
        </div>
      ) : !shop.isOpen && (
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <Clock size={18} className="text-slate-500 shrink-0" />
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            Shop is currently closed outside normal operating hours.
            {shop.nextOpening?.formattedText && (
              <span className="font-bold text-[#1E429F] dark:text-sky-400 ml-1.5">
                Reopens {shop.nextOpening.formattedText}.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Operational Condition Advisory Banner (When shop is open but has operational warning/delay) */}
      {shop.isOpen && !shop.isManualClosure && shop.operationalCondition && shop.operationalCondition !== 'normal' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3.5 shadow-xs">
          <AlertCircle size={22} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
                {shop.operationalCondition === 'high_walkin'
                  ? 'High Counter Demand'
                  : shop.operationalCondition === 'equipment_problem'
                  ? 'Equipment Maintenance'
                  : shop.operationalCondition === 'power_interruption'
                  ? 'Power Interruption'
                  : 'Operational Service Delay'}
              </span>
              {shop.operationalDelayMinutes > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  +{shop.operationalDelayMinutes} min turnaround delay
                </span>
              )}
            </div>
            {shop.operationalMessage && (
              <p className="text-xs text-amber-900/90 dark:text-amber-200 mt-1 italic m-0">
                &ldquo;{shop.operationalMessage}&rdquo;
              </p>
            )}
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-1 mb-0">
              Online print orders are accepted and queued normally. Turnaround may be slightly extended.
            </p>
          </div>
        </div>
      )}

      {/* Key Availability & Live Queue Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Live Queue */}
        <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Online Queue</span>
            <Users size={16} className="text-[#1E429F]" />
          </div>
          <div className="text-3xl font-black text-[#101828] dark:text-white">
            {shop.queueStats?.queueCount ?? shop.currentQueue ?? 0}
            <span className="text-xs font-medium text-slate-400 ml-1.5">orders ahead</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Updated in real-time from active print jobs
          </div>
        </div>

        {/* Turnaround Estimate */}
        <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Est. Waiting Time</span>
            <Clock size={16} className="text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-[#1E429F] dark:text-sky-400">
            ~{shop.queueStats?.estimatedWaitingTime ?? Math.max(5, (shop.currentQueue || 0) * 3)}m
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Includes queue line &amp; printer speed calculations
          </div>
        </div>

        {/* Counter Traffic */}
        <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Counter Walk-In Traffic</span>
            <Sparkles size={16} className="text-amber-500" />
          </div>
          {(() => {
            const count = Math.max(0, Number(shop.walkInCustomerCount ?? shop.walkInCustomers) || 0);
            const effectiveLevel = shop.walkInTrafficLevel || (count > 8 ? 'packed' : (count > 3 ? 'moderate' : 'normal'));
            const isPacked = effectiveLevel === 'packed';
            const isModerate = effectiveLevel === 'moderate';
            const label = isPacked ? 'Packed' : isModerate ? 'Moderate' : 'Normal';
            return (
              <>
                <div className="text-lg font-black text-[#101828] dark:text-white capitalize flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    isPacked ? 'bg-rose-500' : isModerate ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  {label}
                  {count > 0 ? (
                    <span className="text-xs font-semibold text-slate-400">
                      ({count} in store)
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-slate-400">
                      (0 waiting)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-2">
                  {isPacked
                    ? 'Heavy counter lines (+25m wait)'
                    : isModerate
                    ? 'Moderate in-store traffic (+10m wait)'
                    : 'Low counter crowd • Fast printing'}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Services & Transparent Rates Section */}
      <div className="bg-white dark:bg-[#101828] p-5 sm:p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs space-y-5">
        <h2 className="text-base font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
          <Printer size={18} className="text-[#1E429F]" />
          Printing Services &amp; Transparent Rates
        </h2>

        {/* 1. Document Printing Rates */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Printer size={13} className="text-[#1E429F] dark:text-sky-400" />
            Standard Document Printing Rates
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Black &amp; White (A4 / Short)</span>
              <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">₱{Number(pricing.bwPerPage ?? 2).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ page</span></strong>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Black &amp; White (Long / Legal)</span>
              <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">₱{Number(pricing.bwLongPerPage ?? 3).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ page</span></strong>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Full Color (A4 / Short)</span>
              <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">₱{Number(pricing.colorPerPage ?? 4).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ page</span></strong>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">Full Color (Long / Legal)</span>
              <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">₱{Number(pricing.colorLongPerPage ?? 5).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ page</span></strong>
            </div>
          </div>
        </div>

        {/* 2. Photocopy & Xerox Rates */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Copy size={13} className="text-[#1E429F] dark:text-sky-400" />
              Photocopy &amp; Document Reproduction Rates
            </span>
            {!isPhotocopyAvailable && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                Service Unavailable
              </span>
            )}
          </div>

          {isPhotocopyAvailable ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 mb-1">B&amp;W Photocopy (A4 / Short)</span>
                {pricing.photocopyBwA4 != null && pricing.photocopyBwA4 !== '' ? (
                  <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">
                    ₱{Number(pricing.photocopyBwA4).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ page</span>
                  </strong>
                ) : (
                  <span className="text-xs font-bold text-slate-400">Unavailable</span>
                )}
              </div>
              <div className="flex flex-col justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 mb-1">B&amp;W Photocopy (Long / Legal)</span>
                {pricing.photocopyBwLong != null && pricing.photocopyBwLong !== '' ? (
                  <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">
                    ₱{Number(pricing.photocopyBwLong).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ page</span>
                  </strong>
                ) : (
                  <span className="text-xs font-bold text-slate-400">Unavailable</span>
                )}
              </div>
              <div className="flex flex-col justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 mb-1">Full Color Photocopy</span>
                {pricing.photocopyColor != null && pricing.photocopyColor !== '' ? (
                  <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">
                    ₱{Number(pricing.photocopyColor).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ page</span>
                  </strong>
                ) : (
                  <span className="text-xs font-bold text-slate-400">Unavailable</span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 italic">
              Photocopy / Xerox document reproduction is not currently offered by this shop.
            </div>
          )}
        </div>

        {/* 3. Bookbinding & Finishing Rates */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Layers size={13} className="text-[#1E429F] dark:text-sky-400" />
            Bookbinding, Finishing &amp; Priority Fees
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Spiral / Ring</span>
              <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">₱{Number(pricing.bindingCost ?? 35).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ book</span></strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Softbound</span>
              <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">₱{Number(pricing.softbindCost ?? 50).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ book</span></strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Stapled / Fastener</span>
              <strong className="text-[#1E429F] dark:text-sky-400 text-sm font-black">₱{Number(pricing.stapleCost ?? 5).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">/ copy</span></strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300 block mb-1">Rush Order Fee</span>
              {pricing.allowRush !== false ? (
                <strong className="text-amber-600 dark:text-amber-400 text-sm font-black">+₱{Number(pricing.rushFee ?? 20).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">order</span></strong>
              ) : (
                <span className="text-xs font-bold text-rose-500">Not accepted</span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Additional & Custom Services */}
        {customServices.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles size={13} className="text-amber-500" />
                Additional &amp; Custom Services
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-sky-400 border border-blue-200 dark:border-blue-900">
                In-Store / Inquiry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customServices.map((svc, idx) => {
                const sName = typeof svc === 'string' ? svc : svc.name;
                const sDesc = svc.description || '';
                const sPrice = Number(svc.price) || 0;
                const isAvail = svc.available !== false;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {sName}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isAvail
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                        }`}>
                          {isAvail ? 'Available In-Store' : 'Unavailable'}
                        </span>
                      </div>
                      {sDesc && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-0 leading-snug">
                          {sDesc}
                        </p>
                      )}
                    </div>
                    <div className="text-xs font-black text-[#1E429F] dark:text-sky-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      {sPrice > 0 ? `₱${sPrice.toFixed(2)} base rate` : 'Price on inquiry'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Info size={14} className="text-[#1E429F] dark:text-sky-400 shrink-0" />
              <span>
                Custom services are provided in-store. The online document submission system currently processes standard paper printing; custom service inquiries can be arranged directly with the shop.
              </span>
            </div>
          </div>
        )}

        {/* 5. Standard Capabilities Badges */}
        {shop.services && shop.services.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 block mb-2">Service Capabilities Offered:</span>
            <div className="flex flex-wrap gap-2">
              {shop.services
                .filter((s) => (typeof s === 'string' ? true : s.available !== false))
                .map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-[#1E429F] dark:text-sky-400 border border-blue-200 dark:border-blue-900"
                  >
                    ✓ {typeof s === 'string' ? s : s.name}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Operating Hours & Location Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Operating Hours */}
        <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
              <Clock size={16} className="text-emerald-600" />
              Operating Hours
            </h3>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Today: {getTodayHoursDisplay()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAllHours(!showAllHours)}
            className="text-xs font-bold text-[#1E429F] dark:text-sky-400 hover:underline inline-flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
          >
            {showAllHours ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAllHours ? 'Hide Weekly Schedule' : 'View Full Weekly Schedule'}
          </button>

          {showAllHours && Array.isArray(shop.operatingHours) && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {DAYS_ORDER.map((dayKey) => {
                const sched = shop.operatingHours.find((h) => h.day?.toLowerCase() === dayKey);
                return (
                  <div key={dayKey} className="py-1.5 flex justify-between items-center text-xs">
                    <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">{dayKey}</span>
                    <span className={sched?.isClosed ? 'text-rose-500 font-bold' : 'text-slate-500'}>
                      {sched?.isClosed ? 'Closed' : sched?.open ? `${sched.open} - ${sched.close}` : '8:00 AM - 5:00 PM'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Location & Find Shops Map Link */}
        <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
              <MapPin size={16} className="text-rose-500" />
              Location &amp; Directions
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-2 mb-1">
              {shop.address || 'Naval, Biliran'}
            </p>
            {shop.landmark && (
              <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1E429F] border border-blue-200 dark:bg-blue-950/40 dark:text-sky-400 dark:border-blue-900">
                📍 Landmark: {shop.landmark}
              </span>
            )}
            {shop.locationDescription && (
              <p className="text-xs text-slate-500 mt-2 mb-0 italic">
                {shop.locationDescription}
              </p>
            )}
          </div>

          <Link
            to={`/find-shop?shopId=${shop._id}&lat=${lat}&lng=${lng}`}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#101828] dark:text-white text-xs font-bold transition-colors no-underline"
          >
            <Navigation size={14} className="text-[#1E429F]" />
            View on Interactive Map in Find Shops
          </Link>
        </div>
      </div>

      {/* Supported Payment Channels */}
      <div className="bg-white dark:bg-[#101828] p-5 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1E429F] dark:text-sky-400">
            <CreditCard size={20} />
          </div>
          <div>
            <div className="text-xs font-black text-[#101828] dark:text-white">Supported Payment Methods</div>
            <div className="text-xs text-slate-500 mt-0.5">Advance digital payment verification (Anti-Scam &amp; Print Protection)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-sky-400 border border-blue-200 dark:border-blue-900">
            📱 GCash
          </span>
        </div>
      </div>

      {/* Customer Reviews & Feedback */}
      <div className="bg-white dark:bg-[#101828] p-5 sm:p-6 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-[#101828] dark:text-white m-0 flex items-center gap-2">
            <MessageSquare size={18} className="text-[#1E429F]" />
            Customer Ratings &amp; Reviews
          </h2>
          <div className="flex items-center gap-1 font-black text-sm text-[#101828] dark:text-white">
            <Star size={16} className="text-amber-400 fill-amber-400" />
            {(totalReviewsCount > 0 || (Number(shop.reviewsCount) > 0 && shop.rating && Number(shop.rating) > 0)) ? (
              <>
                <span>{Number(shop.rating).toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({totalReviewsCount || shop.reviewsCount} {Number(totalReviewsCount || shop.reviewsCount) === 1 ? 'review' : 'reviews'})
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-400 font-medium">No ratings yet</span>
            )}
          </div>
        </div>

        {publicReviews && publicReviews.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {publicReviews.map((rev, idx) => (
              <div key={rev.id || idx} className="py-3 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#101828] dark:text-white">{rev.customerName || 'Customer'}</span>
                  <span className="text-slate-400">{new Date(rev.createdAt || rev.reviewedAt || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  {'★'.repeat(rev.rating || 5)}
                  <span className="text-[10px] text-slate-400 ml-2">
                    Quality: {rev.printQuality || 5}/5 • Printing Speed: {rev.speedRating || 5}/5
                  </span>
                </div>
                {rev.comment && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic m-0">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                )}
              </div>
            ))}

            {hasMoreReviews && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMoreReviews}
                  disabled={loadingMoreReviews}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1E429F] dark:text-sky-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900 transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingMoreReviews ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Loading reviews...</span>
                    </>
                  ) : (
                    <span>Load More Reviews ({publicReviews.length} of {totalReviewsCount || shop.reviewsCount})</span>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No customer reviews yet. Be the first to place an order and review this shop!
          </div>
        )}
      </div>

      {/* Sticky Bottom CTA for Mobile & Quick Order */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#101828]/95 backdrop-blur-md border-t border-[#E2E8F0] dark:border-slate-800 p-3 z-30 flex items-center justify-between max-w-4xl mx-auto shadow-2xl rounded-t-2xl sm:hidden">
        <div>
          <div className="text-xs font-bold text-[#101828] dark:text-white">{shop.shopName}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{shop.isOpen ? 'Open Now' : 'Closed'}</div>
        </div>
        <button
          onClick={() => navigate('/submit-request', { state: { shop } })}
          className="px-5 py-2.5 rounded-xl bg-[#1E429F] hover:bg-[#1A3882] text-white text-xs font-black border-none cursor-pointer"
        >
          Print Here →
        </button>
      </div>
    </div>
  );
}
