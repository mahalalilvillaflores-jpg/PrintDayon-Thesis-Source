import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, X, ChevronRight, Package, Printer,
  CheckCircle2, AlertTriangle, XCircle, Info
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

function getNotificationIcon(type) {
  if (!type) return <Bell size={14} className="text-[#465FFF] dark:text-sky-400" />;
  const t = type.toLowerCase();
  if (t.includes('request') || t.includes('order')) return <Package size={14} className="text-[#465FFF] dark:text-sky-400" />;
  if (t.includes('print')) return <Printer size={14} className="text-indigo-600 dark:text-indigo-400" />;
  if (t.includes('cancel') || t.includes('reject')) return <XCircle size={14} className="text-rose-600 dark:text-rose-400" />;
  if (t.includes('ready') || t.includes('pickup') || t.includes('complete') || t.includes('verif')) return <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />;
  if (t.includes('delay') || t.includes('warn') || t.includes('rush') || t.includes('issue')) return <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />;
  return <Info size={14} className="text-blue-500 dark:text-sky-400" />;
}

function getNotificationBg(type) {
  if (!type) return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400';
  const t = type.toLowerCase();
  if (t.includes('cancel') || t.includes('reject')) return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400';
  if (t.includes('ready') || t.includes('pickup') || t.includes('complete') || t.includes('verif')) return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400';
  if (t.includes('delay') || t.includes('warn') || t.includes('rush') || t.includes('issue')) return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400';
  return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400';
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

export default function NotificationBell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const getTargetUrl = (notif = null) => {
    if (user?.role === 'shop_owner') {
      return '/owner/notifications';
    }
    if (user?.role === 'admin') {
      return '/admin/logs';
    }
    return notif?._id ? `/notifications/${notif._id}` : '/notifications';
  };

  const handleItemClick = (notif) => {
    if (!notif?._id) return;
    if (!notif.isRead) {
      markRead(notif._id);
    }
    setOpen(false);
    navigate(getTargetUrl(notif));
  };

  return (
    <div className="relative font-outfit">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors relative cursor-pointer"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#465FFF] ring-2 ring-white dark:ring-gray-900 animate-pulse" />
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
          />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-[#101828] rounded-2xl shadow-xl z-50 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 dark:text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#465FFF] text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-bold text-[#465FFF] dark:text-sky-400 hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1 p-0"
                  >
                    <CheckCheck size={13} />
                    <span>Mark all read</span>
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-transparent border-none cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="py-10 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Bell size={18} />
                  </div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 m-0">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 8).map((notif) => (
                  <div
                    key={notif._id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      notif.isRead
                        ? 'bg-white dark:bg-[#101828] hover:bg-slate-50 dark:hover:bg-slate-850/50'
                        : 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/50 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${getNotificationBg(notif.type)}`}>
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${notif.isRead ? 'font-semibold text-slate-800 dark:text-slate-200' : 'font-bold text-slate-900 dark:text-white'}`}>
                          {notif.title}
                        </span>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#465FFF] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 mb-1 leading-snug">
                        {notif.message || notif.body || ''}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-center">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(getTargetUrl());
                }}
                className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-[#465FFF] dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors bg-transparent border-none cursor-pointer flex items-center justify-center gap-1"
              >
                <span>View All Notifications</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
