import React from 'react';
import { MapPin, Users, Clock, Building2, Printer, Star } from 'lucide-react';
import ShopFacadeImage from '../common/ShopFacadeImage';

/**
 * RecommendedShopCard
 * 
 * Lightweight facade card on the Customer Dashboard.
 * Displays:
 * - Shop Photo & Badges (Open/Closed, Top Pick with Star, Rating when available)
 * - Shop Name & Short Address
 * - Base Rate (clean rate per page without estimated calculation box) - REMOVED for clean UI
 * - Live Queue & Waiting Time - REMOVED for clean UI
 * - Action buttons:
 *    1. View Details (opens modal profile)
 *    2. See Location (centers on map in /find-shop)
 *    3. Print Here (starts print order)
 */
export default function RecommendedShopCard({
  shop,
  onSeeLocation,
  onViewProfile,
  onPrintHere,
}) {
  if (!shop) return null;

  const shopId = shop.shopId || shop._id;
  const name = shop.name || shop.shopName || 'Printing Shop';
  const photoUrl = shop.photoUrl || shop.storefrontPhotoUrl;

  const isOpen = shop.isOpen !== false && shop.status !== 'closed' && shop.status?.isOpen !== false;
  const isTopPick = Boolean(shop.isRecommended || shop.recommendation?.label === 'Best Match');

  // Rating info: Only display if shop actually has received ratings
  const ratingScore = Number(shop.rating || 0);
  const reviewsCount = Number(shop.reviewsCount || shop.ratingCount || shop.ratingsCount || 0);
  const hasRating = Boolean(shop.hasReviews || (ratingScore > 0 && reviewsCount > 0));

  const address = shop.location?.address || shop.address || 'Naval, Biliran';
  const isVerified = shop.verificationStatus === 'verified';

  const baseRate = Number(
    shop.pricing?.baseRate ??
    shop.pricingSummary?.baseRate ??
    shop.ratePerPage ??
    (shop.pricing?.bwPerPage || 2)
  ).toFixed(2);

  const queueCount = shop.totalInQueue !== undefined
    ? Number(shop.totalInQueue)
    : (shop.currentQueue !== undefined
      ? Number(shop.currentQueue)
      : (shop.queueCount !== undefined
        ? Number(shop.queueCount)
        : (Number(shop.queue?.onlineJobs || 0) + Number(shop.queue?.walkInCustomers || 0))));

  const waitMins = shop.waitingTimeMinutes ?? shop.queue?.waitingTimeMinutes ?? null;
  const turnaroundMins = shop.turnaround?.estimatedMinutes ?? shop.estimatedCompletionMinutes ?? shop.estimatedCompletionTime ?? null;

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-gray-900 border transition-all duration-200 overflow-hidden flex flex-col group shadow-theme-xs hover:shadow-theme-md hover:-translate-y-0.5 ${
        isTopPick
          ? 'border-brand-300 dark:border-brand-500/40 ring-1 ring-brand-400/30'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      {/* 1. Shop Photo Header */}
      <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-900 overflow-hidden">
        <ShopFacadeImage
          src={photoUrl}
          shopName={name}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 via-transparent to-gray-950/30 pointer-events-none" />

        {/* Status & Recommendation Badges Overlay */}
        <div className="absolute top-2.5 inset-x-2.5 flex justify-between items-center z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status Badge */}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-theme-xs inline-flex items-center gap-1 uppercase tracking-wider ${
                isOpen ? 'bg-success-500' : 'bg-error-500'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              {isOpen ? 'Open' : 'Closed'}
            </span>

            {/* BEST MATCH Badge */}
            {isTopPick && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500 text-white shadow-theme-xs inline-flex items-center gap-1 uppercase tracking-wider border border-brand-400">
                <Star size={10} fill="white" strokeWidth={0} />
                No. 1 Best Match
              </span>
            )}

            {/* Operational Condition Badge */}
            {isOpen && shop.operationalCondition && shop.operationalCondition !== 'normal' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/90 text-white shadow-theme-xs inline-flex items-center gap-1 uppercase tracking-wider backdrop-blur-xs">
                {shop.operationalCondition === 'high_walkin'
                  ? 'High Demand'
                  : shop.operationalCondition === 'equipment_problem'
                  ? 'Maintenance'
                  : 'Delay'}
                {Number(shop.operationalDelayMinutes) > 0 && ` (+${shop.operationalDelayMinutes}m)`}
              </span>
            )}
          </div>

          {/* User Ratings Badge */}
          {hasRating ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-900/85 backdrop-blur-xs text-warning-400 shadow-theme-xs inline-flex items-center gap-1">
              <Star size={10} fill="currentColor" strokeWidth={0} />
              {ratingScore.toFixed(1)} ({reviewsCount})
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-900/70 backdrop-blur-xs text-gray-300 shadow-theme-xs inline-flex items-center gap-1">
              No ratings yet
            </span>
          )}
        </div>
      </div>

      {/* 2. Card Body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Shop Name & Short Address */}
        <div className="mb-auto">
          <div className="flex items-center gap-1.5 truncate">
            <h3
              className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate m-0 leading-snug group-hover:text-brand-500 transition-colors"
              title={name}
            >
              {name}
            </h3>
            {isVerified && (
              <span className="w-3.5 h-3.5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[8px] shrink-0 font-bold" title="Verified Printing Shop">
                ✓
              </span>
            )}
          </div>
          <div
            className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1 truncate"
            title={address}
          >
            <MapPin size={12} className="text-gray-400 dark:text-gray-500 shrink-0" />
            <span className="truncate">{address}</span>
          </div>
        </div>
      </div>

      {/* 3. Actions Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onViewProfile && onViewProfile(shop)}
          className="col-span-1 py-1.5 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-[11px] font-semibold inline-flex justify-center items-center gap-1.5 transition-colors cursor-pointer"
        >
          View Details
        </button>

        <button
          type="button"
          onClick={() => onSeeLocation && onSeeLocation(shop)}
          className="col-span-1 py-1.5 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-[11px] font-semibold inline-flex justify-center items-center gap-1.5 transition-colors cursor-pointer"
        >
          <MapPin size={12} className="text-error-500" />
          <span>Location</span>
        </button>

        <button
          type="button"
          onClick={() => onPrintHere && onPrintHere(shop)}
          className="col-span-2 py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-theme-xs bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white cursor-pointer"
        >
          <Printer size={13} />
          <span>{isOpen ? 'Print Here' : 'Print Here (Closed)'}</span>
        </button>
      </div>
    </div>
  );
}
