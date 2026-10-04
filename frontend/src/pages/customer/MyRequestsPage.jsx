import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { requestAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  FileText, Search, RefreshCw,
  Clock, ArrowRight, Printer, Ticket, X,
  Zap, AlertTriangle, Store, CheckCircle2,
  ChevronLeft, ChevronRight, RotateCcw, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import ShopFacadeImage from '../../components/common/ShopFacadeImage';

const STATUS_LABELS = {
  all: 'All Orders',
  pending: 'Pending',
  submitted: 'Submitted',
  accepted: 'Accepted',
  queued: 'In Queue',
  printing: 'Printing',
  ready: 'Ready for Pickup',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  completed: 'Completed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
};

const STATUS_CONFIGS = {
  submitted: {
    label: 'Submitted',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  accepted: {
    label: 'Accepted',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
    dotClass: 'bg-blue-600',
  },
  queued: {
    label: 'In Queue',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20',
    dotClass: 'bg-purple-600',
  },
  printing: {
    label: 'Printing',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
    dotClass: 'bg-sky-600',
  },
  ready: {
    label: 'Ready for Pickup',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dotClass: 'bg-emerald-600',
  },
  ready_for_pickup: {
    label: 'Ready for Pickup',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dotClass: 'bg-emerald-600',
  },
  picked_up: {
    label: 'Picked Up',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20',
    dotClass: 'bg-teal-600',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    dotClass: 'bg-gray-500',
  },
  rejected: {
    label: 'Declined',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    dotClass: 'bg-rose-600',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
    dotClass: 'bg-orange-500',
  },
  declined: {
    label: 'Declined',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    dotClass: 'bg-rose-600',
  },
  on_hold: {
    label: 'On Hold',
    badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20',
    dotClass: 'bg-yellow-600',
  },
};

export default function MyRequestsPage() {
  const navigate = useNavigate();
  const { socket } = useSocket() || {};
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    ['active', 'completed', 'cancelled', 'all'].includes(tabParam) ? tabParam : 'active'
  );

  useEffect(() => {
    if (tabParam && ['active', 'completed', 'cancelled', 'all'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  const fetchRequests = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    setError(null);
    try {
      const params = { page, limit: 30 };
      const res = await requestAPI.getMyRequests(params);
      const items = res.data?.requests || res.data?.data?.requests || [];
      setRequests(items);
      setTotalPages(res.data?.totalPages || res.data?.data?.totalPages || 1);
    } catch (err) {
      console.error('Failed to load printing requests:', err);
      setError('Could not connect to the printing server. Please check your network connection.');
      if (!isSilent) toast.error('Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time socket listeners for immediate status reflection
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchRequests(true);

    socket.on('request:accepted', handleUpdate);
    socket.on('request:queued', handleUpdate);
    socket.on('request:printing', handleUpdate);
    socket.on('request:ready', handleUpdate);
    socket.on('request:picked_up', handleUpdate);
    socket.on('request:completed', handleUpdate);
    socket.on('request:cancelled', handleUpdate);
    socket.on('request:rejected', handleUpdate);
    socket.on('request:on_hold', handleUpdate);
    socket.on('request:status_changed', handleUpdate);

    return () => {
      socket.off('request:accepted', handleUpdate);
      socket.off('request:queued', handleUpdate);
      socket.off('request:printing', handleUpdate);
      socket.off('request:ready', handleUpdate);
      socket.off('request:picked_up', handleUpdate);
      socket.off('request:completed', handleUpdate);
      socket.off('request:cancelled', handleUpdate);
      socket.off('request:rejected', handleUpdate);
      socket.off('request:on_hold', handleUpdate);
      socket.off('request:status_changed', handleUpdate);
    };
  }, [socket, fetchRequests]);

  // Derived real summary counts for tabs
  const stats = useMemo(() => {
    let active = 0;
    let completed = 0;
    let cancelled = 0;

    requests.forEach((r) => {
      const s = r.status?.toLowerCase();
      if (['pending', 'submitted', 'accepted', 'queued', 'printing', 'ready', 'ready_for_pickup', 'on_hold'].includes(s)) {
        active++;
      } else if (s === 'completed' || s === 'picked_up') {
        completed++;
      } else if (s === 'cancelled' || s === 'rejected' || s === 'declined') {
        cancelled++;
      }
    });

    return { active, completed, cancelled, total: requests.length };
  }, [requests]);

  // Filter requests based on active tab and search keyword
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // 1. Tab filtering (Active vs Completed vs Cancelled vs All)
      if (activeTab === 'active') {
        if (['completed', 'picked_up', 'cancelled', 'rejected', 'declined'].includes(r.status)) return false;
      } else if (activeTab === 'completed') {
        if (!['completed', 'picked_up'].includes(r.status)) return false;
      } else if (activeTab === 'cancelled') {
        if (!['cancelled', 'rejected', 'declined'].includes(r.status)) return false;
      }

      // 2. Search query filtering
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const shopName = (r.shopId?.shopName || r.shopName || '').toLowerCase();
      const docName = (r.documentId?.originalFilename || r.originalFilename || '').toLowerCase();
      const claimCode = (r.claimCode || '').toLowerCase();
      const orderId = (r._id || '').toLowerCase();
      return shopName.includes(q) || docName.includes(q) || claimCode.includes(q) || orderId.includes(q);
    });
  }, [requests, activeTab, searchQuery]);

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-5 pb-12 font-outfit fade-in">

      {/* ==================================================
          UNIFIED CONTROLS: Status Tabs, Search, & Primary Actions
          (Eliminated redundant "My Orders" heading card since top navbar already displays page title)
      ================================================== */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 sm:p-3 shadow-theme-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Status Tabs with Integrated Accurate Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
          {[
            { id: 'active', label: 'Active', count: stats.active, icon: Clock },
            { id: 'completed', label: 'Completed', count: stats.completed, icon: CheckCircle2 },
            { id: 'cancelled', label: 'Cancelled', count: stats.cancelled, icon: AlertTriangle },
            { id: 'all', label: 'All Orders', count: stats.total, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border-none cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-2xs'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar Controls: Search + Sync Live + Find Shop */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
          {/* Clean Search Input */}
          <div className="relative flex-1 sm:w-56 md:w-64 lg:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by document, shop, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/80 text-gray-900 dark:text-white text-xs sm:text-sm font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search input"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-transparent border-none cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sync Live Button */}
          <button
            type="button"
            onClick={() => fetchRequests(false)}
            disabled={refreshing}
            aria-label="Refresh and synchronize orders"
            title="Sync Live Orders"
            className="h-9 sm:h-9.5 px-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-theme-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0 flex-1 sm:flex-none"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'} />
            <span className="whitespace-nowrap">{refreshing ? 'Syncing...' : 'Sync Live'}</span>
          </button>

          {/* Find a Printing Shop CTA */}
          <Link
            to="/find-shop"
            className="h-9 sm:h-9.5 px-3.5 sm:px-4 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-theme-xs transition-colors no-underline shrink-0 flex-1 sm:flex-none whitespace-nowrap"
          >
            <Printer size={14} strokeWidth={2.4} />
            <span>Find a Printing Shop</span>
          </Link>
        </div>
      </div>

      {/* ==================================================
          3. CONTENT AREA: Skeleton Loading, Error, Empty, or Cards
      ================================================== */}
      {loading ? (
        /* Localized Skeleton Loader (No blank screen) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((sk) => (
            <div
              key={sk}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-4 animate-pulse shadow-theme-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-md w-3/4" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800/60 rounded-md w-1/2" />
                </div>
              </div>
              <div className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State with Retry */
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-6 text-center max-w-md mx-auto my-4 space-y-3">
          <AlertCircle size={28} className="text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white m-0">Failed to Load Orders</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 m-0">{error}</p>
          <button
            type="button"
            onClick={() => fetchRequests(false)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-theme-xs"
          >
            Try Again
          </button>
        </div>
      ) : filteredRequests.length === 0 ? (
        /* ==================================================
            4. PURPOSEFUL, WELL-PROPORTIONED EMPTY STATES
        ================================================== */
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 sm:p-12 text-center shadow-theme-xs space-y-3">
          {/* Centered Soft Rounded Icon */}
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900/50 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto shadow-2xs">
            {searchQuery ? (
              <Search size={22} />
            ) : activeTab === 'completed' ? (
              <CheckCircle2 size={22} className="text-emerald-500" />
            ) : activeTab === 'cancelled' ? (
              <AlertTriangle size={22} className="text-orange-500" />
            ) : (
              <FileText size={22} className="text-brand-600 dark:text-brand-400" />
            )}
          </div>

          {/* Title & Description */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0">
              {searchQuery
                ? 'No matching print orders'
                : activeTab === 'active'
                ? 'No active orders yet'
                : activeTab === 'completed'
                ? 'No completed orders yet'
                : activeTab === 'cancelled'
                ? 'No cancelled orders'
                : 'No print requests found'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 mb-0 max-w-sm mx-auto leading-relaxed">
              {searchQuery
                ? `We couldn't find any orders matching "${searchQuery}".`
                : activeTab === 'active'
                ? (stats.completed > 0 || stats.cancelled > 0)
                  ? 'Your print requests will appear here while in progress.'
                  : 'Your print requests will appear here once you place an order.'
                : activeTab === 'completed'
                ? 'Completed and picked-up print requests will be archived here.'
                : activeTab === 'cancelled'
                ? 'Orders that were declined or cancelled will appear here.'
                : 'You have not submitted any print jobs yet.'}
            </p>
          </div>

          {/* Contextual Action */}
          <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors cursor-pointer shadow-theme-xs border-none"
              >
                Clear Search
              </button>
            ) : activeTab === 'active' && stats.completed > 0 ? (
              <button
                type="button"
                onClick={() => handleTabChange('completed')}
                className="px-4 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/60 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-brand-200 dark:border-brand-800"
              >
                <CheckCircle2 size={14} />
                <span>View Completed Orders ({stats.completed})</span>
              </button>
            ) : (
              <Link
                to="/find-shop"
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-theme-xs transition-colors no-underline"
              >
                <Printer size={15} />
                <span>Find a Printing Shop</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================
            5. STRUCTURED RESPONSIVE ORDER CARDS
               (Mobile 1-col, Tablet 2-col, Desktop 3-col)
        ================================================== */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredRequests.map((req) => {
            const shopObj = req.shopId || {};
            const shopName = shopObj.shopName || req.shopName || 'Printing Shop';
            const docName = req.documentId?.originalFilename || req.originalFilename || 'Document.pdf';
            const pages = req.printingSpecifications?.totalPages || 1;
            const copies = req.printingSpecifications?.copies || 1;
            const isColor = req.printingSpecifications?.colorMode === 'color';
            const paperSize = req.printingSpecifications?.paperSize || 'A4';
            const statusConfig = STATUS_CONFIGS[req.status] || STATUS_CONFIGS.pending;
            const statusLabel = STATUS_LABELS[req.status] || req.status?.toUpperCase();
            const orderCode = req._id ? `PR-${req._id.slice(-5).toUpperCase()}` : 'PR-ORDER';
            const formattedDate = new Date(req.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const totalCost = parseFloat(req.estimatedCost || req.finalCost || 0).toFixed(2);
            const isFinished = ['completed', 'picked_up', 'rejected', 'cancelled'].includes(req.status);

            return (
              <div
                key={req._id}
                className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-theme-xs hover:shadow-theme-sm transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Shop Info & Status Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Shop Avatar */}
                      <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                        <ShopFacadeImage
                          src={shopObj.storefrontPhotoUrl}
                          shopName={shopName}
                          className="w-full h-full"
                          textClassName="text-xs font-bold"
                        />
                      </div>

                      {/* Shop Title & Code */}
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 truncate">
                          {orderCode} • {formattedDate}
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white m-0 truncate leading-snug">
                          {shopName}
                        </h3>
                      </div>
                    </div>

                    {/* Status Badge + Rush Pill */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 ${statusConfig.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                        <span>{statusLabel}</span>
                      </span>

                      {req.isRush && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white inline-flex items-center gap-1 uppercase tracking-wider shadow-xs">
                          <Zap size={10} className="fill-white" /> Rush
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Document & Specification Details */}
                  <div className="rounded-xl bg-gray-50/80 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 p-3 space-y-2">
                    {/* Document Title */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-900 dark:text-white min-w-0">
                      <FileText size={15} className="text-brand-500 shrink-0" />
                      <span className="truncate">{docName}</span>
                    </div>

                    {/* Specifications List */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <span><strong>{pages}</strong> {pages === 1 ? 'page' : 'pages'} × <strong>{copies}</strong> {copies === 1 ? 'copy' : 'copies'}</span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span><strong>{isColor ? 'Color' : 'B&W'}</strong></span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span><strong>{paperSize}</strong></span>
                    </div>

                    {/* Claim Code Pill if available */}
                    {req.claimCode && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 text-xs">
                        <Ticket size={13} className="text-gray-500" />
                        <span className="text-gray-600 dark:text-gray-300 font-semibold">
                          Claim Code: <span className="font-mono font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-md">{req.claimCode}</span>
                        </span>
                      </div>
                    )}

                    {/* Delay Notice Banner */}
                    {req.delayNotice?.isDelayed && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                        <Zap size={13} className="text-amber-600 shrink-0" />
                        <span className="truncate">
                          Power Interruption Delay {req.delayNotice.estimatedDelayMinutes ? `(~${req.delayNotice.estimatedDelayMinutes}m)` : ''}
                        </span>
                      </div>
                    )}

                    {/* Shop Notes */}
                    {!req.delayNotice?.isDelayed && req.shopNotes && req.shopNotes.length > 0 && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs font-medium">
                        <AlertTriangle size={13} className="text-blue-600 shrink-0" />
                        <span className="truncate">
                          Notice: &ldquo;{req.shopNotes[req.shopNotes.length - 1].message}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Price & Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                      Total Amount
                    </span>
                    <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight mt-0.5">
                      ₱{totalCost}
                    </div>
                  </div>

                  {/* Context-Appropriate Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Print Again for finished orders */}
                    {isFinished && (
                      <button
                        type="button"
                        onClick={() => navigate('/submit-request', { state: { shop: shopObj } })}
                        title="Submit a new print job with this shop"
                        className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 text-xs font-bold inline-flex items-center gap-1.5 shadow-theme-xs transition-colors cursor-pointer"
                      >
                        <RotateCcw size={12} />
                        <span>Print Again</span>
                      </button>
                    )}

                    {/* Primary Navigation Button */}
                    <Link
                      to={`/my-requests/${req._id}`}
                      className={`h-8 px-3.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-theme-xs transition-colors no-underline ${
                        isFinished
                          ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-white'
                          : 'bg-brand-600 hover:bg-brand-700 text-white'
                      }`}
                    >
                      <span>{isFinished ? 'Details' : 'Track Order'}</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================
          6. PAGINATION (When pages exceed 1)
      ================================================== */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-theme-xs inline-flex items-center gap-1 transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-theme-xs inline-flex items-center gap-1 transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

    </div>
  );
}
