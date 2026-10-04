import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Store, Clock,
  ChevronRight, CheckCircle2, AlertTriangle, Layers,
  Printer, Package, RefreshCw, Trash2, Ticket, Check
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { requestAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import OrderStatusModal from '../../components/customer/OrderStatusModal';
import NotificationDetailView from '../../components/customer/NotificationDetailView';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

// Visual configuration for notification types & event statuses
const NOTIF_STATUS_CONFIGS = {
  request_submitted: {
    label: 'Submitted',
    icon: Clock,
    colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  },
  request_accepted: {
    label: 'Accepted',
    icon: CheckCircle2,
    colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  },
  request_queued: {
    label: 'In Queue',
    icon: Clock,
    colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/50',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20',
  },
  request_printing: {
    label: 'Printing',
    icon: Printer,
    colorClass: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/50',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
  },
  request_ready: {
    label: 'Ready for Pickup',
    icon: Package,
    colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  },
  request_picked_up: {
    label: 'Picked Up',
    icon: Package,
    colorClass: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/50',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20',
  },
  request_completed: {
    label: 'Completed',
    icon: CheckCircle2,
    colorClass: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  },
  request_rejected: {
    label: 'Declined',
    icon: AlertTriangle,
    colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  },
  request_cancelled: {
    label: 'Cancelled',
    icon: AlertTriangle,
    colorClass: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/50',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  },
  delay_alert: {
    label: 'Delay Notice',
    icon: AlertTriangle,
    colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  },
  shop_note: {
    label: 'Shop Note',
    icon: Store,
    colorClass: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-900/50',
    badgeClass: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/20',
  },
  default: {
    label: 'Notice',
    icon: Bell,
    colorClass: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 border-brand-200 dark:border-brand-900/50',
    badgeClass: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-500/20',
  },
};

export default function NotificationsPage() {
  const { id: routeNotificationId } = useParams();
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    loading: notifLoading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  const { socket } = useSocket() || {};

  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread'
  const [groupByOrder, setGroupByOrder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedModalOrder, setSelectedModalOrder] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);

  // Real-time socket listener for live notification synchronization
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchNotifications(true);
    };

    socket.on('request:accepted', handleUpdate);
    socket.on('request:queued', handleUpdate);
    socket.on('request:printing', handleUpdate);
    socket.on('request:ready', handleUpdate);
    socket.on('request:picked_up', handleUpdate);
    socket.on('request:completed', handleUpdate);
    socket.on('request:cancelled', handleUpdate);
    socket.on('request:rejected', handleUpdate);
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
      socket.off('request:status_changed', handleUpdate);
    };
  }, [socket, fetchNotifications]);

  // Relative time helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);
    if (diffSeconds < 60) return 'Just now';
    const diffMins = Math.floor(diffSeconds / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Date categorization helper for chronological date sections
  const getDateCategory = (dateStr) => {
    if (!dateStr) return 'Earlier';
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - itemDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return 'Earlier this week';
    return 'Older';
  };

  // Helper to resolve icon configuration for notification
  const getNotifMeta = (notif) => {
    if (!notif) return NOTIF_STATUS_CONFIGS.default;
    const typeKey = notif.type || '';
    if (NOTIF_STATUS_CONFIGS[typeKey]) return NOTIF_STATUS_CONFIGS[typeKey];

    const relatedReq = typeof notif.relatedRequestId === 'object' ? notif.relatedRequestId : null;
    if (relatedReq?.status) {
      const statusKey = `request_${relatedReq.status}`;
      if (NOTIF_STATUS_CONFIGS[statusKey]) return NOTIF_STATUS_CONFIGS[statusKey];
    }
    return NOTIF_STATUS_CONFIGS.default;
  };

  // Filter notifications (All vs Unread)
  const filteredNotifs = useMemo(() => {
    if (filterTab === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterTab]);

  // Group by Date for default chronological list
  const dateGroupedNotifs = useMemo(() => {
    const groups = {
      'Today': [],
      'Yesterday': [],
      'Earlier this week': [],
      'Older': [],
    };

    filteredNotifs.forEach((notif) => {
      const cat = getDateCategory(notif.createdAt);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(notif);
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [filteredNotifs]);

  // Group notifications by order when "Group by Order" toggle is active
  const groupedOrders = useMemo(() => {
    const groups = {};
    const unassociated = [];

    filteredNotifs.forEach((notif) => {
      const order = notif.relatedRequestId;
      const orderId = typeof order === 'object' ? order?._id : order;

      if (orderId) {
        if (!groups[orderId]) {
          groups[orderId] = {
            orderId,
            order: typeof order === 'object' ? order : null,
            items: [],
            latestDate: new Date(notif.createdAt || 0),
          };
        }
        groups[orderId].items.push(notif);
        const itemDate = new Date(notif.createdAt || 0);
        if (itemDate > groups[orderId].latestDate) {
          groups[orderId].latestDate = itemDate;
        }
      } else {
        unassociated.push(notif);
      }
    });

    const sortedGroups = Object.values(groups).sort((a, b) => b.latestDate - a.latestDate);
    return { groups: sortedGroups, unassociated };
  }, [filteredNotifs]);

  // Manual refresh with visual spinner
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchNotifications(false);
      toast.success('Notifications synchronized');
    } catch {
      toast.error('Failed to sync notifications');
    } finally {
      setRefreshing(false);
    }
  };

  // Open modal for an order
  const handleOpenOrder = async (orderOrId) => {
    if (!orderOrId) return;

    if (typeof orderOrId === 'object' && orderOrId._id) {
      setSelectedModalOrder(orderOrId);
      return;
    }

    try {
      const res = await requestAPI.getById(orderOrId);
      setSelectedModalOrder(res.data?.data || res.data);
    } catch {
      toast.error('Could not load order details');
    }
  };

  // If route contains :id, show full-screen notification detail view
  if (routeNotificationId) {
    return (
      <NotificationDetailView
        notificationId={routeNotificationId}
        onBack={() => navigate('/notifications')}
      />
    );
  }

  // Click handler for notification item - marks as read and navigates to detail view
  const handleNotifClick = (notif) => {
    if (!notif?._id) return;
    if (!notif.isRead) {
      markRead(notif._id);
    }
    navigate(`/notifications/${notif._id}`);
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-12 font-outfit fade-in">

      {/* ==================================================
          1. MAIN NOTIFICATION CONTAINER CARD
      ================================================== */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 sm:p-6 shadow-theme-xs space-y-5">

        {/* ==================================================
            UNIFIED CONTROLS: Filters & Contextual Actions
            (Eliminated redundant "Notifications" heading since top navbar already displays page title)
        ================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800/80">
          {/* Filter Pills & Group by Order */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'all'}
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                filterTab === 'all'
                  ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/30 shadow-2xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              All Updates · {notifications.length}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={filterTab === 'unread'}
              onClick={() => setFilterTab('unread')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                filterTab === 'unread'
                  ? 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/30 shadow-2xs'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              Unread · {unreadCount}
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={groupByOrder}
              onClick={() => setGroupByOrder((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 border shadow-2xs ${
                groupByOrder
                  ? 'bg-brand-50 text-brand-700 border-brand-300 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
            >
              <Layers size={13} className={groupByOrder ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'} />
              <span>Group by order</span>
            </button>
          </div>

          {/* Contextual Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                aria-label="Mark all notifications as read"
                className="h-8.5 sm:h-9 px-3 sm:px-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-theme-xs flex-1 sm:flex-none justify-center"
              >
                <CheckCheck size={14} />
                <span>Mark all as read</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh notifications"
              className="h-8.5 sm:h-9 px-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-theme-xs disabled:opacity-60 disabled:cursor-not-allowed flex-1 sm:flex-none justify-center"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-brand-600 dark:text-brand-400' : ''} />
              <span>Refresh</span>
            </button>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                aria-label="Clear all notifications"
                className="h-8.5 sm:h-9 px-3 rounded-xl bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-theme-xs flex-1 sm:flex-none justify-center"
                title="Delete all notifications"
              >
                <Trash2 size={14} />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* ==================================================
            2. NOTIFICATIONS CONTENT AREA
        ================================================== */}
        {notifLoading ? (
          /* Localized Skeleton Loader (No blank screen) */
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((sk) => (
              <div
                key={sk}
                className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-4 animate-pulse flex items-start gap-3.5"
              >
                <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded-md w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifs.length === 0 ? (
          /* Purposeful Compact Empty States matching visual reference */
          <div className="py-12 sm:py-16 px-4 text-center flex flex-col items-center justify-center">
            {filterTab === 'unread' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-2xs">
                  <CheckCheck size={24} strokeWidth={2} />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0">
                  No unread notifications
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm m-0">
                  You've read all your notifications.
                </p>
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className="mt-4 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer border-none"
                >
                  <span>View All Updates</span>
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900/50 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-3 shadow-2xs">
                  <Bell size={24} strokeWidth={1.8} />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white m-0">
                  You're all caught up!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-sm m-0">
                  When a shop updates your print order, you'll see the notification here.
                </p>
                <Link
                  to="/my-requests"
                  className="mt-4 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-theme-xs transition-colors no-underline cursor-pointer"
                >
                  <Ticket size={16} />
                  <span>View My Orders</span>
                </Link>
              </>
            )}
          </div>
        ) : groupByOrder ? (
          /* Grouped by Order View */
          <div className="space-y-4 pt-1">
            {groupedOrders.groups.length === 0 && groupedOrders.unassociated.length === 0 ? (
              <div className="py-10 text-center text-gray-500 dark:text-gray-400 text-xs">
                No order updates match your filter.
              </div>
            ) : (
              groupedOrders.groups.map(({ orderId, order, items }) => {
                const firstItem = items[0];
                const relatedReq = order || (typeof firstItem?.relatedRequestId === 'object' ? firstItem.relatedRequestId : null);
                const claimCode = relatedReq?.claimCode || `#PD-${orderId.slice(-4).toUpperCase()}`;
                const shopName = relatedReq?.shopId?.shopName || 'Printing Shop';
                const currentStatus = relatedReq?.status;
                const statusMeta = NOTIF_STATUS_CONFIGS[`request_${currentStatus}`] || NOTIF_STATUS_CONFIGS.default;

                return (
                  <div
                    key={orderId}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 overflow-hidden shadow-2xs"
                  >
                    {/* Order Group Header Card */}
                    <div className="bg-gray-50/80 dark:bg-gray-800/60 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-brand-600 dark:text-brand-400 bg-white dark:bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
                          {claimCode}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                          <Store size={14} className="text-brand-600 dark:text-brand-400 shrink-0" />
                          <span className="truncate">{shopName}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {currentStatus && (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenOrder(relatedReq || orderId)}
                          className="h-8 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>View Order</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Timeline of Notifications under this order */}
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {items.map((notif) => {
                        const isUnread = !notif.isRead;
                        const meta = getNotifMeta(notif);
                        const Icon = meta.icon;

                        return (
                          <div
                            key={notif._id}
                            onClick={() => handleNotifClick(notif)}
                            className={`p-3.5 sm:px-4 sm:py-3 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                              isUnread
                                ? 'bg-brand-50/40 dark:bg-brand-950/20 hover:bg-brand-50/70 dark:hover:bg-brand-950/30'
                                : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/40'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${meta.colorClass}`}>
                                <Icon size={14} />
                              </div>

                              <div className="space-y-0.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isUnread && (
                                    <span className="w-2 h-2 rounded-full bg-brand-600 dark:bg-brand-400 shrink-0" aria-label="Unread" />
                                  )}
                                  <span className={`text-xs sm:text-sm font-bold ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                                    {notif.title || 'Order Update'}
                                  </span>
                                </div>
                                <p className="m-0 text-xs sm:text-[13px] text-gray-600 dark:text-gray-300 leading-snug">
                                  {notif.message}
                                </p>
                              </div>
                            </div>

                            {/* Item Actions */}
                            <div className="flex items-center gap-1.5 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                {formatTimeAgo(notif.createdAt)}
                              </span>
                              {isUnread && (
                                <button
                                  type="button"
                                  onClick={() => markRead(notif._id)}
                                  className="p-1 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors cursor-pointer"
                                  title="Mark as read"
                                >
                                  <Check size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteNotification(notif._id)}
                                className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Delete notification"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {/* Any unassociated notifications */}
            {groupedOrders.unassociated.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 p-4 space-y-3">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                  General System Notices
                </span>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {groupedOrders.unassociated.map((notif) => {
                    const isUnread = !notif.isRead;
                    return (
                      <div
                        key={notif._id}
                        onClick={() => handleNotifClick(notif)}
                        className={`py-2.5 px-1.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isUnread ? 'font-bold' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm text-brand-600 dark:text-brand-400 font-bold block">
                            {notif.title}
                          </span>
                          <p className="m-0 text-xs text-gray-600 dark:text-gray-300">{notif.message}</p>
                        </div>
                        <span className="text-[11px] text-gray-400 shrink-0">{formatTimeAgo(notif.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Chronological List Grouped by Date (Today, Yesterday, Earlier) */
          <div className="space-y-5 pt-1">
            {dateGroupedNotifs.map(([category, items]) => (
              <div key={category} className="space-y-2">
                {/* Date Category Heading */}
                <div className="px-1 flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {category}
                  </span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800/80" />
                </div>

                {/* Notifications Cards / Rows */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 shadow-2xs">
                  {items.map((notif) => {
                    const isUnread = !notif.isRead;
                    const meta = getNotifMeta(notif);
                    const Icon = meta.icon;
                    const relatedReq = typeof notif.relatedRequestId === 'object' ? notif.relatedRequestId : null;
                    const claimCode = relatedReq?.claimCode || '';
                    const shopName = relatedReq?.shopId?.shopName || notif.relatedShopId?.shopName || '';

                    return (
                      <div
                        key={notif._id}
                        onClick={() => handleNotifClick(notif)}
                        className={`p-3.5 sm:p-4 transition-all cursor-pointer flex items-start justify-between gap-3.5 relative group ${
                          isUnread
                            ? 'bg-brand-50/40 dark:bg-brand-950/20 hover:bg-brand-50/60 dark:hover:bg-brand-950/30'
                            : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/40'
                        }`}
                      >
                        {/* Left Status Indicator Accent */}
                        {isUnread && (
                          <span className="absolute left-0 top-2 bottom-2 w-1 bg-brand-600 dark:bg-brand-400 rounded-r" />
                        )}

                        {/* Event / Type Icon */}
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.colorClass} shadow-2xs`}>
                          <Icon size={16} strokeWidth={2.2} />
                        </div>

                        {/* Center Information */}
                        <div className="space-y-1 min-w-0 flex-1 pl-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-brand-600 dark:bg-brand-400 shrink-0" aria-label="Unread" />
                            )}
                            <span className={`text-xs sm:text-sm font-bold ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                              {notif.title || 'Order Update'}
                            </span>
                            {claimCode && (
                              <span className="font-mono font-bold text-[11px] text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/40 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-800/60">
                                {claimCode}
                              </span>
                            )}
                            {shopName && (
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium inline-flex items-center gap-1">
                                <Store size={12} className="text-gray-400" />
                                <span className="truncate max-w-[140px] sm:max-w-none">{shopName}</span>
                              </span>
                            )}
                          </div>

                          <p className="m-0 text-xs sm:text-[13px] text-gray-600 dark:text-gray-300 leading-snug">
                            {notif.message}
                          </p>

                          <div className="flex items-center gap-3 pt-0.5">
                            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                              {formatTimeAgo(notif.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                          {relatedReq && (
                            <button
                              type="button"
                              onClick={() => handleOpenOrder(relatedReq)}
                              className="h-8 px-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-brand-600 hover:text-white dark:hover:bg-brand-600 text-gray-700 dark:text-gray-200 font-bold text-xs inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="View order tracking"
                            >
                              <span className="hidden sm:inline">Order</span>
                              <ChevronRight size={13} />
                            </button>
                          )}

                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => markRead(notif._id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 dark:hover:text-brand-400 transition-colors cursor-pointer"
                              title="Mark as read"
                            >
                              <Check size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => deleteNotification(notif._id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete notification"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================
          3. ORDER STATUS PROGRESS TIMELINE MODAL
      ================================================== */}
      <OrderStatusModal
        order={selectedModalOrder}
        isOpen={Boolean(selectedModalOrder)}
        onClose={() => setSelectedModalOrder(null)}
      />

      {/* ==================================================
          4. CLEAR ALL NOTIFICATIONS CONFIRMATION MODAL
      ================================================== */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={async () => {
          try {
            await clearAllNotifications();
            toast.success('All notifications cleared');
          } catch {
            toast.error('Failed to clear notifications');
          }
        }}
        title="Clear All Notifications?"
        description="Are you sure you want to clear all your notifications? This action cannot be undone."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        danger
        icon="trash"
      />
    </div>
  );
}
