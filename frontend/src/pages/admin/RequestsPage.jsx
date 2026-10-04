import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { adminAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, RefreshCw, Eye, Store, User, Phone, Mail,
  Calendar, Layers, MapPin, DollarSign, Activity,
  ChevronRight, X, ArrowRight, LayoutGrid, List
} from 'lucide-react';
import toast from 'react-hot-toast';

const COLOR = {
  NAVY: '#101828',
  BLUE: '#465FFF',
  BLUE_BG: '#EBF6FA',
  GREEN: '#15803D',
  GREEN_BG: '#F0FDF4',
  GREEN_BORDER: '#BBF7D0',
  AMBER: '#C2410C',
  AMBER_BG: '#FFF7ED',
  AMBER_BORDER: '#FED7AA',
  RED: '#B91C1C',
  RED_BG: '#FEF2F2',
  RED_BORDER: '#FECACA',
  BG_MAIN: '#F8FAFC',
  BG_CARD: '#FFFFFF',
  TEXT_PRIMARY: '#172033',
  TEXT_SECONDARY: '#52627A',
  BORDER: '#D9E2EC',
};

const cardStyle = {
  background: COLOR.BG_CARD,
  borderRadius: '0.875rem',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(22, 58, 95, 0.04)',
  border: `1px solid ${COLOR.BORDER}`,
};

const thStyle = {
  padding: '0.75rem 0.75rem',
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: COLOR.TEXT_SECONDARY,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

function formatSubmittedDate(date) {
  if (!date) return { primary: '—', secondary: '' };
  const d = new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  const timeStr = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diff < 60) return { primary: 'Just now', secondary: timeStr };
  if (diff < 3600) return { primary: `${Math.floor(diff / 60)}m ago`, secondary: timeStr };
  if (diff < 86400) return { primary: `${Math.floor(diff / 3600)}h ago`, secondary: timeStr };

  const dateStr = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  return { primary: dateStr, secondary: timeStr };
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: COLOR.AMBER, bg: COLOR.AMBER_BG, border: COLOR.AMBER_BORDER, icon: Clock },
  accepted:  { label: 'Accepted',  color: COLOR.NAVY,  bg: COLOR.BLUE_BG,  border: '#BFDBFE',           icon: CheckCircle2 },
  queued:    { label: 'Queued',    color: COLOR.BLUE,  bg: COLOR.BLUE_BG,  border: '#BFDBFE',           icon: Layers },
  printing:  { label: 'Printing',  color: COLOR.BLUE,  bg: COLOR.BLUE_BG,  border: '#BFDBFE',           icon: Activity },
  ready:     { label: 'Ready',     color: COLOR.GREEN, bg: COLOR.GREEN_BG, border: COLOR.GREEN_BORDER, icon: CheckCircle2 },
  completed: { label: 'Completed', color: COLOR.GREEN, bg: COLOR.GREEN_BG, border: COLOR.GREEN_BORDER, icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: COLOR.RED,   bg: COLOR.RED_BG,   border: COLOR.RED_BORDER,   icon: XCircle },
  cancelled: { label: 'Cancelled', color: COLOR.TEXT_SECONDARY, bg: COLOR.BG_MAIN, border: COLOR.BORDER, icon: AlertCircle },
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectRequest, setInspectRequest] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('printdayon_admin_requests_view') || 'grid';
    } catch (_) {
      return 'grid';
    }
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('printdayon_admin_requests_view', mode);
    } catch (_) {}
  };

  const { socket } = useSocket() || {};

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await adminAPI.getRequests({ limit: 100 });
      setRequests(res.data?.requests || []);
    } catch (err) {
      toast.error('Failed to load printing requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const res = await adminAPI.getShops();
      setShops(res.data?.shops || res.data || []);
    } catch (_) {}
  }, []);

  const handleHoldOrder = async (orderId) => {
    const reason = window.prompt('Enter reason for placing this order on Administrative Hold:');
    if (!reason || !reason.trim()) return;
    try {
      await adminAPI.holdOrder(orderId, { reason: reason.trim() });
      toast.success('Job order placed on Administrative Hold.');
      setInspectRequest(null);
      await fetchRequests(true);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to hold order.');
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchShops();
  }, [fetchRequests, fetchShops]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchRequests(true);
    };
    socket.on('request:new', handleUpdate);
    socket.on('request:statusChanged', handleUpdate);
    return () => {
      socket.off('request:new', handleUpdate);
      socket.off('request:statusChanged', handleUpdate);
    };
  }, [socket, fetchRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesStatus = !statusFilter || r.status === statusFilter;
      const sId = (r.shopId?._id || r.shopId)?.toString();
      const matchesShop = !shopFilter || sId === shopFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (r._id || '').toLowerCase().includes(q) ||
        (r.customerId?.name || '').toLowerCase().includes(q) ||
        (r.shopId?.shopName || '').toLowerCase().includes(q) ||
        (r.documentId?.originalFilename || '').toLowerCase().includes(q);

      return matchesStatus && matchesShop && matchesSearch;
    });
  }, [requests, statusFilter, shopFilter, searchQuery]);

  const shopMetrics = useMemo(() => {
    const map = {};
    (shops || []).forEach(s => {
      const id = (s._id || s.id)?.toString();
      map[id] = {
        id,
        name: s.shopName || s.name || 'Printing Shop',
        address: s.address || s.landmark || 'Naval, Biliran',
        total: 0,
        completed: 0,
        active: 0,
        cancelled: 0,
        revenue: 0,
      };
    });

    (requests || []).forEach(r => {
      const sId = (r.shopId?._id || r.shopId)?.toString();
      if (!sId) return;
      if (!map[sId]) {
        map[sId] = {
          id: sId,
          name: r.shopId?.shopName || 'Printing Shop',
          address: r.shopId?.address || 'Naval, Biliran',
          total: 0,
          completed: 0,
          active: 0,
          cancelled: 0,
          revenue: 0,
        };
      }
      map[sId].total += 1;
      if (r.status === 'completed') {
        map[sId].completed += 1;
        map[sId].revenue += (r.estimatedCost || 0);
      } else if (['pending', 'accepted', 'queued', 'printing', 'ready'].includes(r.status)) {
        map[sId].active += 1;
      } else if (r.status === 'rejected' || r.status === 'cancelled') {
        map[sId].cancelled += 1;
      }
    });

    return Object.values(map);
  }, [shops, requests]);

  const metrics = useMemo(() => {
    const total = requests.length;
    const active = requests.filter(r => ['pending', 'accepted', 'queued', 'printing', 'ready'].includes(r.status)).length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const rejected = requests.filter(r => r.status === 'rejected' || r.status === 'cancelled').length;
    const fulfillmentRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const grossRevenue = requests
      .filter(r => r.status === 'completed')
      .reduce((acc, curr) => acc + (curr.estimatedCost || 0), 0);

    const counts = {
      pending: requests.filter(r => r.status === 'pending').length,
      printing: requests.filter(r => r.status === 'printing').length,
      ready: requests.filter(r => r.status === 'ready').length,
      completed: completed,
      rejected: requests.filter(r => r.status === 'rejected').length,
    };

    return { total, active, completed, rejected, fulfillmentRate, grossRevenue, counts };
  }, [requests]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', margin: '0 auto', paddingBottom: '2.5rem' }} className="fade-in">

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '1rem',
      }}>
        {[
          {
            label: 'Total Orders',
            value: metrics.total,
            sub: 'All submitted orders',
            icon: FileText,
            color: '#1E293B',
            bg: '#F1F5F9',
            border: '#CBD5E1',
          },
          {
            label: 'In Queue / Printing',
            value: metrics.active,
            sub: 'Currently in queue or printing',
            icon: Clock,
            color: '#D97706',
            bg: '#FFFBEB',
            border: '#FDE68A',
          },
          {
            label: 'Completed',
            value: metrics.completed,
            sub: 'Finished & claimed orders',
            icon: CheckCircle2,
            color: '#059669',
            bg: '#ECFDF5',
            border: '#A7F3D0',
          },
          {
            label: 'Cancelled / Rejected',
            value: metrics.rejected,
            sub: 'Declined or cancelled orders',
            icon: XCircle,
            color: '#DC2626',
            bg: '#FEF2F2',
            border: '#FECACA',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              style={{
                background: COLOR.BG_CARD,
                borderRadius: '1rem',
                padding: '1.25rem',
                border: `1px solid ${COLOR.BORDER}`,
                boxShadow: '0 1px 3px rgba(22, 58, 95, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '128px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{
                    fontSize: '0.6875rem',
                    color: COLOR.TEXT_SECONDARY,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: '1.875rem',
                    fontWeight: 800,
                    color: COLOR.NAVY,
                    lineHeight: 1.15,
                    marginTop: '0.35rem',
                    letterSpacing: '-0.02em',
                  }}>
                    {item.value}
                  </div>
                </div>

                <div style={{
                  width: '2.375rem',
                  height: '2.375rem',
                  borderRadius: '0.625rem',
                  background: item.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${item.border}`,
                  flexShrink: 0,
                }}>
                  <Icon size={17} color={item.color} />
                </div>
              </div>

              <div style={{
                fontSize: '0.75rem',
                color: COLOR.TEXT_SECONDARY,
                marginTop: '0.625rem',
                fontWeight: 500,
              }}>
                {item.sub}
              </div>
            </div>
          );
        })}
      </div>


      <div style={{
        ...cardStyle,
        padding: '0.875rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.875rem',
      }}>
        {/* Left: Responsive open search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: '1 1 300px', maxWidth: '440px' }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.85rem',
                color: '#64748B',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by order ID, customer, shop, document…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                }
              }}
              style={{
                width: '100%',
                height: '38px',
                paddingLeft: '2.25rem',
                paddingRight: searchQuery ? '2.25rem' : '0.85rem',
                borderRadius: '0.625rem',
                border: '1px solid #CBD5E1',
                fontSize: '0.8125rem',
                outline: 'none',
                background: '#F8FAFC',
                color: '#0F172A',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onFocus={e => {
                e.target.style.background = '#FFFFFF';
                e.target.style.borderColor = '#465FFF';
                e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.12)';
              }}
              onBlur={e => {
                e.target.style.background = '#F8FAFC';
                e.target.style.borderColor = '#CBD5E1';
                e.target.style.boxShadow = 'none';
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.25rem',
                  borderRadius: '0.25rem',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Store filter, Status filter & neutral Reset pill */}
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            aria-label="Filter requests by store"
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
              minWidth: '175px',
            }}
          >
            <option value="">All Stores ({shopMetrics.length})</option>
            {shopMetrics.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.total})
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter requests by status"
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
              minWidth: '160px',
            }}
          >
            <option value="">All Status ({metrics.total})</option>
            <option value="pending">Pending ({metrics.counts.pending})</option>
            <option value="printing">Printing ({metrics.counts.printing})</option>
            <option value="ready">Ready ({metrics.counts.ready})</option>
            <option value="completed">Completed ({metrics.counts.completed})</option>
            <option value="rejected">Rejected ({metrics.counts.rejected})</option>
          </select>

          {(statusFilter || searchQuery || shopFilter) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setSearchQuery('');
                setShopFilter('');
              }}
              aria-label="Reset all search and status filters"
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
              onMouseEnter={e => {
                e.currentTarget.style.background = '#E2E8F0';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#F1F5F9';
              }}
            >
              <X size={13} className="text-slate-400" /> Reset
            </button>
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
          paddingBottom: '0.75rem',
          borderBottom: `1px solid ${COLOR.BORDER}`,
        }}>
          <div>
            <h2 style={{
              fontSize: '1.0625rem',
              fontWeight: 700,
              color: COLOR.TEXT_PRIMARY,
              margin: 0,
              letterSpacing: '-0.01em',
            }}>
              Order List
            </h2>
            <p style={{
              fontSize: '0.75rem',
              color: COLOR.TEXT_SECONDARY,
              margin: '0.2rem 0 0',
              fontWeight: 500,
            }}>
              Showing {filteredRequests.length} of {requests.length} total orders
            </p>
          </div>

          {/* Grid View & Table View Toggle */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#F1F5F9',
            padding: '3px',
            borderRadius: '0.625rem',
            border: '1px solid #E2E8F0',
            gap: '2px',
          }}>
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              title="Grid View"
              aria-label="Grid View"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: 'none',
                background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'grid' ? COLOR.NAVY : COLOR.TEXT_SECONDARY,
                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('table')}
              title="Table View"
              aria-label="Table View"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                border: 'none',
                background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'table' ? COLOR.NAVY : COLOR.TEXT_SECONDARY,
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontSize: '0.8125rem', color: COLOR.TEXT_SECONDARY, fontWeight: 500 }}>
              Loading print requests…
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '3.75rem 1.5rem',
            margin: '0 auto',
            maxWidth: '520px',
          }}>
            <div style={{
              width: '3.25rem',
              height: '3.25rem',
              borderRadius: '0.875rem',
              background: COLOR.BG_MAIN,
              border: `1px solid ${COLOR.BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 1px 2px rgba(22, 58, 95, 0.04)',
            }}>
              <FileText size={24} color={COLOR.TEXT_SECONDARY} />
            </div>

            <h3 style={{
              fontSize: '1.0625rem',
              fontWeight: 700,
              color: COLOR.TEXT_PRIMARY,
              margin: '0 0 0.35rem',
            }}>
              {searchQuery || statusFilter || shopFilter ? 'No matching requests found' : 'No printing requests yet'}
            </h3>

            <p style={{
              fontSize: '0.875rem',
              color: COLOR.TEXT_SECONDARY,
              margin: '0 0 0.35rem',
              lineHeight: 1.45,
            }}>
              {searchQuery || statusFilter || shopFilter
                ? 'No print orders match the selected filters or keyword. Try resetting your search.'
                : 'New printing requests will appear here when customers submit orders.'}
            </p>

            <p style={{
              fontSize: '0.8125rem',
              color: COLOR.TEXT_SECONDARY,
              margin: 0,
              opacity: 0.85,
            }}>
              Requests will be automatically organized by their current fulfillment status.
            </p>

            {(searchQuery || statusFilter || shopFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setSearchQuery('');
                  setShopFilter('');
                }}
                style={{
                  marginTop: '1.25rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: COLOR.BLUE,
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
                }}
              >
                Clear Search &amp; Filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1rem',
          }}>
            {filteredRequests.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              const specs = req.printingSpecifications || {};

              return (
                <div
                  key={req._id}
                  style={{
                    background: COLOR.BG_CARD,
                    borderRadius: '0.875rem',
                    border: `1px solid ${COLOR.BORDER}`,
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: '0 1px 3px rgba(22, 58, 95, 0.04)',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#CBD5E1';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 58, 95, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = COLOR.BORDER;
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(22, 58, 95, 0.04)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: COLOR.TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        ORD-#{req._id.slice(-6).toUpperCase()}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: statusCfg.bg,
                        color: statusCfg.color,
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        border: `1px solid ${statusCfg.border}`,
                      }}>
                        <StatusIcon size={11} /> {statusCfg.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.875rem', fontWeight: 700, color: COLOR.TEXT_PRIMARY }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <User size={14} color={COLOR.BLUE} /> {req.customerId?.name || 'Customer'}
                      </span>
                      <ArrowRight size={13} color={COLOR.TEXT_SECONDARY} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: COLOR.NAVY }}>
                        <Store size={14} /> {req.shopId?.shopName || 'Print Shop'}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    background: COLOR.BG_MAIN,
                    padding: '0.75rem 0.875rem',
                    borderRadius: '0.625rem',
                    border: `1px solid ${COLOR.BORDER}`,
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <FileText size={14} color={COLOR.BLUE} /> {req.documentId?.originalFilename || 'Document File'}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <span style={{ background: COLOR.BG_CARD, border: `1px solid ${COLOR.BORDER}`, padding: '0.15rem 0.45rem', borderRadius: '0.35rem', fontSize: '0.6875rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>
                        {specs.paperSize || 'A4'}
                      </span>
                      <span style={{ background: COLOR.BG_CARD, border: `1px solid ${COLOR.BORDER}`, padding: '0.15rem 0.45rem', borderRadius: '0.35rem', fontSize: '0.6875rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>
                        {specs.colorMode === 'color' ? 'Full Color' : 'B&W'}
                      </span>
                      <span style={{ background: COLOR.BG_CARD, border: `1px solid ${COLOR.BORDER}`, padding: '0.15rem 0.45rem', borderRadius: '0.35rem', fontSize: '0.6875rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>
                        {specs.copies || 1} {specs.copies > 1 ? 'copies' : 'copy'} ({specs.totalPages || 1} pgs)
                      </span>
                    </div>

                    {(req.estimatedTravelTime > 0 || req.estimatedWaitingTime > 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', color: COLOR.TEXT_SECONDARY, marginTop: '0.25rem' }}>
                        <span>🚶 Travel: ~{req.estimatedTravelTime}m</span>
                        <span>·</span>
                        <span>⏳ Queue: ~{req.estimatedWaitingTime}m</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: `1px solid ${COLOR.BORDER}` }}>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: COLOR.TEXT_SECONDARY, fontWeight: 600 }}>Total Cost</div>
                      <div style={{ fontSize: '1.0625rem', fontWeight: 800, color: COLOR.TEXT_PRIMARY }}>
                        ₱{(req.estimatedCost || 0).toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => setInspectRequest(req)}
                      aria-label={`Inspect job order ${req._id}`}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: `1px solid ${COLOR.BORDER}`,
                        background: COLOR.BG_CARD,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: COLOR.TEXT_PRIMARY,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = COLOR.BG_MAIN;
                        e.currentTarget.style.borderColor = '#CBD5E1';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = COLOR.BG_CARD;
                        e.currentTarget.style.borderColor = COLOR.BORDER;
                      }}
                    >
                      <Eye size={13} color={COLOR.BLUE} /> Inspect Job
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            borderRadius: '0.75rem',
            border: `1px solid ${COLOR.BORDER}`,
            background: '#FFFFFF',
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.8125rem',
            }}>
              <thead>
                <tr style={{ background: COLOR.BG_MAIN, borderBottom: `1px solid ${COLOR.BORDER}` }}>
                  <th style={{ ...thStyle, paddingLeft: '1.25rem' }}>Order ID</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Print Shop</th>
                  <th style={thStyle}>Document &amp; Specs</th>
                  <th style={thStyle}>Total Cost</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Submitted</th>
                  <th style={{ ...thStyle, textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const specs = req.printingSpecifications || {};
                  const submitted = formatSubmittedDate(req.createdAt);

                  return (
                    <tr
                      key={req._id}
                      style={{
                        borderBottom: `1px solid ${COLOR.BORDER}`,
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: '0.75rem 0.75rem 0.75rem 1.25rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: COLOR.NAVY,
                          background: COLOR.BG_MAIN,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.375rem',
                          border: `1px solid ${COLOR.BORDER}`,
                        }}>
                          ORD-#{req._id.slice(-6).toUpperCase()}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle', maxWidth: '160px' }}>
                        <div style={{ fontWeight: 700, color: COLOR.TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.customerId?.name || 'Customer'}>
                          <User size={13} color={COLOR.BLUE} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.customerId?.name || 'Customer'}</span>
                        </div>
                        {(req.customerId?.contactNumber || req.customerId?.email) && (
                          <div style={{ fontSize: '0.7rem', color: COLOR.TEXT_SECONDARY, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.customerId?.contactNumber || req.customerId?.email}>
                            {req.customerId?.contactNumber || req.customerId?.email}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle', maxWidth: '200px' }}>
                        <div style={{ fontWeight: 700, color: COLOR.NAVY, display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.shopId?.shopName || 'Print Shop'}>
                          <Store size={13} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.shopId?.shopName || 'Print Shop'}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: COLOR.TEXT_SECONDARY, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.shopId?.address || 'Naval, Biliran'}>
                          {req.shopId?.address || 'Naval, Biliran'}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle', maxWidth: '220px' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: COLOR.TEXT_PRIMARY,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={req.documentId?.originalFilename || 'Document File'}
                        >
                          <FileText size={13} color={COLOR.BLUE} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {req.documentId?.originalFilename || 'Document File'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                          <span style={{ background: COLOR.BG_MAIN, border: `1px solid ${COLOR.BORDER}`, padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>
                            {specs.paperSize || 'A4'}
                          </span>
                          <span style={{ background: COLOR.BG_MAIN, border: `1px solid ${COLOR.BORDER}`, padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>
                            {specs.colorMode === 'color' ? 'Full Color' : 'B&W'}
                          </span>
                          <span style={{ background: COLOR.BG_MAIN, border: `1px solid ${COLOR.BORDER}`, padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.65rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>
                            {specs.copies || 1} {specs.copies > 1 ? 'copies' : 'copy'} ({specs.totalPages || 1} pgs)
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: COLOR.TEXT_PRIMARY }}>
                          ₱{(req.estimatedCost || 0).toFixed(2)}
                        </div>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: statusCfg.bg,
                          color: statusCfg.color,
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          border: `1px solid ${statusCfg.border}`,
                        }}>
                          <StatusIcon size={11} /> {statusCfg.label}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>
                          {submitted.primary}
                        </div>
                        {submitted.secondary && (
                          <div style={{ fontSize: '0.65rem', color: COLOR.TEXT_SECONDARY, marginTop: '0.1rem' }}>
                            {submitted.secondary}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1.25rem 0.75rem 0.75rem', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setInspectRequest(req)}
                          aria-label={`Inspect job order ${req._id}`}
                          style={{
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.5rem',
                            border: `1px solid ${COLOR.BORDER}`,
                            background: COLOR.BG_CARD,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: COLOR.TEXT_PRIMARY,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = COLOR.BG_MAIN;
                            e.currentTarget.style.borderColor = '#CBD5E1';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = COLOR.BG_CARD;
                            e.currentTarget.style.borderColor = COLOR.BORDER;
                          }}
                        >
                          <Eye size={13} color={COLOR.BLUE} /> Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {inspectRequest && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(22, 58, 95, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '1rem',
            width: '540px',
            maxWidth: '100%',
            boxShadow: '0 20px 40px rgba(22, 58, 95, 0.25)',
            border: `1px solid ${COLOR.BORDER}`,
            overflow: 'hidden',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              background: COLOR.NAVY,
              padding: '1.25rem 1.5rem',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Print Job Order Audit
                </span>
                <h3 style={{ fontSize: '1.1875rem', fontWeight: 800, margin: '0.2rem 0 0', letterSpacing: '-0.01em' }}>
                  ORD-#{inspectRequest._id.slice(-8).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setInspectRequest(null)}
                aria-label="Close audit modal"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
              fontSize: '0.8125rem',
              flex: 1,
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: COLOR.BG_MAIN,
                padding: '1rem 1.125rem',
                borderRadius: '0.75rem',
                border: `1px solid ${COLOR.BORDER}`,
              }}>
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: COLOR.TEXT_SECONDARY, textTransform: 'uppercase' }}>
                    Fulfillment Status
                  </div>
                  <div style={{
                    fontWeight: 800,
                    fontSize: '0.9375rem',
                    color: (STATUS_CONFIG[inspectRequest.status] || STATUS_CONFIG.pending).color,
                    marginTop: '0.15rem',
                  }}>
                    {(STATUS_CONFIG[inspectRequest.status] || STATUS_CONFIG.pending).label}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: COLOR.TEXT_SECONDARY, textTransform: 'uppercase' }}>
                    Total Amount
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.1875rem', color: COLOR.TEXT_PRIMARY, marginTop: '0.15rem' }}>
                    ₱{(inspectRequest.estimatedCost || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ background: COLOR.BG_MAIN, padding: '1rem 1.125rem', borderRadius: '0.75rem', border: `1px solid ${COLOR.BORDER}` }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: COLOR.TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <User size={12} color={COLOR.BLUE} /> Customer
                  </div>
                  <div style={{ fontWeight: 700, color: COLOR.TEXT_PRIMARY, marginTop: '0.3rem', fontSize: '0.875rem' }}>
                    {inspectRequest.customerId?.name || 'Customer'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: COLOR.TEXT_SECONDARY, marginTop: '0.15rem' }}>
                    {inspectRequest.customerId?.email}
                  </div>
                  {inspectRequest.customerId?.contactNumber && (
                    <div style={{ fontSize: '0.75rem', color: COLOR.TEXT_PRIMARY, marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Phone size={12} color={COLOR.TEXT_SECONDARY} /> {inspectRequest.customerId.contactNumber}
                    </div>
                  )}
                </div>

                <div style={{ background: COLOR.BG_MAIN, padding: '1rem 1.125rem', borderRadius: '0.75rem', border: `1px solid ${COLOR.BORDER}` }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: COLOR.TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Store size={12} color={COLOR.BLUE} /> Assigned Shop
                  </div>
                  <div style={{ fontWeight: 700, color: COLOR.NAVY, marginTop: '0.3rem', fontSize: '0.875rem' }}>
                    {inspectRequest.shopId?.shopName || 'Print Shop'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: COLOR.TEXT_SECONDARY, marginTop: '0.15rem' }}>
                    {inspectRequest.shopId?.address || 'Naval, Biliran'}
                  </div>
                  {inspectRequest.shopId?.contactNumber && (
                    <div style={{ fontSize: '0.75rem', color: COLOR.TEXT_PRIMARY, marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Phone size={12} color={COLOR.TEXT_SECONDARY} /> {inspectRequest.shopId.contactNumber}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: COLOR.BG_MAIN, padding: '1rem 1.125rem', borderRadius: '0.75rem', border: `1px solid ${COLOR.BORDER}` }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: COLOR.TEXT_PRIMARY, textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                  Document Specifications
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem', fontSize: '0.75rem' }}>
                  <div>
                    <span style={{ color: COLOR.TEXT_SECONDARY, fontSize: '0.6875rem' }}>File Name:</span>
                    <div style={{ fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>{inspectRequest.documentId?.originalFilename || 'Document'}</div>
                  </div>
                  <div>
                    <span style={{ color: COLOR.TEXT_SECONDARY, fontSize: '0.6875rem' }}>Paper Size:</span>
                    <div style={{ fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>{inspectRequest.printingSpecifications?.paperSize || 'A4'}</div>
                  </div>
                  <div>
                    <span style={{ color: COLOR.TEXT_SECONDARY, fontSize: '0.6875rem' }}>Color Mode:</span>
                    <div style={{ fontWeight: 600, color: inspectRequest.printingSpecifications?.colorMode === 'color' ? '#7C3AED' : COLOR.TEXT_PRIMARY }}>
                      {inspectRequest.printingSpecifications?.colorMode === 'color' ? 'Full Color' : 'Black & White'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: COLOR.TEXT_SECONDARY, fontSize: '0.6875rem' }}>Copies:</span>
                    <div style={{ fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>{inspectRequest.printingSpecifications?.copies || 1}</div>
                  </div>
                  <div>
                    <span style={{ color: COLOR.TEXT_SECONDARY, fontSize: '0.6875rem' }}>Pages per copy:</span>
                    <div style={{ fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>{inspectRequest.printingSpecifications?.totalPages || 1}</div>
                  </div>
                  <div>
                    <span style={{ color: COLOR.TEXT_SECONDARY, fontSize: '0.6875rem' }}>Binding:</span>
                    <div style={{ fontWeight: 600, color: COLOR.TEXT_PRIMARY }}>{inspectRequest.printingSpecifications?.binding || 'None'}</div>
                  </div>
                </div>
              </div>

              <div style={{ background: COLOR.BG_MAIN, padding: '1rem 1.125rem', borderRadius: '0.75rem', border: `1px solid ${COLOR.BORDER}` }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: COLOR.TEXT_PRIMARY, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Operations Research Algorithm Timing
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: '#FFFFFF', padding: '0.625rem 0.5rem', borderRadius: '0.5rem', border: `1px solid ${COLOR.BORDER}` }}>
                    <div style={{ fontSize: '0.6875rem', color: COLOR.TEXT_SECONDARY, fontWeight: 600 }}>Est. Travel Time</div>
                    <div style={{ fontWeight: 800, color: COLOR.NAVY, fontSize: '0.9375rem', marginTop: '0.15rem' }}>
                      ~{inspectRequest.estimatedTravelTime || 0} min
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '0.625rem 0.5rem', borderRadius: '0.5rem', border: `1px solid ${COLOR.BORDER}` }}>
                    <div style={{ fontSize: '0.6875rem', color: COLOR.TEXT_SECONDARY, fontWeight: 600 }}>Est. Queue Wait</div>
                    <div style={{ fontWeight: 800, color: COLOR.NAVY, fontSize: '0.9375rem', marginTop: '0.15rem' }}>
                      ~{inspectRequest.estimatedWaitingTime || 0} min
                    </div>
                  </div>
                  <div style={{ background: '#FFFFFF', padding: '0.625rem 0.5rem', borderRadius: '0.5rem', border: `1px solid ${COLOR.BORDER}` }}>
                    <div style={{ fontSize: '0.6875rem', color: COLOR.TEXT_SECONDARY, fontWeight: 600 }}>Est. Service Time</div>
                    <div style={{ fontWeight: 800, color: COLOR.NAVY, fontSize: '0.9375rem', marginTop: '0.15rem' }}>
                      ~{inspectRequest.estimatedPrintingTime || 0} min
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              padding: '1rem 1.5rem',
              borderTop: `1px solid ${COLOR.BORDER}`,
              background: '#FFFFFF',
              flexShrink: 0,
              display: 'flex',
              gap: '0.75rem',
            }}>
              {!['completed', 'cancelled', 'rejected'].includes(inspectRequest.status) && (
                <button
                  onClick={() => handleHoldOrder(inspectRequest._id)}
                  style={{
                    flex: 1,
                    height: '42px',
                    borderRadius: '0.625rem',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <AlertCircle size={14} /> Place on Admin Hold
                </button>
              )}
              <button
                onClick={() => setInspectRequest(null)}
                style={{
                  flex: 1,
                  height: '42px',
                  borderRadius: '0.625rem',
                  background: COLOR.BLUE,
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(25, 57, 141, 0.25)',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .search-btn-wrapper .search-tooltip {
          visibility: hidden;
          opacity: 0;
          transition: opacity 0.15s ease, transform 0.15s ease;
          transform: translate(-50%, 4px) !important;
        }
        .search-btn-wrapper:hover .search-tooltip {
          visibility: visible;
          opacity: 1;
          transform: translate(-50%, 0) !important;
        }
      `}</style>
    </div>
  );
}
