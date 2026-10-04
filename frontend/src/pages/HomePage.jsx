import { Link } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import MapView from "../components/map/MapView";
import MapLegend from "../components/map/MapLegend";
import { getRoadPolyline } from "../utils/roadRouting";
import { recommendationAPI } from "../services/api";
import ThemeToggle from "../components/common/ThemeToggle";
import ShopFacadeImage from "../components/common/ShopFacadeImage";

import {
  MapPin,
  Route,
  Clock3,
  Zap,
  GraduationCap,
  BriefcaseBusiness,
  Users,
  Star,
  Printer,
  Navigation,
  LocateFixed,
  ChevronRight,
  ChevronDown,
  Footprints,
  Bike,
  Car,
  ShieldCheck,
  ArrowRight,
  Search,
  BookOpen,
  X,
} from "lucide-react";

const NAVAL_CENTER = {
  lat: 11.563591,
  lng: 124.398505,
  name: "BiPSU Main Campus, Naval",
};

const NAVAL_LANDMARKS = [
  { name: "BiPSU Main Campus (Vicentillo Ext.)", lat: 11.563591, lng: 124.398505 },
  { name: "Sitio Butay, P.I. Garcia", lat: 11.56437, lng: 124.39964 },
  { name: "Naval Town Plaza & Cathedral", lat: 11.562502, lng: 124.395952 },
  { name: "Naval Public Market / Terminal", lat: 11.560478, lng: 124.396483 },
  { name: "Naval Port / Pier Area", lat: 11.5615, lng: 124.3935 },
  { name: "Villa Cornejo (Kawayan)", lat: 11.702366, lng: 124.431758 },
];


function Navbar({ onOpenHowItWorks, onOpenAbout }) {
  return (
    <header className="sticky top-0 z-50 px-2.5 sm:px-6 pt-2 sm:pt-3">
      <div
        className="
          mx-auto
          flex
          h-[54px] sm:h-[62px]
          max-w-[1240px]
          items-center
          justify-between
          gap-1.5 sm:gap-4
          px-2.5 sm:px-5 md:px-6
          rounded-2xl
          bg-white/95
          dark:bg-gray-900/95
          backdrop-blur-md
          shadow-lg
          border
          border-white/80
          dark:border-gray-800
        "
      >
        <Link
          to="/"
          className="
            flex
            shrink-0
            items-center
            gap-2 sm:gap-3
            no-underline
            min-w-0
          "
        >
          <img
            src="/logo.png"
            alt="PrintDayon Logo"
            className="h-8 w-8 sm:h-10 sm:w-10 md:h-11 md:w-11 object-contain shrink-0"
          />

          <div className="shrink-0">
            <div className="text-[17px] sm:text-[19px] md:text-[20px] font-bold leading-none tracking-tight font-outfit">
              <span className="text-gray-900 dark:text-white">Print</span>
              <span className="text-brand-500">Dayon</span>
            </div>

            <div className="hidden sm:block mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Online Printing System
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-xs sm:text-sm font-semibold font-outfit">
          <a
            href="#home"
            className="text-brand-500 relative pb-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-500 after:rounded-full no-underline"
          >
            Home
          </a>
          <a
            href="#how-it-works"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors no-underline"
          >
            How It Works
          </a>
          <a
            href="#about"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors no-underline"
          >
            About
          </a>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5 font-outfit shrink-0">
          <ThemeToggle />
          <Link
            to="/login"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg sm:rounded-xl px-2.5 sm:px-3.5 md:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 no-underline transition-colors active:scale-[0.98] shrink-0"
          >
            Sign In
          </Link>

          <Link
            to="/register"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-lg sm:rounded-xl bg-brand-500 px-3 sm:px-4 md:px-5 py-1.5 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-white no-underline transition-colors hover:bg-brand-600 active:scale-[0.98] shadow-theme-xs shrink-0"
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

function RecommendedShopCard({ shop, travelMode = 'motor' }) {
  if (!shop) return null;
  const shopName = shop.shopName || shop.name || 'Printing Shop';
  const shopId = shop.shopId || shop._id;
  const isVerified = shop.verificationStatus === 'verified';
  const isOpen = shop.isOpen !== false && shop.status !== 'closed';

  // Real rating from MongoDB: If no reviews exist, display 'No ratings yet'
  const hasReviews = Boolean(shop.hasReviews || (Number(shop.reviewsCount || 0) > 0 && Number(shop.rating || 0) > 0));
  const ratingVal = hasReviews && shop.rating !== null && Number(shop.rating) > 0 ? Number(shop.rating).toFixed(1) : null;
  const reviewsCount = Number(shop.reviewsCount || 0);

  // Real travel time / walking time calculated from customer location
  const travelMins = shop.travelTimeMinutes ?? shop.travelTime;
  const distanceM = shop.distanceMeters ?? (shop.distanceKm ? parseFloat(shop.distanceKm) * 1000 : null);
  const distanceText = distanceM
    ? (distanceM < 1000 ? `${Math.round(distanceM)} m away` : `${(distanceM / 1000).toFixed(2)} km away`)
    : '';

  let travelDisplay = '';
  if (travelMode === 'walking' || shop.travelMode === 'walking') {
    if (travelMins !== undefined && travelMins !== null) {
      travelDisplay = `About ${Math.max(1, Math.round(Number(travelMins)))} min walk`;
    } else if (distanceM) {
      const calcWalk = Math.max(1, Math.round(distanceM / 75));
      travelDisplay = `About ${calcWalk} min walk`;
    }
  } else {
    const modeLabel = travelMode === 'vehicle' ? 'Car' : 'Motor';
    if (travelMins !== undefined && travelMins !== null) {
      travelDisplay = `About ${Math.max(1, Math.round(Number(travelMins)))} min by ${modeLabel}`;
    }
  }

  // Combined distance and travel time wording
  const locationTravelText = [distanceText, travelDisplay].filter(Boolean).join(' · ');

  // Real Queue count confirmed from database (Requirement 3: People waiting: 0)
  const totalQueue = shop.totalInQueue ?? shop.currentQueue ?? shop.queueCount;
  const queueDisplay = (totalQueue !== undefined && totalQueue !== null)
    ? `${totalQueue}`
    : 'Unavailable';

  // Real Estimated completion time (Requirement 4: Estimated completion time: About X minutes)
  const completionMins = shop.estimatedCompletionMinutes ?? shop.estimatedCompletionTime;
  let completionDisplay = 'Unavailable';
  if (!isOpen) {
    completionDisplay = 'Shop closed';
  } else if (completionMins !== undefined && completionMins !== null && Number(completionMins) > 0) {
    const mins = Math.max(1, Math.round(Number(completionMins)));
    completionDisplay = `About ${mins} min${mins === 1 ? '' : 's'}`;
  }

  // Real storefront photo or initials
  const photoUrl = shop.photoUrl || shop.storefrontPhotoUrl || null;
  const initials = shopName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className="
        absolute
        bottom-3
        left-3
        z-[30]
        w-[min(380px,calc(100%-24px))]
        rounded-xl
        border
        border-gray-200/80
        dark:border-gray-800
        bg-white/95
        dark:bg-gray-900/95
        backdrop-blur-md
        p-3.5
        shadow-theme-md
        transition-all
        font-outfit
      "
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          <ShopFacadeImage
            src={photoUrl}
            shopName={shopName}
            className="w-full h-full"
            textClassName="text-xs font-bold"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate m-0">
              {shopName}
            </h4>
            {isVerified && (
              <span className="w-3.5 h-3.5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[8px] shrink-0 font-bold" title="Verified Printing Shop">
                ✓
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {hasReviews && ratingVal ? (
              <span className="text-warning-500 font-semibold">★ {ratingVal} {reviewsCount > 0 ? `(${reviewsCount})` : ''}</span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500 font-normal">No ratings yet</span>
            )}
            {locationTravelText && (
              <>
                <span>•</span>
                <span>{locationTravelText}</span>
              </>
            )}
          </div>

          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
            <span>People waiting: <strong className="text-gray-900 dark:text-white font-semibold">{queueDisplay}</strong></span>
            <span className="mx-1.5">•</span>
            <span>Est. completion: <strong className="text-brand-500 font-semibold">{completionDisplay}</strong></span>
          </div>
        </div>

        <Link
          to={shopId ? `/shop/${shopId}` : '/login'}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-theme-xs transition-colors no-underline text-center self-center"
        >
          View Shop
        </Link>
      </div>
    </div>
  );
}

const HOME_TRAVEL_MODES = [
  { key: 'walking', label: 'Walk', Icon: Footprints, title: 'Walking (4.8 km/h)' },
  { key: 'motor', label: 'Motor', Icon: Bike, title: 'Motorcycle / Motorbike (28 km/h)' },
  { key: 'vehicle', label: 'Car', Icon: Car, title: 'Private Vehicle / Car (35 km/h)' },
];

function NavalMap() {
  const [userLocation, setUserLocation] = useState(NAVAL_CENTER);
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [travelMode, setTravelMode] = useState('motor');
  const [route, setRoute] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  const [showLandmarkMenu, setShowLandmarkMenu] = useState(false);
  const landmarkMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (landmarkMenuRef.current && !landmarkMenuRef.current.contains(e.target)) {
        setShowLandmarkMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchShops = useCallback(async (loc, selectTop = false, mode) => {
    const activeMode = mode || travelMode;
    try {
      const res = await recommendationAPI.getRankedShops({
        lat: loc.lat,
        lng: loc.lng,
        travelMode: activeMode,
      });
      const ranked = res.data?.ranked || res.data?.shops || res.ranked || res.shops || [];
      if (ranked.length > 0) {
        setShops(ranked);
        const topRec = ranked.find((s) => s.isRecommended) || ranked[0];
        setSelectedShop((prev) => {
          if (selectTop || !prev) return topRec;
          const stillThere = ranked.find(
            (s) => (s.shopId || s._id) === (prev.shopId || prev._id)
          );
          return stillThere || topRec;
        });
      } else {
        setShops([]);
        setSelectedShop(null);
        setRoute([]);
      }
    } catch (err) {
      console.warn("Failed to fetch shops from server:", err);
      setShops([]);
      setSelectedShop(null);
      setRoute([]);
    }
  }, [travelMode]);

  useEffect(() => {
    if (!selectedShop || !userLocation) return;
    const shopCoords = {
      lat: selectedShop.latitude || selectedShop.lat,
      lng: selectedShop.longitude || selectedShop.lng,
    };
    if (!shopCoords.lat || !shopCoords.lng) return;

    const dijkstraCoords = (selectedShop.pathCoordinates && selectedShop.pathCoordinates.length >= 2)
      ? selectedShop.pathCoordinates
      : [
        [userLocation.lng, userLocation.lat],
        [shopCoords.lng, shopCoords.lat],
      ];

    setRoute(dijkstraCoords);

    let isMounted = true;
    getRoadPolyline(userLocation, shopCoords, dijkstraCoords, travelMode)
      .then((roadData) => {
        if (isMounted && roadData?.coordinates?.length) {
          setRoute(roadData.coordinates);
        }
      })
      .catch(() => { });

    return () => {
      isMounted = false;
    };
  }, [selectedShop, userLocation, travelMode]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const newLoc = {
            lat: Number(latitude.toFixed(6)),
            lng: Number(longitude.toFixed(6)),
            name: "Your Live Location (Naval)",
          };
          setUserLocation(newLoc);
          fetchShops(newLoc, true);
        },
        () => {
          fetchShops(NAVAL_CENTER, true);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      fetchShops(NAVAL_CENTER, true);
    }
  }, [fetchShops]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        const newLoc = {
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6)),
          name: "Your Live Location",
        };
        setUserLocation(newLoc);
        fetchShops(newLoc, true);
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSelectShop = (shop) => {
    setSelectedShop(shop);
  };

  const handleLocationChange = (coords) => {
    const updated = {
      ...coords,
      name: "Custom Pinned Location",
    };
    setUserLocation(updated);
    fetchShops(updated, true);
  };

  return (
    <div
      className="
        relative
        h-[320px]
        sm:h-[350px]
        lg:h-[370px]
        xl:h-[410px]
        w-full
        overflow-hidden
        border-2
        border-[#DCE4EA]
        shadow-card
        bg-white
      "
      style={{
        borderRadius: "20px 24px 20px 22px",
      }}
    >
      <MapView
        shops={shops}
        userLocation={userLocation}
        route={route}
        selectedShop={selectedShop}
        travelMode={travelMode}
        height="100%"
        onShopSelect={handleSelectShop}
        onLocationChange={handleLocationChange}
        showStyleSwitcher={true}
        styleSwitcherPosition="bottom-right"
        showRecenter={false}
      />

      <div className="absolute left-3 top-3 z-[30] flex items-center gap-2 flex-wrap max-w-[calc(100%-56px)]">
        <div ref={landmarkMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowLandmarkMenu((prev) => !prev)}
            className="
              flex
              items-center
              gap-2
              rounded-lg
              border
              border-[#DCE4EA]
              bg-white
              px-3
              py-1.5
              text-left
              shadow-subtle
              transition-colors
              hover:bg-gray-50 dark:hover:bg-gray-800
              font-outfit
            "
          >
            <MapPin size={13} className="text-brand-500 shrink-0" />
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 max-w-[130px] truncate sm:max-w-[190px]">
              {userLocation.name || "Your Live Location (Naval)"}
            </span>
            <ChevronDown size={12} className="text-gray-400 shrink-0" />
          </button>

          {showLandmarkMenu && (
            <div
              className="
                absolute
                left-0
                top-full
                mt-1.5
                w-64
                rounded-2xl
                border
                border-gray-200
                dark:border-gray-800
                bg-white
                dark:bg-gray-900
                p-1.5
                shadow-theme-md
                z-50
                font-outfit
              "
            >
              <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                Quick Location in Naval
              </div>
              {NAVAL_LANDMARKS.map((lm) => (
                <button
                  key={lm.name}
                  type="button"
                  onClick={() => {
                    setUserLocation(lm);
                    fetchShops(lm, true, travelMode);
                    setShowLandmarkMenu(false);
                  }}
                  className={`
                    w-full
                    flex
                    items-center
                    justify-between
                    rounded-xl
                    px-2.5
                    py-1.5
                    text-left
                    text-xs
                    font-medium
                    transition-colors
                    ${userLocation.name === lm.name
                      ? "bg-brand-50 dark:bg-brand-500/10 text-brand-500 font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }
                  `}
                >
                  <span className="truncate">{lm.name}</span>
                  {userLocation.name === lm.name && (
                    <span className="text-brand-500 text-xs font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-0.5 shadow-theme-xs font-outfit">
          {HOME_TRAVEL_MODES.map((m) => {
            const isActive = travelMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                title={m.title}
                onClick={() => {
                  setTravelMode(m.key);
                  fetchShops(userLocation, true, m.key);
                }}
                className={`
                  flex
                  items-center
                  gap-1.5
                  rounded-lg
                  px-2.5
                  py-1
                  text-[11px]
                  font-medium
                  transition-colors
                  ${isActive
                    ? "bg-brand-500 text-white font-semibold shadow-theme-xs"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800"
                  }
                `}
              >
                <m.Icon size={13} className="shrink-0" />
                <span className="hidden xs:inline">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleLocateMe}
        disabled={isLocating}
        title="Locate my position with GPS"
        className="
          absolute
          right-3
          top-3
          z-[30]
          flex
          h-8
          w-8
          items-center
          justify-center
          rounded-xl
          border
          border-gray-200
          dark:border-gray-800
          bg-white
          dark:bg-gray-900
          text-brand-500
          shadow-theme-xs
          transition-colors
          hover:bg-gray-50
          dark:hover:bg-gray-800
          active:scale-95
        "
      >
        <LocateFixed
          size={15}
          className={isLocating ? "animate-spin text-brand-500" : ""}
        />
      </button>

      <div className="absolute top-3 right-12 z-[30] hidden sm:block">
        <MapLegend activeTravelMode={travelMode} mode="dropdown" />
      </div>

      <RecommendedShopCard shop={selectedShop} travelMode={travelMode} />

      <Link
        to="/login"
        className="
          absolute
          bottom-3
          right-3
          z-[30]
          hidden
          sm:inline-flex
          items-center
          gap-1.5
          px-3
          py-1.5
          rounded-xl
          bg-white
          dark:bg-gray-900
          hover:bg-gray-50
          dark:hover:bg-gray-800
          text-gray-800
          dark:text-gray-200
          text-xs
          font-semibold
          shadow-theme-xs
          border
          border-gray-200
          dark:border-gray-800
          no-underline
          transition-colors
          active:scale-95
          font-outfit
        "
      >
        <Navigation size={13} className="text-brand-500" />
        <span>View All Shops</span>
      </Link>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  iconBackground,
}) {
  return (
    <div
      className="
        flex
        items-start
        gap-4
        rounded-2xl
        border
        border-[#e3e3e3]
        bg-white
        p-5
        shadow-xs
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:border-[#0066FF]/30
        hover:shadow-sm
      "
    >
      <div
        className={`
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          shadow-xs
          ${iconBackground}
        `}
      >
        {icon}
      </div>

      <div>
        <h3
          className="
            mb-1
            text-sm
            font-bold
            text-[#0a0a0a]
            tracking-tight
          "
        >
          {title}
        </h3>

        <p
          className="
            m-0
            text-xs
            leading-relaxed
            text-slate-500
          "
        >
          {description}
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="w-full min-h-screen font-sans relative text-[#183243]">
      {/* Fixed Background Image of Naval, Biliran that stays locked when scrolling */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/images/naval_aerial_bg.jpg')" }}
      >
        {/* Soft, gentle natural daylight tint so the mountains, blue sea, and town shine through */}
        <div className="absolute inset-0 bg-slate-900/15" />

        {/* Directional gradient on the left for crisp text readability without making the island pitch dark */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/30 to-transparent" />
      </div>

      {/* Hero Section */}
      <section
        id="home"
        className="
          min-h-screen
          w-full
          flex
          flex-col
          justify-between
          relative
        "
      >
        {/* Top: Floating Navbar */}
        <div className="relative z-40 flex-shrink-0 pt-1 pb-1">
          <Navbar />
        </div>

        {/* Middle: Hero Content & Organic Map */}
        <div className="relative z-10 mx-auto max-w-[1280px] w-full px-4 sm:px-8 lg:px-10 flex-1 min-h-0 flex items-center py-6 sm:py-8 font-outfit">
          <div className="grid items-center gap-6 lg:gap-8 lg:grid-cols-[0.88fr_1.12fr] w-full">
            {/* Left Hero Content */}
            <div className="max-w-[540px]">
              <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-gray-900/90 border border-white/60 dark:border-gray-800 shadow-theme-xs px-3 py-1 text-xs font-bold text-gray-900 dark:text-white">
                <MapPin size={13} className="text-brand-500" />
                <span>NAVAL, BILIRAN</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.16] tracking-tight text-white m-0 drop-shadow-md">
                Find the Right<br />
                <span className="text-brand-300">Printing Shop</span><br />
                Near You.
              </h1>

              <p className="mt-3 text-xs sm:text-sm lg:text-[15px] leading-relaxed text-white/95 font-normal drop-shadow">
                PrintDayon helps students find verified printing shops and compare location, queue, and estimated completion time.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-theme-xs transition-all active:scale-[0.98] no-underline"
                >
                  <span>Find Shops Now</span>
                  <ArrowRight size={15} />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/90 hover:bg-white text-gray-900 border border-white/60 shadow-theme-xs px-6 py-3 text-xs sm:text-sm font-bold transition-all active:scale-[0.98] no-underline"
                >
                  <span>How It Works</span>
                </a>
              </div>
            </div>

            {/* Right Map */}
            <div id="shops" className="relative min-w-0">
              <NavalMap />
            </div>
          </div>
        </div>

        {/* Bottom: Compact Feature Section */}
        <div className="relative z-20 w-full max-w-[1240px] mx-auto px-4 sm:px-6 pb-4 pt-1 flex-shrink-0 font-outfit">
          <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/40 dark:border-gray-800 shadow-theme-sm p-3 sm:p-3.5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-800">
              {/* Faster Completion */}
              <div className="flex items-center gap-3 px-2">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0 border border-brand-100 dark:border-brand-500/20">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white m-0">Faster Completion</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight m-0 mt-0.5">
                    Distance, queue & time optimization.
                  </p>
                </div>
              </div>

              {/* Real-Time Location */}
              <div className="flex items-center gap-3 px-2 pt-2 sm:pt-0">
                <div className="w-9 h-9 rounded-xl bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0 border border-success-100 dark:border-success-500/20">
                  <MapPin size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white m-0">Real-Time Location</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight m-0 mt-0.5">
                    Shortest path routing in Naval.
                  </p>
                </div>
              </div>

              {/* Queue Visibility */}
              <div className="flex items-center gap-3 px-2 pt-2 sm:pt-0">
                <div className="w-9 h-9 rounded-xl bg-warning-50 dark:bg-warning-500/10 text-warning-600 dark:text-warning-400 flex items-center justify-center shrink-0 border border-warning-100 dark:border-warning-500/20">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white m-0">Queue Visibility</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight m-0 mt-0.5">
                    Live customers & turnaround estimates.
                  </p>
                </div>
              </div>

              {/* Verified Shops */}
              <div className="flex items-center gap-3 px-2 pt-2 sm:pt-0">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-100 dark:border-brand-500/20">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white m-0">Verified Shops</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight m-0 mt-0.5">
                    Trusted local printing partners.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: How It Works & About Sections */}
      <main className="font-outfit">
        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 sm:py-20 bg-gray-950/80 backdrop-blur-md border-t border-white/10 scroll-mt-6 text-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 backdrop-blur-sm text-xs font-bold text-brand-300 uppercase tracking-wider mb-3">
                How It Works
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white m-0 drop-shadow-sm">
                Make Smarter Printing Decisions in Naval.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-gray-300 leading-relaxed m-0">
                PrintDayon connects students and customers to verified printing shops with shortest-path road routing and real-time queue intelligence.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/30 dark:border-gray-800 p-6 shadow-theme-md text-gray-900 dark:text-white">
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center mb-4">
                  <Route size={22} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white m-0 mb-2">
                  1. Shortest-Path Road Routing
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                  Calculates walking and riding road distances and travel times across Naval's street network directly to verified print shops using Dijkstra's algorithm.
                </p>
              </div>

              {/* Card 2 */}
              <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/30 dark:border-gray-800 p-6 shadow-theme-md text-gray-900 dark:text-white">
                <div className="w-12 h-12 rounded-xl bg-warning-50 dark:bg-warning-500/10 text-warning-600 dark:text-warning-400 border border-warning-100 dark:border-warning-500/20 flex items-center justify-center mb-4">
                  <Clock3 size={22} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white m-0 mb-2">
                  2. Real-Time Queue Visibility
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                  Never stand in campus lines blindly. View live customer queues, ongoing print orders, and estimated completion times before heading out.
                </p>
              </div>

              {/* Card 3 */}
              <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/30 dark:border-gray-800 p-6 shadow-theme-md text-gray-900 dark:text-white">
                <div className="w-12 h-12 rounded-xl bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 border border-success-100 dark:border-success-500/20 flex items-center justify-center mb-4">
                  <Zap size={22} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white m-0 mb-2">
                  3. Multi-Criteria Recommendation
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                  Combines road distance, queue congestion, printing turnaround, and pricing to automatically recommend the optimal shop for quick pickup.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="py-16 sm:py-20 bg-gray-950/90 backdrop-blur-md border-t border-white/10 scroll-mt-6 text-white">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 backdrop-blur-sm text-xs font-bold text-brand-300 uppercase tracking-wider mb-3">
                  About PrintDayon
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white m-0 drop-shadow-sm">
                  Built for the Naval Community.
                </h2>
                <p className="mt-3 text-sm text-gray-300 leading-relaxed m-0">
                  PrintDayon is an academic thesis project developed to bridge students, customers, and printing press operators into a centralized, transparent digital printing ecosystem in Naval, Biliran.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/30 dark:border-gray-800 p-5 shadow-theme-md text-gray-900 dark:text-white">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500 flex items-center justify-center mb-3">
                    <GraduationCap size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white m-0 mb-1">For Students</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                    Skip lines during project deadlines and rush hours with real-time queue visibility.
                  </p>
                </div>

                <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/30 dark:border-gray-800 p-5 shadow-theme-md text-gray-900 dark:text-white">
                  <div className="w-10 h-10 rounded-xl bg-warning-50 dark:bg-warning-500/10 text-warning-600 dark:text-warning-400 flex items-center justify-center mb-3">
                    <BriefcaseBusiness size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white m-0 mb-1">For Customers</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                    Submit document prints, photocopy jobs, and thesis bookbinding with scheduled pickups.
                  </p>
                </div>

                <div className="rounded-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/30 dark:border-gray-800 p-5 shadow-theme-md text-gray-900 dark:text-white">
                  <div className="w-10 h-10 rounded-xl bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 flex items-center justify-center mb-3">
                    <Printer size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white m-0 mb-1">For Print Shops</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed m-0">
                    Manage incoming workloads, organize queues, and reduce physical crowding in-store.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contact" className="bg-gray-950/95 backdrop-blur-md text-white py-8 border-t border-white/10 font-outfit">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="PrintDayon Logo" className="h-6 w-6 object-contain" />
            <span className="font-bold text-base text-white">PrintDayon</span>
            <span className="text-xs text-white/50">| Online Printing System</span>
          </div>
          <p className="text-xs text-white/70 m-0">
            An Academic Thesis Project &copy; {new Date().getFullYear()} Naval, Biliran, Philippines.
          </p>
        </div>
      </footer>
    </div>
  );
}
