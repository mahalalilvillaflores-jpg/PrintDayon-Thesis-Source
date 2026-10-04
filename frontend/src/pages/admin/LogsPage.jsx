import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { adminAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  User, Store, FileText, ShieldCheck, CheckCircle2,
  Search, Trash2, Clock, Eye, X, Shield,
  Zap, Key, Layers, Copy, Check, RotateCcw,
  CheckSquare, Square
} from 'lucide-react';
import toast from 'react-hot-toast';

const NAVY = '#101828';
const BLUE = '#465FFF';
const GREEN = '#10B981';
const GRAY = '#64748B';

const cardStyle = {
  background: 'white',
  borderRadius: '1rem',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(6,63,92,0.04)',
  border: '1px solid #E2E8F0',
};

const ROLE_COLORS = {
  customer:   { label: 'Customer',   bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  shop_owner: { label: 'Shop Owner', bg: '#FEF7E8', text: '#92400E', border: '#FDE3A7' },
  admin:      { label: 'Admin',      bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  system:     { label: 'System',     bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getNotificationContent(log) {
  const match = (log.details || '').match(/#([a-zA-Z0-9]+)/);
  const orderId = match ? `Order #${match[1]}` : 'Print Order';
  const shopName = log.targetName || log.actorName || 'Printing Shop';

  if (log.action === 'order_completed') {
    return {
      title: `${shopName} completed ${orderId}`,
      badge: 'Order Fulfilled',
      badgeColor: '#047857',
      badgeBg: '#ECFDF5',
      badgeBorder: '#A7F3D0',
      icon: CheckCircle2,
      iconColor: '#047857',
      iconBg: '#ECFDF5',
      subtext: `Documents printed and handed over to customer at ${shopName}`,
    };
  }
  if (log.action === 'order_ready') {
    return {
      title: `${shopName} marked ${orderId} ready for pickup`,
      badge: 'Ready for Pickup',
      badgeColor: '#0D9488',
      badgeBg: '#F0FDFA',
      badgeBorder: '#99F6E4',
      icon: CheckCircle2,
      iconColor: '#0D9488',
      iconBg: '#F0FDFA',
      subtext: `Customer notified that print documents are waiting at store counter`,
    };
  }
  if (log.action === 'order_printing') {
    return {
      title: `${shopName} started printing ${orderId}`,
      badge: 'In Production',
      badgeColor: '#465FFF',
      badgeBg: '#E0F2FE',
      badgeBorder: '#BAE6FD',
      icon: Layers,
      iconColor: '#465FFF',
      iconBg: '#E0F2FE',
      subtext: `Physical printing in progress on store equipment`,
    };
  }
  if (log.action === 'order_queued') {
    return {
      title: `${shopName} added ${orderId} to print queue`,
      badge: 'Queue Assigned',
      badgeColor: '#DB2777',
      badgeBg: '#FCE7F3',
      badgeBorder: '#FBCFE8',
      icon: Layers,
      iconColor: '#DB2777',
      iconBg: '#FCE7F3',
      subtext: `Job assigned to printing queue for scheduled fulfillment`,
    };
  }
  if (log.action === 'order_accepted') {
    return {
      title: `${shopName} accepted ${orderId}`,
      badge: 'Job Accepted',
      badgeColor: '#2563EB',
      badgeBg: '#EFF6FF',
      badgeBorder: '#BFDBFE',
      icon: CheckCircle2,
      iconColor: '#2563EB',
      iconBg: '#EFF6FF',
      subtext: `Store confirmed job specifications and started preparation`,
    };
  }
  if (log.action === 'request_created') {
    return {
      title: `New customer request submitted for ${orderId}`,
      badge: 'Order Created',
      badgeColor: '#D97706',
      badgeBg: '#FEF3C7',
      badgeBorder: '#FDE68A',
      icon: FileText,
      iconColor: '#D97706',
      iconBg: '#FEF3C7',
      subtext: `Customer submitted print file to ${shopName}`,
    };
  }
  if (log.action === 'shop_registered') {
    return {
      title: `New Partner Shop Application: ${log.targetName || log.actorName}`,
      badge: 'Store Application',
      badgeColor: '#0D9488',
      badgeBg: '#F0FDFA',
      badgeBorder: '#99F6E4',
      icon: Store,
      iconColor: '#0D9488',
      iconBg: '#F0FDFA',
      subtext: `Shop owner applied for partner verification in Naval, Biliran`,
    };
  }
  if (log.action === 'shop_verified') {
    return {
      title: `Admin approved and verified ${log.targetName || log.actorName}`,
      badge: 'Compliance Verified',
      badgeColor: '#047857',
      badgeBg: '#ECFDF5',
      badgeBorder: '#A7F3D0',
      icon: ShieldCheck,
      iconColor: '#047857',
      iconBg: '#ECFDF5',
      subtext: `Municipal business permit and compliance validated by Administrator`,
    };
  }
  if (log.action === 'user_registered') {
    return {
      title: `New user account registered: ${log.actorName || 'User'}`,
      badge: 'Account Created',
      badgeColor: '#1D4ED8',
      badgeBg: '#EFF6FF',
      badgeBorder: '#BFDBFE',
      icon: User,
      iconColor: '#1D4ED8',
      iconBg: '#EFF6FF',
      subtext: `New ${log.actorRole === 'shop_owner' ? 'shop partner' : 'customer'} joined PrintDayon`,
    };
  }
  if (log.action === 'user_login') {
    const portal = log.actorRole === 'admin' ? 'Admin Dashboard' : log.actorRole === 'shop_owner' ? 'Shop Partner Portal' : 'Customer Portal';
    return {
      title: `${log.actorName || 'User'} signed in to ${portal}`,
      badge: 'Sign-In',
      badgeColor: '#64748B',
      badgeBg: '#F1F5F9',
      badgeBorder: '#E2E8F0',
      icon: Key,
      iconColor: '#64748B',
      iconBg: '#F1F5F9',
      subtext: `Authenticated session recorded`,
    };
  }

  return {
    title: log.details || (log.action || 'System action completed').replace(/_/g, ' '),
    badge: (log.action || 'System').replace(/_/g, ' '),
    badgeColor: NAVY,
    badgeBg: '#F8FAFC',
    badgeBorder: '#E2E8F0',
    icon: Shield,
    iconColor: NAVY,
    iconBg: '#F8FAFC',
    subtext: `Logged by ${log.actorName || 'System'}`,
  };
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('actionable'); // 'actionable' | 'all' | 'shops' | 'orders' | 'logins'
  const [hideRoutineLogins, setHideRoutineLogins] = useState(true);
  const [inspectLog, setInspectLog] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const { socket } = useSocket() || {};

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminAPI.getLogs({ limit: 150 });
      const rawData = res?.data || res;
      const logsArray = rawData?.logs || rawData?.data?.logs || (Array.isArray(rawData) ? rawData : []);
      const statsObj = rawData?.stats || rawData?.data?.stats || { total: logsArray.length };
      setLogs(logsArray);
      setStats(statsObj);
    } catch (err) {
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!socket) return;
    const handleNewAudit = (newLog) => {
      setLogs((prev) => [newLog, ...prev.slice(0, 149)]);
      setStats((prev) => ({
        ...prev,
        total: (prev.total || 0) + 1,
        [newLog.eventType]: (prev[newLog.eventType] || 0) + 1,
      }));
    };

    socket.on('audit:new', handleNewAudit);
    return () => {
      socket.off('audit:new', handleNewAudit);
    };
  }, [socket]);

  // Consolidate categories
  const categoryCounts = useMemo(() => {
    const totalCount = logs.length;
    const loginsCount = logs.filter(l => l.action === 'user_login').length;
    const actionableCount = totalCount - loginsCount;
    const shopsCount = logs.filter(l => l.eventType === 'shop' || l.eventType === 'verify').length;
    const ordersCount = logs.filter(l => ['request', 'order', 'queue'].includes(l.eventType)).length;

    return {
      all: totalCount,
      logins: loginsCount,
      actionable: actionableCount,
      shops: shopsCount,
      orders: ordersCount,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const isLogin = log.action === 'user_login';

      if (categoryFilter === 'actionable') {
        if (isLogin) return false;
      } else if (categoryFilter === 'logins') {
        if (!isLogin) return false;
      } else if (categoryFilter === 'shops') {
        if (log.eventType !== 'shop' && log.eventType !== 'verify') return false;
      } else if (categoryFilter === 'orders') {
        if (!['request', 'order', 'queue'].includes(log.eventType)) return false;
      } else if (categoryFilter === 'all') {
        if (hideRoutineLogins && isLogin) return false;
      }

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const item = getNotificationContent(log);
      const titleText = item.title.toLowerCase();
      const subText = item.subtext.toLowerCase();
      const actorText = (log.actorName || '').toLowerCase();
      const targetText = (log.targetName || '').toLowerCase();

      return (
        titleText.includes(q) ||
        subText.includes(q) ||
        actorText.includes(q) ||
        targetText.includes(q)
      );
    });
  }, [logs, categoryFilter, hideRoutineLogins, search]);

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      await adminAPI.clearLogs();
      toast.success('System audit trail cleared.');
      setShowClearConfirm(false);
      setLogs([]);
      setStats({ total: 0 });
    } catch (err) {
      toast.error('Failed to clear logs.');
    } finally {
      setClearing(false);
    }
  };

  const handleCopyPayload = (log) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopiedPayload(true);
      toast.success('Audit payload copied to clipboard');
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch (_) {
      toast.error('Failed to copy payload');
    }
  };

  const totalEvents = categoryCounts.all || 0;

  const metricCards = [
    {
      id: 'all',
      label: 'Total Platform Events',
      value: categoryCounts.all,
      sub: 'All recorded system operations',
      share: '100%',
      icon: Zap,
      color: NAVY,
      bg: '#F1F5F9',
      border: '#E2E8F0',
    },
    {
      id: 'actionable',
      label: 'Actionable Alerts',
      value: categoryCounts.actionable,
      sub: 'Verifications, orders & shops',
      share: totalEvents ? `${Math.round((categoryCounts.actionable / totalEvents) * 100)}%` : '0%',
      icon: ShieldCheck,
      color: '#047857',
      bg: '#ECFDF5',
      border: '#A7F3D0',
    },
    {
      id: 'shops',
      label: 'Shop Operations',
      value: categoryCounts.shops,
      sub: 'Permits, queues & establishments',
      share: totalEvents ? `${Math.round((categoryCounts.shops / totalEvents) * 100)}%` : '0%',
      icon: Store,
      color: '#0F766E',
      bg: '#F0FDFA',
      border: '#99F6E4',
    },
    {
      id: 'orders',
      label: 'Print Order Jobs',
      value: categoryCounts.orders,
      sub: 'Files, prints & completions',
      share: totalEvents ? `${Math.round((categoryCounts.orders / totalEvents) * 100)}%` : '0%',
      icon: Layers,
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', margin: '0 auto', paddingBottom: '2rem' }} className="fade-in">

      {/* Informational Metric KPI Cards (Static, Non-Clickable) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              style={{
                ...cardStyle,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '128px',
                borderColor: '#E2E8F0',
                boxShadow: '0 1px 3px rgba(6,63,92,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: GRAY,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: '1.85rem',
                      fontWeight: 800,
                      color: NAVY,
                      lineHeight: 1.15,
                      marginTop: '0.35rem',
                      letterSpacing: '-0.02em',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.45rem',
                    }}
                  >
                    <span>{m.value}</span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: m.color,
                        background: m.bg,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '999px',
                        border: `1px solid ${m.border}`,
                      }}
                    >
                      {m.share}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.75rem',
                    background: m.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${m.border}`,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={m.color} />
                </div>
              </div>

              <div
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.74rem',
                  color: GRAY,
                  fontWeight: 500,
                }}
              >
                {m.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Streamlined Search and Category Toolbar */}
      <div
        style={{
          ...cardStyle,
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.875rem',
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
          <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search actions, shop name, actor, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0.5rem 2.2rem 0.5rem 2.35rem',
              borderRadius: '0.55rem',
              border: '1.5px solid #E2E8F0',
              fontSize: '0.8rem',
              outline: 'none',
              background: '#F8FAFC',
              color: NAVY,
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
            onFocus={(e) => {
              e.target.style.background = '#FFFFFF';
              e.target.style.borderColor = BLUE;
              e.target.style.boxShadow = '0 0 0 3px rgba(25, 57, 141, 0.12)';
            }}
            onBlur={(e) => {
              e.target.style.background = '#F8FAFC';
              e.target.style.borderColor = '#E2E8F0';
              e.target.style.boxShadow = 'none';
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#E2E8F0',
                border: 'none',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: GRAY,
              }}
              title="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Right: Category filter & Reset */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter events by category"
            style={{
              height: '38px',
              padding: '0 0.85rem',
              borderRadius: '0.625rem',
              border: '1px solid #CBD5E1',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#101828',
              background: '#F8FAFC',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '190px',
            }}
          >
            <option value="actionable">Actionable Alerts ({categoryCounts.actionable})</option>
            <option value="shops">Shop Operations ({categoryCounts.shops})</option>
            <option value="orders">Print Orders ({categoryCounts.orders})</option>
            <option value="logins">User Sign-Ins ({categoryCounts.logins})</option>
            <option value="all">All Events ({categoryCounts.all})</option>
          </select>

          {(categoryFilter !== 'actionable' || search) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('actionable');
                setSearch('');
              }}
              aria-label="Reset filters"
              style={{
                height: '38px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#334155',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                padding: '0 0.85rem',
                borderRadius: '0.625rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#E2E8F0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F1F5F9';
              }}
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Activity Feed List (Modern Notification Feed) */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: NAVY, margin: 0 }}>
              Activity Logs
            </h2>
            <p style={{ fontSize: '0.74rem', color: GRAY, margin: '0.15rem 0 0' }}>
              Showing {filteredLogs.length} {filteredLogs.length === 1 ? 'event' : 'events'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Routine sign-in toggle when viewing All Events */}
            {categoryFilter === 'all' && (
              <button
                type="button"
                onClick={() => setHideRoutineLogins(!hideRoutineLogins)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: hideRoutineLogins ? BLUE : GRAY,
                  background: hideRoutineLogins ? '#EEF2FC' : '#F8FAFC',
                  border: `1px solid ${hideRoutineLogins ? '#D2DEFC' : '#E2E8F0'}`,
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                {hideRoutineLogins ? <CheckSquare size={13} color={BLUE} /> : <Square size={13} color={GRAY} />}
                Hide routine sign-ins ({categoryCounts.logins})
              </button>
            )}

            {logs.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.38rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  cursor: 'pointer',
                  color: '#64748B',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#101828';
                  e.currentTarget.style.borderColor = '#CBD5E1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#64748B';
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }}
                title="Clear audit trail records"
              >
                <Trash2 size={13} /> Clear Logs
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem' }}>
            <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.8rem', color: GRAY }}>Loading audit records...</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: GRAY }}>
            <Shield size={38} color="#CBD5E1" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: NAVY }}>No matching audit records found</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
              {search
                ? `No events match "${search}". Try clearing your search query.`
                : 'System activity will stream here live as users, shop owners, and admins interact.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filteredLogs.map((log) => {
              const item = getNotificationContent(log);
              const Icon = item.icon;
              const roleCfg = ROLE_COLORS[log.actorRole] || ROLE_COLORS.system;

              return (
                <div
                  key={log._id || log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.95rem 1.25rem',
                    borderRadius: '0.875rem',
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s ease',
                    gap: '1rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F8FAFC';
                    e.currentTarget.style.borderColor = '#CBD5E1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#E2E8F0';
                  }}
                >
                  {/* Left: Icon & Notification Narrative */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '2.6rem',
                        height: '2.6rem',
                        borderRadius: '0.75rem',
                        background: item.iconBg,
                        color: item.iconColor,
                        border: `1px solid ${item.badgeBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={17} />
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: NAVY, lineHeight: 1.35 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        <span>{item.subtext}</span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600, color: '#475569' }}>
                          <Clock size={11} color="#94A3B8" /> {formatRelativeTime(log.timestamp || log.createdAt)}
                        </span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ fontWeight: 700, color: roleCfg.text, background: roleCfg.bg, padding: '0.05rem 0.4rem', borderRadius: '999px', fontSize: '0.65rem', border: `1px solid ${roleCfg.border}` }}>
                          {roleCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Clean Status Badge & Inspect */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span
                      style={{
                        padding: '0.22rem 0.65rem',
                        borderRadius: '999px',
                        background: item.badgeBg,
                        color: item.badgeColor,
                        border: `1px solid ${item.badgeBorder}`,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.badge}
                    </span>

                    <button
                      type="button"
                      onClick={() => setInspectLog(log)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: NAVY,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = BLUE;
                        e.currentTarget.style.color = BLUE;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.color = NAVY;
                      }}
                      title="Inspect audit payload"
                    >
                      <Eye size={12} color={BLUE} /> Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inspect Event Payload Modal */}
      {inspectLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(6, 63, 92, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setInspectLog(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '1.25rem',
              width: '520px',
              maxWidth: '100%',
              boxShadow: '0 24px 60px rgba(6, 63, 92, 0.35)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                background: NAVY,
                padding: '1.25rem 1.5rem',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#D2DEFC', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Audit Event Details
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: '0.15rem 0 0', color: '#FFFFFF' }}>
                  {getNotificationContent(inspectLog).title}
                </h3>
              </div>
              <button
                onClick={() => setInspectLog(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
              <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #E2E8F0' }}>
                <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>Description</div>
                <div style={{ fontWeight: 800, color: NAVY, marginTop: '0.2rem' }}>{getNotificationContent(inspectLog).subtext}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #E2E8F0' }}>
                  <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700 }}>Actor</div>
                  <div style={{ fontWeight: 800, color: NAVY, marginTop: '0.15rem' }}>
                    {inspectLog.actorName} ({inspectLog.actorRole})
                  </div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #E2E8F0' }}>
                  <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700 }}>Action Badge</div>
                  <div style={{ fontWeight: 800, color: BLUE, textTransform: 'uppercase', marginTop: '0.15rem' }}>
                    {getNotificationContent(inspectLog).badge}
                  </div>
                </div>
              </div>

              {inspectLog.targetName && (
                <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #E2E8F0' }}>
                  <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700 }}>Target Entity</div>
                  <div style={{ fontWeight: 800, color: NAVY, marginTop: '0.15rem' }}>
                    {inspectLog.targetName} {inspectLog.targetId ? `(ID: ${inspectLog.targetId})` : ''}
                  </div>
                </div>
              )}

              <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #E2E8F0' }}>
                <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700 }}>Exact Timestamp</div>
                <div style={{ fontWeight: 800, color: NAVY, marginTop: '0.15rem' }}>
                  {new Date(inspectLog.timestamp || inspectLog.createdAt).toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'medium' })}
                </div>
              </div>

              {inspectLog.metadata && Object.keys(inspectLog.metadata).length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>
                      Additional Metadata
                    </span>
                    <button
                      onClick={() => handleCopyPayload(inspectLog)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: BLUE,
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {copiedPayload ? <Check size={12} color={GREEN} /> : <Copy size={12} />}
                      {copiedPayload ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <div
                    style={{
                      background: '#101828',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      color: '#D2DEFC',
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      overflowX: 'auto',
                      maxHeight: '160px',
                    }}
                  >
                    <pre style={{ margin: 0 }}>{JSON.stringify(inspectLog.metadata, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handleCopyPayload(inspectLog)}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '0.5rem',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: NAVY,
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                  }}
                >
                  {copiedPayload ? <Check size={13} color={GREEN} /> : <Copy size={13} />}
                  {copiedPayload ? 'Copied Payload' : 'Copy Payload'}
                </button>
                <button
                  onClick={() => setInspectLog(null)}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: BLUE,
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Confirmation Modal */}
      {showClearConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 39, 71, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '1.25rem',
              width: '400px',
              maxWidth: '100%',
              boxShadow: '0 24px 60px rgba(6, 63, 92, 0.35)',
              border: '1px solid #E2E8F0',
              padding: '1.75rem',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#F1F5F9', color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <Trash2 size={20} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: NAVY, margin: 0 }}>
              Clear System Audit Trail?
            </h3>
            <p style={{ fontSize: '0.8rem', color: GRAY, marginTop: '0.4rem', lineHeight: 1.5 }}>
              This will permanently purge all recorded audit telemetry and event history. This action cannot be reversed.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                style={{
                  flex: 1,
                  height: '38px',
                  borderRadius: '0.5rem',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: NAVY,
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={clearing}
                style={{
                  flex: 1,
                  height: '38px',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#0F172A',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                {clearing ? 'Clearing...' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
