import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import {
  Users, Shield, Store, Search, Trash2, CheckCircle2,
  XCircle, Phone, Mail, Calendar, Eye, X, Check,
  AlertTriangle, LayoutGrid, List, MapPin, Star,
  Clock, ExternalLink, ChevronRight, FileText,
  User as UserIcon, UserX, Copy, ArrowUpDown,
  ShieldAlert, Sparkles, RefreshCw, Info, ShoppingBag
} from 'lucide-react';
import toast from 'react-hot-toast';

const NAVY = '#101828';
const BLUE = '#465FFF';
const TEAL = '#0F766E';
const GREEN = '#10B981';
const AMBER = '#F59E0B';
const RED = '#DC2626';
const GRAY = '#64748B';

const ROLE_THEME = {
  customer: {
    label: 'Customer',
    color: '#1D4ED8',
    bg: '#EFF6FF',
    border: '#BFDBFE',
    gradient: 'linear-gradient(135deg, #1D4ED8 0%, #465FFF 100%)',
    icon: UserIcon,
    subLabel: 'Student / Public Client',
  },
  shop_owner: {
    label: 'Shop Owner',
    color: '#0F766E',
    bg: '#F0FDFA',
    border: '#99F6E4',
    gradient: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)',
    icon: Store,
    subLabel: 'Printing Business Partner',
  },
  admin: {
    label: 'Administrator',
    color: '#4338CA',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    gradient: 'linear-gradient(135deg, #101828 0%, #312E81 100%)',
    icon: Shield,
    subLabel: 'System Super Admin',
  },
};

const cardBase = {
  background: '#FFFFFF',
  borderRadius: '1rem',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 6px 18px rgba(6,63,92,0.04)',
};

const thStyle = {
  padding: '0.85rem 1rem',
  fontSize: '0.6875rem',
  fontWeight: 700,
  color: GRAY,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #E2E8F0',
  background: '#F8FAFC',
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const searchInputRef = useRef(null);

  // Modals & Drawers
  const [inspectUser, setInspectUser] = useState(null);
  const [inspectTab, setInspectTab] = useState('overview');
  const [userRequests, setUserRequests] = useState([]);
  const [loadingUserRequests, setLoadingUserRequests] = useState(false);

  // Reasoned Suspension Modal
  const [suspendModalUser, setSuspendModalUser] = useState(null);
  const [suspendReason, setSuspendReason] = useState('Violation of printing platform terms');
  const [customSuspendReason, setCustomSuspendReason] = useState('');

  // Delete Modal
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Copy indicator state
  const [copiedId, setCopiedId] = useState(null);

  // View mode
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('printdayon_admin_users_view') || 'grid';
    } catch (_) {
      return 'grid';
    }
  });

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('printdayon_admin_users_view', mode);
    } catch (_) {}
  };

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

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [usersRes, shopsRes] = await Promise.allSettled([
        adminAPI.getUsers({ limit: 300 }),
        adminAPI.getShops({ limit: 300 }),
      ]);
      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.data?.users || []);
      }
      if (shopsRes.status === 'fulfilled') {
        setShops(shopsRes.value.data?.shops || []);
      }
    } catch (err) {
      toast.error('Failed to load user records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Map user to shop
  const getShopForUser = useCallback(
    (user) => {
      if (!user) return null;
      if (user.shop) return user.shop;
      const uid = user._id?.toString() || user.id?.toString();
      return (
        shops.find((s) => {
          const ownerId = s.ownerId?._id?.toString() || s.ownerId?.toString();
          return ownerId === uid;
        }) || null
      );
    },
    [shops]
  );

  // Fetch requests for inspected customer
  useEffect(() => {
    if (inspectUser && inspectUser.role === 'customer') {
      setLoadingUserRequests(true);
      adminAPI
        .getRequests({ customerId: inspectUser._id, limit: 10 })
        .then((res) => {
          setUserRequests(res.data?.requests || []);
        })
        .catch(() => {
          setUserRequests([]);
        })
        .finally(() => {
          setLoadingUserRequests(false);
        });
    } else {
      setUserRequests([]);
    }
  }, [inspectUser]);

  // Metrics computation
  const metrics = useMemo(() => {
    const total = users.length;
    const customers = users.filter((u) => u.role === 'customer').length;
    const owners = users.filter((u) => u.role === 'shop_owner').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const inactive = users.filter((u) => u.isActive === false).length;
    return { total, customers, owners, admins, inactive };
  }, [users]);

  // Filtering & Sorting
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      const matchesRole = !roleFilter || u.role === roleFilter;
      const userShop = getShopForUser(u);

      const matchesSearch =
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.contactNumber || '').includes(searchQuery) ||
        (userShop?.shopName || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? u.isActive !== false
          : u.isActive === false;

      return matchesRole && matchesSearch && matchesStatus;
    });

    return list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'activity') {
        const countA = a.activity?.totalRequests || (a.role === 'shop_owner' ? 10 : 0);
        const countB = b.activity?.totalRequests || (b.role === 'shop_owner' ? 10 : 0);
        return countB - countA;
      }
      return 0;
    });
  }, [users, roleFilter, searchQuery, statusFilter, sortBy, getShopForUser]);

  // Copy email with feedback
  const handleCopyEmail = (email, id, e) => {
    e?.stopPropagation();
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    toast.success(`Copied "${email}" to clipboard.`);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  // Open reasoned suspension modal
  const handleInitiateSuspend = (user, e) => {
    e?.stopPropagation();
    setSuspendModalUser(user);
    setSuspendReason('Violation of printing platform terms');
    setCustomSuspendReason('');
  };

  // Confirm suspension with reason
  const handleConfirmSuspend = async () => {
    if (!suspendModalUser) return;
    const finalReason =
      suspendReason === 'Other (specify below)'
        ? customSuspendReason.trim() || 'Suspended by administrator'
        : suspendReason;

    setSubmitting(true);
    try {
      await adminAPI.toggleUserStatus(suspendModalUser._id, false, finalReason);
      toast.success(`Account for ${suspendModalUser.name} has been suspended.`);
      setSuspendModalUser(null);
      fetchUsers(true);
      if (inspectUser?._id === suspendModalUser._id) {
        setInspectUser((prev) => ({
          ...prev,
          isActive: false,
          deactivationReason: finalReason,
          deactivatedAt: new Date().toISOString(),
        }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to suspend account.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reactivate user
  const handleReactivate = async (user, e) => {
    e?.stopPropagation();
    try {
      await adminAPI.toggleUserStatus(user._id, true);
      toast.success(`${user.name} has been reactivated in good standing.`);
      fetchUsers(true);
      if (inspectUser?._id === user._id) {
        setInspectUser((prev) => ({
          ...prev,
          isActive: true,
          deactivationReason: '',
          deactivatedAt: null,
        }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reactivate user.');
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setSubmitting(true);
    try {
      await adminAPI.deleteUser(deleteConfirmUser._id);
      toast.success(`Account for ${deleteConfirmUser.name} permanently deleted.`);
      setDeleteConfirmUser(null);
      if (inspectUser?._id === deleteConfirmUser._id) {
        setInspectUser(null);
      }
      fetchUsers(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete user.');
    } finally {
      setSubmitting(false);
    }
  };

  // KPI Card Filter click helper
  const handleKpiCardClick = (targetRole, targetStatus = 'all') => {
    if (roleFilter === targetRole && statusFilter === targetStatus) {
      // Toggle off if already active
      setRoleFilter('');
      setStatusFilter('all');
    } else {
      setRoleFilter(targetRole);
      setStatusFilter(targetStatus);
    }
  };

  const isFilterActive = roleFilter || statusFilter !== 'all' || searchQuery;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%',
        margin: '0 auto',
        paddingBottom: '2.5rem',
      }}
      className="fade-in"
    >
      {/* 1. EXECUTIVE KPI METRIC CARDS (INTERACTIVE & ROLE-CODED) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
        }}
      >
        {[
          {
            label: 'Total Registered',
            value: metrics.total,
            sub: 'All platform users',
            share: '100%',
            icon: Users,
            color: NAVY,
            bg: '#F1F5F9',
            border: '#CBD5E1',
          },
          {
            label: 'Customers',
            value: metrics.customers,
            sub: 'Students & public',
            share: metrics.total ? `${Math.round((metrics.customers / metrics.total) * 100)}%` : '0%',
            icon: UserIcon,
            color: '#1D4ED8',
            bg: '#EFF6FF',
            border: '#BFDBFE',
          },
          {
            label: 'Shop Owners',
            value: metrics.owners,
            sub: 'Printing partners',
            share: metrics.total ? `${Math.round((metrics.owners / metrics.total) * 100)}%` : '0%',
            icon: Store,
            color: TEAL,
            bg: '#F0FDFA',
            border: '#99F6E4',
          },
          {
            label: 'Administrators',
            value: metrics.admins,
            sub: 'Platform supervisors',
            share: metrics.total ? `${Math.round((metrics.admins / metrics.total) * 100)}%` : '0%',
            icon: Shield,
            color: '#4338CA',
            bg: '#EEF2FF',
            border: '#C7D2FE',
          },
          {
            label: 'Suspended',
            value: metrics.inactive,
            sub: 'Restricted access',
            share: metrics.total ? `${Math.round((metrics.inactive / metrics.total) * 100)}%` : '0%',
            icon: UserX,
            color: RED,
            bg: '#FEF2F2',
            border: '#FECACA',
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              style={{
                ...cardBase,
                padding: '1.15rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '132px',
                cursor: 'default',
                position: 'relative',
                overflow: 'hidden',
                borderColor: '#E2E8F0',
                boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 12px rgba(6,63,92,0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: GRAY,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>{m.label}</span>
                  </div>
                  <div
                    style={{
                      fontSize: '1.95rem',
                      fontWeight: 900,
                      color: NAVY,
                      lineHeight: 1.15,
                      marginTop: '0.3rem',
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
                  fontSize: '0.73rem',
                  color: GRAY,
                  fontWeight: 500,
                }}
              >
                <span>{m.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. REFINED TOOLBAR (SINGLE ROW: SEARCH + FILTERS + SORT) */}
      <div
        style={{
          ...cardBase,
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'nowrap',
          overflowX: 'auto',
        }}
      >
        {/* Left: Open Responsive Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: '1 1 260px', maxWidth: '380px' }}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <Search
              size={14}
              color="#94A3B8"
              style={{
                position: 'absolute',
                left: '0.85rem',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, email, phone, or shop…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                }
              }}
              style={{
                width: '100%',
                height: '36px',
                paddingLeft: '2.2rem',
                paddingRight: searchQuery ? '2.1rem' : '0.85rem',
                borderRadius: '0.5rem',
                border: '1.5px solid #E2E8F0',
                fontSize: '0.78rem',
                color: NAVY,
                background: '#FFFFFF',
                outline: 'none',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = BLUE;
                e.target.style.boxShadow = '0 0 0 3px rgba(25, 57, 141, 0.12)';
              }}
              onBlurCapture={(e) => {
                e.target.style.borderColor = '#E2E8F0';
                e.target.style.boxShadow = 'none';
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: '0.4rem',
                  background: 'transparent',
                  border: 'none',
                  color: GRAY,
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right: Role Select, Status Select, Sort By, Reset, Refresh (Single Row) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'nowrap' }}>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter users by role"
            style={{
              height: '36px',
              padding: '0 0.75rem',
              borderRadius: '0.5rem',
              border: '1.5px solid #E2E8F0',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: NAVY,
              background: '#F8FAFC',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '125px',
            }}
          >
            <option value="">All Roles ({metrics.total})</option>
            <option value="customer">Customers ({metrics.customers})</option>
            <option value="shop_owner">Shop Owners ({metrics.owners})</option>
            <option value="admin">Admins ({metrics.admins})</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter users by account status"
            style={{
              height: '36px',
              padding: '0 0.75rem',
              borderRadius: '0.5rem',
              border: '1.5px solid #E2E8F0',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: NAVY,
              background: '#F8FAFC',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '115px',
            }}
          >
            <option value="all">Status: All</option>
            <option value="active">Active Accounts</option>
            <option value="inactive">Suspended Accounts</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort users"
            style={{
              height: '36px',
              padding: '0 0.75rem',
              borderRadius: '0.5rem',
              border: '1.5px solid #E2E8F0',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: NAVY,
              background: '#F8FAFC',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '135px',
            }}
          >
            <option value="newest">Recently Registered</option>
            <option value="oldest">Oldest Members</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="activity">Platform Activity</option>
          </select>

          {isFilterActive && (
            <button
              onClick={() => {
                setRoleFilter('');
                setStatusFilter('all');
                setSearchQuery('');
                setSortBy('newest');
              }}
              style={{
                height: '36px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#334155',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                padding: '0 0.85rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#E2E8F0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F1F5F9';
              }}
              title="Reset all search and filters"
            >
              <X size={13} className="text-slate-400" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* 3. MAIN DIRECTORY CONTAINER (HEADER + GRID/TABLE VIEWS) */}
      <div style={cardBase}>
        {/* Section Header */}
        <div
          style={{
            padding: '1.15rem 1.4rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                Platform User Directory
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: BLUE,
                  background: '#EFF6FF',
                  border: '1px solid #DBEAFE',
                  padding: '0.12rem 0.55rem',
                  borderRadius: '999px',
                }}
              >
                {filteredUsers.length} shown
              </span>
            </div>
            <p style={{ fontSize: '0.73rem', color: GRAY, margin: '0.2rem 0 0' }}>
              Supervise registered customer accounts, printing shop owners, and system administrators.
            </p>
          </div>

          {/* Grid View & Table View Toggle */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#F1F5F9',
              padding: '3px',
              borderRadius: '0.625rem',
              border: '1px solid #E2E8F0',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              title="Grid Cards View"
              aria-label="Grid Cards View"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: viewMode === 'grid' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'grid' ? NAVY : GRAY,
                boxShadow:
                  viewMode === 'grid'
                    ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
                    : 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'grid' ? 800 : 600,
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={15} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('table')}
              title="Enterprise Table View"
              aria-label="Enterprise Table View"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'table' ? NAVY : GRAY,
                boxShadow:
                  viewMode === 'table'
                    ? '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)'
                    : 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: viewMode === 'table' ? 800 : 600,
                transition: 'all 0.15s ease',
              }}
            >
              <List size={15} />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.25rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: NAVY }}>
                Loading verified accounts…
              </div>
              <div style={{ fontSize: '0.75rem', color: GRAY, marginTop: '0.2rem' }}>
                Fetching platform users and associated print shops
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: GRAY }}>
              <Users size={44} color="#CBD5E1" style={{ marginBottom: '0.75rem' }} />
              <div style={{ fontWeight: 800, fontSize: '1rem', color: NAVY }}>
                No accounts match your criteria
              </div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                {searchQuery
                  ? `No platform users match "${searchQuery}".`
                  : 'No registered accounts in this selected role or status filter.'}
              </div>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setRoleFilter('');
                    setStatusFilter('all');
                    setSearchQuery('');
                    setSortBy('newest');
                  }}
                  style={{
                    marginTop: '1rem',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '0.5rem',
                    background: '#101828',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ============================================================ */
            /* UNIQUE & PROFESSIONAL GRID CARDS                             */
            /* ============================================================ */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                gap: '1.15rem',
              }}
            >
              {filteredUsers.map((user) => {
                const theme = ROLE_THEME[user.role] || ROLE_THEME.customer;
                const RoleIcon = theme.icon;
                const isActive = user.isActive !== false;
                const userShop = user.role === 'shop_owner' ? getShopForUser(user) : null;
                const isCopied = copiedId === user._id;

                const initials = (user.name || 'U')
                  .trim()
                  .split(/\s+/)
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={user._id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '0.875rem',
                      border: `1.5px solid ${isActive ? '#E2E8F0' : '#FECACA'}`,
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      boxShadow: '0 2px 6px rgba(6,63,92,0.03)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 22px rgba(6,63,92,0.08)';
                      e.currentTarget.style.borderColor = isActive ? '#CBD5E1' : '#FCA5A5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(6,63,92,0.03)';
                      e.currentTarget.style.borderColor = isActive ? '#E2E8F0' : '#FECACA';
                    }}
                  >
                    {/* Top Accent Strip per role */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: '1.25rem',
                        right: '1.25rem',
                        height: '2.5px',
                        background: isActive ? theme.gradient : '#DC2626',
                        borderBottomLeftRadius: '2px',
                        borderBottomRightRadius: '2px',
                      }}
                    />

                    {/* Header: Avatar, Name, Role Badge, Status */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', minWidth: 0 }}>
                        {/* Stylized Avatar with live status dot */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div
                            style={{
                              width: '2.85rem',
                              height: '2.85rem',
                              borderRadius: '0.75rem',
                              background: theme.bg,
                              color: theme.color,
                              border: `1.5px solid ${theme.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '1rem',
                              letterSpacing: '0.5px',
                              boxShadow: '0 2px 5px rgba(6,63,92,0.06)',
                            }}
                          >
                            {initials}
                          </div>
                          {/* Live Status Indicator Dot */}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '-2px',
                              right: '-2px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: isActive ? GREEN : RED,
                              border: '2px solid #FFFFFF',
                              boxShadow: isActive ? '0 0 0 2px rgba(16,185,129,0.2)' : 'none',
                            }}
                            title={isActive ? 'Active Account' : 'Suspended Account'}
                          />
                        </div>

                        {/* Name & Role */}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '0.96rem',
                              color: NAVY,
                              lineHeight: 1.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={user.name}
                          >
                            {user.name}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexWrap: 'wrap',
                              marginTop: '0.25rem',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.12rem 0.55rem',
                                borderRadius: '999px',
                                background: theme.bg,
                                color: theme.color,
                                border: `1px solid ${theme.border}`,
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                              }}
                            >
                              <RoleIcon size={11} /> {theme.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          background: isActive ? '#ECFDF5' : '#FEF2F2',
                          color: isActive ? '#065F46' : RED,
                          fontSize: '0.67rem',
                          fontWeight: 800,
                          border: `1px solid ${isActive ? '#A7F3D0' : '#FECACA'}`,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: isActive ? '#10B981' : RED,
                          }}
                        />
                        {isActive ? 'Active' : 'Suspended'}
                      </span>
                    </div>

                    {/* Role-Specific Affiliation Pill */}
                    {user.role === 'shop_owner' && userShop && (
                      <div
                        onClick={() => {
                          setInspectUser(user);
                          setInspectTab('shop');
                        }}
                        role="button"
                        tabIndex={0}
                        style={{
                          background: '#F0FDFA',
                          border: '1px solid #CCFBF1',
                          padding: '0.4rem 0.65rem',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#E6FFFA')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#F0FDFA')}
                        title={`Assigned Shop: ${userShop.shopName}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          <Store size={12} color="#0F766E" style={{ flexShrink: 0 }} />
                          <span
                            style={{
                              fontSize: '0.73rem',
                              fontWeight: 800,
                              color: '#0F766E',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {userShop.shopName}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              background:
                                userShop.verificationStatus === 'verified'
                                  ? '#ECFDF5'
                                  : userShop.verificationStatus === 'rejected'
                                  ? '#FEF2F2'
                                  : '#FFFBEB',
                              color:
                                userShop.verificationStatus === 'verified'
                                  ? '#065F46'
                                  : userShop.verificationStatus === 'rejected'
                                  ? '#991B1B'
                                  : '#92400E',
                              border:
                                userShop.verificationStatus === 'verified'
                                  ? '1px solid #A7F3D0'
                                  : userShop.verificationStatus === 'rejected'
                                  ? '1px solid #FECACA'
                                  : '1px solid #FDE68A',
                              textTransform: 'uppercase',
                            }}
                          >
                            {userShop.verificationStatus || 'Pending'}
                          </span>
                          <ChevronRight size={12} color="#0F766E" />
                        </div>
                      </div>
                    )}

                    {user.role === 'customer' && (
                      <div
                        style={{
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.72rem',
                          color: GRAY,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <ShoppingBag size={12} color={BLUE} />
                          <strong style={{ color: NAVY }}>
                            {user.activity?.totalRequests || 0}
                          </strong>{' '}
                          total print orders
                        </span>
                        {user.activity?.completedRequests > 0 && (
                          <span style={{ color: GREEN, fontWeight: 700 }}>
                            {user.activity.completedRequests} completed
                          </span>
                        )}
                      </div>
                    )}

                    {/* Suspension Notice Banner if Deactivated */}
                    {!isActive && user.deactivationReason && (
                      <div
                        style={{
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.7rem',
                          color: '#991B1B',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.4rem',
                        }}
                      >
                        <ShieldAlert size={13} color={RED} style={{ flexShrink: 0, marginTop: '1px' }} />
                        <div>
                          <strong style={{ fontWeight: 800 }}>Suspended:</strong>{' '}
                          {user.deactivationReason}
                        </div>
                      </div>
                    )}

                    {/* Details Box: Email (Copyable), Contact Number, Joined Date */}
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: GRAY,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        background: '#F8FAFC',
                        padding: '0.75rem 0.85rem',
                        borderRadius: '0.625rem',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      {/* Email + Copy Icon Button */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Mail size={12} color={BLUE} style={{ flexShrink: 0 }} />
                          <a
                            href={`mailto:${user.email}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontWeight: 600,
                              color: NAVY,
                              textDecoration: 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Email: ${user.email}`}
                          >
                            {user.email}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleCopyEmail(user.email, user._id, e)}
                          title="Copy email address"
                          style={{
                            background: isCopied ? '#ECFDF5' : 'transparent',
                            border: isCopied ? '1px solid #A7F3D0' : 'none',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            color: isCopied ? GREEN : GRAY,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>

                      {/* Phone Number */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#334155' }}>
                        <Phone size={12} color="#64748B" style={{ flexShrink: 0 }} />
                        {user.contactNumber ? (
                          <a
                            href={`tel:${user.contactNumber}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: '#334155', textDecoration: 'none', fontWeight: 600 }}
                          >
                            {user.contactNumber}
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>No phone recorded</span>
                        )}
                      </div>

                      {/* Registered Date */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          color: '#94A3B8',
                          fontSize: '0.7rem',
                        }}
                      >
                        <Calendar size={11} color="#94A3B8" style={{ flexShrink: 0 }} />
                        <span>
                          Registered:{' '}
                          {new Date(user.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div style={{ display: 'flex', gap: '0.45rem', paddingTop: '0.15rem' }}>
                      {/* Inspect Dossier Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setInspectUser(user);
                          setInspectTab('overview');
                        }}
                        style={{
                          flex: 1.2,
                          padding: '0.45rem 0.65rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #E2E8F0',
                          background: '#F8FAFC',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: NAVY,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#FFFFFF';
                          e.currentTarget.style.borderColor = '#CBD5E1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#F8FAFC';
                          e.currentTarget.style.borderColor = '#E2E8F0';
                        }}
                      >
                        <Eye size={13} color={BLUE} /> Inspect
                      </button>

                      {/* Suspend / Reactivate Button */}
                      {user.role !== 'admin' && (
                        isActive ? (
                          <button
                            type="button"
                            onClick={(e) => handleInitiateSuspend(user, e)}
                            style={{
                              flex: 1,
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.5rem',
                              border: '1px solid #FDE68A',
                              background: '#FFFBEB',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#B45309',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#FEF3C7';
                              e.currentTarget.style.borderColor = '#FCD34D';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#FFFBEB';
                              e.currentTarget.style.borderColor = '#FDE68A';
                            }}
                            title="Suspend user account with reason"
                          >
                            <UserX size={13} color="#D97706" /> Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleReactivate(user, e)}
                            style={{
                              flex: 1,
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.5rem',
                              border: '1px solid #A7F3D0',
                              background: '#ECFDF5',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#065F46',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#D1FAE5';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#ECFDF5';
                            }}
                            title="Restore account to good standing"
                          >
                            <CheckCircle2 size={13} /> Reactivate
                          </button>
                        )
                      )}

                      {/* Delete Button (Protected) */}
                      {user.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmUser(user);
                          }}
                          style={{
                            padding: '0.45rem 0.65rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #FECACA',
                            background: '#FEF2F2',
                            color: RED,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FEE2E2';
                            e.currentTarget.style.borderColor = '#FCA5A5';
                            e.currentTarget.style.color = '#B91C1C';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#FEF2F2';
                            e.currentTarget.style.borderColor = '#FECACA';
                            e.currentTarget.style.color = RED;
                          }}
                          title="Delete account permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ============================================================ */
            /* HIGH-DENSITY ENTERPRISE TABLE VIEW                           */
            /* ============================================================ */
            <div
              style={{
                overflowX: 'auto',
                borderRadius: '0.75rem',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.8125rem',
                }}
              >
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ ...thStyle, paddingLeft: '1.25rem' }}>User Profile</th>
                    <th style={thStyle}>Role & Affiliation</th>
                    <th style={thStyle}>Contact</th>
                    <th style={thStyle}>Account Standing</th>
                    <th style={thStyle}>Platform Footprint</th>
                    <th style={thStyle}>Registered</th>
                    <th style={{ ...thStyle, textAlign: 'right', paddingRight: '1.25rem' }}>
                      Moderation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const theme = ROLE_THEME[user.role] || ROLE_THEME.customer;
                    const RoleIcon = theme.icon;
                    const isActive = user.isActive !== false;
                    const userShop = user.role === 'shop_owner' ? getShopForUser(user) : null;
                    const isCopied = copiedId === user._id;

                    const initials = (user.name || 'U')
                      .trim()
                      .split(/\s+/)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    const registeredDate = new Date(user.createdAt).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    return (
                      <tr
                        key={user._id}
                        style={{
                          borderBottom: '1px solid #E2E8F0',
                          transition: 'background-color 0.15s ease',
                          background: isActive ? 'transparent' : '#FEF2F20A',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {/* 1. User Profile */}
                        <td style={{ padding: '0.85rem 0.75rem 0.85rem 1.25rem', verticalAlign: 'middle', maxWidth: '250px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div
                              style={{
                                width: '2.4rem',
                                height: '2.4rem',
                                borderRadius: '0.5rem',
                                background: theme.bg,
                                color: theme.color,
                                border: `1px solid ${theme.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                style={{
                                  fontWeight: 800,
                                  color: NAVY,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={user.name}
                              >
                                {user.name}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.71rem',
                                  color: GRAY,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  marginTop: '0.1rem',
                                }}
                              >
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: '160px',
                                  }}
                                  title={user.email}
                                >
                                  {user.email}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyEmail(user.email, user._id, e)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: isCopied ? GREEN : '#94A3B8',
                                    cursor: 'pointer',
                                    padding: '1px',
                                    display: 'inline-flex',
                                  }}
                                  title="Copy email"
                                >
                                  {isCopied ? <Check size={11} /> : <Copy size={11} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Role & Affiliation */}
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.15rem 0.55rem',
                              borderRadius: '999px',
                              background: theme.bg,
                              color: theme.color,
                              border: `1px solid ${theme.border}`,
                              fontSize: '0.67rem',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                            }}
                          >
                            <RoleIcon size={11} /> {theme.label}
                          </span>
                          {user.role === 'shop_owner' && userShop && (
                            <div
                              style={{
                                fontSize: '0.6875rem',
                                color: TEAL,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                marginTop: '0.2rem',
                                maxWidth: '180px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={userShop.shopName}
                            >
                              <Store size={10} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {userShop.shopName}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 3. Contact */}
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {user.contactNumber ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: NAVY, fontWeight: 600 }}>
                              <Phone size={12} color="#64748B" />
                              <span>{user.contactNumber}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>

                        {/* 4. Account Standing */}
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.15rem 0.55rem',
                                borderRadius: '999px',
                                background: isActive ? '#ECFDF5' : '#FEF2F2',
                                color: isActive ? '#065F46' : RED,
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                border: `1px solid ${isActive ? '#A7F3D0' : '#FECACA'}`,
                              }}
                            >
                              • {isActive ? 'Active' : 'Suspended'}
                            </span>
                            {!isActive && user.deactivationReason && (
                              <div
                                style={{
                                  fontSize: '0.65rem',
                                  color: RED,
                                  marginTop: '0.15rem',
                                  maxWidth: '160px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={user.deactivationReason}
                              >
                                Reason: {user.deactivationReason}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. Platform Footprint */}
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {user.role === 'customer' ? (
                            <span style={{ fontSize: '0.73rem', color: GRAY }}>
                              <strong style={{ color: NAVY }}>{user.activity?.totalRequests || 0}</strong> orders
                            </span>
                          ) : user.role === 'shop_owner' && userShop ? (
                            <span style={{ fontSize: '0.73rem', color: TEAL, fontWeight: 700 }}>
                              {userShop.status?.toUpperCase()} • {userShop.currentQueue || 0} in queue
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.73rem', color: '#94A3B8' }}>Super Admin</span>
                          )}
                        </td>

                        {/* 6. Registered Date */}
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: GRAY, fontWeight: 600 }}>
                            <Calendar size={12} color="#94A3B8" />
                            <span>{registeredDate}</span>
                          </div>
                        </td>

                        {/* 7. Moderation Actions */}
                        <td style={{ padding: '0.85rem 1.25rem 0.85rem 0.75rem', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectUser(user);
                                setInspectTab('overview');
                              }}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '0.5rem',
                                border: '1px solid #E2E8F0',
                                background: '#F8FAFC',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: NAVY,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#FFFFFF';
                                e.currentTarget.style.borderColor = '#CBD5E1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#F8FAFC';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                              }}
                            >
                              <Eye size={12} color={BLUE} /> Inspect
                            </button>

                            {user.role !== 'admin' && (
                              isActive ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleInitiateSuspend(user, e)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #FDE68A',
                                    background: '#FFFBEB',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: '#B45309',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#FEF3C7';
                                    e.currentTarget.style.borderColor = '#FCD34D';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#FFFBEB';
                                    e.currentTarget.style.borderColor = '#FDE68A';
                                  }}
                                  title="Suspend account"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleReactivate(user, e)}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #A7F3D0',
                                    background: '#ECFDF5',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: '#065F46',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#D1FAE5')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ECFDF5')}
                                  title="Reactivate account"
                                >
                                  Reactivate
                                </button>
                              )
                            )}

                            {user.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmUser(user);
                                }}
                                style={{
                                  padding: '0.35rem 0.45rem',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #FECACA',
                                  background: '#FEF2F2',
                                  color: RED,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#FEE2E2';
                                  e.currentTarget.style.borderColor = '#FCA5A5';
                                  e.currentTarget.style.color = '#B91C1C';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#FEF2F2';
                                  e.currentTarget.style.borderColor = '#FECACA';
                                  e.currentTarget.style.color = RED;
                                }}
                                title="Delete account"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. EXECUTIVE USER PROFILE DOSSIER MODAL                     */}
      {/* ============================================================ */}
      {inspectUser && (() => {
        const theme = ROLE_THEME[inspectUser.role] || ROLE_THEME.customer;
        const RoleIcon = theme.icon;
        const isShopOwner = inspectUser.role === 'shop_owner';
        const ownerShop = isShopOwner ? getShopForUser(inspectUser) : null;
        const isActive = inspectUser.isActive !== false;

        const initials = (inspectUser.name || 'U')
          .trim()
          .split(/\s+/)
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(15, 39, 71, 0.7)',
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
                width: '560px',
                maxWidth: '100%',
                maxHeight: '92vh',
                boxShadow: '0 24px 60px rgba(15, 39, 71, 0.4)',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
                animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Dossier Header Banner */}
              <div
                style={{
                  background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
                  borderBottom: '1px solid #E2E8F0',
                  padding: '1.25rem 1.5rem',
                  position: 'relative',
                }}
              >
                {/* Top Role Color Strip */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: isActive ? theme.gradient : RED,
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '3.25rem',
                        height: '3.25rem',
                        borderRadius: '0.875rem',
                        background: theme.bg,
                        color: theme.color,
                        border: `1.5px solid ${theme.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '1.2rem',
                        boxShadow: '0 2px 8px rgba(6,63,92,0.08)',
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: NAVY, margin: 0, lineHeight: 1.2 }}>
                          {inspectUser.name}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '0.12rem 0.5rem',
                            borderRadius: '999px',
                            background: isActive ? '#ECFDF5' : '#FEF2F2',
                            color: isActive ? '#065F46' : RED,
                            border: `1px solid ${isActive ? '#A7F3D0' : '#FECACA'}`,
                          }}
                        >
                          • {isActive ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: theme.color,
                            textTransform: 'uppercase',
                          }}
                        >
                          <RoleIcon size={12} /> {theme.label}
                        </span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span style={{ fontSize: '0.7rem', color: GRAY }}>
                          Member since{' '}
                          {new Date(inspectUser.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setInspectUser(null)}
                    style={{
                      background: '#F1F5F9',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      color: GRAY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    title="Close inspection"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Dossier Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {[
                    { id: 'overview', label: 'Overview & Profile' },
                    ...(isShopOwner ? [{ id: 'shop', label: 'Printing Shop Details' }] : []),
                    ...(inspectUser.role === 'customer' ? [{ id: 'requests', label: 'Print Activity' }] : []),
                    { id: 'governance', label: 'Account Moderation' },
                  ].map((tab) => {
                    const isTabActive = inspectTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setInspectTab(tab.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.73rem',
                          fontWeight: isTabActive ? 800 : 600,
                          background: isTabActive ? '#101828' : '#F1F5F9',
                          color: isTabActive ? '#FFFFFF' : GRAY,
                          border: isTabActive ? '1px solid #101828' : '1px solid #E2E8F0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dossier Body Content */}
              <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* TAB 1: OVERVIEW */}
                {inspectTab === 'overview' && (
                  <>
                    {!isActive && inspectUser.deactivationReason && (
                      <div
                        style={{
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          padding: '0.75rem 1rem',
                          borderRadius: '0.75rem',
                          fontSize: '0.78rem',
                          color: '#991B1B',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                        }}
                      >
                        <ShieldAlert size={16} color={RED} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 800 }}>Account Suspended by Administrator</div>
                          <div style={{ marginTop: '0.15rem' }}>
                            <strong>Reason:</strong> {inspectUser.deactivationReason}
                          </div>
                          {inspectUser.deactivatedAt && (
                            <div style={{ fontSize: '0.7rem', color: '#B91C1C', marginTop: '0.2rem' }}>
                              Recorded on {new Date(inspectUser.deactivatedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ background: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}>
                      <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Email Address
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                        <span style={{ fontWeight: 800, color: NAVY, fontSize: '0.9rem' }}>{inspectUser.email}</span>
                        <a
                          href={`mailto:${inspectUser.email}`}
                          style={{
                            fontSize: '0.73rem',
                            fontWeight: 700,
                            color: BLUE,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Mail size={12} /> Send Email
                        </a>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}>
                        <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Cellphone Contact
                        </div>
                        <div style={{ fontWeight: 800, color: NAVY, marginTop: '0.2rem', fontSize: '0.85rem' }}>
                          {inspectUser.contactNumber ? (
                            <a href={`tel:${inspectUser.contactNumber}`} style={{ color: NAVY, textDecoration: 'none' }}>
                              {inspectUser.contactNumber}
                            </a>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>Not provided</span>
                          )}
                        </div>
                      </div>
                      <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}>
                        <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Registration Date
                        </div>
                        <div style={{ fontWeight: 800, color: NAVY, marginTop: '0.2rem', fontSize: '0.85rem' }}>
                          {new Date(inspectUser.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}>
                      <div style={{ color: GRAY, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        System Account ID
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#334155', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                        {inspectUser._id}
                      </div>
                    </div>
                  </>
                )}

                {/* TAB 2: SHOP DETAILS (IF SHOP OWNER) */}
                {inspectTab === 'shop' && (
                  <div>
                    {ownerShop ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Shop Header Card */}
                        <div
                          style={{
                            background: '#F0FDFA',
                            border: '1px solid #99F6E4',
                            borderRadius: '0.875rem',
                            padding: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: NAVY }}>
                                {ownerShop.shopName}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: GRAY, fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                <MapPin size={13} color="#0F766E" />
                                <span>{ownerShop.address || 'Not provided'}</span>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.6rem',
                                borderRadius: '999px',
                                background: ownerShop.verificationStatus === 'verified' ? '#ECFDF5' : '#FFFBEB',
                                color: ownerShop.verificationStatus === 'verified' ? '#065F46' : '#92400E',
                                border: ownerShop.verificationStatus === 'verified' ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                                textTransform: 'uppercase',
                              }}
                            >
                              {ownerShop.verificationStatus || 'Pending'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.85rem' }}>
                            <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #CCFBF1' }}>
                              <div style={{ fontSize: '0.62rem', color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>DTI Registration</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: NAVY, marginTop: '0.1rem' }}>
                                {ownerShop.dtiNumber || 'Not provided'}
                              </div>
                            </div>
                            <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #CCFBF1' }}>
                              <div style={{ fontSize: '0.62rem', color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Mayor's Permit</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: NAVY, marginTop: '0.1rem' }}>
                                {ownerShop.mayorsPermitNumber || 'Not provided'}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #CCFBF1' }}>
                              <div style={{ fontSize: '0.62rem', color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Customer Rating</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#D97706', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                                <Star size={12} fill="#D97706" color="#D97706" />
                                <span>{ownerShop.rating ? Number(ownerShop.rating).toFixed(1) : '5.0'}</span>
                                <span style={{ color: GRAY, fontWeight: 500, fontSize: '0.7rem' }}>({ownerShop.reviewsCount || 0})</span>
                              </div>
                            </div>
                            <div style={{ background: '#FFFFFF', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #CCFBF1' }}>
                              <div style={{ fontSize: '0.62rem', color: GRAY, fontWeight: 700, textTransform: 'uppercase' }}>Active Queue</div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: NAVY, marginTop: '0.1rem' }}>
                                {ownerShop.currentQueue || 0} in queue ({ownerShop.activeJobs || 0} printing)
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setInspectUser(null);
                              navigate('/admin/shops');
                            }}
                            style={{
                              width: '100%',
                              marginTop: '0.85rem',
                              padding: '0.55rem',
                              borderRadius: '0.5rem',
                              background: '#FFFFFF',
                              border: '1.5px solid #0F766E',
                              color: '#0F766E',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.4rem',
                            }}
                          >
                            <Store size={14} /> Open in Shop Management <ExternalLink size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '2rem', textAlign: 'center', color: GRAY }}>
                        <Store size={32} color="#94A3B8" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontWeight: 800, color: NAVY, fontSize: '0.9rem' }}>No Shop Record Found</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          This user is registered as a Shop Owner but has not yet registered a printing shop.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: CUSTOMER PRINT ACTIVITY */}
                {inspectTab === 'requests' && (
                  <div>
                    {loadingUserRequests ? (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontSize: '0.75rem', color: GRAY }}>Fetching print orders…</div>
                      </div>
                    ) : userRequests.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2.5rem', color: GRAY }}>
                        <ShoppingBag size={32} color="#CBD5E1" style={{ margin: '0 auto 0.5rem' }} />
                        <div style={{ fontWeight: 800, color: NAVY, fontSize: '0.9rem' }}>No Print Orders Yet</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          This customer has not submitted any printing requests on PrintDayon.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Recent Orders ({userRequests.length})
                        </div>
                        {userRequests.map((req) => (
                          <div
                            key={req._id}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '0.625rem',
                              padding: '0.65rem 0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.75rem',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 800, color: NAVY }}>
                                {req.shopId?.shopName || 'Printing Shop'}
                              </div>
                              <div style={{ color: GRAY, fontSize: '0.68rem', marginTop: '0.1rem' }}>
                                {req.documentId?.originalFilename || 'Document'} • {new Date(req.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '0.12rem 0.5rem',
                                borderRadius: '4px',
                                background: req.status === 'completed' ? '#ECFDF5' : req.status === 'rejected' ? '#FEF2F2' : '#EFF6FF',
                                color: req.status === 'completed' ? '#065F46' : req.status === 'rejected' ? RED : BLUE,
                                textTransform: 'uppercase',
                              }}
                            >
                              {req.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: ACCOUNT MODERATION CONTROLS */}
                {inspectTab === 'governance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontWeight: 800, color: NAVY, fontSize: '0.85rem' }}>Account Status & Moderation</div>
                      <p style={{ fontSize: '0.73rem', color: GRAY, margin: '0.25rem 0 0.75rem' }}>
                        Restricting an account prevents the user from logging in or placing/receiving print orders.
                      </p>

                      {inspectUser.role !== 'admin' ? (
                        isActive ? (
                          <button
                            type="button"
                            onClick={() => handleInitiateSuspend(inspectUser)}
                            style={{
                              padding: '0.5rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              color: '#B45309',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                            }}
                          >
                            <UserX size={14} color="#D97706" /> Suspend Account with Reason
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivate(inspectUser)}
                            style={{
                              padding: '0.5rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              color: '#065F46',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                            }}
                          >
                            <CheckCircle2 size={14} /> Reactivate Account to Good Standing
                          </button>
                        )
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: GRAY, fontStyle: 'italic' }}>
                          Super administrator accounts cannot be suspended or deleted from this panel.
                        </div>
                      )}
                    </div>

                    {inspectUser.role !== 'admin' && (
                      <div style={{ background: '#FEF2F2', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #FECACA' }}>
                        <div style={{ fontWeight: 800, color: RED, fontSize: '0.85rem' }}>Danger Zone: Delete Account</div>
                        <p style={{ fontSize: '0.73rem', color: '#991B1B', margin: '0.25rem 0 0.75rem' }}>
                          Permanently delete this user account. This action cannot be undone.
                        </p>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmUser(inspectUser)}
                          style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: '0.5rem',
                            background: RED,
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <Trash2 size={14} /> Delete Account Permanently
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dossier Footer */}
              <div
                style={{
                  padding: '0.85rem 1.5rem',
                  background: '#F8FAFC',
                  borderTop: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  onClick={() => setInspectUser(null)}
                  style={{
                    padding: '0.45rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: '#101828',
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 5. REASONED SUSPENSION MODAL                                 */}
      {/* ============================================================ */}
      {suspendModalUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 39, 71, 0.7)',
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
              width: '460px',
              maxWidth: '100%',
              boxShadow: '0 24px 60px rgba(15, 39, 71, 0.4)',
              border: '1px solid #FDE68A',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  background: '#FFFBEB',
                  color: '#D97706',
                  border: '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UserX size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: NAVY, margin: 0 }}>
                  Suspend User Account
                </h3>
                <div style={{ fontSize: '0.73rem', color: GRAY, marginTop: '0.1rem' }}>
                  {suspendModalUser.name} ({suspendModalUser.email})
                </div>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.78rem', color: '#334155', margin: 0, lineHeight: 1.4 }}>
                Please specify the reason for suspending this account. This explanation will be logged in the system audit trail and displayed on the account dossier.
              </p>

              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Suspension Reason
                </label>
                <select
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: NAVY,
                    background: '#FFFFFF',
                    outline: 'none',
                  }}
                >
                  <option value="Violation of printing platform terms">Violation of printing platform terms</option>
                  <option value="Spam, abusive, or fake printing requests">Spam, abusive, or fake printing requests</option>
                  <option value="Repeated no-show / unpaid printing pickups">Repeated no-show / unpaid printing pickups</option>
                  <option value="Shop non-compliance or invalid permits">Shop non-compliance or invalid permits</option>
                  <option value="Customer requested account closure">Customer requested account closure</option>
                  <option value="Other (specify below)">Other (specify below)</option>
                </select>
              </div>

              {suspendReason === 'Other (specify below)' && (
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Custom Explanation
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter custom reason for suspension…"
                    value={customSuspendReason}
                    onChange={(e) => setCustomSuspendReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.8rem',
                      color: NAVY,
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ padding: '0.85rem 1.5rem', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSuspendModalUser(null)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: GRAY,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspend}
                disabled={submitting}
                style={{
                  padding: '0.45rem 1.15rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
                }}
              >
                {submitting ? 'Suspending…' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. PERMANENT DELETE CONFIRMATION MODAL                       */}
      {/* ============================================================ */}
      {deleteConfirmUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 39, 71, 0.7)',
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
              width: '420px',
              maxWidth: '100%',
              boxShadow: '0 24px 60px rgba(15, 39, 71, 0.4)',
              border: '1px solid #FECACA',
              padding: '1.5rem',
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div
              style={{
                width: '3.25rem',
                height: '3.25rem',
                borderRadius: '50%',
                background: '#FEF2F2',
                color: RED,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: NAVY, margin: '0 0 0.5rem' }}>
              Permanently Delete Account?
            </h3>
            <p style={{ fontSize: '0.8rem', color: GRAY, margin: '0 0 1.25rem', lineHeight: 1.45 }}>
              Are you sure you want to delete the account for{' '}
              <strong style={{ color: NAVY }}>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})?
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setDeleteConfirmUser(null)}
                style={{
                  flex: 1,
                  height: '40px',
                  borderRadius: '0.5rem',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: GRAY,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={submitting}
                style={{
                  flex: 1,
                  height: '40px',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: RED,
                  color: 'white',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220,38,38,0.3)',
                }}
              >
                {submitting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
