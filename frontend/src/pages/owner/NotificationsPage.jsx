import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, RefreshCw, ChevronRight, CheckCircle2,
  AlertTriangle, Printer, XCircle, Info, Sparkles, Trash2,
  Package, AlertCircle,
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';


function getIconProps(type) {
  if (!type) return { Icon: Bell, cls: 'text-[#465FFF]', bg: 'bg-blue-50 dark:bg-blue-950/40' };
  const t = type.toLowerCase();
  if (t.includes('cancel') || t.includes('reject'))
    return { Icon: XCircle, cls: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' };
  if (t.includes('ready') || t.includes('pickup') || t.includes('complete') || t.includes('verif'))
    return { Icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' };
  if (t.includes('delay') || t.includes('warn') || t.includes('rush') || t.includes('issue'))
    return { Icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' };
  if (t.includes('print'))
    return { Icon: Printer, cls: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' };
  if (t.includes('request') || t.includes('order'))
    return { Icon: Package, cls: 'text-[#465FFF] dark:text-sky-400', bg: 'bg-blue-50 dark:bg-blue-950/40' };
  return { Icon: Info, cls: 'text-blue-500 dark:text-sky-400', bg: 'bg-blue-50 dark:bg-blue-950/40' };
}

function timeAgo(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function isToday(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 sm:px-5 py-4 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-44" />
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-10 shrink-0" />
        </div>
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
      </div>
    </div>
  );
}

function SectionLabel({ label }) {
  return (
    <div className="px-4 sm:px-5 pt-4 pb-2">
      <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">
        {label}
      </span>
    </div>
  );
}

function EmptyState({ filter }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#465FFF] dark:text-sky-400 flex items-center justify-center mb-3">
        <Sparkles size={22} />
      </div>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {filter === 'unread'
          ? "You're all caught up."
          : 'New shop activity will appear here.'}
      </p>
    </div>
  );
}

function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 dark:bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-[#101828] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg w-full max-w-sm p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-clear-title"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle size={18} />
          </div>
          <h2
            id="confirm-clear-title"
            className="text-sm font-bold text-slate-900 dark:text-white"
          >
            Clear all notifications?
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 pl-12">
          All notifications will be removed from your notification list.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 transition-all cursor-pointer border-none"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationRow({ notif, onMarkRead, onDelete, onNavigate }) {
  const { Icon, cls, bg } = getIconProps(notif.type);
  const hasOrderLink = !!(notif.data?.requestId || notif.relatedRequestId);

  return (
    <div
      onClick={() => onMarkRead(notif)}
      className={`group relative flex items-start gap-3 px-4 sm:px-5 py-4 cursor-pointer transition-colors ${notif.isRead
          ? 'bg-white dark:bg-[#101828] hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
          : 'bg-[#465FFF]/[0.04] dark:bg-blue-950/20 hover:bg-[#465FFF]/[0.07] dark:hover:bg-blue-950/30'
        }`}
    >
      {/* Unread left accent bar */}
      {!notif.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#465FFF] rounded-r" />
      )}

      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}
      >
        <Icon size={15} className={cls} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title + timestamp */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-[13px] leading-snug truncate ${notif.isRead
                  ? 'font-semibold text-slate-700 dark:text-slate-300'
                  : 'font-bold text-slate-900 dark:text-white'
                }`}
            >
              {notif.title || 'Notification'}
            </span>
            {!notif.isRead && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#465FFF] shrink-0 mt-px" />
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
              {timeAgo(notif.createdAt)}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notif._id);
              }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer bg-transparent border-none"
              title="Delete"
              aria-label="Delete notification"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Message */}
        {(notif.message || notif.body) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
            {notif.message || notif.body}
          </p>
        )}

        {/* Action link */}
        {hasOrderLink && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notif);
              onNavigate();
            }}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#465FFF] dark:text-sky-400 hover:underline cursor-pointer bg-transparent border-none p-0"
          >
            View in Orders
            <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function OwnerNotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();
  const { socket } = useSocket() || {};

  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket) return;
    const handle = () => fetchNotifications(true);
    socket.on('notification:new', handle);
    return () => socket.off('notification:new', handle);
  }, [socket, fetchNotifications]);

  const filtered = (notifications || []).filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  // Group into TODAY / EARLIER
  const todayItems = filtered.filter((n) => isToday(n.createdAt));
  const earlierItems = filtered.filter((n) => !isToday(n.createdAt));

  const handleMarkRead = async (notif) => {
    if (!notif.isRead) {
      try { await markRead(notif._id); } catch { /* ignore */ }
    }
  };

  const handleMarkAllRead = async () => {
    try { await markAllRead(); } catch { toast.error('Could not mark all as read'); }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await fetchNotifications(); } finally { setRefreshing(false); }
  };

  const handleDelete = async (id) => {
    try { await deleteNotification(id); } catch { toast.error('Could not delete notification'); }
  };

  const handleClearAll = async () => {
    setShowConfirm(false);
    try { await clearAllNotifications(); } catch { toast.error('Could not clear notifications'); }
  };

  const renderList = (items) =>
    items.map((notif) => (
      <NotificationRow
        key={notif._id}
        notif={notif}
        onMarkRead={handleMarkRead}
        onDelete={handleDelete}
        onNavigate={() => navigate('/owner/requests')}
      />
    ));

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          onConfirm={handleClearAll}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Root container — matches ShopManagementPage / RequestsPage convention */}
      <div className="w-full max-w-7xl mx-auto space-y-4 pb-12 font-outfit">

        {/* ── Page Description (no duplicate h1 — global header already shows it) ── */}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Stay updated with new orders, shop activity, and important alerts.
        </p>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">

          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer border-none ${filter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-[#465FFF] dark:text-white shadow-sm'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
              All Updates
              <span
                className={`text-[10px] px-1.5 py-px rounded-full font-bold leading-none ${filter === 'all'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#465FFF] dark:text-sky-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500'
                  }`}
              >
                {notifications.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-xs font-bold transition-all cursor-pointer border-none ${filter === 'unread'
                  ? 'bg-white dark:bg-slate-800 text-[#465FFF] dark:text-white shadow-sm'
                  : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
            >
              Unread
              <span
                className={`text-[10px] px-1.5 py-px rounded-full font-bold leading-none ${unreadCount > 0
                    ? 'bg-[#465FFF] text-white'
                    : filter === 'unread'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-[#465FFF] dark:text-sky-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500'
                  }`}
              >
                {unreadCount}
              </span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              title="Refresh notifications"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer bg-white dark:bg-slate-800/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                size={14}
                className={(loading || refreshing) ? 'animate-spin text-[#465FFF]' : ''}
              />
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-[#465FFF] dark:text-sky-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/40 transition-all cursor-pointer"
              >
                <CheckCheck size={13} />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/60 dark:border-rose-800/40 transition-all cursor-pointer"
                title="Clear all notifications"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Clear all</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Notification List ── */}
        <div className="bg-white dark:bg-[#101828] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs overflow-hidden">

          {/* Loading skeleton */}
          {loading && notifications.length === 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">

              {/* TODAY group */}
              {todayItems.length > 0 && (
                <>
                  <SectionLabel label="Today" />
                  {renderList(todayItems)}
                </>
              )}

              {/* EARLIER group — only show label if today also has items */}
              {earlierItems.length > 0 && (
                <>
                  {todayItems.length > 0 && (
                    <div className="h-px bg-slate-100 dark:bg-slate-800 mx-4 sm:mx-5" />
                  )}
                  <SectionLabel label="Earlier" />
                  {renderList(earlierItems)}
                </>
              )}

            </div>
          )}
        </div>

      </div>
    </>
  );
}
