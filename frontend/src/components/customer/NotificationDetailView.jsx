import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  Clock,
  CheckCircle2,
  Package,
  Printer,
  FileText,
  AlertTriangle,
  XCircle,
  CheckCheck,
  Bell,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  MapPin,
  Phone,
  Trash2,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { notificationAPI, requestAPI } from '../../services/api';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';

// 7-Step Lifecycle definitions
const LIFECYCLE_STAGES = [
  { key: 'submitted', label: 'Submitted', altKeys: ['pending'] },
  { key: 'accepted', label: 'Accepted', altKeys: [] },
  { key: 'queued', label: 'In Queue', altKeys: [] },
  { key: 'printing', label: 'Printing', altKeys: [] },
  { key: 'ready_for_pickup', label: 'Ready for Pickup', altKeys: ['ready'] },
  { key: 'picked_up', label: 'Picked Up', altKeys: [] },
  { key: 'completed', label: 'Completed', altKeys: [] },
];

export default function NotificationDetailView({ notificationId, initialNotification = null, onBack }) {
  const navigate = useNavigate();
  const { markRead, notifications, deleteNotification } = useNotifications();

  const [notification, setNotification] = useState(initialNotification);
  const [order, setOrder] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loading, setLoading] = useState(!initialNotification);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 1. Fetch Notification if needed or fallback from context
  useEffect(() => {
    let isMounted = true;

    const loadNotification = async () => {
      // Check local context first for instant rendering
      if (!initialNotification && notifications?.length) {
        const found = notifications.find((n) => n._id === notificationId);
        if (found) {
          setNotification(found);
          setLoading(false);
        }
      }

      try {
        const res = await notificationAPI.getById(notificationId);
        const fetched = res.data?.data || res.data;
        if (isMounted && fetched) {
          setNotification(fetched);
        }
      } catch (err) {
        console.warn('Could not fetch single notification from server:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (notificationId) {
      loadNotification();
    }

    return () => {
      isMounted = false;
    };
  }, [notificationId, initialNotification, notifications]);

  // 2. Automatically mark as read on open (without changing createdAt or status)
  useEffect(() => {
    if (notification?._id && !notification.isRead) {
      markRead(notification._id);
    }
  }, [notification?._id, notification?.isRead, markRead]);

  // 3. Resolve Order details & fetch Status History
  const relatedOrder = useMemo(() => {
    if (!notification?.relatedRequestId) return null;
    return typeof notification.relatedRequestId === 'object'
      ? notification.relatedRequestId
      : null;
  }, [notification?.relatedRequestId]);

  const orderId = useMemo(() => {
    if (!notification?.relatedRequestId) return null;
    return typeof notification.relatedRequestId === 'object'
      ? notification.relatedRequestId?._id
      : notification.relatedRequestId;
  }, [notification?.relatedRequestId]);

  useEffect(() => {
    let isMounted = true;
    if (!orderId) {
      setOrder(null);
      setStatusHistory([]);
      return;
    }

    // Set immediate order state if available from populated notification
    if (relatedOrder) {
      setOrder(relatedOrder);
    }

    // Fetch full order to guarantee complete specifications and documents
    const fetchFullOrderAndHistory = async () => {
      setHistoryLoading(true);
      try {
        const [orderRes, historyRes] = await Promise.allSettled([
          requestAPI.getById(orderId),
          requestAPI.getStatusHistory(orderId),
        ]);

        if (isMounted) {
          if (orderRes.status === 'fulfilled' && orderRes.value?.data) {
            const raw = orderRes.value.data?.data || orderRes.value.data;
            setOrder(raw);
          }
          if (historyRes.status === 'fulfilled' && historyRes.value?.data) {
            const rawHist = historyRes.value.data?.data || historyRes.value.data?.history || historyRes.value.data || [];
            setStatusHistory(Array.isArray(rawHist) ? rawHist : []);
          }
        }
      } catch (err) {
        console.warn('Could not load order details or history:', err.message);
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    };

    fetchFullOrderAndHistory();

    return () => {
      isMounted = false;
    };
  }, [orderId, relatedOrder]);

  // Date formatting helpers
  const formatExactDateTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${datePart} · ${timePart}`;
    } catch {
      return String(dateStr);
    }
  };

  const formatShortTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  // Status visual mapping
  const getStatusMeta = (status) => {
    switch (status) {
      case 'submitted':
      case 'pending':
        return {
          label: 'Submitted',
          icon: Clock,
          color: '#D97706',
          bg: '#FEF3C7',
          border: '#FDE68A',
          dot: 'bg-amber-500',
        };
      case 'accepted':
        return {
          label: 'Accepted',
          icon: CheckCircle2,
          color: '#2563EB',
          bg: '#EFF6FF',
          border: '#BFDBFE',
          dot: 'bg-blue-600',
        };
      case 'queued':
        return {
          label: 'In Queue',
          icon: Clock,
          color: '#7C3AED',
          bg: '#F5F3FF',
          border: '#DDD6FE',
          dot: 'bg-purple-600',
        };
      case 'printing':
        return {
          label: 'Printing Started',
          icon: Printer,
          color: '#0284C7',
          bg: '#F0F9FF',
          border: '#BAE6FD',
          dot: 'bg-sky-500',
        };
      case 'ready':
      case 'ready_for_pickup':
        return {
          label: 'Ready for Pickup',
          icon: Package,
          color: '#16A34A',
          bg: '#DCFCE7',
          border: '#86EFAC',
          dot: 'bg-emerald-500',
        };
      case 'picked_up':
        return {
          label: 'Picked Up',
          icon: Package,
          color: '#0D9488',
          bg: '#CCFBF1',
          border: '#99F6E4',
          dot: 'bg-teal-500',
        };
      case 'completed':
        return {
          label: 'Completed',
          icon: CheckCheck,
          color: '#475569',
          bg: '#F1F5F9',
          border: '#CBD5E1',
          dot: 'bg-slate-500',
        };
      case 'rejected':
        return {
          label: 'Order Declined',
          icon: XCircle,
          color: '#DC2626',
          bg: '#FEE2E2',
          border: '#FECACA',
          dot: 'bg-rose-500',
        };
      case 'cancelled':
        return {
          label: 'Order Cancelled',
          icon: AlertTriangle,
          color: '#EA580C',
          bg: '#FFEDD5',
          border: '#FED7AA',
          dot: 'bg-orange-500',
        };
      default:
        return {
          label: 'Notice',
          icon: Bell,
          color: '#19398d',
          bg: '#EEF2FF',
          border: '#C7D2FE',
          dot: 'bg-[#19398d]',
        };
    }
  };

  // Determine current status of order or notification
  const currentStatus = order?.status || (notification?.type?.replace('request_', '')) || 'submitted';
  const statusMeta = getStatusMeta(currentStatus);
  const StatusIcon = statusMeta.icon;

  // Shop and Claim Code details
  const shopName = order?.shopId?.shopName || order?.shopName || 'Printing Shop';
  const claimCode = order?.claimCode || (orderId ? `#PD-${orderId.slice(-4).toUpperCase()}` : null);
  const isOrderRelated = Boolean(orderId);

  // Specifications
  const specs = order?.printingSpecifications || {};
  const isColor = specs.colorMode === 'color';
  const serviceTitle = isColor ? 'Color Printing' : 'B&W Printing';
  const paperSize = specs.paperSize || 'A4';
  const copies = specs.copies || 1;
  const totalPages = specs.totalPages || order?.documentId?.totalPages || 1;
  const sidedText = specs.sided === 'double' ? 'Double-sided' : 'Single-sided';
  const totalAmount = order?.estimatedCost || order?.totalPrice
    ? `₱${Number(order.estimatedCost || order.totalPrice).toFixed(2)}`
    : null;

  // Status History Timestamp Lookup
  const getStageTimestamp = (stageKey, altKeys = []) => {
    const allKeys = [stageKey, ...altKeys];
    // 1. Check order_status_history array
    const record = statusHistory.find((h) => allKeys.includes(h.status));
    if (record?.createdAt || record?.created_at) {
      return record.createdAt || record.created_at;
    }
    // 2. Check direct model timestamps on order
    if (stageKey === 'submitted') return order?.submittedAt || order?.createdAt;
    if (stageKey === 'accepted') return order?.acceptedAt;
    if (stageKey === 'queued') return order?.queuedAt;
    if (stageKey === 'printing') return order?.printingStartedAt;
    if (stageKey === 'ready_for_pickup') return order?.readyAt;
    if (stageKey === 'picked_up') return order?.pickedUpAt;
    if (stageKey === 'completed') return order?.completedAt;
    if (stageKey === 'rejected') return order?.rejectedAt;
    if (stageKey === 'cancelled') return order?.cancelledAt;

    return null;
  };

  // Stage state calculator: completed | current | upcoming
  const getStageState = (stageIndex, currentStatusKey) => {
    if (currentStatusKey === 'rejected' || currentStatusKey === 'cancelled') {
      return stageIndex === 0 ? 'completed' : 'upcoming';
    }

    const currentIndex = LIFECYCLE_STAGES.findIndex(
      (s) => s.key === currentStatusKey || s.altKeys.includes(currentStatusKey)
    );

    if (currentIndex === -1) {
      return stageIndex === 0 ? 'current' : 'upcoming';
    }

    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/notifications');
    }
  };

  const handleViewOrderDetails = () => {
    if (orderId) {
      navigate(`/my-requests/${orderId}`);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="spinner mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Loading notification...
        </p>
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="w-full max-w-4xl mx-auto py-16 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
        <Bell size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
        <h3 className="text-lg font-black text-[#19398d] dark:text-white m-0">
          Notification Not Found
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
          This notification may have been removed or does not exist.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="py-2 px-4 rounded-xl bg-[#19398d] hover:bg-[#122b6d] text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Notifications</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-16 pt-1 sm:pt-2 px-1 sm:px-0 fade-in">
      {/* 1. TOP NAVIGATION / BACK BAR */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBack}
          className="py-2 px-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-[#19398d] dark:text-sky-400 font-extrabold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 inline-flex items-center gap-2 transition-all shadow-2xs cursor-pointer group"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Notifications</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="py-2 px-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs sm:text-sm border border-rose-200 dark:border-rose-900 inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>
      </div>

      {/* 2. MAIN FULL-SCREEN NOTIFICATION READING CARD */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Top Accent Strip */}
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: statusMeta.color }}
        />

        <div className="p-6 sm:p-8 lg:p-10 space-y-6">
          {/* HEADER: Title, Status Indicator, Shop, Order ID, Exact Timestamp */}
          <div className="space-y-3 pb-6 border-b border-slate-200/80 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#19398d] dark:text-white tracking-tight m-0">
                    {notification.title}
                  </h1>
                </div>

                {/* Shop Name & Order ID */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 pt-1">
                  {isOrderRelated && (
                    <span className="inline-flex items-center gap-1.5 text-[#172033] dark:text-white">
                      <Store size={15} className="text-[#19398d] dark:text-sky-400" />
                      <span>{shopName}</span>
                    </span>
                  )}

                  {claimCode && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="font-mono font-black text-xs text-[#19398d] dark:text-sky-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                        Order {claimCode}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Status Indicator Pill / Dot */}
              <div
                className="px-3.5 py-1.5 rounded-full text-xs font-black inline-flex items-center gap-2 shrink-0 border shadow-2xs"
                style={{
                  backgroundColor: statusMeta.bg,
                  color: statusMeta.color,
                  borderColor: statusMeta.border,
                }}
              >
                <span className={`w-2 h-2 rounded-full ${statusMeta.dot} animate-pulse`} />
                <StatusIcon size={14} />
                <span>{statusMeta.label}</span>
              </div>
            </div>

            {/* Exact Date & Time Created */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
              <Calendar size={13} className="text-slate-400 dark:text-slate-500" />
              <span>{formatExactDateTime(notification.createdAt)}</span>
              {notification.isRead && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-slate-400">Read</span>
                </>
              )}
            </div>
          </div>

          {/* 3. NOTIFICATION MESSAGE CONTENT */}
          <div className="space-y-4">
            <div className="text-base sm:text-lg text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              <p className="m-0 whitespace-pre-line">
                {notification.message}
              </p>
            </div>

            {/* Optional Shop Delay Notice Callout */}
            {order?.delayNotice && (order.delayNotice.isDelayed || typeof order.delayNotice === 'string') && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                  <span className="font-black block mb-0.5">Shop Notice:</span>
                  <span>
                    {typeof order.delayNotice === 'string'
                      ? order.delayNotice
                      : order.delayNotice.reason || 'There is an expected delay with this order.'}
                    {order.delayNotice?.estimatedDelayMinutes > 0 && (
                      <span className="font-bold ml-1">
                        (~{order.delayNotice.estimatedDelayMinutes} mins delay)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. DYNAMIC ORDER SUMMARY (If related to a print order) */}
          {isOrderRelated && (
            <div className="pt-6 border-t border-slate-200/80 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#19398d] dark:text-sky-400 m-0 flex items-center gap-1.5">
                  <FileText size={15} />
                  <span>Order Summary</span>
                </h2>
                {claimCode && (
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {claimCode}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-750/70 rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-xs sm:text-sm">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Service
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">
                      {serviceTitle}
                    </span>
                    <span className="text-[11px] text-slate-500 block capitalize">
                      {specs.paperType || 'Bond'} Paper
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Paper Size
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">
                      {paperSize}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {sidedText}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Copies &amp; Pages
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">
                      {copies} {copies > 1 ? 'copies' : 'copy'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {totalPages} {totalPages > 1 ? 'pages' : 'page'} each
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Total
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#19398d] dark:text-sky-400">
                      {totalAmount || '—'}
                    </span>
                    {order?.paymentMethod && (
                      <span className="text-[11px] text-slate-500 block uppercase font-medium">
                        {order.paymentMethod.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Additional file/binding note if present */}
                {(order?.documentId?.originalName || (specs.binding && specs.binding !== 'none')) && (
                  <div className="mt-3.5 pt-3.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-600 dark:text-slate-300">
                    {order?.documentId?.originalName && (
                      <span className="font-medium truncate max-w-sm flex items-center gap-1.5">
                        <FileText size={13} className="text-[#19398d] dark:text-sky-400 shrink-0" />
                        <span className="truncate">{order.documentId.originalName}</span>
                      </span>
                    )}
                    {specs.binding && specs.binding !== 'none' && (
                      <span className="font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 capitalize">
                        Binding: {specs.binding.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. ORDER STATUS TIMELINE (If related to a print order) */}
          {isOrderRelated && (
            <div className="pt-6 border-t border-slate-200/80 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#19398d] dark:text-sky-400 m-0 flex items-center gap-1.5">
                  <Clock size={15} />
                  <span>Order Status</span>
                </h2>
                {historyLoading && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    Updating history...
                  </span>
                )}
              </div>

              {/* Status Flow List matching user specification:
                  ✓ Submitted
                  ✓ Accepted
                  ✓ In Queue
                  ✓ Printing
                  ● Ready for Pickup
                  ○ Picked Up
                  ○ Completed
              */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-700/80">
                <div className="space-y-3">
                  {/* Alternative Terminal States if Rejected or Cancelled */}
                  {currentStatus === 'rejected' ? (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-3">
                      <XCircle size={18} className="shrink-0" />
                      <div>
                        <span className="font-black text-sm block">Order Declined</span>
                        <span className="text-xs">This request was declined by the printing shop.</span>
                      </div>
                    </div>
                  ) : currentStatus === 'cancelled' ? (
                    <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200 flex items-center gap-3">
                      <AlertTriangle size={18} className="shrink-0" />
                      <div>
                        <span className="font-black text-sm block">Order Cancelled</span>
                        <span className="text-xs">This print request was cancelled.</span>
                      </div>
                    </div>
                  ) : (
                    LIFECYCLE_STAGES.map((stage, idx) => {
                      const stageState = getStageState(idx, currentStatus);
                      const timestamp = getStageTimestamp(stage.key, stage.altKeys);
                      const isCompleted = stageState === 'completed';
                      const isCurrent = stageState === 'current';
                      const isUpcoming = stageState === 'upcoming';

                      return (
                        <div
                          key={stage.key}
                          className={`flex items-center justify-between gap-3 py-1 px-2.5 rounded-lg transition-colors ${
                            isCurrent
                              ? 'bg-blue-50/70 dark:bg-blue-950/30 font-bold'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Icon Indicator: ✓ | ● | ○ */}
                            {isCompleted ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs shrink-0">
                                ✓
                              </span>
                            ) : isCurrent ? (
                              <span className="w-5 h-5 rounded-full bg-[#19398d]/10 text-[#19398d] dark:text-sky-400 flex items-center justify-center font-black text-xs shrink-0 relative">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#19398d] dark:bg-sky-400 animate-pulse" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 text-slate-300 dark:text-slate-600 flex items-center justify-center text-xs shrink-0">
                                ○
                              </span>
                            )}

                            <span
                              className={`text-xs sm:text-sm ${
                                isCompleted
                                  ? 'font-bold text-slate-800 dark:text-slate-200'
                                  : isCurrent
                                  ? 'font-black text-[#19398d] dark:text-sky-400'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {stage.label}
                            </span>
                          </div>

                          {/* Timestamp column */}
                          <div className="text-right shrink-0">
                            {timestamp ? (
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {formatShortTime(timestamp)}
                              </span>
                            ) : isUpcoming ? (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600 uppercase font-semibold tracking-wider">
                                Upcoming
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* 6. VIEW ORDER DETAILS BUTTON */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleViewOrderDetails}
                  className="w-full sm:w-auto py-3 px-6 rounded-xl bg-[#19398d] hover:bg-[#122b6d] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <span>View Order Details</span>
                  <ExternalLink size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          try {
            await deleteNotification(notification._id);
            toast.success('Notification deleted');
            handleBack();
          } catch {
            toast.error('Failed to delete notification');
          }
        }}
        title="Delete Notification?"
        description="Are you sure you want to delete this notification? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        icon="trash"
      />
    </div>
  );
}
