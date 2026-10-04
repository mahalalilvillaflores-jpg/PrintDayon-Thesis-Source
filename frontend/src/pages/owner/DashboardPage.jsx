import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { shopAPI, requestAPI, documentAPI } from '../../services/api';
import {
  Printer, ChevronRight, FileText, Inbox, Activity, RefreshCw,
  Coins, AlertTriangle, CheckCircle, Wrench,
  Sliders, Clock, CheckCircle2, Zap, Search, Ticket,
  Eye, Check, Ban, FileDown, Users, AlertOctagon,
  X, ChevronDown, RotateCcw, Power, Layers,
  Store, MapPin, ShieldCheck, Plus, Minus, Star, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardContainer } from '../../components/common/UnifiedDashboard';
import DateRangePicker from '../../components/common/DateRangePicker';
import ShopOperationalStatusCard from '../../components/owner/ShopOperationalStatusCard';
import TemporaryClosureModal from '../../components/owner/TemporaryClosureModal';



// Helper: Determine operational status badge & style
function getOperationalBadge(condition, status, isManualClosure = false, closureReason = '') {
  if (isManualClosure) {
    const label = closureReason ? closureReason.replace(/_/g, ' ').toUpperCase() : 'TEMPORARILY CLOSED';
    return {
      label,
      icon: AlertOctagon,
      primary: '#F04438',
      bg: 'bg-error-50 dark:bg-error-500/10',
      border: 'border-error-200 dark:border-error-500/20',
      bannerBorder: 'border-error-200 dark:border-error-500/20',
      accentLine: 'border-l-error-500',
      text: 'text-error-700 dark:text-error-300',
      headingColor: 'text-error-700 dark:text-error-400',
      iconColor: 'text-error-600 dark:text-error-400',
      delayColor: 'text-error-700 dark:text-error-300',
      dot: 'bg-error-500',
    };
  }

  if (status === 'closed' || condition === 'closed') {
    return {
      label: 'CLOSED',
      icon: AlertOctagon,
      primary: '#64748B',
      bg: 'bg-gray-100 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      bannerBorder: 'border-gray-200 dark:border-gray-700',
      accentLine: 'border-l-gray-400',
      text: 'text-gray-600 dark:text-gray-400',
      headingColor: 'text-gray-700 dark:text-gray-300',
      iconColor: 'text-gray-500 dark:text-gray-400',
      delayColor: 'text-gray-600 dark:text-gray-400',
      dot: 'bg-gray-400',
    };
  }

  switch (condition) {
    case 'power_interruption':
      return {
        label: 'POWER OUTAGE',
        icon: Zap,
        primary: '#F04438',
        bg: 'bg-error-50 dark:bg-error-500/10',
        border: 'border-error-200 dark:border-error-500/20',
        bannerBorder: 'border-error-200 dark:border-error-500/20',
        accentLine: 'border-l-error-500',
        text: 'text-error-700 dark:text-error-300',
        headingColor: 'text-error-700 dark:text-error-400',
        iconColor: 'text-error-600 dark:text-error-400',
        delayColor: 'text-error-700 dark:text-error-400',
        dot: 'bg-error-500 animate-pulse',
      };
    case 'high_walkin':
      return {
        label: 'HIGH WALK-IN',
        icon: Users,
        primary: '#F79009',
        bg: 'bg-warning-50 dark:bg-warning-500/10',
        border: 'border-warning-200 dark:border-warning-500/20',
        bannerBorder: 'border-warning-200 dark:border-warning-500/20',
        accentLine: 'border-l-warning-500',
        text: 'text-warning-700 dark:text-warning-300',
        headingColor: 'text-warning-700 dark:text-warning-400',
        iconColor: 'text-warning-600 dark:text-warning-400',
        delayColor: 'text-warning-700 dark:text-warning-400',
        dot: 'bg-warning-500 animate-pulse',
      };
    case 'equipment_problem':
      return {
        label: 'EQUIPMENT ISSUE',
        icon: Wrench,
        primary: '#F04438',
        bg: 'bg-error-50 dark:bg-error-500/10',
        border: 'border-error-200 dark:border-error-500/20',
        bannerBorder: 'border-error-200 dark:border-error-500/20',
        accentLine: 'border-l-error-500',
        text: 'text-error-700 dark:text-error-300',
        headingColor: 'text-error-700 dark:text-error-400',
        iconColor: 'text-error-600 dark:text-error-400',
        delayColor: 'text-error-700 dark:text-error-400',
        dot: 'bg-error-500 animate-pulse',
      };
    case 'service_delay':
      return {
        label: 'SERVICE DELAY',
        icon: AlertTriangle,
        primary: '#F79009',
        bg: 'bg-warning-50 dark:bg-warning-500/10',
        border: 'border-warning-200 dark:border-warning-500/20',
        bannerBorder: 'border-warning-200 dark:border-warning-500/20',
        accentLine: 'border-l-warning-500',
        text: 'text-warning-700 dark:text-warning-300',
        headingColor: 'text-warning-700 dark:text-warning-400',
        iconColor: 'text-warning-600 dark:text-warning-400',
        delayColor: 'text-warning-700 dark:text-warning-400',
        dot: 'bg-warning-500 animate-pulse',
      };
    case 'temporary_delay':
      return {
        label: 'TEMPORARY DELAY',
        icon: AlertTriangle,
        primary: '#F79009',
        bg: 'bg-warning-50 dark:bg-warning-500/10',
        border: 'border-warning-200 dark:border-warning-500/20',
        bannerBorder: 'border-warning-200 dark:border-warning-500/20',
        accentLine: 'border-l-warning-500',
        text: 'text-warning-700 dark:text-warning-300',
        headingColor: 'text-warning-700 dark:text-warning-400',
        iconColor: 'text-warning-600 dark:text-warning-400',
        delayColor: 'text-warning-700 dark:text-warning-400',
        dot: 'bg-warning-500 animate-pulse',
      };
    default:
      return {
        label: 'OPEN',
        icon: CheckCircle2,
        primary: '#12B76A',
        bg: 'bg-success-50 dark:bg-success-500/10',
        border: 'border-success-200 dark:border-success-500/20',
        bannerBorder: 'border-success-200 dark:border-success-500/20',
        accentLine: 'border-l-success-500',
        text: 'text-success-700 dark:text-success-300',
        headingColor: 'text-success-700 dark:text-success-400',
        iconColor: 'text-success-600 dark:text-success-400',
        delayColor: 'text-success-700 dark:text-success-400',
        dot: 'bg-success-500 animate-pulse',
      };
  }
}



export default function OwnerDashboard() {
  const { socket, joinShopRoom } = useSocket() || {};
  const [shop, setShop] = useState(null);
  const [stats, setStats] = useState({
    pendingOrders: 0,
    currentlyPrinting: 0,
    completedToday: 0,
    currentQueue: 0,
    totalCompleted: 0,
  });
  const [queue, setQueue] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [allShopOrders, setAllShopOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Explicit onboarding flag from backend (requiresOnboarding === true) — never inferred from a failed request
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  // Dashboard API failure (500 / 403 / network) — rendered as a retryable error, NOT as onboarding
  const [dashboardError, setDashboardError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  // Sales Overview Period: 'today' | '7days' | '30days' | 'custom'
  const [salesRange, setSalesRange] = useState('30days');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState(null);
  const [mobileRequestsExpanded, setMobileRequestsExpanded] = useState(false);

  // Modals state
  const [viewingOrder, setViewingOrder] = useState(null);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Report File Issue Modal State
  const [reportingFileOrder, setReportingFileOrder] = useState(null);
  const [fileIssueCategory, setFileIssueCategory] = useState('file_issue');
  const [fileIssueMessage, setFileIssueMessage] = useState('Missing pages or unreadable formatting in uploaded file. Please re-upload your document.');
  const [fileIssueDelay, setFileIssueDelay] = useState(15);
  const [submittingFileIssue, setSubmittingFileIssue] = useState(false);

  // Operational Status & Temporary Closure Modal State
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [submittingClosure, setSubmittingClosure] = useState(false);
  const [reopeningShop, setReopeningShop] = useState(false);


  // Counter Pickup / Claim Code Lookup Modal State
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimInput, setClaimInput] = useState('');
  const [verifiedOrder, setVerifiedOrder] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [verifyingPickup, setVerifyingPickup] = useState(false);
  const [updatingWalkIn, setUpdatingWalkIn] = useState(false);

  // Customer Feedback & Reviews State
  const [reviewsData, setReviewsData] = useState({
    summary: { rating: 0, reviewsCount: 0, avgPrintQuality: null, avgSpeedRating: null },
    reviews: [],
    pagination: { page: 1, limit: 10, total: 0, pages: 1 },
  });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);

  const fetchReviews = useCallback(async (page = 1) => {
    setLoadingReviews(true);
    try {
      const res = await shopAPI.getOwnerReviews({ page, limit: 10 });
      if (res.data) {
        setReviewsData(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch shop reviews:', err.message);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const handleUpdateWalkInCount = async (delta) => {
    if (!shop?._id || updatingWalkIn) return;
    const current = Math.max(0, Number(shop.walkInCustomerCount) || 0);
    const nextCount = Math.max(0, current + delta);
    setUpdatingWalkIn(true);
    try {
      await shopAPI.updateWalkInCount(shop._id, nextCount, shop.walkInTrafficLevel || 'normal');
      setShop((prev) => ({
        ...prev,
        walkInCustomerCount: nextCount,
      }));
      toast.success(`Walk-in count updated to ${nextCount}`, { id: 'walkin-toast', duration: 1500 });
    } catch (err) {
      toast.error('Failed to update walk-in count');
    } finally {
      setUpdatingWalkIn(false);
    }
  };

  // Fetch Dashboard and Shop Orders
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setRefreshing(true);
      setDashboardError(null);
    }
    try {
      const res = await shopAPI.getMyShopDashboard();

      if (res?.requiresOnboarding === true) {
        setRequiresOnboarding(true);
        setDashboardError(null);
        setShop(null);
        return;
      }

      if (!res?.data?.shop) {
        throw new Error('Dashboard response did not include shop information.');
      }

      setRequiresOnboarding(false);
      setDashboardError(null);

      if (res.data) {
        const { shop: shopData, stats: statsData, activeQueue, recentOrders: ordersData } = res.data;
        setShop(shopData);

        setStats(statsData || {
          pendingOrders: 0,
          currentlyPrinting: 0,
          completedToday: 0,
          currentQueue: 0,
          totalCompleted: 0,
        });
        setQueue(activeQueue || []);
        setRecentOrders(ordersData || []);

        if (shopData?._id) {
          try {
            const reqRes = await requestAPI.getShopRequests(shopData._id, { limit: 100 });
            const list = reqRes.data?.requests || reqRes.data || [];
            setAllShopOrders(list);
          } catch (e) {
            console.warn('Could not fetch extra shop requests:', e);
          }
        }
      }
    } catch (err) {
      console.error('Owner dashboard fetch error:', err);
      // Silent (socket-triggered) refreshes keep the already-loaded dashboard visible
      if (!isSilent) {
        setDashboardError({
          message: 'Something went wrong while loading your shop information. Please try again.',
          detail: err?.message || '',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Separate shop room joining from data fetching
  useEffect(() => {
    if (shop?._id) {
      joinShopRoom?.(shop._id);
    }
  }, [shop?._id, joinShopRoom]);

  useEffect(() => {
    fetchReviews(reviewPage);
  }, [fetchReviews, reviewPage]);

  // Real-time Socket Event Listeners
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = (data) => {
      console.log('⚡ [OwnerDashboard] Real-time socket event received:', data);
      fetchData(true);
      fetchReviews(1);
    };

    socket.on('request:new', handleRealtimeUpdate);
    socket.on('request:status', handleRealtimeUpdate);
    socket.on('request:status_changed', handleRealtimeUpdate);
    socket.on('request:cancelled', handleRealtimeUpdate);
    socket.on('queue:update', handleRealtimeUpdate);
    socket.on('shop:queue_changed', handleRealtimeUpdate);
    socket.on('shop:status_updated', handleRealtimeUpdate);
    socket.on('shop:walk_in_traffic_changed', handleRealtimeUpdate);
    socket.on('shop:rated', handleRealtimeUpdate);

    return () => {
      socket.off('request:new', handleRealtimeUpdate);
      socket.off('request:status', handleRealtimeUpdate);
      socket.off('request:status_changed', handleRealtimeUpdate);
      socket.off('shop:rated', handleRealtimeUpdate);
      socket.off('request:cancelled', handleRealtimeUpdate);
      socket.off('queue:update', handleRealtimeUpdate);
      socket.off('shop:queue_changed', handleRealtimeUpdate);
      socket.off('shop:status_updated', handleRealtimeUpdate);
      socket.off('shop:walk_in_traffic_changed', handleRealtimeUpdate);
    };
  }, [socket, fetchData]);

  // Update Order Status (Accept, Ready, Completed, Rejected)
  const handleUpdateStatus = async (requestId, newStatus, reason = '') => {
    setUpdatingId(requestId);
    try {
      await requestAPI.updateStatus(requestId, newStatus, reason);
      toast.success(`Order updated to ${newStatus.toUpperCase()}`);
      if (viewingOrder && viewingOrder._id === requestId) {
        setViewingOrder(null);
      }
      if (rejectingOrderId) {
        setRejectingOrderId(null);
        setRejectionReason('');
      }
      await fetchData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setUpdatingId(null);
    }
  };

  // Report File Issue (Customer Notification without silent cancellation)
  const handleReportFileIssue = async (e) => {
    if (e) e.preventDefault();
    if (!reportingFileOrder?._id) return;
    setSubmittingFileIssue(true);
    try {
      await requestAPI.addShopNote(reportingFileOrder._id, {
        category: fileIssueCategory,
        message: fileIssueMessage.trim(),
        delayMinutes: Number(fileIssueDelay) || 0,
      });
      toast.success('File issue reported! Customer has been notified immediately.');
      setReportingFileOrder(null);
      await fetchData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to report file issue');
    } finally {
      setSubmittingFileIssue(false);
    }
  };





  // Temporary Closure Handlers
  const handleConfirmClosure = async (closureData) => {
    if (!shop?._id) return;
    setSubmittingClosure(true);
    try {
      const res = await shopAPI.setTemporaryClosure(shop._id, closureData);
      if (res.data?.shop) {
        setShop(res.data.shop);
      }
      setShowClosureModal(false);
      toast.success('Shop temporarily closed.');
      await fetchData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to set temporary closure');
    } finally {
      setSubmittingClosure(false);
    }
  };

  const handleReopenNow = async () => {
    if (!shop?._id) return;
    setReopeningShop(true);
    try {
      const res = await shopAPI.reopenShop(shop._id);
      if (res.data?.shop) {
        setShop(res.data.shop);
      }
      toast.success('Shop reopened! Automatic operating schedule resumed.');
      await fetchData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to reopen shop');
    } finally {
      setReopeningShop(false);
    }
  };

  // Claim Code Verification Handlers
  const handleLookupClaim = (codeToSearch) => {
    const raw = codeToSearch !== undefined ? codeToSearch : claimInput;
    const query = (raw || '').trim().toLowerCase().replace(/^#/, '');
    if (!query) {
      setLookupError('Please enter a claim code');
      setVerifiedOrder(null);
      return;
    }

    setLookupError('');
    const allKnown = [...(allShopOrders || []), ...(queue || []), ...(recentOrders || [])];
    const match = allKnown.find((o) => {
      const code = (o.claimCode || '').toLowerCase().replace(/^#/, '');
      const idEnd = (o._id || '').toLowerCase().slice(-4);
      const tracking = (o.trackingNumber || '').toLowerCase().replace(/^#/, '');
      return code === query || idEnd === query || tracking === query || (o._id || '').toLowerCase() === query;
    });

    if (match) {
      setVerifiedOrder(match);
      setLookupError('');
    } else {
      setVerifiedOrder(null);
      setLookupError(`No order found matching "${raw}". Please verify the claim code.`);
    }
  };

  const handleReleaseOrder = async (orderId) => {
    if (!orderId || verifyingPickup) return;
    setVerifyingPickup(true);
    try {
      await requestAPI.updateStatus(orderId, 'completed');
      toast.success('Prints verified and released to customer!');
      setVerifiedOrder((prev) => (prev ? { ...prev, status: 'completed' } : null));
      await fetchData(true);
    } catch (err) {
      toast.error(err.message || 'Failed to release order');
    } finally {
      setVerifyingPickup(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // DERIVED METRICS & FILTERED DATA
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Incoming Jobs (Pending)
  const incomingJobs = useMemo(() => {
    const list = allShopOrders.length > 0 ? allShopOrders : recentOrders;
    return list.filter((o) => o.status === 'pending');
  }, [allShopOrders, recentOrders]);

  // 2. Active Queue Jobs (Printing + Queued/Accepted)
  const activeQueueJobs = useMemo(() => {
    const combined = [...(queue || [])];
    (allShopOrders || []).forEach((o) => {
      if (['printing', 'queued', 'accepted'].includes(o.status) && !combined.some((q) => q._id === o._id)) {
        combined.push(o);
      }
    });

    // FCFS Sort: printing jobs first, then queued/accepted by acceptedAt or submittedAt
    return combined.sort((a, b) => {
      if (a.status === 'printing' && b.status !== 'printing') return -1;
      if (b.status === 'printing' && a.status !== 'printing') return 1;
      return new Date(a.acceptedAt || a.submittedAt || 0) - new Date(b.acceptedAt || b.submittedAt || 0);
    });
  }, [queue, allShopOrders]);

  // 3. Completed Orders
  const completedOrders = useMemo(() => {
    const list = allShopOrders.length > 0 ? allShopOrders : recentOrders;
    return list
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.updatedAt || 0) - new Date(a.completedAt || a.updatedAt || 0));
  }, [allShopOrders, recentOrders]);

  // 4. Sales metrics by Range (Today, Week, Month)
  const todayCompletedOrders = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return completedOrders.filter((o) => new Date(o.completedAt || o.updatedAt || o.submittedAt) >= startOfDay);
  }, [completedOrders]);

  const todaySales = useMemo(() => {
    return todayCompletedOrders.reduce((acc, curr) => acc + (curr.estimatedCost || 0), 0);
  }, [todayCompletedOrders]);

  const todayNetSales = useMemo(() => {
    return Number((todaySales * 0.97).toFixed(2));
  }, [todaySales]);



  // 5. Recent 7 Days Completed Activity
  const recentDaysActivity = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const dayName = i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' });
      const dateStr = d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });

      const count = completedOrders.filter((o) => {
        const completedDate = new Date(o.completedAt || o.updatedAt || o.submittedAt || 0);
        return completedDate >= d && completedDate <= dayEnd;
      }).length;

      days.push({
        dayName,
        dateStr,
        count,
        isToday: i === 0,
      });
    }
    return days;
  }, [completedOrders]);

  const maxDailyCompleted = useMemo(() => {
    return Math.max(...recentDaysActivity.map((d) => d.count), 0);
  }, [recentDaysActivity]);

  // 4b. Sales Overview Dynamic Calculations (Period Filtered)
  const filteredCompletedOrders = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (salesRange === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (salesRange === '7days') {
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (salesRange === '30days') {
      startDate.setDate(now.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
    } else if (salesRange === 'custom') {
      if (customStartDate) {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(now.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
      }
      if (customEndDate) {
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    return completedOrders.filter((o) => {
      const d = new Date(o.completedAt || o.updatedAt || o.submittedAt || 0);
      return d >= startDate && d <= endDate;
    });
  }, [completedOrders, salesRange, customStartDate, customEndDate]);

  const periodGrossSales = useMemo(() => {
    return filteredCompletedOrders.reduce((sum, o) => sum + (o.estimatedCost || 0), 0);
  }, [filteredCompletedOrders]);

  const periodCommission = useMemo(() => {
    return Number((periodGrossSales * 0.03).toFixed(2));
  }, [periodGrossSales]);

  const periodNetEarnings = useMemo(() => {
    return Number((periodGrossSales - periodCommission).toFixed(2));
  }, [periodGrossSales, periodCommission]);

  const periodRevenue = periodNetEarnings;

  const periodCompletedCount = filteredCompletedOrders.length;
  const periodAverageOrder = periodCompletedCount > 0 ? (periodRevenue / periodCompletedCount) : 0;

  const periodLabel = useMemo(() => {
    if (salesRange === 'today') return 'Today';
    if (salesRange === '7days') return 'Last 7 days';
    if (salesRange === '30days') return 'Last 30 days';
    if (salesRange === 'custom') {
      return `From ${customStartDate} to ${customEndDate}`;
    }
    return 'Last 30 days';
  }, [salesRange, customStartDate, customEndDate]);

  // Dynamic Revenue Trend Points based on Period with rich pinpoint metadata
  const trendData = useMemo(() => {
    const now = new Date();

    if (salesRange === '30days') {
      // 4 Weeks: W1, W2, W3, W4
      const weeks = [
        { label: 'W1', fullLabel: 'Week 1', value: 0, orderCount: 0, start: 29, end: 22 },
        { label: 'W2', fullLabel: 'Week 2', value: 0, orderCount: 0, start: 21, end: 15 },
        { label: 'W3', fullLabel: 'Week 3', value: 0, orderCount: 0, start: 14, end: 8 },
        { label: 'W4', fullLabel: 'Week 4', value: 0, orderCount: 0, start: 7, end: 0 },
      ];

      weeks.forEach((w) => {
        const startD = new Date(now);
        startD.setDate(now.getDate() - w.start);
        startD.setHours(0, 0, 0, 0);

        const endD = new Date(now);
        endD.setDate(now.getDate() - w.end);
        endD.setHours(23, 59, 59, 999);

        const matching = completedOrders.filter((o) => {
          const d = new Date(o.completedAt || o.updatedAt || o.submittedAt || 0);
          return d >= startD && d <= endD;
        });

        w.value = matching.reduce((sum, o) => sum + (o.finalCost || o.estimatedCost || 0), 0);
        w.orderCount = matching.length;
        const fmtStart = startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fmtEnd = endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        w.fullLabel = `${w.fullLabel} (${fmtStart} - ${fmtEnd})`;
      });

      return weeks.map(({ label, fullLabel, value, orderCount }) => ({
        label,
        fullLabel,
        value,
        orderCount,
        netValue: value * 0.97,
        commission: value * 0.03,
      }));
    }

    if (salesRange === '7days') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const endD = new Date(d);
        endD.setHours(23, 59, 59, 999);

        const dayName = i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' });
        const fullDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const matching = completedOrders.filter((o) => {
          const od = new Date(o.completedAt || o.updatedAt || o.submittedAt || 0);
          return od >= d && od <= endD;
        });

        const val = matching.reduce((sum, o) => sum + (o.finalCost || o.estimatedCost || 0), 0);

        days.push({
          label: dayName,
          fullLabel: fullDate,
          value: val,
          orderCount: matching.length,
          netValue: val * 0.97,
          commission: val * 0.03,
        });
      }
      return days;
    }

    if (salesRange === 'today') {
      const slots = [
        { label: 'Morning', fullLabel: 'Morning (12 AM - 12 PM)', start: 0, end: 12, value: 0, orderCount: 0 },
        { label: 'Noon', fullLabel: 'Noon (12 PM - 3 PM)', start: 12, end: 15, value: 0, orderCount: 0 },
        { label: 'Afternoon', fullLabel: 'Afternoon (3 PM - 6 PM)', start: 15, end: 18, value: 0, orderCount: 0 },
        { label: 'Evening', fullLabel: 'Evening (6 PM - 12 AM)', start: 18, end: 24, value: 0, orderCount: 0 },
      ];

      slots.forEach((s) => {
        const matching = todayCompletedOrders.filter((o) => {
          const d = new Date(o.completedAt || o.updatedAt || o.submittedAt || 0);
          const h = d.getHours();
          return h >= s.start && h < s.end;
        });
        s.value = matching.reduce((sum, o) => sum + (o.finalCost || o.estimatedCost || 0), 0);
        s.orderCount = matching.length;
      });

      return slots.map(({ label, fullLabel, value, orderCount }) => ({
        label,
        fullLabel,
        value,
        orderCount,
        netValue: value * 0.97,
        commission: value * 0.03,
      }));
    }

    // Custom: 4 intervals
    const start = customStartDate ? new Date(customStartDate) : new Date(now.getTime() - 30 * 86400000);
    start.setHours(0, 0, 0, 0);
    const end = customEndDate ? new Date(customEndDate) : new Date(now);
    end.setHours(23, 59, 59, 999);

    const diff = Math.max(1, end.getTime() - start.getTime());
    const step = diff / 4;

    const parts = [];
    for (let i = 0; i < 4; i++) {
      const pStart = new Date(start.getTime() + i * step);
      const pEnd = new Date(start.getTime() + (i + 1) * step);
      const matching = completedOrders.filter((o) => {
        const d = new Date(o.completedAt || o.updatedAt || o.submittedAt || 0);
        return d >= pStart && d <= pEnd;
      });
      const val = matching.reduce((sum, o) => sum + (o.finalCost || o.estimatedCost || 0), 0);
      const p1Str = pStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const p2Str = pEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      parts.push({
        label: `P${i + 1}`,
        fullLabel: `Period ${i + 1} (${p1Str} - ${p2Str})`,
        value: val,
        orderCount: matching.length,
        netValue: val * 0.97,
        commission: val * 0.03,
      });
    }
    return parts;
  }, [salesRange, completedOrders, todayCompletedOrders, customStartDate, customEndDate]);

  const maxTrendVal = useMemo(() => {
    return Math.max(...trendData.map((t) => t.value), 1);
  }, [trendData]);

  const svgPoints = useMemo(() => {
    const width = 360;
    const height = 60;
    const startX = 20;
    const baseY = 80;
    const count = trendData.length;

    if (count <= 1) return [];

    return trendData.map((t, i) => {
      const x = startX + (i / (count - 1)) * width;
      const y = baseY - (t.value / maxTrendVal) * height;
      return {
        x,
        y,
        value: t.value,
        netValue: t.netValue || 0,
        commission: t.commission || 0,
        orderCount: t.orderCount || 0,
        label: t.label,
        fullLabel: t.fullLabel || t.label,
      };
    });
  }, [trendData, maxTrendVal]);

  const linePath = useMemo(() => {
    if (svgPoints.length === 0) return '';
    return svgPoints.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [svgPoints]);

  const areaPath = useMemo(() => {
    if (svgPoints.length === 0) return '';
    const first = svgPoints[0];
    const last = svgPoints[svgPoints.length - 1];
    return `${linePath} L ${last.x} 80 L ${first.x} 80 Z`;
  }, [linePath, svgPoints]);

  // Pinpoint cursor handler for Revenue Trend chart
  const handleChartMouseMove = useCallback((e) => {
    if (svgPoints.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const mouseX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
    const svgX = 20 + ratio * 360;

    let nearestIdx = 0;
    let minDiff = Infinity;
    svgPoints.forEach((pt, idx) => {
      const diff = Math.abs(pt.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = idx;
      }
    });
    setHoveredTrendIdx(nearestIdx);
  }, [svgPoints]);

  // Workload and Wait Time Calculations
  const onlineWaitMinutes = useMemo(() => {
    if (activeQueueJobs.length === 0) return 0;
    let totalMins = 0;
    activeQueueJobs.forEach((job) => {
      if (job.estimatedPrintingTime) {
        totalMins += job.estimatedPrintingTime;
      } else {
        const pages = (job.printingSpecifications?.totalPages || 1) * (job.printingSpecifications?.copies || 1);
        totalMins += Math.max(1, Math.ceil(pages / 15)) + 1;
      }
    });
    return totalMins;
  }, [activeQueueJobs]);


  const isManualClosure = Boolean(
    shop?.isManualClosure ||
    (shop?.temporaryClosure?.isClosed && (!shop?.temporaryClosure?.reopenAt || new Date() < new Date(shop?.temporaryClosure?.reopenAt)))
  );
  const isShopClosed = isManualClosure || (shop && !shop.isOpen);

  const currentOpBadge = getOperationalBadge(
    shop?.operationalCondition || 'normal',
    shop?.status || 'open',
    isManualClosure,
    shop?.closureReason || shop?.temporaryClosure?.reason
  );

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <div className="spinner" />
        <div className="text-sm text-slate-500 font-semibold">Loading shop dashboard...</div>
      </div>
    );
  }

  // Failed request (or missing shop without an explicit onboarding flag) → error state, never onboarding
  if (!shop && (dashboardError || !requiresOnboarding)) {
    return (
      <DashboardContainer className="dash-page-container w-full py-10">
        <div
          id="owner-dashboard-error"
          role="alert"
          className="bg-white dark:bg-[#101828] border border-gray-200 dark:border-gray-800 rounded-2xl p-8 max-w-xl mx-auto text-center shadow-sm"
        >
          <div className="w-16 h-16 bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Unable to Load Shop Dashboard</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {dashboardError?.message || 'Something went wrong while loading your shop information. Please try again.'}
          </p>
          {dashboardError?.detail && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 break-words">Details: {dashboardError.detail}</p>
          )}
          {!dashboardError?.detail && <div className="mb-6" />}
          <button
            id="owner-dashboard-retry-btn"
            type="button"
            onClick={() => fetchData()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#465FFF] hover:bg-[#3641F5] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-sm w-full sm:w-auto"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      </DashboardContainer>
    );
  }

  // Only when backend explicitly returned requiresOnboarding === true
  if (!shop && requiresOnboarding) {
    return (
      <DashboardContainer className="dash-page-container w-full py-10">
        <div className="bg-white dark:bg-[#101828] border border-amber-200 dark:border-amber-900/50 rounded-2xl p-8 max-w-xl mx-auto text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Complete Shop Onboarding</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            You do not have a registered printing shop yet. Complete your shop registration and upload your business credentials (DTI / Mayor's Permit) to start accepting student print orders.
          </p>
          <a
            href="/register/partner"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all shadow-sm"
          >
            Register Your Printing Shop
          </a>
        </div>
      </DashboardContainer>
    );
  }

  const hasServiceAlert = !isShopClosed && shop?.operationalCondition && shop.operationalCondition !== 'normal';
  const printingCount = activeQueueJobs.filter((j) => j.status === 'printing').length;
  const inQueueCount = activeQueueJobs.filter((j) => j.status !== 'printing').length;

  return (
    <DashboardContainer className="dash-page-container w-full py-1">

      {shop.verificationStatus === 'pending' && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-amber-600 shrink-0" />
            <span className="text-sm font-medium">
              Your shop is pending administrator verification. Once approved, your shop will be listed for students to place print orders.
            </span>
          </div>
          <a
            href="/owner/verification"
            className="text-xs font-bold text-amber-900 dark:text-amber-200 underline whitespace-nowrap"
          >
            View Verification Status &rarr;
          </a>
        </div>
      )}

      {/* =============================================================
          A. MOBILE LAYOUT (< 768px) - COMPACT OPERATIONAL OVERVIEW
      ============================================================= */}
      <div className="block md:hidden space-y-3 pb-6">
        {/* 1. TOP STOREFRONT COMMAND HEADER (MOBILE) */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/90 dark:border-gray-800/90 bg-white dark:bg-[#101828] p-3.5 shadow-theme-xs">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-brand-50 dark:ring-brand-500/10">
                <Store size={19} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black text-gray-900 dark:text-white tracking-tight truncate">
                  {shop?.shopName || 'Printing Shop'}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isManualClosure ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                      Closed
                    </span>
                  ) : !isShopClosed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success-600 dark:text-success-400 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                      Open
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                      Closed
                    </span>
                  )}
                  <span className="text-gray-300 dark:text-slate-700">•</span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                    {activeQueueJobs.length} {activeQueueJobs.length === 1 ? 'job' : 'jobs'} in queue
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowClosureModal(true)}
                className="px-2.5 py-1.5 text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50/90 dark:bg-brand-500/15 rounded-xl border border-brand-200/70 dark:border-brand-500/20 shadow-theme-xs cursor-pointer flex items-center gap-1"
              >
                <Power size={12} />
                <span>Closure</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. ALERT BANNER (ONLY WHEN DELAY/ISSUE/CLOSED ADVISORY EXISTS) */}
        {(hasServiceAlert || (isShopClosed && shop?.operationalMessage)) && (
          <div className={`p-3 rounded-xl border ${currentOpBadge.bg} ${currentOpBadge.border} flex items-start gap-2.5 shadow-theme-xs`}>
            <currentOpBadge.icon size={16} className={`shrink-0 mt-0.5 ${currentOpBadge.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-bold uppercase tracking-wider ${currentOpBadge.headingColor}`}>
                {currentOpBadge.label}
              </div>
              <p className={`text-xs mt-0.5 leading-snug ${currentOpBadge.text}`}>
                {shop?.operationalMessage || 'Service delays or advisory reported at shop.'}
              </p>
              {shop?.operationalDelayMinutes > 0 && !isShopClosed && (
                <div className={`text-[11px] font-bold mt-1 ${currentOpBadge.delayColor}`}>
                  Estimated +{shop.operationalDelayMinutes} mins
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. COMPACT TODAY SUMMARY */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 px-0.5">
            Today
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 p-3 shadow-theme-xs">
            <div className="grid grid-cols-3 text-center pb-2.5 border-b border-gray-200 dark:border-gray-800 dark:border-slate-700/60">
              <Link to="/owner/requests?status=pending" className="hover:opacity-80 transition-opacity">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  New
                </div>
                <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">
                  {incomingJobs.length}
                </div>
              </Link>
              <Link to="/owner/queue" className="hover:opacity-80 transition-opacity border-x border-gray-200 dark:border-gray-800 dark:border-slate-700/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Queue
                </div>
                <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">
                  {inQueueCount}
                </div>
              </Link>
              <Link to="/owner/queue" className="hover:opacity-80 transition-opacity">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Printing
                </div>
                <div className="text-xl font-black text-gray-900 dark:text-white mt-0.5">
                  {printingCount}
                </div>
              </Link>
            </div>
            <div className="flex items-center justify-between pt-2 px-1">
              <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                Today's Sales
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white">
                ₱{todaySales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>


        {/* 5. INCOMING REQUESTS */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 p-3 shadow-theme-xs">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                Incoming Requests
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400 dark:bg-sky-950/50 dark:text-sky-400">
                {incomingJobs.length}
              </span>
            </div>
            {incomingJobs.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileRequestsExpanded(!mobileRequestsExpanded)}
                className="text-[11px] font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 flex items-center gap-0.5 cursor-pointer"
              >
                {mobileRequestsExpanded ? 'Collapse' : 'Details'}
                <ChevronDown size={14} className={`transform transition-transform ${mobileRequestsExpanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {incomingJobs.length === 0 ? 'No pending requests' : `${incomingJobs.length} pending requests`}
          </div>

          {/* Expandable Preview */}
          {mobileRequestsExpanded && incomingJobs.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/60 space-y-2">
              {incomingJobs.slice(0, 3).map((job) => (
                <div key={job._id} className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/50 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-gray-900 dark:text-white truncate">
                      {job.user?.name || job.customerName || 'Customer'}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                      {job.fileName || (job.files && job.files[0]?.originalName) || 'Document'} · {job.printingSpecifications?.totalPages || 1}p
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingOrder(job)}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-800 dark:border-slate-600 text-[10px] font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 shrink-0 cursor-pointer"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/60">
            <Link
              to="/owner/requests"
              className="text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 flex items-center justify-between hover:underline"
            >
              <span>{incomingJobs.length > 0 ? 'View Requests →' : 'View Orders →'}</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* 6. ACTIVE PRINTING */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 p-3 shadow-theme-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              Active Printing
            </span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400 dark:bg-sky-950/50 dark:text-sky-400">
              {printingCount}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">
            {printingCount === 0 ? 'Queue is clear' : `${printingCount} job currently printing`}
          </div>
          <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/60">
            <Link
              to="/owner/queue"
              className="text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 flex items-center justify-between hover:underline"
            >
              <span>View Queue →</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>


      {/* =============================================================
          B. TABLET LAYOUT (768px – 1199px) - 2-COLUMN STRUCTURE
      ============================================================= */}
      <div className="hidden md:block xl:hidden space-y-3.5 pb-6">
        {/* 1. STOREFRONT COMMAND HERO BANNER (TABLET) */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/90 dark:border-gray-800/90 bg-white dark:bg-[#101828] p-4 shadow-theme-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20 shrink-0 ring-4 ring-brand-50 dark:ring-brand-500/10">
                <Store size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-base font-black text-gray-900 dark:text-white tracking-tight truncate">
                    {shop?.shopName || 'Printing Shop'}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/20">
                    <ShieldCheck size={11} />
                    <span>Partner</span>
                  </span>
                  {!isShopClosed ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Open
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      Closed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 truncate">
                  <span className="truncate">{shop?.address || shop?.location?.address || 'Naval, Biliran'}</span>
                  <span>•</span>
                  <span><strong>{activeQueueJobs.length}</strong> in queue</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/owner/services"
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-700 transition-colors shadow-theme-xs flex items-center gap-1.5"
              >
                <Sliders size={12} />
                <span>Rates</span>
              </Link>
              <button
                type="button"
                onClick={() => setShowClosureModal(true)}
                className="px-3 py-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50/80 hover:bg-brand-100/80 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 rounded-xl border border-brand-200/70 dark:border-brand-500/20 transition-colors shadow-theme-xs cursor-pointer flex items-center gap-1.5"
              >
                <Power size={13} />
                <span>Closure</span>
              </button>
              <button
                type="button"
                onClick={() => fetchData()}
                disabled={refreshing}
                title="Refresh live shop data"
                className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-theme-xs"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin text-brand-500' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* 2. TODAY SUMMARY (Horizontal 4-Stat Bar) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 p-3.5 shadow-theme-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
            Today
          </div>
          <div className="grid grid-cols-4 divide-x divide-gray-200 dark:divide-gray-800 text-center">
            <Link to="/owner/requests?status=pending" className="px-2 hover:opacity-80 transition-opacity">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                New Orders
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                {incomingJobs.length}
              </div>
            </Link>
            <Link to="/owner/queue" className="px-2 hover:opacity-80 transition-opacity">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Queue
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                {inQueueCount}
              </div>
            </Link>
            <Link to="/owner/queue" className="px-2 hover:opacity-80 transition-opacity">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Printing
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                {printingCount}
              </div>
            </Link>
            <Link to="/owner/sales?range=today" className="px-2 hover:opacity-80 transition-opacity">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Earnings
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
                ₱{todaySales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </Link>
          </div>
        </div>

        {/* 3. ROW 2: SHOP STATUS */}
        <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Shop Status
              </span>
              {isManualClosure && (
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                  Manual Override
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isManualClosure ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-black text-rose-600 dark:text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  CLOSED
                </span>
              ) : !isShopClosed ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-black text-success-600 dark:text-success-400 dark:text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse" />
                  OPEN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm font-black text-gray-500 dark:text-gray-400 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                  CLOSED
                </span>
              )}
            </div>
            {shop?.nextOpening?.formattedText && (
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                Next opening: {shop.nextOpening.formattedText}
              </div>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/60">
            {isManualClosure ? (
              <button
                type="button"
                onClick={handleReopenNow}
                disabled={reopeningShop}
                className="text-xs font-bold text-success-600 dark:text-success-400 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw size={12} className={reopeningShop ? 'animate-spin' : ''} />
                <span>Reopen Now →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowClosureModal(true)}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Power size={12} />
                <span>Close Temporarily →</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. ROW 3: INCOMING REQUESTS + ACTIVE PRINTING (2 Columns) */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Incoming Requests */}
          <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Incoming Requests
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400 dark:bg-sky-950/50 dark:text-sky-400">
                  {incomingJobs.length}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {incomingJobs.length === 0 ? 'No pending requests' : `${incomingJobs.length} pending`}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {incomingJobs.length > 0 ? 'Review and confirm online print orders' : 'All incoming orders have been processed'}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/60">
              <Link
                to="/owner/requests"
                className="text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 flex items-center justify-between hover:underline"
              >
                <span>View Requests →</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Active Printing */}
          <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Active Printing
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400 dark:bg-sky-950/50 dark:text-sky-400">
                  {printingCount}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {printingCount === 0 ? 'Queue is clear' : `${printingCount} jobs`}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {printingCount > 0 ? 'Documents currently being produced' : 'No documents currently printing'}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/60">
              <Link
                to="/owner/queue"
                className="text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 flex items-center justify-between hover:underline"
              >
                <span>View Queue →</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* 5. ROW 4: SALES SUMMARY (Compact Tablet) */}
        <div className="p-3.5 rounded-xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Today's Net Sales
              </div>
              <div className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                ₱{todayNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="border-l border-gray-200 dark:border-gray-800 dark:border-slate-700/60 pl-6">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Completed Today
              </div>
              <div className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                {todayCompletedOrders.length} orders
              </div>
            </div>
            <div className="border-l border-gray-200 dark:border-gray-800 dark:border-slate-700/60 pl-6 hidden lg:block">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Total Completed
              </div>
              <div className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                {stats.totalCompleted || completedOrders.length}
              </div>
            </div>
          </div>
          <Link
            to="/owner/sales"
            className="px-3 py-1.5 text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 bg-brand-50 dark:bg-brand-500/10 dark:bg-sky-950/50 hover:bg-brand-100 dark:bg-brand-500/20 rounded-lg border border-brand-200 dark:border-brand-500/30 dark:border-sky-800 transition-colors cursor-pointer shrink-0"
          >
            View Sales →
          </Link>
        </div>
      </div>


      {/* =============================================================
          C. DESKTOP LAYOUT (>= 1200px) - EXISTING FULL DASHBOARD
      ============================================================= */}
      <div className="hidden xl:block space-y-4">
        {/* ─────────────────────────────────────────────────────────────
            1. HEADER
        ───────────────────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────
          1. STOREFRONT COMMAND HERO BANNER (DESKTOP)
      ───────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-2xl border border-gray-200/90 dark:border-gray-800/90 bg-white dark:bg-[#101828] p-4 sm:p-5 shadow-theme-xs">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand-500/10 dark:bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 -bottom-8 h-32 w-32 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-2xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Storefront Identity & Live Status */}
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {/* Shop Squircle Icon */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 dark:from-brand-600 dark:to-indigo-700 text-white flex items-center justify-center shadow-md shadow-brand-500/20 ring-4 ring-brand-50 dark:ring-brand-500/10">
                <Store size={24} className="sm:w-7 sm:h-7" />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#101828] ${
                  !isShopClosed ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
                title={!isShopClosed ? 'Shop is Open' : 'Shop is Closed'}
              />
            </div>

            {/* Shop Info & Live Badges */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                  {shop?.shopName || 'Printing Shop'}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300 border border-brand-200/60 dark:border-brand-500/20">
                  <ShieldCheck size={12} />
                  <span>Verified Partner</span>
                </span>
                {!isShopClosed ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Open for Orders
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Store Closed
                  </span>
                )}
              </div>

              {/* Sub-meta chips: Address, Active Queue, Walk-in */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 truncate max-w-xs">
                  <MapPin size={12} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate">{shop?.address || shop?.location?.address || 'Naval, Biliran'}</span>
                </span>
                <span className="text-gray-300 dark:text-slate-700 hidden sm:inline">•</span>
                <span className="inline-flex items-center gap-1">
                  <Printer size={12} className="text-brand-500 dark:text-brand-400 shrink-0" />
                  <span><strong>{activeQueueJobs.length}</strong> active in queue</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <Link
              to="/owner/services"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 rounded-xl border border-gray-200/80 dark:border-slate-700 transition-colors shadow-theme-xs"
            >
              <Sliders size={13} className="text-gray-500 dark:text-slate-400" />
              <span>Services & Rates</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowClosureModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50/80 hover:bg-brand-100/80 dark:bg-brand-500/10 dark:hover:bg-brand-500/20 rounded-xl border border-brand-200/70 dark:border-brand-500/20 transition-colors shadow-theme-xs cursor-pointer"
            >
              <Power size={13} />
              <span>Manage Closure</span>
            </button>

            <button
              type="button"
              onClick={() => fetchData()}
              disabled={refreshing}
              title="Refresh live shop data"
              className="p-2 text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white bg-gray-50 hover:bg-gray-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 rounded-xl border border-gray-200/80 dark:border-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-theme-xs"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-brand-500' : ''} />
            </button>
          </div>
        </div>
      </header>


      {/* ─────────────────────────────────────────────────────────────
          3. SHOP OVERVIEW (4 Compact Metric Cards)
      ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mb-1">
          {/* Card 1: NEW JOBS */}
          <Link
            to="/owner/requests?status=pending"
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs hover:shadow-theme-sm hover:border-brand-500/40 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-500 dark:text-brand-400 flex items-center justify-center shrink-0 shadow-theme-xs">
                  <Inbox size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                    New Orders
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5 leading-tight tracking-tight truncate font-outfit">
                    {incomingJobs.length}
                  </div>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              {incomingJobs.length > 0 ? `${incomingJobs.length} waiting for confirmation` : 'Waiting for confirmation'}
            </div>
          </Link>

          {/* Card 2: IN QUEUE */}
          <Link
            to="/owner/queue"
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs hover:shadow-theme-sm hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-theme-xs">
                  <Clock size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                    Waiting to Print
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5 leading-tight tracking-tight truncate font-outfit">
                    {activeQueueJobs.filter((j) => j.status !== 'printing').length}
                  </div>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              Orders waiting to print
            </div>
          </Link>

          {/* Card 3: PRINTING */}
          <Link
            to="/owner/queue"
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs hover:shadow-theme-sm hover:border-purple-500/40 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-theme-xs">
                  <Printer size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                    Currently Printing
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5 leading-tight tracking-tight truncate font-outfit">
                    {activeQueueJobs.filter((j) => j.status === 'printing').length}
                  </div>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              Currently being printed
            </div>
          </Link>

          {/* Card 4: TODAY'S SALES */}
          <Link
            to="/owner/sales?range=today"
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-xs hover:shadow-theme-sm hover:border-amber-500/40 transition-all flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-warning-50 dark:bg-warning-500/15 text-warning-600 dark:text-warning-400 flex items-center justify-center shrink-0 shadow-theme-xs">
                  <Coins size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                    Earnings Today
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5 leading-tight tracking-tight truncate font-outfit">
                    ₱{todaySales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              <ChevronRight size={14} className="text-gray-400 group-hover:text-warning-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              From completed orders
            </div>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. SHOP STATUS & WALK-IN QUEUE
      ───────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs">
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-700/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white m-0">
                Today's Shop Activity
              </h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Box 1: Shop Operational Status Card */}
          <ShopOperationalStatusCard
            shop={shop}
            onOpenClosureModal={() => setShowClosureModal(true)}
            onReopenNow={handleReopenNow}
            reopening={reopeningShop}
          />

          {/* Box 2: Walk-In Counter Traffic Widget */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/40 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-[#465FFF] dark:text-sky-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Walk-In Customers
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  shop?.walkInTrafficLevel === 'packed'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300/80'
                    : shop?.walkInTrafficLevel === 'moderate'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/80'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300/80'
                }`}>
                  {shop?.walkInTrafficLevel || 'normal'}
                </span>
              </div>

              <div className="py-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {Math.max(0, Number(shop?.walkInCustomerCount) || 0)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    in-store customer{Number(shop?.walkInCustomerCount) === 1 ? '' : 's'} waiting
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handleUpdateWalkInCount(-1)}
                    disabled={updatingWalkIn || (Number(shop?.walkInCustomerCount) || 0) <= 0}
                    className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-white text-xs font-black inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-40"
                    title="Decrement in-store customer count"
                  >
                    <Minus size={13} />
                    <span>Decrease</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateWalkInCount(1)}
                    disabled={updatingWalkIn}
                    className="h-8 px-3 rounded-lg bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-black inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    title="Increment in-store customer count"
                  >
                    <Plus size={13} />
                    <span>Add Customer</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-2 border-t border-slate-200/70 dark:border-slate-700/60">
              <Link
                to="/owner/operations"
                className="w-full h-9 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center gap-1.5 transition-all shadow-xs no-underline"
              >
                <span>Full Traffic &amp; Delay Controls</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {/* Box 3: Online Queue */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/40 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <Layers size={14} className="text-slate-500 dark:text-slate-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Print Queue
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-mono font-bold">
                  ~{onlineWaitMinutes}m wait
                </span>
              </div>

              <div className="py-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {activeQueueJobs.length}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    active job{activeQueueJobs.length === 1 ? '' : 's'} in queue
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span>{activeQueueJobs.filter(j => j.status === 'printing').length} Printing</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span>{activeQueueJobs.filter(j => j.status !== 'printing').length} Waiting</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center gap-2">
              <Link
                to="/owner/queue"
                className="flex-1 h-9 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center gap-1.5 transition-all shadow-xs no-underline"
              >
                <span>Manage Production Queue</span>
                <ChevronRight size={13} />
              </Link>
              <button
                type="button"
                onClick={() => setShowClaimModal(true)}
                className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer border-none"
                title="Search student claim code for pickup release"
              >
                <Ticket size={13} />
                <span>Pickup Claim</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5 & 6. INCOMING PRINT REQUESTS & ACTIVE PRINTING QUEUE (2-Column Grid)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
        {/* Left Box: Incoming Print Requests */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs flex flex-col h-full">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200 dark:border-gray-800 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Inbox size={16} className="text-brand-500 dark:text-brand-400 dark:text-sky-400" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-gray-900 dark:text-white">
                New Orders
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-brand-500 dark:text-brand-400 dark:text-sky-300 border border-blue-200 dark:border-blue-800">
              {incomingJobs.length} Pending
            </span>
          </div>

          {incomingJobs.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center flex-1">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-slate-700/60 text-success-600 dark:text-success-400 flex items-center justify-center mb-2">
                <CheckCircle2 size={20} className="text-success-600 dark:text-success-400" />
              </div>
              <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">✓ No pending requests</div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 mb-2.5">
                All incoming print jobs have been confirmed.
              </p>
              <Link
                to="/owner/requests"
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 hover:underline"
              >
                <span>View All Orders</span>
                <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {incomingJobs.map((job) => {
                const code = job.claimCode || (job._id ? `PD-${job._id.slice(-4).toUpperCase()}` : 'PD-XXXX');
                const displayCode = code.startsWith('#') ? code : `#${code}`;
                const docName = job.documentId?.originalFilename || job.originalFilename || 'Document.pdf';
                const pages = job.printingSpecifications?.totalPages || job.documentId?.pageCount || 1;
                const copies = job.printingSpecifications?.copies || 1;
                const isColor = job.printingSpecifications?.colorMode === 'color';
                const paperSize = job.printingSpecifications?.paperSize || 'A4';
                const paperType = job.printingSpecifications?.paperType;
                const binding = job.printingSpecifications?.binding;
                const customerName = job.customerId?.name || job.customerName || 'Customer';
                const timeStr = new Date(job.submittedAt || job.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = new Date(job.submittedAt || job.createdAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' });
                const estCost = typeof job.estimatedCost === 'number' ? job.estimatedCost : 0;

                return (
                  <div
                    key={job._id}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/30 border border-gray-200 dark:border-gray-800 dark:border-slate-700/80 hover:border-brand-500/50 transition-all flex flex-col gap-3"
                  >
                    {/* Top Row: Order ID, Customer & Date/Time, Cost */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-gray-200 dark:border-gray-800/80 dark:border-slate-700/60">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono font-black text-xs sm:text-sm text-brand-500 dark:text-brand-400 dark:text-sky-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200/80 dark:border-blue-800/60">
                          {displayCode}
                        </span>
                        <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                          {customerName}
                        </div>
                        <span className="text-[11px] text-gray-500 dark:text-slate-500 flex items-center gap-1">
                          <Clock size={11} />
                          <span>{dateStr} • {timeStr}</span>
                        </span>
                      </div>

                      {estCost > 0 && (
                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                          <span className="text-[11px] text-gray-500 dark:text-slate-500">Est. Total:</span>
                          <span className="font-black text-xs sm:text-sm text-brand-500 dark:text-brand-400 dark:text-sky-400">
                            ₱{estCost.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Middle Row: Document File & Specs Pills */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {/* File Name & Document info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-brand-500 dark:text-brand-400 dark:text-sky-400 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-gray-900 dark:text-white truncate" title={docName}>
                            {docName}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-slate-500">
                            {pages} page{pages === 1 ? '' : 's'} • {copies} cop{copies === 1 ? 'y' : 'ies'} ({pages * copies} total prints)
                          </div>
                        </div>
                      </div>

                      {/* Specs Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          isColor
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-300 border-gray-200 dark:border-gray-800 dark:border-slate-600'
                        }`}>
                          {isColor ? 'Color' : 'B&W'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-300 border border-gray-200 dark:border-gray-800 dark:border-slate-600">
                          {paperSize.toUpperCase()}
                        </span>
                        {paperType && paperType !== 'normal' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-300 border border-gray-200 dark:border-gray-800 dark:border-slate-600 capitalize">
                            {paperType}
                          </span>
                        )}
                        {binding && binding !== 'none' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-300 border border-gray-200 dark:border-gray-800 dark:border-slate-600 capitalize">
                            {binding.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-800/80 dark:border-slate-700/60 flex items-center justify-end gap-2 flex-wrap">
                      {/* View File - Secondary action: white with navy text and #D9E2EF border */}
                      <button
                        type="button"
                        onClick={() => setViewingOrder(job)}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-blue-950/40 text-gray-800 dark:text-gray-200 dark:text-blue-400 border border-gray-200 dark:border-gray-800 dark:border-blue-500/40 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-theme-xs"
                        title="View document specs and preview"
                      >
                        <Eye size={13} className="text-brand-500 dark:text-brand-400 dark:text-blue-400" />
                        <span>View</span>
                      </button>

                      {/* Report File Issue - Warning action: #C77700 */}
                      <button
                        type="button"
                        onClick={() => {
                          setReportingFileOrder(job);
                          setFileIssueCategory('file_issue');
                          setFileIssueMessage('Missing pages or unreadable formatting in uploaded file. Please re-upload your document.');
                          setFileIssueDelay(15);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 text-warning-600 dark:text-warning-400 dark:text-amber-400 border border-warning-500/40 dark:border-amber-500/40 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-theme-xs"
                        title="Report file problem to customer with clear message"
                      >
                        <AlertTriangle size={13} className="text-warning-600 dark:text-warning-400 dark:text-amber-400" />
                        <span>Issue</span>
                      </button>

                      {/* Reject - Destructive action: #C62828 */}
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingOrderId(job._id);
                          setRejectionReason('Shop is currently at maximum capacity or unable to fulfill specifications.');
                        }}
                        disabled={updatingId === job._id}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 text-error-600 dark:text-error-400 dark:text-rose-400 border border-error-500/40 dark:border-rose-500/40 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-theme-xs disabled:opacity-50"
                        title="Reject job"
                      >
                        <Ban size={13} className="text-error-600 dark:text-error-400 dark:text-rose-400" />
                        <span>Reject</span>
                      </button>

                      {/* Accept - Success action: #009B6B */}
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(job._id, 'accepted')}
                        disabled={updatingId === job._id}
                        className="px-3 py-1.5 rounded-lg bg-success-500 hover:bg-success-600 text-white border border-success-500 text-xs font-bold transition-all shadow-theme-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        title="Accept into active printing queue"
                      >
                        {updatingId === job._id ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                        <span>Accept</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Box: Active Printing Queue */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs flex flex-col h-full">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200 dark:border-gray-800 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Printer size={16} className="text-brand-500 dark:text-brand-400 dark:text-sky-400" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-gray-900 dark:text-white">
                Active Printing Queue
              </h3>
              <span className="text-xs text-gray-500 hidden sm:inline">• FCFS Order</span>
            </div>
            <Link
              to="/owner/queue"
              className="text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Live Queue Manager</span>
              <ChevronRight size={12} />
            </Link>
          </div>

          {activeQueueJobs.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center flex-1">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-slate-700/60 text-success-600 dark:text-success-400 flex items-center justify-center mb-2">
                <CheckCircle2 size={20} className="text-success-600 dark:text-success-400" />
              </div>
              <div className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">✓ Queue is clear. No documents are currently printing.</div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 mb-2.5">
                Ready for incoming print jobs.
              </p>
              <Link
                to="/owner/queue"
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 hover:underline"
              >
                <span>Live Queue Manager</span>
                <ChevronRight size={12} />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800 flex-1">
              {activeQueueJobs.map((item, idx) => {
                const isPrinting = item.status === 'printing';
                const code = item.claimCode || (item._id ? `PD-${item._id.slice(-4).toUpperCase()}` : 'PD-XXXX');
                const displayCode = code.startsWith('#') ? code : `#${code}`;
                const docName = item.documentId?.originalFilename || item.originalFilename || 'Document.pdf';
                const pages = (item.printingSpecifications?.totalPages || 1) * (item.printingSpecifications?.copies || 1);
                const estTime = item.estimatedPrintingTime ? `~${item.estimatedPrintingTime}m` : `~${Math.max(2, Math.ceil(pages / 15))}m`;
                const customerName = item.customerId?.name || item.customerName || 'Customer';

                return (
                  <div
                    key={item._id || idx}
                    className={`py-2.5 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                      isPrinting ? 'bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 my-1' : 'hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-black text-xs text-gray-500 dark:text-slate-500 w-6 shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-brand-500 dark:text-brand-400 dark:text-sky-400">
                            {displayCode}
                          </span>
                          <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                            {docName}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-500 truncate mt-0.5">
                          {customerName} • {pages} total page{pages === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 self-end sm:self-center">
                      {/* Status Pill */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        isPrinting
                          ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-700 text-gray-900 dark:text-slate-300 border border-gray-200 dark:border-gray-800 dark:border-slate-600'
                      }`}>
                        {isPrinting && <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse" />}
                        <span>{isPrinting ? 'Printing' : 'Waiting in Queue'}</span>
                      </span>

                      <span className="font-mono text-xs text-gray-500 dark:text-slate-400 font-semibold w-12 text-right hidden sm:inline-block">
                        {estTime}
                      </span>

                      {/* Quick Status Action Button */}
                      {isPrinting ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(item._id, 'ready')}
                          disabled={updatingId === item._id}
                          className="px-3 py-1 rounded-md bg-success-500 hover:bg-success-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-theme-xs flex items-center gap-1"
                          title="Mark print ready for customer pickup"
                        >
                          <CheckCircle size={12} />
                          <span>Mark Ready</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(item._id, 'printing')}
                          disabled={updatingId === item._id}
                          className="px-3 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-theme-xs flex items-center gap-1"
                          title="Start printing document"
                        >
                          <Printer size={12} />
                          <span>Start Printing</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          7. SALES OVERVIEW
      ───────────────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-200 dark:border-gray-800 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-brand-500 dark:text-brand-400 dark:text-sky-400" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-gray-900 dark:text-white">
              Sales Overview
            </h3>
          </div>

          <Link
            to="/owner/sales"
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-800 dark:border-slate-700 text-gray-900 dark:text-slate-200 hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <span>View Sales</span>
            <ChevronRight size={13} className="text-brand-500 dark:text-brand-400 dark:text-sky-400" />
          </Link>
        </div>

        {/* Period Selector */}
        <div className="py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-500 block mb-1.5">
                Period
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'today', label: 'Today' },
                  { id: '7days', label: '7 Days' },
                  { id: '30days', label: '30 Days' },
                  { id: 'custom', label: 'Custom Date' },
                ].map((p) => {
                  const isSelected = salesRange === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSalesRange(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-brand-500 text-white shadow-theme-xs'
                          : 'bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Inputs */}
            {salesRange === 'custom' && (
              <DateRangePicker
                startDate={customStartDate}
                endDate={customEndDate}
                onStartDateChange={setCustomStartDate}
                onEndDateChange={setCustomEndDate}
                onReset={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="self-start sm:self-auto"
              />
            )}
          </div>
        </div>

        {/* Two-Part Layout: Left: Revenue Trend | Right: Order Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 sm:gap-4 items-stretch mt-1">
          {/* LEFT: Revenue Trend */}
          <div className="xl:col-span-8 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/30 border border-gray-200 dark:border-gray-800 dark:border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Net Revenue (After 3% Platform Commission)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                  ₱{periodNetEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-success-600 dark:text-success-400 dark:text-emerald-400">
                  (97% Take-Home)
                </span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2 flex-wrap">
                <span>{periodLabel}</span>
                <span>•</span>
                <span>Gross: ₱{periodGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">Comm. (3%): -₱{periodCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Revenue Trend Graph with Interactive Pinpoint Tracking */}
            <div className="mt-4 pt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-500 mb-2 flex items-center justify-between">
                <span>Revenue Trend</span>
                {hoveredTrendIdx !== null && svgPoints[hoveredTrendIdx] && (
                  <span className="text-[10px] font-bold text-brand-600 dark:text-sky-400">
                    {svgPoints[hoveredTrendIdx].fullLabel}: ₱{svgPoints[hoveredTrendIdx].netValue.toFixed(2)} Net
                  </span>
                )}
              </div>

              {trendData.every((t) => t.value === 0) ? (
                <div className="h-28 flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 dark:border-slate-700 rounded-lg bg-white/40 dark:bg-slate-800/40 text-center px-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                    No completed sales yet.
                  </p>
                </div>
              ) : (
                <div
                  className="relative select-none cursor-crosshair"
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={() => setHoveredTrendIdx(null)}
                  onTouchMove={handleChartMouseMove}
                  onTouchEnd={() => setHoveredTrendIdx(null)}
                >
                  {/* Floating Pinpoint Tooltip */}
                  {hoveredTrendIdx !== null && svgPoints[hoveredTrendIdx] && (
                    <div
                      className="absolute pointer-events-none transition-all duration-75 ease-out z-30"
                      style={{
                        left: `${(svgPoints[hoveredTrendIdx].x / 400) * 100}%`,
                        top: `${Math.max(5, (svgPoints[hoveredTrendIdx].y / 100) * 100 - 15)}%`,
                        transform: `translate(${
                          hoveredTrendIdx === 0
                            ? '10px, -100%'
                            : hoveredTrendIdx === svgPoints.length - 1
                            ? 'calc(-100% - 10px), -100%'
                            : '-50%, -100%'
                        })`,
                      }}
                    >
                      <div className="bg-slate-900/95 dark:bg-slate-950/95 text-white rounded-xl shadow-xl px-3 py-2 text-xs border border-slate-700/80 backdrop-blur-xs min-w-[160px]">
                        <div className="font-bold text-[11px] text-slate-300 border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between gap-3">
                          <span>{svgPoints[hoveredTrendIdx].fullLabel || svgPoints[hoveredTrendIdx].label}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{svgPoints[hoveredTrendIdx].orderCount} order{svgPoints[hoveredTrendIdx].orderCount === 1 ? '' : 's'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] text-slate-400">Net Take-Home:</span>
                          <span className="text-xs font-black text-emerald-400">₱{svgPoints[hoveredTrendIdx].netValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mt-0.5">
                          <span>Gross Sales:</span>
                          <span className="font-semibold text-slate-200">₱{svgPoints[hoveredTrendIdx].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                          <span>Comm. (3%):</span>
                          <span className="text-amber-400">-₱{svgPoints[hoveredTrendIdx].commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <svg viewBox="0 0 400 100" className="w-full h-24 overflow-visible">
                    <line x1="20" y1="80" x2="380" y2="80" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" />
                    <line x1="20" y1="15" x2="380" y2="15" stroke="currentColor" strokeOpacity="0.06" strokeDasharray="3 3" />
                    {areaPath && <path d={areaPath} fill="#465FFF" fillOpacity="0.08" />}
                    {linePath && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="#465FFF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Active Vertical Guideline on Pinpoint */}
                    {hoveredTrendIdx !== null && svgPoints[hoveredTrendIdx] && (
                      <line
                        x1={svgPoints[hoveredTrendIdx].x}
                        y1="12"
                        x2={svgPoints[hoveredTrendIdx].x}
                        y2="82"
                        stroke="#465FFF"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        strokeOpacity="0.65"
                      />
                    )}

                    {svgPoints.map((pt, idx) => {
                      const isHovered = hoveredTrendIdx === idx;
                      return (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredTrendIdx(idx)}
                        >
                          {/* Invisible larger hover hit area */}
                          <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                          {/* Hover Pinpoint Pulse Rings */}
                          {isHovered && (
                            <>
                              <circle cx={pt.x} cy={pt.y} r="9" fill="#465FFF" fillOpacity="0.2" className="animate-ping" />
                              <circle cx={pt.x} cy={pt.y} r="5.5" fill="#465FFF" stroke="#FFFFFF" strokeWidth="2.5" />
                            </>
                          )}

                          {/* Regular Point Dot */}
                          {!isHovered && (
                            <circle cx={pt.x} cy={pt.y} r="3.5" fill="#465FFF" className="transition-transform hover:scale-125" />
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  <div className="flex justify-between items-center px-4 mt-1 text-[10px] font-bold text-gray-500 dark:text-slate-500">
                    {trendData.map((t, idx) => {
                      const isHovered = hoveredTrendIdx === idx;
                      return (
                        <span
                          key={idx}
                          onClick={() => setHoveredTrendIdx(idx)}
                          className={`cursor-pointer transition-colors ${
                            isHovered
                              ? 'text-brand-600 dark:text-sky-400 font-extrabold scale-110'
                              : 'hover:text-gray-900 dark:hover:text-white'
                          }`}
                        >
                          {t.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Order Activity */}
          <div className="xl:col-span-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/30 border border-gray-200 dark:border-gray-800 dark:border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Order Activity
              </span>

              <div className="mt-3 space-y-2.5">
                {/* Completed - Most Prominent */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    Completed
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-success-600 dark:text-success-400 dark:text-white">
                    {periodCompletedCount}
                  </span>
                </div>

                {/* Pending - Secondary */}
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                    Pending
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-300">
                    {incomingJobs.length}
                  </span>
                </div>

                {/* Printing - Secondary */}
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                    Printing
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-300">
                    {activeQueueJobs.filter((j) => j.status === 'printing').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Average order value
              </span>
              <div className="text-lg font-black text-gray-900 dark:text-white mt-1">
                ₱{periodAverageOrder.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          8. RECENT COMPLETED ORDERS (Visual Analytics)
      ───────────────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200 dark:border-gray-800 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success-600 dark:text-success-400 dark:text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-gray-900 dark:text-white">
              Recent Completed Orders
            </h3>
          </div>
          <Link
            to="/owner/requests?status=completed"
            className="text-xs font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
          >
            <span>View all completed</span>
            <ChevronRight size={12} />
          </Link>
        </div>

        {/* 2-Column Layout: Left Summary Card + Right Activity Bar Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4 items-stretch">
          {/* Left Column: Total Completed Summary Card */}
          <div className="xl:col-span-5 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/30 border border-gray-200 dark:border-gray-800 dark:border-slate-700/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Total Completed
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-success-600 dark:text-success-400 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Fulfilled
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                  {completedOrders.length}
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  order{completedOrders.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-500 mt-1">
                Total completed customer print jobs
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800 dark:border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400 font-medium">Completed Today:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {todayCompletedOrders.length} {todayCompletedOrders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-slate-400 font-medium">Total Fulfilled Value:</span>
                <span className="font-bold text-success-600 dark:text-success-400 dark:text-emerald-400">
                  ₱{completedOrders.reduce((acc, curr) => acc + (curr.estimatedCost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Order Activity Bar Chart */}
          <div className="xl:col-span-7 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/30 border border-gray-200 dark:border-gray-800 dark:border-slate-700/80 flex flex-col justify-between relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Completed Orders (Past 7 Days)
              </span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-500">
                {recentDaysActivity[0]?.dateStr} - {recentDaysActivity[recentDaysActivity.length - 1]?.dateStr}
              </span>
            </div>

            {/* Chart Area */}
            <div className="relative h-36 flex items-end justify-between gap-1 sm:gap-2 px-2 pt-6 pb-2 border-b border-gray-200 dark:border-gray-800 dark:border-slate-700/80">
              {/* Subtle Grid Lines */}
              <div className="absolute inset-x-0 top-6 border-b border-dashed border-gray-200 dark:border-gray-800 dark:border-slate-700/40 pointer-events-none" />
              <div className="absolute inset-x-0 top-20 border-b border-dashed border-gray-200 dark:border-gray-800 dark:border-slate-700/40 pointer-events-none" />

              {/* Empty state centered message if no completed orders */}
              {completedOrders.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-800/95 border border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs text-center">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">No completed orders yet</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-500">Activity will automatically chart here as orders are completed</p>
                  </div>
                </div>
              )}

              {/* Bars for 7 days */}
              {recentDaysActivity.map((d, i) => {
                const hasOrders = d.count > 0;
                const barHeightPercent = maxDailyCompleted > 0
                  ? Math.max(12, Math.round((d.count / maxDailyCompleted) * 100))
                  : 0;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full z-0 group">
                    {/* Count badge above bar */}
                    <span className={`text-[10px] font-bold mb-1 transition-opacity ${
                      hasOrders
                        ? 'text-success-600 dark:text-success-400 dark:text-emerald-400 opacity-100'
                        : 'text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100'
                    }`}>
                      {d.count}
                    </span>

                    {/* The Bar */}
                    {hasOrders ? (
                      <div
                        style={{ height: `${barHeightPercent}%` }}
                        className="w-full max-w-[28px] sm:max-w-[34px] rounded-t-md bg-brand-500 dark:bg-sky-500 hover:bg-success-500 dark:hover:bg-emerald-500 transition-all duration-200 cursor-default"
                        title={`${d.count} completed on ${d.dayName} (${d.dateStr})`}
                      />
                    ) : (
                      <div
                        className="w-full max-w-[28px] sm:max-w-[34px] h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/80"
                        title={`0 completed on ${d.dayName} (${d.dateStr})`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* X-Axis Days Labels */}
            <div className="flex items-center justify-between gap-1 sm:gap-2 px-2 pt-2">
              {recentDaysActivity.map((d, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className={`block text-[11px] font-bold ${
                    d.isToday
                      ? 'text-brand-500 dark:text-brand-400 dark:text-sky-400'
                      : 'text-gray-500 dark:text-slate-400'
                  }`}>
                    {d.dayName}
                  </span>
                  <span className="block text-[9px] text-gray-500 dark:text-slate-500 font-mono">
                    {d.dateStr}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          9. CUSTOMER RATINGS & FEEDBACK (Read-Only Owner View)
      ───────────────────────────────────────────────────────────── */}
      <div className="p-3.5 sm:p-5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-800 dark:border-slate-700 shadow-theme-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800 dark:border-slate-700 gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-brand-600 dark:text-sky-400" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-gray-900 dark:text-white m-0">
              Customer Ratings &amp; Feedback
            </h3>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-bold text-amber-700 dark:text-amber-300">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span>{reviewsData.summary?.rating > 0 ? Number(reviewsData.summary.rating).toFixed(1) : 'No ratings yet'}</span>
              <span className="text-[11px] text-amber-600/80 dark:text-amber-400 font-normal">
                ({reviewsData.summary?.reviewsCount || 0} {Number(reviewsData.summary?.reviewsCount) === 1 ? 'review' : 'reviews'})
              </span>
            </div>
            {reviewsData.summary?.avgPrintQuality && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                Quality: {Number(reviewsData.summary.avgPrintQuality).toFixed(1)}/5
              </span>
            )}
            {reviewsData.summary?.avgSpeedRating && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                Speed: {Number(reviewsData.summary.avgSpeedRating).toFixed(1)}/5
              </span>
            )}
          </div>
        </div>

        {/* Reviews List */}
        {loadingReviews ? (
          <div className="flex items-center justify-center py-8 text-xs text-slate-400">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading customer feedback...
          </div>
        ) : reviewsData.reviews && reviewsData.reviews.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-slate-700/60 space-y-2">
            {reviewsData.reviews.map((rev) => (
              <div key={rev.id || rev.orderId} className="pt-3 pb-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {rev.customerName || 'Customer'}
                    </span>
                    {rev.isAnonymous && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 font-medium">
                        Anonymous
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {new Date(rev.reviewedAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center text-amber-400 font-black">
                    {'★'.repeat(rev.rating || 5)}
                    <span className="text-gray-300 dark:text-slate-600 font-normal">
                      {'★'.repeat(5 - (rev.rating || 5))}
                    </span>
                  </div>
                  {(rev.printQuality || rev.speedRating) && (
                    <div className="text-[11px] text-gray-500 dark:text-slate-400">
                      {rev.printQuality && `Quality: ${rev.printQuality}/5`}
                      {rev.printQuality && rev.speedRating && ' • '}
                      {rev.speedRating && `Speed: ${rev.speedRating}/5`}
                    </div>
                  )}
                </div>

                {rev.comment && (
                  <p className="text-xs text-gray-700 dark:text-slate-300 italic bg-gray-50 dark:bg-slate-700/40 p-2.5 rounded-lg border border-gray-100 dark:border-slate-700/60 m-0">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                )}

                {rev.tags && rev.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {rev.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-sky-300 border border-blue-100 dark:border-blue-900/40"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Pagination Controls */}
            {reviewsData.pagination?.pages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700/60 text-xs">
                <span className="text-slate-400">
                  Page {reviewsData.pagination.page} of {reviewsData.pagination.pages} ({reviewsData.pagination.total} total reviews)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={reviewsData.pagination.page <= 1 || loadingReviews}
                    onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed bg-transparent text-slate-700 dark:text-slate-200"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={reviewsData.pagination.page >= reviewsData.pagination.pages || loadingReviews}
                    onClick={() => setReviewPage((p) => p + 1)}
                    className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed bg-transparent text-slate-700 dark:text-slate-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-gray-400 space-y-1">
            <p className="font-semibold text-gray-600 dark:text-slate-300 m-0">No customer reviews yet</p>
            <p className="text-[11px] text-gray-400 m-0">
              When customers rate your shop upon order completion, their ratings, tags, and feedback comments will appear here.
            </p>
          </div>
        )}
      </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TEMPORARY CLOSURE MODAL
      ───────────────────────────────────────────────────────────── */}
      <TemporaryClosureModal
        isOpen={showClosureModal}
        onClose={() => setShowClosureModal(false)}
        shop={shop}
        onConfirm={handleConfirmClosure}
        loading={submittingClosure}
      />

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: REPORT FILE ISSUE (No Silent Cancels)
      ───────────────────────────────────────────────────────────── */}
      {reportingFileOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning-600 dark:text-warning-400 dark:text-amber-400" />
                <h3 className="font-black text-amber-900 dark:text-amber-300 text-sm uppercase">
                  Report File Issue to Customer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportingFileOrder(null)}
                className="text-warning-600 dark:text-warning-400 dark:text-amber-400"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReportFileIssue} className="p-5 space-y-3.5 text-xs">
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/40 border border-gray-200 dark:border-gray-800 dark:border-slate-600">
                <div className="font-mono font-bold text-brand-500 dark:text-brand-400 dark:text-sky-400">
                  {reportingFileOrder.claimCode || `#PD-${reportingFileOrder._id?.slice(-4).toUpperCase()}`}
                </div>
                <div className="font-bold text-gray-900 dark:text-white truncate">
                  {reportingFileOrder.documentId?.originalFilename || reportingFileOrder.originalFilename || 'Document.pdf'}
                </div>
                <div className="text-gray-500 text-[11px]">
                  Customer: {reportingFileOrder.customerId?.name || reportingFileOrder.customerName || 'Customer'}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-900 dark:text-slate-300 mb-1 uppercase tracking-wider text-[11px]">
                  Common Issue Templates:
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    'Missing pages or unreadable formatting in uploaded file. Please re-upload.',
                    'File is corrupted or password protected. Please re-submit an unlocked PDF.',
                    'Cut-off text or wrong paper orientation detected.',
                    'Low resolution / blurry image. Text may not print clearly.',
                  ].map((msg, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFileIssueMessage(msg)}
                      className="p-2 rounded-md text-left text-[11px] font-medium bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-gray-800 dark:border-slate-600 text-gray-900 dark:text-slate-300"
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-900 dark:text-slate-300 mb-1 uppercase tracking-wider text-[11px]">
                  Message to Customer:
                </label>
                <textarea
                  rows={3}
                  required
                  value={fileIssueMessage}
                  onChange={(e) => setFileIssueMessage(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-800 dark:border-slate-600 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportingFileOrder(null)}
                  className="px-3.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-slate-300 hover:bg-gray-50 dark:bg-gray-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFileIssue || !fileIssueMessage.trim()}
                  className="px-4 py-1.5 rounded-lg bg-warning-500 hover:bg-warning-600 text-white text-xs font-bold transition-all shadow-theme-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingFileIssue ? <RefreshCw size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                  <span>Notify Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: VIEW ORDER / FILE DETAILS
      ───────────────────────────────────────────────────────────── */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/60 border-b border-gray-200 dark:border-gray-800 dark:border-slate-600 flex items-center justify-between">
              <div>
                <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase">
                  Job Details ({viewingOrder.claimCode || `#PD-${viewingOrder._id?.slice(-4).toUpperCase()}`})
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Submitted by {viewingOrder.customerId?.name || 'Customer'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/40 border border-gray-200 dark:border-gray-800 dark:border-slate-600">
                  <span className="text-gray-500 block font-semibold text-[11px]">Document:</span>
                  <span className="font-bold text-xs text-gray-900 dark:text-white truncate block mt-0.5">
                    {viewingOrder.documentId?.originalFilename || viewingOrder.originalFilename || 'Document.pdf'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/40 border border-gray-200 dark:border-gray-800 dark:border-slate-600">
                  <span className="text-gray-500 block font-semibold text-[11px]">Total Price:</span>
                  <span className="font-black text-sm text-brand-500 dark:text-brand-400 dark:text-sky-400 block mt-0.5">
                    ₱{Number(viewingOrder.estimatedCost || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/40 border border-gray-200 dark:border-gray-800 dark:border-slate-600 text-center">
                  <span className="text-gray-500 block text-[10px]">Pages:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {viewingOrder.printingSpecifications?.totalPages || 1}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/40 border border-gray-200 dark:border-gray-800 dark:border-slate-600 text-center">
                  <span className="text-gray-500 block text-[10px]">Copies:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {viewingOrder.printingSpecifications?.copies || 1}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/40 border border-gray-200 dark:border-gray-800 dark:border-slate-600 text-center">
                  <span className="text-gray-500 block text-[10px]">Color:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {viewingOrder.printingSpecifications?.colorMode === 'color' ? 'Full Color' : 'B&W'}
                  </span>
                </div>
              </div>

              {viewingOrder.printingSpecifications?.additionalInstructions && (
                <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs">
                  <span className="font-bold text-brand-500 dark:text-brand-400 dark:text-sky-300 block mb-0.5 text-[11px]">Instructions:</span>
                  <p className="text-gray-900 dark:text-slate-300 m-0">
                    {viewingOrder.printingSpecifications.additionalInstructions}
                  </p>
                </div>
              )}

              {/* View / Download Document Link */}
              {viewingOrder.documentId?._id && (
                <a
                  href={documentAPI.getViewUrl(viewingOrder.documentId._id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-gray-900 dark:text-slate-200 border border-gray-200 dark:border-gray-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileDown size={14} />
                  <span>Open Attached Document</span>
                </a>
              )}
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/60 border-t border-gray-200 dark:border-gray-800 dark:border-slate-600 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-3.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold text-xs"
              >
                Close
              </button>
              {viewingOrder.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(viewingOrder._id, 'accepted')}
                  disabled={updatingId === viewingOrder._id}
                  className="px-3.5 py-1.5 rounded-lg bg-success-500 hover:bg-success-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check size={13} />
                  <span>Accept Job</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: REJECT ORDER
      ───────────────────────────────────────────────────────────── */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between">
              <h3 className="font-black text-error-600 dark:text-error-400 dark:text-rose-300 text-sm uppercase">
                Reject Print Job
              </h3>
              <button
                type="button"
                onClick={() => {
                  setRejectingOrderId(null);
                  setRejectionReason('');
                }}
                className="text-error-600 dark:text-error-400 dark:text-rose-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-900 dark:text-slate-300">
                Please provide a brief reason to notify the customer why their request cannot be fulfilled:
              </p>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white outline-none focus:border-error-500"
              />
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/60 border-t border-gray-200 dark:border-gray-800 dark:border-slate-600 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingOrderId(null);
                  setRejectionReason('');
                }}
                className="px-3.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(rejectingOrderId, 'rejected', rejectionReason)}
                disabled={updatingId === rejectingOrderId}
                className="px-4 py-1.5 rounded-lg bg-error-500 hover:bg-error-600 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 5: COUNTER PICKUP & CLAIM CODE VERIFICATION
      ───────────────────────────────────────────────────────────── */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 dark:border-slate-700 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/60 border-b border-gray-200 dark:border-gray-800 dark:border-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket size={16} className="text-brand-500 dark:text-brand-400 dark:text-sky-400" />
                <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase">
                  Counter Pickup Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowClaimModal(false);
                  setVerifiedOrder(null);
                  setClaimInput('');
                  setLookupError('');
                }}
                className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLookupClaim();
                }}
                className="flex items-stretch gap-2"
              >
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Enter Claim Code (e.g. #PD-5187)..."
                    value={claimInput}
                    onChange={(e) => {
                      setClaimInput(e.target.value);
                      if (lookupError) setLookupError('');
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white uppercase font-mono outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
                >
                  Lookup
                </button>
              </form>

              {lookupError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs font-semibold text-error-600 dark:text-error-400 dark:text-rose-300">
                  {lookupError}
                </div>
              )}

              {verifiedOrder && (
                <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-800 dark:bg-slate-700/40 border border-gray-200 dark:border-gray-800 dark:border-slate-600 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-black text-sm text-brand-500 dark:text-brand-400 dark:text-sky-300">
                        {verifiedOrder.claimCode?.startsWith('#') ? verifiedOrder.claimCode : `#${verifiedOrder.claimCode || (verifiedOrder._id ? `PD-${verifiedOrder._id.slice(-4).toUpperCase()}` : 'PD-5187')}`}
                      </span>
                      <div className="font-bold text-xs text-gray-900 dark:text-white">
                        {verifiedOrder.customerId?.name || 'Customer'}
                      </div>
                    </div>
                    <span className="text-sm font-black text-brand-500 dark:text-brand-400 dark:text-sky-400">
                      ₱{Number(verifiedOrder.estimatedCost || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Status: <span className="font-bold uppercase text-gray-900 dark:text-slate-200">{verifiedOrder.status}</span>
                  </div>

                  {verifiedOrder.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => handleReleaseOrder(verifiedOrder._id)}
                      disabled={verifyingPickup}
                      className="w-full py-2 rounded-lg bg-success-500 hover:bg-success-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {verifyingPickup ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={15} />}
                      <span>Verify &amp; Release to Customer</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </DashboardContainer>
  );
}
