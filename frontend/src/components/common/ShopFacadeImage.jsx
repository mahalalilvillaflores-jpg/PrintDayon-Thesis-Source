import React, { useState, useEffect } from 'react';

/**
 * Derives 1-2 shop initials automatically from the shop name.
 * Examples:
 * - "Lander Printing Services" -> "LP"
 * - "Print Hub Naval" -> "PH"
 * - "ABC Printing Services" -> "AB"
 * - "Mahal's Print Shop" -> "MP"
 * - "Lander" -> "L"
 */
export function getShopInitials(name) {
  if (!name || typeof name !== 'string') return 'SP';

  // Clean apostrophes and trim
  const cleaned = name.replace(/['’]/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SP';

  if (words.length === 1) {
    const single = words[0];
    return single.substring(0, 1).toUpperCase();
  }

  const w1 = words[0];
  const w2 = words[1];

  // If first word is an acronym like "ABC", use first 2 letters of w1 -> "AB"
  if (w1.length >= 2 && w1 === w1.toUpperCase() && /^[A-Z]+$/.test(w1)) {
    return w1.substring(0, 2);
  }

  return (w1[0] + w2[0]).toUpperCase();
}

/**
 * StorefrontPlaceholder
 * Clean, branded placeholder displaying shop initials.
 */
export function StorefrontPlaceholder({ shopName, className = '', textClassName = '' }) {
  const initials = getShopInitials(shopName);
  return (
    <div
      className={`w-full h-full bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-800 flex items-center justify-center select-none ${className}`}
    >
      <span className={`font-black text-[#465FFF] dark:text-sky-400 tracking-wider ${textClassName || 'text-xl sm:text-2xl'}`}>
        {initials}
      </span>
    </div>
  );
}

/**
 * ShopFacadeImage
 * Renders storefront facade photo with automatic fallback to shop initials on error or missing photo.
 */
export default function ShopFacadeImage({
  src,
  shopName,
  className = 'w-full h-full',
  imgClassName = 'w-full h-full object-cover',
  textClassName = '',
  alt = '',
}) {
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Construct absolute URL for production cross-domain compatibility
  const getFullSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    const rawApiUrl = import.meta.env.VITE_API_URL || '';
    const apiBase = rawApiUrl.replace(/\/api$/, '').replace(/\/$/, '');
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const fullSrc = getFullSrc(src);

  useEffect(() => {
    setImgError(false);
    setIsLoading(true);
  }, [fullSrc]);

  if (!fullSrc || imgError) {
    return (
      <StorefrontPlaceholder
        shopName={shopName}
        className={className}
        textClassName={textClassName}
      />
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-300 dark:border-slate-700 border-t-[#465FFF] rounded-full animate-spin"></div>
        </div>
      )}
      <img
        src={fullSrc}
        alt={alt || shopName || 'Storefront Facade'}
        className={`${imgClassName} ${isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImgError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
}
