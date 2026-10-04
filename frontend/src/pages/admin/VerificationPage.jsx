import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldCheck, X, Check, Eye, Search, Clock, AlertTriangle,
  Store, User, Phone, Mail, FileText, CheckCircle2, ChevronRight,
  Shield, Building2, MapPin, AlertCircle, RefreshCw, LayoutGrid, Table
} from 'lucide-react';
import api, { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const NAVY = '#101828';
const BLUE = '#465FFF';
const GRAY = '#64748B';

const cardBase = {
  background: '#FFFFFF',
  borderRadius: '1rem',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(6,63,92,0.04)',
};

export default function VerificationPage() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'verified' | 'pending' | 'rejected'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modals
  const [inspectShop, setInspectShop] = useState(null);
  const [actionModal, setActionModal] = useState({ open: false, type: null, shop: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const searchInputRef = useRef(null);

  // Keyboard shortcut '/'
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

  const fetchShops = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await adminAPI.getShops({ limit: 100 });
      const shopList = res.data?.data?.shops || res.data?.shops || [];
      setShops(shopList);
    } catch (err) {
      toast.error('Failed to load shop compliance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Metric counts
  const counts = useMemo(() => {
    const total = shops.length;
    const verified = shops.filter(s => s.verificationStatus === 'verified').length;
    const pending = shops.filter(s => s.verificationStatus === 'pending' || !s.verificationStatus).length;
    const rejected = shops.filter(s => s.verificationStatus === 'rejected' || s.verificationStatus === 'suspended').length;
    return { total, verified, pending, rejected };
  }, [shops]);

  // Filtered shops
  const filtered = useMemo(() => {
    return shops.filter(s => {
      const status = s.verificationStatus || 'pending';
      const matchFilter = filter === 'all'
        ? true
        : filter === 'pending'
          ? (status === 'pending' || !s.verificationStatus)
          : status === filter;

      const q = search.toLowerCase().trim();
      const matchSearch = !q ||
        (s.shopName || '').toLowerCase().includes(q) ||
        (s.ownerId?.name || '').toLowerCase().includes(q) ||
        (s.ownerId?.email || '').toLowerCase().includes(q) ||
        (s.dtiNumber || '').toLowerCase().includes(q) ||
        (s.mayorsPermitNumber || '').toLowerCase().includes(q) ||
        (s.address || '').toLowerCase().includes(q) ||
        (s.landmark || '').toLowerCase().includes(q);

      return matchFilter && matchSearch;
    });
  }, [shops, filter, search]);

  const handleVerifyDirect = async (shopId, status, reason = '') => {
    setActionLoading(true);
    try {
      await adminAPI.verifyShop(shopId, status, reason);
      toast.success(
        status === 'verified'
          ? 'Shop compliance verified and accredited.'
          : 'Shop status updated successfully.'
      );
      await fetchShops(true);
      if (inspectShop && inspectShop._id === shopId) {
        setInspectShop(prev => prev ? { ...prev, verificationStatus: status } : null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update verification status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAction = (type, shop) => {
    setActionModal({ open: true, type, shop });
    setRejectionReason(type === 'reject' ? 'Incomplete or expired 2026 Municipal Business Permit' : '');
  };

  const handleConfirmAction = async () => {
    const { type, shop } = actionModal;
    if (!shop) return;

    if (type === 'reject' && !rejectionReason.trim()) {
      toast.error('Please specify a reason for rejecting compliance.');
      return;
    }

    setActionLoading(true);
    try {
      const newStatus = type === 'approve' ? 'verified' : 'rejected';
      await adminAPI.verifyShop(shop._id, newStatus, rejectionReason.trim());
      toast.success(
        type === 'approve'
          ? `Shop "${shop.shopName}" verified successfully.`
          : `Shop "${shop.shopName}" application rejected.`
      );
      setActionModal({ open: false, type: null, shop: null });
      await fetchShops(true);
      if (inspectShop && inspectShop._id === shop._id) {
        setInspectShop(prev => prev ? { ...prev, verificationStatus: newStatus } : null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSecureView = async (url) => {
    try {
      const toastId = toast.loading('Loading secure document...');
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      window.open(blobUrl, '_blank');
      toast.dismiss(toastId);
    } catch (error) {
      toast.error('Failed to securely load document. You may not have permission.');
      console.error(error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', margin: '0 auto', paddingBottom: '2.5rem' }} className="fade-in">

      {/* 1. TOP METRIC CARDS (CLEAN STATIC KPI SUMMARY) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {[
          {
            label: 'Total Print Shops',
            value: counts.total,
            sub: 'Registered stores in Naval',
            share: '100%',
            icon: Store,
            color: NAVY,
            bg: '#F1F5F9',
            border: '#CBD5E1',
          },
          {
            label: 'Verified & Active',
            value: counts.verified,
            sub: 'Accredited on live map',
            share: counts.total ? `${Math.round((counts.verified / counts.total) * 100)}%` : '0%',
            icon: ShieldCheck,
            color: '#059669',
            bg: '#ECFDF5',
            border: '#A7F3D0',
          },
          {
            label: 'Pending Review',
            value: counts.pending,
            sub: 'Awaiting permit review',
            share: counts.total ? `${Math.round((counts.pending / counts.total) * 100)}%` : '0%',
            icon: Clock,
            color: '#D97706',
            bg: '#FFFBEB',
            border: '#FDE68A',
          },
          {
            label: 'Rejected / Flagged',
            value: counts.rejected,
            sub: 'Declined or non-compliant',
            share: counts.total ? `${Math.round((counts.rejected / counts.total) * 100)}%` : '0%',
            icon: AlertTriangle,
            color: '#DC2626',
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
                    }}
                  >
                    {m.label}
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

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div
        style={{
          ...cardBase,
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.875rem',
        }}
      >
        {/* Open Responsive Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: '1 1 280px', maxWidth: '420px' }}>
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
              placeholder="Search shop, owner, permit number, or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearch('');
                }
              }}
              style={{
                width: '100%',
                height: '38px',
                paddingLeft: '2.25rem',
                paddingRight: search ? '2.25rem' : '0.85rem',
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
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
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

        {/* Right: Filter tabs & neutral Reset pill */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Shops (${counts.total})` },
            { id: 'verified', label: `Verified (${counts.verified})` },
            { id: 'pending', label: `Pending (${counts.pending})` },
            { id: 'rejected', label: `Rejected (${counts.rejected})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              style={{
                height: '36px',
                padding: '0 0.85rem',
                borderRadius: '0.55rem',
                fontSize: '0.78rem',
                fontWeight: filter === t.id ? 700 : 600,
                cursor: 'pointer',
                border: filter === t.id ? '1.5px solid #101828' : '1px solid #E2E8F0',
                background: filter === t.id ? '#101828' : '#FFFFFF',
                color: filter === t.id ? '#FFFFFF' : '#334155',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          ))}

          {(filter !== 'all' || search) && (
            <button
              type="button"
              onClick={() => {
                setFilter('all');
                setSearch('');
              }}
              style={{
                height: '36px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#334155',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                padding: '0 0.85rem',
                borderRadius: '0.55rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
            >
              <X size={13} className="text-slate-400" /> Reset
            </button>
          )}

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
              marginLeft: '0.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
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
                color: viewMode === 'grid' ? NAVY : GRAY,
                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
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
                color: viewMode === 'table' ? NAVY : GRAY,
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Table size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. SHOP COMPLIANCE & VERIFICATION CARDS */}
      {loading ? (
        <div style={{ ...cardBase, padding: '4rem 1rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
          <div style={{ fontSize: '0.8125rem', color: GRAY, fontWeight: 500 }}>
            Loading print shop compliance dossiers…
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardBase, padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <Shield size={36} color={GRAY} style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: NAVY, margin: '0 0 0.25rem' }}>
            No shops match the selected verification criteria
          </h3>
          <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 1rem' }}>
            Try resetting your search query or switching to "All Shops".
          </p>
          <button
            type="button"
            onClick={() => { setFilter('all'); setSearch(''); }}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              background: '#465FFF',
              color: 'white',
              fontSize: '0.78rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filtered.map((shop) => {
            const isVerified = shop.verificationStatus === 'verified';
            const isRejected = shop.verificationStatus === 'rejected' || shop.verificationStatus === 'suspended';
            const isPending = !isVerified && !isRejected;

            return (
              <div
                key={shop._id}
                style={{
                  ...cardBase,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  borderColor: isVerified ? '#BBF7D0' : isRejected ? '#FECACA' : '#FDE68A',
                  boxShadow: '0 2px 8px rgba(6,63,92,0.04)',
                  transition: 'all 0.18s ease',
                }}
              >
                <div>
                  {/* Shop Top Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                      <div
                        style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '0.625rem',
                          background: isVerified ? '#ECFDF5' : '#EFF6FF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isVerified ? '#059669' : '#465FFF',
                          border: `1px solid ${isVerified ? '#A7F3D0' : '#BFDBFE'}`,
                          flexShrink: 0,
                        }}
                      >
                        <Store size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: NAVY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shop.shopName}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: GRAY, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '1px' }}>
                          <MapPin size={11} color="#465FFF" />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {shop.address || shop.landmark || 'Not provided'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: isVerified ? '#ECFDF5' : isRejected ? '#FEF2F2' : '#FFFBEB',
                        color: isVerified ? '#059669' : isRejected ? '#DC2626' : '#D97706',
                        border: `1px solid ${isVerified ? '#A7F3D0' : isRejected ? '#FECACA' : '#FDE68A'}`,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {isVerified ? <CheckCircle2 size={12} /> : isRejected ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {isVerified ? 'Verified' : isRejected ? 'Rejected' : 'Pending'}
                    </span>
                  </div>

                  {/* Compliance & Owner Dossier Box */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      borderRadius: '0.625rem',
                      padding: '0.85rem',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: GRAY }}>Registered Owner:</span>
                      <strong style={{ color: NAVY }}>{shop.ownerId?.name || 'Not provided'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: GRAY }}>Mayor's Permit:</span>
                      <code style={{ background: '#FFFFFF', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '0.72rem', color: '#0F172A', fontWeight: 600 }}>
                        {shop.mayorsPermitNumber || 'Not provided'}
                      </code>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: GRAY }}>DTI Registration:</span>
                      <code style={{ background: '#FFFFFF', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '0.72rem', color: '#0F172A', fontWeight: 600 }}>
                        {shop.dtiNumber || 'Not provided'}
                      </code>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: GRAY }}>LGU Jurisdiction:</span>
                      <span style={{ color: NAVY, fontWeight: 600 }}>Naval, Biliran Province</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: GRAY }}>Contact & Payout:</span>
                      <span style={{ color: NAVY, fontWeight: 600 }}>{shop.gcashNumber || shop.contactNumber || shop.ownerId?.contactNumber || 'Not provided'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
                  {!isVerified ? (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleVerifyDirect(shop._id, 'verified')}
                      style={{
                        flex: 1,
                        height: '34px',
                        borderRadius: '0.5rem',
                        background: '#059669',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 1px 3px rgba(5,150,105,0.2)',
                      }}
                    >
                      <ShieldCheck size={14} /> Approve Store
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleOpenAction('revoke', shop)}
                      style={{
                        flex: 1,
                        height: '34px',
                        borderRadius: '0.5rem',
                        background: '#F8FAFC',
                        color: '#475569',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <AlertTriangle size={13} color="#D97706" /> Re-evaluate
                    </button>
                  )}

                  {!isRejected && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleOpenAction('reject', shop)}
                      style={{
                        height: '34px',
                        padding: '0 0.75rem',
                        borderRadius: '0.5rem',
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <X size={13} /> Reject
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setInspectShop(shop)}
                    style={{
                      height: '34px',
                      padding: '0 0.85rem',
                      borderRadius: '0.5rem',
                      background: '#F1F5F9',
                      color: NAVY,
                      border: '1px solid #E2E8F0',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Eye size={13} /> Inspect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div
          style={{
            ...cardBase,
            overflowX: 'auto',
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
                <th style={{ padding: '0.85rem 1rem 0.85rem 1.25rem', fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Print Shop
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Registered Owner
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Mayor's Permit / DTI
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Contact &amp; Payout
                </th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Status
                </th>
                <th style={{ padding: '0.85rem 1.25rem 0.85rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((shop) => {
                const isVerified = shop.verificationStatus === 'verified';
                const isRejected = shop.verificationStatus === 'rejected' || shop.verificationStatus === 'suspended';
                const isPending = !isVerified && !isRejected;

                return (
                  <tr
                    key={shop._id}
                    style={{
                      borderBottom: '1px solid #E2E8F0',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {/* Print Shop */}
                    <td style={{ padding: '0.85rem 1rem 0.85rem 1.25rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: '2.25rem',
                            height: '2.25rem',
                            borderRadius: '0.5rem',
                            background: isVerified ? '#ECFDF5' : '#EFF6FF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isVerified ? '#059669' : '#465FFF',
                            border: `1px solid ${isVerified ? '#A7F3D0' : '#BFDBFE'}`,
                            flexShrink: 0,
                          }}
                        >
                          <Store size={15} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: NAVY, fontSize: '0.875rem' }}>
                            {shop.shopName}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: GRAY, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '1px' }}>
                            <MapPin size={11} color="#465FFF" />
                            <span>{shop.address || shop.landmark || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Owner */}
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: NAVY }}>
                        {shop.ownerId?.name || 'Not provided'}
                      </div>
                      {shop.ownerId?.email && (
                        <div style={{ fontSize: '0.7rem', color: GRAY, marginTop: '2px' }}>
                          {shop.ownerId.email}
                        </div>
                      )}
                    </td>

                    {/* Mayor's Permit / DTI */}
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.65rem', color: GRAY, fontWeight: 600 }}>MP:</span>
                          <code style={{ background: '#F8FAFC', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '0.7rem', color: '#0F172A', fontWeight: 600 }}>
                            {shop.mayorsPermitNumber || 'Not provided'}
                          </code>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.65rem', color: GRAY, fontWeight: 600 }}>DTI:</span>
                          <code style={{ background: '#F8FAFC', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '0.7rem', color: '#0F172A', fontWeight: 600 }}>
                            {shop.dtiNumber || 'Not provided'}
                          </code>
                        </div>
                      </div>
                    </td>

                    {/* Contact & Payout */}
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: NAVY, fontSize: '0.78rem' }}>
                        {shop.gcashNumber || shop.contactNumber || shop.ownerId?.contactNumber || 'Not provided'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: GRAY, marginTop: '2px' }}>
                        Naval, Biliran Province
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          background: isVerified ? '#ECFDF5' : isRejected ? '#FEF2F2' : '#FFFBEB',
                          color: isVerified ? '#059669' : isRejected ? '#DC2626' : '#D97706',
                          border: `1px solid ${isVerified ? '#A7F3D0' : isRejected ? '#FECACA' : '#FDE68A'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {isVerified ? <CheckCircle2 size={11} /> : isRejected ? <AlertTriangle size={11} /> : <Clock size={11} />}
                        {isVerified ? 'Verified' : isRejected ? 'Rejected' : 'Pending'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1.25rem 0.85rem 1rem', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {!isVerified ? (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleVerifyDirect(shop._id, 'verified')}
                            style={{
                              height: '30px',
                              padding: '0 0.65rem',
                              borderRadius: '0.375rem',
                              background: '#059669',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <ShieldCheck size={12} /> Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleOpenAction('revoke', shop)}
                            style={{
                              height: '30px',
                              padding: '0 0.6rem',
                              borderRadius: '0.375rem',
                              background: '#F8FAFC',
                              color: '#475569',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <AlertTriangle size={12} color="#D97706" /> Re-evaluate
                          </button>
                        )}

                        {!isRejected && (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleOpenAction('reject', shop)}
                            style={{
                              height: '30px',
                              padding: '0 0.6rem',
                              borderRadius: '0.375rem',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              border: '1px solid #FECACA',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <X size={12} /> Reject
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setInspectShop(shop)}
                          style={{
                            height: '30px',
                            padding: '0 0.65rem',
                            borderRadius: '0.375rem',
                            background: '#F1F5F9',
                            color: NAVY,
                            border: '1px solid #E2E8F0',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Eye size={12} color="#465FFF" /> Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. ACTION MODAL (REJECT / REVOKE WITH REASON) */}
      {actionModal.open && actionModal.shop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 27, 60, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '1rem',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} color="#DC2626" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                  {actionModal.type === 'reject' ? 'Reject Store Application' : 'Revoke Verification'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionModal({ open: false, type: null, shop: null })}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: GRAY }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: GRAY, lineHeight: 1.45, margin: '0 0 1rem' }}>
              Specify the compliance reason for rejecting or revoking verification for <strong>{actionModal.shop.shopName}</strong>. The owner will be notified to correct or resubmit documents.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: NAVY, marginBottom: '0.35rem' }}>
                Reason for Rejection:
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Expired 2025 Mayor's Permit, please upload valid 2026 renewal certificate..."
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  color: '#0F172A',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
              <button
                type="button"
                onClick={() => setActionModal({ open: false, type: null, shop: null })}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  color: '#475569',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmAction}
                style={{
                  padding: '0.5rem 1.15rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {actionLoading ? 'Processing…' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. INSPECT DOSSIER MODAL */}
      {inspectShop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 27, 60, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '1rem',
              maxWidth: '540px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    background: inspectShop.verificationStatus === 'verified' ? '#ECFDF5' : '#FFFBEB',
                    color: inspectShop.verificationStatus === 'verified' ? '#059669' : '#D97706',
                    border: `1px solid ${inspectShop.verificationStatus === 'verified' ? '#A7F3D0' : '#FDE68A'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    marginBottom: '0.35rem',
                  }}
                >
                  <ShieldCheck size={12} /> Status: {inspectShop.verificationStatus || 'Pending'}
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: NAVY, margin: 0 }}>
                  {inspectShop.shopName}
                </h3>
                <div style={{ fontSize: '0.75rem', color: GRAY, marginTop: '2px' }}>
                  {inspectShop.address || inspectShop.landmark || 'Not provided'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectShop(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: GRAY }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.8125rem' }}>
              <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '0.625rem', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                  Business Compliance Identification
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: GRAY }}>Mayor's Business Permit:</span>
                    <div style={{ fontWeight: 700, color: NAVY }}>{inspectShop.mayorsPermitNumber || 'Not provided'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: GRAY }}>DTI Registration:</span>
                    <div style={{ fontWeight: 700, color: NAVY }}>{inspectShop.dtiNumber || 'Not provided'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: GRAY }}>LGU Jurisdiction:</span>
                    <div style={{ fontWeight: 700, color: NAVY }}>Naval, Biliran</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: GRAY }}>Operational Hours:</span>
                    <div style={{ fontWeight: 700, color: NAVY }}>
                      {inspectShop.operatingHours && inspectShop.operatingHours.length > 0 
                        ? `${inspectShop.operatingHours[0].open} - ${inspectShop.operatingHours[0].close}` 
                        : 'Not provided'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '0.625rem', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                  Uploaded Verification Documents
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: GRAY }}>Storefront Photo:</span>
                    {inspectShop.storefrontPhotoUrl ? <a href={inspectShop.storefrontPhotoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#465FFF', textDecoration: 'none' }}>View Image</a> : <span style={{ fontSize: '0.75rem', color: GRAY }}>Not provided</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: GRAY }}>Mayor's Permit Document:</span>
                    {inspectShop.permitDocUrl ? <button onClick={() => handleSecureView(inspectShop.permitDocUrl)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 600, color: '#465FFF', textDecoration: 'none' }}>View Document</button> : <span style={{ fontSize: '0.75rem', color: GRAY }}>Not provided</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: GRAY }}>DTI Document:</span>
                    {inspectShop.dtiDocUrl ? <button onClick={() => handleSecureView(inspectShop.dtiDocUrl)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.75rem', fontWeight: 600, color: '#465FFF', textDecoration: 'none' }}>View Document</button> : <span style={{ fontSize: '0.75rem', color: GRAY }}>Not provided</span>}
                  </div>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '0.85rem', borderRadius: '0.625rem', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                  Ownership & Contact Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: GRAY }}>Owner Name:</span>
                    <strong style={{ color: NAVY }}>{inspectShop.ownerId?.name || 'Not provided'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: GRAY }}>Email Address:</span>
                    <span style={{ color: NAVY }}>{inspectShop.ownerId?.email || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: GRAY }}>Mobile / Phone:</span>
                    <span style={{ color: NAVY }}>{inspectShop.contactNumber || inspectShop.ownerId?.contactNumber || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: GRAY }}>GCash Account:</span>
                    <span style={{ color: NAVY }}>{inspectShop.gcashNumber ? `${inspectShop.gcashNumber} (${inspectShop.gcashName || 'Registered'})` : 'Not provided yet'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {inspectShop.verificationStatus !== 'verified' && (
                <button
                  type="button"
                  onClick={() => handleVerifyDirect(inspectShop._id, 'verified')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    background: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Approve &amp; Verify Now
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectShop(null)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#F1F5F9',
                  color: NAVY,
                  border: '1px solid #E2E8F0',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
