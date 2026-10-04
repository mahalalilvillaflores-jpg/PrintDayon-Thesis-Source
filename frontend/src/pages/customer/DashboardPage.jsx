import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { requestAPI, recommendationAPI, shopAPI } from '../../services/api';
import {
  Plus, Clock, ChevronRight, Store, FileText,
  Building2, Search, X, Sparkles, Zap, CheckCircle2,
  CreditCard, ShieldCheck, Layers, Printer, Copy,
  ArrowUpRight, ArrowUp, ArrowDown, MoreVertical,
  MapPin, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import RecommendedShopCard from '../../components/shops/RecommendedShopCard';
import ShopProfileModal from '../../components/shops/ShopProfileModal';
import ShopFacadeImage from '../../components/common/ShopFacadeImage';

const NAVAL_COORDS = { lat: 11.56437, lng: 124.39964 }; // Sitio Butay, P.I. Garcia, Naval (BiPSU Student Hub)

// In-memory stale-while-revalidate cache for instant dashboard navigation
const dashboardCache = {
  userId: null,
  data: null,
  timestamp: 0,
};

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket() || {};

  const displayName = useMemo(() => {
    if (user?.fullName) return user.fullName;
    const parts = [
      user?.firstName,
      user?.middleName ? `${user.middleName.charAt(0)}.` : '',
      user?.lastName,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    return user?.name || user?.username || 'Customer';
  }, [user]);

  const initialLetter = (displayName || 'M').charAt(0).toUpperCase();

  const isCached = dashboardCache.userId === user?._id && dashboardCache.data;
  
  const [loading, setLoading] = useState(!isCached);
  const [activeOrder, setActiveOrder] = useState(() => isCached ? dashboardCache.data.activeOrder : null);
  const [recommendedShops, setRecommendedShops] = useState(() => isCached ? dashboardCache.data.recommendedShops : []);
  const [recentOrders, setRecentOrders] = useState(() => isCached ? dashboardCache.data.recentOrders : []);
  const [allOrders, setAllOrders] = useState(() => isCached ? dashboardCache.data.allOrders : []);
  const [shopStats, setShopStats] = useState(() => isCached ? dashboardCache.data.shopStats : { open: 0, total: 0 });
  const [fastestShop, setFastestShop] = useState(() => isCached ? dashboardCache.data.fastestShop : null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfileShop, setSelectedProfileShop] = useState(null);

  const fetchData = useCallback(async (silent = false, coords = NAVAL_COORDS) => {
    // If we have cache and we're just remounting, do it silently (stale-while-revalidate)
    const isSWR = dashboardCache.userId === user?._id && dashboardCache.data;
    if (!silent && !isSWR) {
      setLoading(true);
    }

    try {
      // Fetch Customer Orders, Recommendations, and Shop Stats in PARALLEL
      const [reqResult, recResult, statsResult] = await Promise.allSettled([
        requestAPI.getMyRequests({ limit: 50 }),
        recommendationAPI.getRankedShops({
          latitude: coords.lat,
          longitude: coords.lng,
          limit: 3,
        }),
        shopAPI.getStats(),
      ]);

      // 1. Process Orders
      let orders = [];
      if (reqResult.status === 'fulfilled') {
        const reqRes = reqResult.value;
        orders = reqRes?.data?.requests || reqRes?.requests || [];
        setAllOrders(orders);

        const active = orders.find(
          (o) => !['completed', 'cancelled', 'rejected'].includes(o.status)
        );
        setActiveOrder(active || null);
        setRecentOrders(orders.slice(0, 5));
      }

      // 2. Process Shop Stats (ultra-lightweight ~70 byte endpoint)
      if (statsResult.status === 'fulfilled') {
        const statsData = statsResult.value?.data?.data || statsResult.value?.data || {};
        setShopStats({
          open: statsData.open ?? statsData.currentlyOpenCount ?? 0,
          total: statsData.total ?? 0,
        });
      }

      // 3. Process Recommendations
      if (recResult.status === 'fulfilled') {
        const recRes = recResult.value;
        const ranked = recRes?.data?.ranked || recRes?.ranked || recRes?.data?.shops || [];
        if (ranked.length > 0) {
          setRecommendedShops(ranked.slice(0, 3));
          setFastestShop(ranked[0]);
        }
        // Fallback for shopStats if stats endpoint failed but recommendations succeeded
        if (statsResult.status !== 'fulfilled') {
          const totalShops = recRes?.data?.data?.totalShops ?? recRes?.data?.totalShops ?? ranked.length;
          const openShops = recRes?.data?.data?.availableShops ?? recRes?.data?.availableShops ?? ranked.filter((s) => s.isOpen).length;
          setShopStats({ open: openShops, total: totalShops });
        }
      }

      // 4. Save to Cache
      dashboardCache.userId = user?._id;
      dashboardCache.timestamp = Date.now();
      const currentActive = reqResult.status === 'fulfilled' ? orders.find((o) => !['completed', 'cancelled', 'rejected'].includes(o.status)) : activeOrder;
      
      dashboardCache.data = {
        activeOrder: currentActive || null,
        recentOrders: reqResult.status === 'fulfilled' ? orders.slice(0, 5) : recentOrders,
        allOrders: reqResult.status === 'fulfilled' ? orders : allOrders,
        shopStats: {
          open: statsResult.status === 'fulfilled' ? (statsResult.value?.data?.data?.open ?? statsResult.value?.data?.data?.currentlyOpenCount ?? 0) : shopStats.open,
          total: statsResult.status === 'fulfilled' ? (statsResult.value?.data?.data?.total ?? 0) : shopStats.total,
        },
        recommendedShops: recResult.status === 'fulfilled' ? (recResult.value?.data?.ranked || recResult.value?.ranked || recResult.value?.data?.shops || []).slice(0, 3) : recommendedShops,
        fastestShop: recResult.status === 'fulfilled' ? (recResult.value?.data?.ranked || recResult.value?.ranked || recResult.value?.data?.shops || [])[0] : fastestShop,
      };

    } catch (err) {
      console.error('Dashboard data load error:', err);
      if (!silent) {
        toast.error('Failed to load dashboard updates');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // 1. Initial fast parallel load using BiPSU / Naval default coordinates
    fetchData(false, NAVAL_COORDS);

    // 2. GPS check: Only update if user coordinates differ significantly (> 100m) from initial coords,
    // avoiding duplicate network requests when user is already at the campus hub.
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos?.coords?.latitude && pos?.coords?.longitude) {
            const gpsCoords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
            const latDiff = Math.abs(gpsCoords.lat - NAVAL_COORDS.lat);
            const lngDiff = Math.abs(gpsCoords.lng - NAVAL_COORDS.lng);
            const approxMeters = Math.hypot(latDiff * 111000, lngDiff * 111000 * Math.cos(gpsCoords.lat * Math.PI / 180));

            if (approxMeters > 100) {
              recommendationAPI.getRankedShops({
                latitude: gpsCoords.lat,
                longitude: gpsCoords.lng,
                limit: 3,
              }).then((recRes) => {
                const ranked = recRes?.data?.ranked || recRes?.ranked || recRes?.data?.shops || [];
                if (ranked.length > 0) {
                  setRecommendedShops(ranked.slice(0, 3));
                  setFastestShop(ranked[0]);
                }
              }).catch(() => {});
            }
          }
        },
        () => {}, // Gracefully ignore permission denials or timeouts
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, [fetchData]);

  // Real-time updates via Socket
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchData(true);
    };

    socket.on('request:accepted', handleUpdate);
    socket.on('request:queued', handleUpdate);
    socket.on('request:printing', handleUpdate);
    socket.on('request:ready', handleUpdate);
    socket.on('request:picked_up', handleUpdate);
    socket.on('request:completed', handleUpdate);
    socket.on('request:status_changed', handleUpdate);
    socket.on('shop:queue_changed', handleUpdate);
    socket.on('shop:updated', handleUpdate);

    return () => {
      socket.off('request:accepted', handleUpdate);
      socket.off('request:queued', handleUpdate);
      socket.off('request:printing', handleUpdate);
      socket.off('request:ready', handleUpdate);
      socket.off('request:picked_up', handleUpdate);
      socket.off('request:completed', handleUpdate);
      socket.off('request:status_changed', handleUpdate);
      socket.off('shop:queue_changed', handleUpdate);
      socket.off('shop:updated', handleUpdate);
    };
  }, [socket, fetchData]);

  // Computed metrics for TailAdmin KPI cards
  const metrics = useMemo(() => {
    const completed = allOrders.filter((o) => o.status === 'completed');
    const spent = completed.reduce((sum, o) => sum + (Number(o.estimatedCost) || 0), 0);
    const activeCount = allOrders.filter((o) => !['completed', 'cancelled', 'rejected'].includes(o.status)).length;
    return {
      totalOrders: allOrders.length,
      completedCount: completed.length,
      totalSpent: spent,
      activeCount,
    };
  }, [allOrders]);

  // Monthly print volume aggregated by month for customer activity chart
  const monthlyPrintData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();

    const counts = new Array(12).fill(0);
    const amounts = new Array(12).fill(0);

    allOrders.forEach((order) => {
      const date = new Date(order.createdAt || order.updatedAt || Date.now());
      const m = date.getMonth();
      counts[m] += 1;
      amounts[m] += Number(order.estimatedCost) || 0;
    });

    return monthNames.map((month, idx) => {
      const realCount = counts[idx];
      const realAmount = amounts[idx];
      return {
        month,
        value: realCount,
        realCount,
        amount: realAmount,
        isCurrent: idx === currentMonth,
      };
    });
  }, [allOrders]);

  const maxChartValue = useMemo(() => {
    const maxVal = Math.max(...monthlyPrintData.map((d) => d.value), 4);
    return Math.ceil(maxVal / 4) * 4 || 12;
  }, [monthlyPrintData]);




  const displayedShops = useMemo(() => {
    if (!searchQuery.trim()) return recommendedShops;
    const q = searchQuery.toLowerCase().trim();
    return recommendedShops.filter((s) =>
      s.shopName?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q) ||
      s.services?.some((srv) => (srv.name || srv.serviceName || '')?.toLowerCase().includes(q))
    );
  }, [recommendedShops, searchQuery]);

  const handleSeeLocation = (shop) => {
    const shopId = shop.shopId || shop._id;
    navigate('/find-shop', {
      state: {
        selectedShopId: shopId,
        shop,
        latitude: shop.latitude || shop.location?.latitude,
        longitude: shop.longitude || shop.location?.longitude,
      },
    });
  };

  const handleViewProfile = (shop) => {
    setSelectedProfileShop(shop);
  };

  const handlePrintHere = (shop) => {
    navigate('/submit-request', { state: { shop } });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
      case 'pending':
        return { label: 'Submitted', className: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400 border border-warning-200 dark:border-warning-500/20' };
      case 'accepted':
        return { label: 'Accepted', className: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300 border border-brand-200 dark:border-brand-500/20' };
      case 'queued':
        return { label: 'In Queue', className: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20' };
      case 'printing':
        return { label: 'Printing', className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20' };
      case 'ready':
      case 'ready_for_pickup':
        return { label: 'Ready for Pickup', className: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400 border border-success-200 dark:border-success-500/20' };
      case 'picked_up':
        return { label: 'Picked Up', className: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300 border border-teal-200 dark:border-teal-500/20' };
      case 'completed':
        return { label: 'Completed', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700' };
      case 'rejected':
        return { label: 'Declined', className: 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400 border border-error-200 dark:border-error-500/20' };
      case 'cancelled':
        return { label: 'Cancelled', className: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20' };
      default:
        return { label: status || 'Active', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700' };
    }
  };

  const getReasonLabel = (shop) => {
    if (shop.recommendationReason) return shop.recommendationReason;
    const reasons = [];
    if (shop.isOpen) reasons.push('Open now');
    if ((shop.queueCount || 0) <= 2) reasons.push('Short queue');
    if (shop.estimatedCompletionMinutes && shop.estimatedCompletionMinutes <= 15) reasons.push('Fast printing');
    return reasons.join(' • ') || 'Available for your service';
  };



  return (
    <div className="w-full flex flex-col gap-6 pb-12 fade-in font-outfit">

      {/* 1. WELCOME HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-theme-sm">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
          
          {/* Left: Avatar + Greeting */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#4F46E5] to-[#3B82F6] text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-blue-500/25 shrink-0">
              {initialLetter}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-lg lg:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-1.5 m-0 leading-snug">
                <span className="truncate">Welcome back, {displayName}!</span>
                <span className="shrink-0">👋</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1 font-normal m-0 truncate">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">Ready to print documents • {shopStats.open > 0 ? `${shopStats.open} shops are available` : 'All shops are available'}</span>
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full md:w-auto mt-1 md:mt-0">
            <button
              type="button"
              onClick={() => navigate('/my-requests')}
              className="inline-flex justify-center items-center gap-2 px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors shadow-theme-xs cursor-pointer"
            >
              <FileText size={15} className="text-gray-500 dark:text-gray-400 shrink-0" />
              <span>My Requests</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/submit-request')}
              className="inline-flex justify-center items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-theme-xs transition-colors cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} className="shrink-0" />
              <span>Submit Print Request</span>
              <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 hidden sm:inline" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. REAL CUSTOMER PRINT METRICS */}
      <div className="flex flex-col gap-6">

        {/* Top 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Metric 1: Active Print Orders */}
          <div
            onClick={() => activeOrder && navigate(`/my-requests/${activeOrder._id}`)}
            className={`rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs hover:shadow-theme-sm transition-all flex flex-col justify-between ${
              activeOrder ? 'cursor-pointer hover:border-brand-500/40' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 shadow-theme-xs">
                <Clock size={22} />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block truncate">
                Active Print Orders
              </span>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white font-outfit tracking-tight truncate max-w-[65%]">
                  {loading ? (
                    <span className="inline-block w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  ) : activeOrder
                    ? activeOrder.status === 'printing'
                      ? 'Printing'
                      : activeOrder.queuePosition
                      ? `#${activeOrder.queuePosition}`
                      : 'In Queue'
                    : metrics.activeCount}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold shrink-0 ${
                    metrics.activeCount > 0
                      ? 'text-warning-700 bg-warning-50 dark:bg-warning-500/10 dark:text-warning-400'
                      : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400'
                  }`}
                >
                  {metrics.activeCount > 0 ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />
                      <span>Live Job</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} strokeWidth={2.5} />
                      <span>Ready</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              {activeOrder
                ? `${activeOrder.shopId?.shopName || 'Printing Shop'} • Click to track`
                : 'Ready for your next document'}
            </div>
          </div>

          {/* Metric 2: Total Orders */}
          <div
            onClick={() => navigate('/my-requests')}
            className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs hover:shadow-theme-sm transition-all flex flex-col justify-between cursor-pointer hover:border-brand-500/40"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700 shadow-theme-xs">
                <FileText size={22} />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block truncate">
                Total Print Orders
              </span>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white font-outfit tracking-tight truncate max-w-[65%]">
                  {loading ? (
                    <span className="inline-block w-12 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  ) : (
                    metrics.totalOrders
                  )}
                </span>
                <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                  <span>{metrics.completedCount} Completed</span>
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              {shopStats.open} verified printing hubs open in Naval
            </div>
          </div>

          {/* Metric 3: Total Amount Spent */}
          <div
            onClick={() => navigate('/my-requests?tab=completed')}
            className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900 shadow-theme-xs hover:shadow-theme-sm transition-all flex flex-col justify-between cursor-pointer hover:border-brand-500/40 sm:col-span-2 lg:col-span-1"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-theme-xs">
                <CreditCard size={22} />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block truncate">
                Total Amount Spent
              </span>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white font-outfit tracking-tight truncate max-w-[65%]">
                  {loading ? (
                    <span className="inline-block w-20 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  ) : (
                    `₱${Number(metrics.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </span>
                <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 shrink-0">
                  <span>{metrics.completedCount} Jobs</span>
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              Overall printing expense history in Naval
            </div>
          </div>
        </div>

        {/* Monthly Print Activity Bar Chart (Full Width) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight font-outfit">
                Monthly Print Activity
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Document print volume throughout the academic year
              </p>
            </div>
          </div>

          {/* Chart Grid & Bars or Empty State */}
          {monthlyPrintData.every((d) => d.value === 0) ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                <FileText size={20} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white m-0">No print activity yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[200px]">
                Your monthly print volume will appear here once you submit requests.
              </p>
            </div>
          ) : (
            <div className="relative pt-2 pb-1">
              <div className="relative h-[200px] w-full flex flex-col justify-between">
                {[maxChartValue, Math.round((maxChartValue * 3) / 4), Math.round((maxChartValue * 2) / 4), Math.round((maxChartValue * 1) / 4), 0].map((step, sIdx) => (
                  <div key={sIdx} className="flex items-center w-full">
                    <span className="w-7 text-[11px] font-medium text-gray-400 dark:text-gray-500 text-right pr-2 select-none shrink-0 font-outfit">
                      {step}
                    </span>
                    <div className="flex-1 border-b border-gray-100 dark:border-gray-800/80 w-full" />
                  </div>
                ))}

                {/* Vertical Bars Container */}
                <div className="absolute inset-y-0 left-7 right-0 flex items-end justify-between px-2 sm:px-6 pt-3">
                  {monthlyPrintData.map((bar) => {
                    const heightPercent = maxChartValue > 0 ? (bar.value / maxChartValue) * 100 : 0;
                    return (
                      <div
                        key={bar.month}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-8 hidden group-hover:flex z-30 px-2 py-0.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-bold shadow-lg whitespace-nowrap pointer-events-none">
                          {bar.month}: {bar.value} Prints {bar.amount > 0 ? `• ₱${bar.amount.toFixed(0)}` : ''}
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${Math.max(4, heightPercent)}%` }}
                          className={`w-3 sm:w-4 md:w-5 rounded-t-xs sm:rounded-t-sm transition-all duration-300 ${
                            bar.isCurrent
                              ? 'bg-brand-600 group-hover:bg-brand-700'
                              : 'bg-gray-200 dark:bg-gray-700 group-hover:bg-brand-500'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* X Axis Labels */}
              <div className="flex justify-between pl-7 pr-1 pt-3 text-[11px] font-medium text-gray-500 dark:text-gray-400 select-none font-outfit">
                {monthlyPrintData.map((d) => (
                  <div key={d.month} className={`flex-1 text-center ${d.isCurrent ? 'font-bold text-gray-900 dark:text-white' : ''}`}>
                    {d.month}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>





      {/* 5. ACTIVE ORDER TRACKING (IF ANY) */}
      {activeOrder && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white m-0 flex items-center gap-2">
              <Clock size={18} className="text-brand-500" />
              <span>Active Order Tracking</span>
            </h2>
            <Link
              to={`/my-requests/${activeOrder._id}`}
              className="text-xs font-semibold text-brand-500 hover:text-brand-600 dark:text-brand-400 inline-flex items-center gap-1 transition-colors"
            >
              <span>Full Order Details</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-theme-xs flex flex-col gap-4">
            <div className="flex justify-between items-start flex-wrap gap-4">
              {/* Order Shop & Facade */}
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-center shadow-theme-xs">
                  <ShopFacadeImage
                    src={activeOrder.shopId?.storefrontPhotoUrl}
                    shopName={activeOrder.shopId?.shopName}
                    className="w-full h-full"
                    textClassName="text-sm font-bold"
                  />
                </div>

                <div>
                  <div className="text-[11px] font-bold text-brand-500 dark:text-brand-400 uppercase tracking-wider">
                    Order #{activeOrder.claimCode || activeOrder._id.slice(-6).toUpperCase()}
                  </div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white m-0 mt-0.5">
                    {activeOrder.shopId?.shopName || 'Naval Printing Shop'}
                  </h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <FileText size={13} className="text-brand-500" />
                    <span>{activeOrder.documentId?.originalFilename || activeOrder.fileName || 'Document.pdf'}</span>
                  </div>
                </div>
              </div>

              {/* Status Badge & Action */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {(() => {
                  const b = getStatusBadge(activeOrder.status);
                  return (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold shadow-theme-xs inline-flex items-center gap-1.5 ${b.className}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {b.label}
                    </span>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => navigate(`/my-requests/${activeOrder._id}`)}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-theme-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Track Order</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Progress / Queue Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  Queue Position
                </div>
                <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
                  {activeOrder.status === 'printing'
                    ? '⚡ Printing'
                    : (activeOrder.queuePosition ? `Position #${activeOrder.queuePosition}` : 'In queue')}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  Estimated Wait
                </div>
                <div className="text-sm sm:text-base font-bold text-brand-500 dark:text-brand-400 mt-0.5">
                  ~{activeOrder.estimatedWaitingTime ? `${activeOrder.estimatedWaitingTime} mins` : `${activeOrder.estimatedCompletionTime || 15} mins`}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  Order Total
                </div>
                <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-0.5">
                  ₱{activeOrder.estimatedCost ? activeOrder.estimatedCost.toFixed(2) : '0.00'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                  Payment Status
                </div>
                <div className="text-xs sm:text-sm font-semibold text-success-600 dark:text-success-400 mt-0.5">
                  {activeOrder.paymentStatus === 'paid_verifying' ? 'Paid (Verifying)' : (activeOrder.paymentStatus || 'Pending')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. RECOMMENDED SHOPS SECTION */}
      <div>
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tracking-tight m-0">
              Recommended Shops
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 m-0 font-normal">
              Ranked by shortest distance, lowest queue, and customer rating in Naval
            </p>
          </div>

          <Link
            to="/find-shop"
            className="text-xs font-semibold text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors inline-flex items-center gap-1"
          >
            <span>View All Shops</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {/* Search Bar for exploring any store across Naval */}
        <div className="mb-4 flex items-center gap-2 max-w-lg">
          <div className="relative flex-1 flex items-center">
            <Search size={15} className="text-gray-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate('/find-shop', { state: { searchQuery } });
                }
              }}
              placeholder="Search a different store or service in Naval..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 shadow-xs"
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
          <button
            type="button"
            onClick={() => navigate('/find-shop', { state: { searchQuery } })}
            className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            title="Search on map"
          >
            <Search size={13} />
            <span>Search</span>
          </button>
        </div>

        {displayedShops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedShops.map((shop) => (
              <RecommendedShopCard
                key={shop.shopId || shop._id}
                shop={shop}
                onSeeLocation={handleSeeLocation}
                onViewProfile={handleViewProfile}
                onPrintHere={handlePrintHere}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-theme-xs">
            <Store size={32} className="text-gray-400 mx-auto mb-2" />
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white m-0">
              No recommended shops match &ldquo;{searchQuery}&rdquo;
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 my-2">
              Try searching with different keywords or explore all verified shops across Naval.
            </p>
            <div className="flex gap-2 justify-center mt-3">
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 cursor-pointer shadow-theme-xs"
              >
                Clear Search
              </button>
              <button
                type="button"
                onClick={() => navigate('/find-shop', { state: { searchQuery } })}
                className="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-xs font-medium text-white cursor-pointer shadow-theme-xs"
              >
                Search All Shops
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs shadow-theme-xs">
            No shop recommendations currently available. Check the Find Shops directory.
          </div>
        )}
      </div>

      {/* 7. TAILADMIN RECENT ORDERS & RE-ORDER */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white m-0">
              Recent Orders
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
              Your recent print requests in Naval
            </span>
          </div>

          <Link
            to="/my-requests"
            className="text-xs font-semibold text-brand-500 hover:text-brand-600 dark:text-brand-400 inline-flex items-center gap-1 transition-colors"
          >
            <span>View All ({allOrders.length})</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-theme-xs overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            {recentOrders.map((order) => {
              const b = getStatusBadge(order.status);
              const dateStr = order.completedAt || order.updatedAt || order.createdAt;
              const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
              const shopObj = order.shopId;

              return (
                <div
                  key={order._id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">
                          {order.documentId?.originalFilename || order.fileName || 'Document.pdf'}
                        </span>
                        {order.claimCode && (
                          <span className="font-mono text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                            #{order.claimCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-1 flex-wrap leading-tight">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{shopObj?.shopName || 'Printing Shop'}</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span>{formattedDate}</span>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <strong className="text-gray-900 dark:text-white font-bold">₱{order.estimatedCost ? order.estimatedCost.toFixed(2) : '0.00'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto mt-2 sm:mt-0 pl-13 sm:pl-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800 pt-3 sm:pt-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex-1 sm:flex-none text-center sm:text-left ${b.className}`}>
                      {b.label}
                    </span>

                    {shopObj && (
                      <button
                        type="button"
                        onClick={() => navigate('/submit-request', { state: { shop: shopObj } })}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750 text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors shadow-theme-xs cursor-pointer flex-1 sm:flex-none"
                        title="Print again with this shop"
                      >
                        Print Again
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => navigate(`/my-requests/${order._id}`)}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-colors shadow-theme-xs cursor-pointer inline-flex justify-center items-center gap-1 flex-1 sm:flex-none"
                    >
                      <span>Details</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 text-xs shadow-theme-xs">
            No past orders yet. Once your orders are completed, they will appear here.
          </div>
        )}
      </div>

      {/* Detailed Shop Profile Modal */}
      <ShopProfileModal
        shop={selectedProfileShop}
        isOpen={Boolean(selectedProfileShop)}
        onClose={() => setSelectedProfileShop(null)}
        onSeeLocation={handleSeeLocation}
        onPrintHere={handlePrintHere}
      />

    </div>
  );
}

