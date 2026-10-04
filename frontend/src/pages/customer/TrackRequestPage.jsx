import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { requestAPI, documentAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  MapPin, Clock, Printer, Package, CheckCircle2, XCircle, ArrowLeft,
  RefreshCw, FileText, ShieldCheck, Trash2, Star, Zap, Ticket, Copy,
  AlertTriangle, Check, ExternalLink, Sparkles, Car, MessageSquare,
  Eye, Upload, CreditCard, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import ShopFacadeImage from '../../components/common/ShopFacadeImage';

const STATUSES = ['pending', 'accepted', 'queued', 'printing', 'ready', 'picked_up', 'completed'];

const STATUS_PROGRESS = {
  pending: 15,
  submitted: 15,
  accepted: 30,
  queued: 45,
  printing: 65,
  ready: 80,
  ready_for_pickup: 80,
  picked_up: 90,
  completed: 100,
  rejected: 0,
  cancelled: 0,
  on_hold: 40,
};

const STATUS_INFO = {
  pending: { label: 'Submitted', icon: Clock, color: '#92400E', bg: '#FEF7E8', border: '#FDE3A7', desc: 'Order placed online and waiting for shop review.' },
  submitted: { label: 'Submitted', icon: Clock, color: '#92400E', bg: '#FEF7E8', border: '#FDE3A7', desc: 'Order placed online and waiting for shop review.' },
  accepted: { label: 'Accepted', icon: CheckCircle2, color: '#465FFF', bg: 'rgba(70, 95, 255, 0.08)', border: 'rgba(70, 95, 255, 0.25)', desc: 'Request accepted! Shop is prepping your print job.' },
  queued: { label: 'Order in Queue', icon: FileText, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', desc: 'Your document is in line in the active printing queue.' },
  printing: { label: 'Printing Started', icon: Printer, color: '#465FFF', bg: '#E0F2FE', border: '#BAE6FD', desc: 'Your document is actively running on the printer right now!' },
  ready: { label: 'Ready for Pickup', icon: Package, color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC', desc: 'Printing complete! Head over to the counter to collect.' },
  ready_for_pickup: { label: 'Ready for Pickup', icon: Package, color: '#16A34A', bg: '#DCFCE7', border: '#86EFAC', desc: 'Printing complete! Head over to the counter to collect.' },
  picked_up: { label: 'Picked Up', icon: Package, color: '#0D9488', bg: '#CCFBF1', border: '#99F6E4', desc: 'Documents have been received by the customer.' },
  completed: { label: 'Completed', icon: CheckCircle2, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1', desc: 'Order fulfilled and received successfully.' },
  rejected: { label: 'Order Declined', icon: XCircle, color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', desc: 'Your request was declined by the printing shop.' },
  cancelled: { label: 'Order Cancelled', icon: AlertTriangle, color: '#EA580C', bg: '#FFEDD5', border: '#FED7AA', desc: 'This order was cancelled.' },
  on_hold: { label: 'Order On Hold', icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', desc: 'Your order is temporarily on hold. Check shop notes or contact the shop.' },
};

export default function TrackRequestPage() {
  const { id } = useParams();
  const { socket } = useSocket() || {};
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [purging, setPurging] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const fetchRequest = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await requestAPI.getById(id);
      setRequest(res.data?.data ?? null);
    } catch (err) {
      console.error('Failed to load tracking details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  const handleUploadTrackProof = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      return toast.error('Please upload an image screenshot (JPG, PNG, or WEBP).');
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      return toast.error('File size must be under 10MB.');
    }

    setIsUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('proof', selectedFile);
      const upRes = await requestAPI.uploadPaymentProof(formData);
      const proofUrl = upRes.data?.proofUrl;
      if (proofUrl) {
        await requestAPI.attachPaymentProof(id, { paymentProofUrl: proofUrl });
        toast.success('Payment receipt attached! Shop has been notified.');
        fetchRequest(true);
      }
    } catch (err) {
      toast.error('Failed to attach proof. Please try again.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  useEffect(() => {
    if (!socket || !request) return;
    const events = [
      'request:accepted', 'request:queued', 'request:printing',
      'request:ready', 'request:completed', 'request:rejected', 'request:cancelled',
      'request:on_hold',
      'request:note_added', 'request:delay_alert', 'request:delay_cleared',
      'request:queue_recalculated', 'queue:recalculated',
    ];
    const handler = (data) => {
      if (data?.requestId === id || data?.relatedRequestId === id) {
        if (data.status || data.queuePosition !== undefined) {
          setRequest((prev) => prev ? {
            ...prev,
            status: data.status || prev.status,
            queuePosition: data.queuePosition !== undefined ? data.queuePosition : prev.queuePosition,
            printerChannel: data.printerChannel || prev.printerChannel,
            estimatedWaitingTime: data.estimatedWaitingTime !== undefined ? data.estimatedWaitingTime : prev.estimatedWaitingTime,
          } : null);
        }
        fetchRequest(true);
      } else if (data?.shopId && data.shopId === (request.shopId?._id || request.shopId)) {
        fetchRequest(true);
      }
    };
    events.forEach((e) => socket.on(e, handler));
    return () => events.forEach((e) => socket.off(e, handler));
  }, [socket, id, request?._id, request?.shopId, fetchRequest]);

  const handlePurgeDocument = async () => {
    if (!request?.documentId?._id) return;
    if (!confirm('Permanently wipe this file from storage for data privacy? This cannot be undone.')) return;
    setPurging(true);
    try {
      await documentAPI.delete(request.documentId._id);
      toast.success('File permanently wiped from server storage.');
      await fetchRequest(true);
    } catch (err) {
      toast.error(err.message || 'Failed to purge document.');
    } finally {
      setPurging(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this print order?')) return;
    setCancelling(true);
    try {
      await requestAPI.cancel(id);
      toast.success('Print request cancelled.');
      await fetchRequest(true);
    } catch (err) {
      toast.error(err.message || 'Failed to cancel request.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!request) {
    return (
      <div style={{ maxWidth: '640px', margin: '3rem auto', padding: '2.5rem 1.5rem', textAlign: 'center', background: 'white', borderRadius: '1.25rem', border: '1.5px solid #CBD5E1' }}>
        <AlertTriangle size={42} color="#F59E0B" style={{ margin: '0 auto 0.75rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>Print Request Not Found</h2>
        <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0.5rem 0 1.5rem' }}>This order may have expired, been deleted, or does not exist.</p>
        <Link to="/my-requests" className="btn btn-primary" style={{ padding: '0.6rem 1.4rem', fontWeight: 800 }}>
          View All Requests
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[request.status] || STATUS_INFO.pending;
  const StatusIcon = statusInfo.icon || Clock;
  const currentStatusIndex = STATUSES.indexOf(request.status);
  const isTerminal = ['completed', 'rejected', 'cancelled'].includes(request.status);
  const isCancellable = ['pending', 'accepted', 'queued'].includes(request.status);
  const doc = request.documentId;
  const isDocPurged = doc?.isDeletedFromStorage;
  const claimCode = request.claimCode || `PD-${request._id?.slice(-4).toUpperCase()}`;
  const orderCode = request._id ? `PR-${request._id.slice(-5).toUpperCase()}` : 'PR-ORDER';
  const progressPercent = STATUS_PROGRESS[request.status] || 20;

  return (
    <div className="w-full pb-14 font-outfit">
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to="/my-requests"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '0.55rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'white',
              border: '1.5px solid #CBD5E1',
              color: '#0F172A',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            title="Back to My Requests"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
                Track Order
              </h1>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', background: '#F1F5F9', padding: '0.15rem 0.5rem', borderRadius: '0.4rem', border: '1px solid #CBD5E1' }}>
                {orderCode}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.15rem 0 0 0' }}>
              Real-time progress, queue status, and counter pickup ticket
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchRequest(false)}
          disabled={refreshing}
          style={{
            height: '36px',
            padding: '0 0.85rem',
            borderRadius: '0.55rem',
            background: 'white',
            border: '1.5px solid #CBD5E1',
            color: '#334155',
            fontSize: '0.775rem',
            fontWeight: 700,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Syncing...' : 'Sync Live'}
        </button>
      </div>

      {request.delayNotice?.isDelayed && (
        <div style={{
          background: '#FEF3C7',
          border: '1.5px solid #F59E0B',
          borderRadius: '0.875rem',
          padding: '1.1rem 1.25rem',
          marginBottom: '1.25rem',
          boxShadow: '0 2px 12px rgba(245, 158, 11, 0.12)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '0.65rem',
            background: '#F59E0B',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
          }}>
            <Zap size={22} className="animate-pulse" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#92400E' }}>
                  Electrical Power Outage / Delay Notice from {request.shopId?.shopName || 'Shop'}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: '#FDE68A',
                  color: '#78350F',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '0.35rem',
                }}>
                  Live Warning
                </span>
              </div>
              {request.delayNotice.estimatedDelayMinutes > 0 && (
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B45309', background: 'white', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #FDE68A' }}>
                  Estimated Delay: ~{request.delayNotice.estimatedDelayMinutes} mins
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#78350F', margin: '0.35rem 0 0 0', fontWeight: 600, lineHeight: 1.45 }}>
              "{request.delayNotice.reason}"
            </p>
            <div style={{ fontSize: '0.725rem', color: '#92400E', marginTop: '0.4rem', opacity: 0.9 }}>
              Printing will automatically proceed as soon as electricity is restored in Naval. Your queue position is securely held.
            </div>
          </div>
        </div>
      )}

      {(() => {
        const docIssueNote = (request.shopNotes || []).slice().reverse().find(n => n.category === 'file_issue' || n.category === 'layout_issue');
        if (!docIssueNote) return null;
        const isFileCorrupt = docIssueNote.category === 'file_issue';

        return (
          <div style={{
            background: isFileCorrupt ? '#FEF2F2' : '#FFFBEB',
            border: `1.5px solid ${isFileCorrupt ? '#FCA5A5' : '#FCD34D'}`,
            borderRadius: '0.875rem',
            padding: '1.1rem 1.25rem',
            marginBottom: '1.25rem',
            boxShadow: '0 2px 12px rgba(220, 38, 38, 0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.65rem',
              background: isFileCorrupt ? '#DC2626' : '#D97706',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {isFileCorrupt ? <FileText size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: isFileCorrupt ? '#991B1B' : '#92400E' }}>
                  {isFileCorrupt ? 'Action Required: Issue with Uploaded Document File' : 'Formatting / Margin Notice from Print Shop'}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  background: isFileCorrupt ? '#FEE2E2' : '#FEF3C7',
                  color: isFileCorrupt ? '#991B1B' : '#78350F',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '0.35rem',
                }}>
                  Shop Notice
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: isFileCorrupt ? '#7F1D1D' : '#78350F', margin: '0.35rem 0 0.5rem 0', fontWeight: 600, lineHeight: 1.45 }}>
                "{docIssueNote.message}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {request.shopId?.contactNumber && (
                  <a
                    href={`tel:${request.shopId.contactNumber}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#465FFF',
                      textDecoration: 'none',
                      background: 'white',
                      border: '1px solid #CBD5E1',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.45rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    Call Shop: {request.shopId.contactNumber}
                  </a>
                )}
                {isCancellable && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#DC2626',
                      background: 'white',
                      border: '1px solid #FECACA',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.45rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel Order to Re-upload
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="track-page-grid">

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div style={{
            background: 'white',
            borderRadius: '0.875rem',
            padding: '1.25rem 1.35rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '0.625rem',
                  background: statusInfo.bg,
                  border: `1px solid ${statusInfo.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <StatusIcon size={22} color={statusInfo.color} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0F172A', margin: 0 }}>
                      {statusInfo.label}
                    </h2>
                    {!isTerminal && (
                      <span className="badge-premium-sky">
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#465FFF' }} />
                        Live
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: '#475569', marginTop: '0.15rem' }}>
                    {statusInfo.desc}
                  </div>
                </div>
              </div>

              <div style={{
                textAlign: 'right',
                background: '#F8FAFC',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                border: '1px solid #E2E8F0',
              }}>
                <div style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Fulfillment</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#465FFF' }}>{progressPercent}%</div>
              </div>
            </div>

            <div style={{
              width: '100%',
              height: '5px',
              background: '#F1F5F9',
              borderRadius: '999px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: isTerminal && request.status !== 'completed' ? '#DC2626' : '#465FFF',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '0.875rem',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#465FFF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Ticket size={15} color="#465FFF" /> Grab &amp; Go Counter Claim Code
              </div>

              <span style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                background: request.paymentStatus === 'verified' ? '#DCFCE7' : (request.paymentStatus === 'paid_verifying' || request.paymentProofUrl || request.paymentRefNumber) ? '#EFF6FF' : '#F1F5F9',
                color: request.paymentStatus === 'verified' ? '#15803D' : (request.paymentStatus === 'paid_verifying' || request.paymentProofUrl || request.paymentRefNumber) ? '#1D4ED8' : '#475569',
                padding: '0.2rem 0.65rem',
                borderRadius: '999px',
                border: `1px solid ${request.paymentStatus === 'verified' ? '#86EFAC' : (request.paymentStatus === 'paid_verifying' || request.paymentProofUrl || request.paymentRefNumber) ? '#BFDBFE' : '#E2E8F0'}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                {request.paymentStatus === 'verified' ? (
                  <><Check size={12} strokeWidth={3} /> Paid &amp; Verified</>
                ) : (request.paymentStatus === 'paid_verifying' || request.paymentProofUrl || request.paymentRefNumber) ? (
                  <><Clock size={12} /> Payment Verifying</>
                ) : (
                  'Awaiting Verification'
                )}
              </span>
            </div>

            <div style={{
              background: '#F8FAFC',
              borderRadius: '0.75rem',
              padding: '1rem 1.15rem',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '1px', fontFamily: 'monospace', lineHeight: 1 }}>
                    {claimCode}
                  </span>
                  {request.isRush && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: '#D97706',
                      color: 'white',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 8px rgba(245,158,11,0.25)',
                    }}>
                      <Zap size={12} className="fill-white" /> RUSH
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(claimCode);
                      toast.success('Claim code copied to clipboard');
                    }}
                    className="btn-premium-secondary !py-1 !px-2 !text-xs flex items-center gap-1"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.35rem' }}>
                  Show this code to shop staff for fast, zero-wait collection
                </div>
              </div>

              <div style={{
                textAlign: 'right',
                background: 'white',
                padding: '0.45rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #E2E8F0',
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#465FFF' }}>
                  ~{request.timeSavedMinutes || 12} min
                </div>
                <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Zap size={12} color="#465FFF" /> Time Saved vs Queue
                </div>
              </div>
            </div>

            {(!isTerminal && (request.queuePosition || request.status === 'accepted' || request.status === 'queued' || request.status === 'printing')) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: '#F8FAFC', borderRadius: '0.625rem', padding: '0.75rem 0.85rem', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.675rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Queue Position</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#465FFF', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {request.status === 'printing' ? (
                      <span style={{ color: '#0284C7', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Printer size={16} className="animate-pulse" /> Active on Printer
                      </span>
                    ) : request.queuePosition ? (
                      <>#{request.queuePosition} in line</>
                    ) : (
                      'Preparing'
                    )}
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', borderRadius: '0.625rem', padding: '0.75rem 0.85rem', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.675rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Est. Wait Time</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#465FFF', marginTop: '0.15rem' }}>
                    ~{request.estimatedWaitingTime !== undefined ? request.estimatedWaitingTime : (request.estimatedCompletionTime || 5)}m
                  </div>
                </div>

                <div style={{
                  background: (request.printerChannel === 'color_inkjet' || request.printingSpecifications?.colorMode === 'color') ? '#F5F3FF' : '#F0FDF4',
                  borderRadius: '0.625rem',
                  padding: '0.75rem 0.85rem',
                  border: `1px solid ${(request.printerChannel === 'color_inkjet' || request.printingSpecifications?.colorMode === 'color') ? '#DDD6FE' : '#BBF7D0'}`,
                }}>
                  <div style={{ fontSize: '0.675rem', fontWeight: 600, color: (request.printerChannel === 'color_inkjet' || request.printingSpecifications?.colorMode === 'color') ? '#6D28D9' : '#15803D', textTransform: 'uppercase' }}>Hardware Line</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: (request.printerChannel === 'color_inkjet' || request.printingSpecifications?.colorMode === 'color') ? '#5B21B6' : '#166534', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span>{(request.printerChannel === 'color_inkjet' || request.printingSpecifications?.colorMode === 'color') ? '' : ''}</span>
                    {(request.printerChannel === 'color_inkjet' || request.printingSpecifications?.colorMode === 'color') ? 'Color Inkjet' : 'B&W Laser'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {request.shopNotes && request.shopNotes.length > 0 && (
            <div style={{
              background: 'white',
              borderRadius: '0.875rem',
              padding: '1.25rem',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '0.5rem', background: 'rgba(70, 95, 255, 0.08)', color: '#465FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={15} />
                  </div>
                  <h3 style={{ fontSize: '0.925rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Messages from {request.shopId?.shopName || 'Print Shop'}
                  </h3>
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '0.15rem 0.5rem', borderRadius: '0.35rem' }}>
                  {request.shopNotes.length} notice{request.shopNotes.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {request.shopNotes.map((note, idx) => {
                  const isOutage = note.category === 'power_outage';
                  const isFileErr = note.category === 'file_issue' || note.category === 'layout_issue';
                  return (
                    <div key={idx} style={{
                      padding: '0.75rem',
                      borderRadius: '0.625rem',
                      background: isOutage ? '#FFFBEB' : isFileErr ? '#FEF2F2' : '#F8FAFC',
                      border: `1px solid ${isOutage ? '#FDE68A' : isFileErr ? '#FECACA' : '#E2E8F0'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: isOutage ? '#92400E' : isFileErr ? '#991B1B' : '#465FFF',
                          background: isOutage ? '#FEF3C7' : isFileErr ? '#FEE2E2' : 'rgba(70, 95, 255, 0.08)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '0.3rem',
                        }}>
                          {note.category?.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: '0.675rem', color: '#94A3B8' }}>
                          {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#1E293B', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                        {note.message}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!['rejected', 'cancelled'].includes(request.status) && (
            <div style={{
              background: 'white',
              borderRadius: '0.875rem',
              padding: '1.25rem 1.35rem',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#465FFF', margin: '0 0 1.25rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Order Fulfillment Progress
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {STATUSES.map((status, idx) => {
                  const info = STATUS_INFO[status];
                  const done = idx < currentStatusIndex;
                  const active = idx === currentStatusIndex;

                  return (
                    <div key={status} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', paddingBottom: idx < STATUSES.length - 1 ? '1.25rem' : '0', position: 'relative' }}>
                      {idx < STATUSES.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: '13px',
                          top: '26px',
                          width: '2px',
                          height: 'calc(100% - 8px)',
                          background: done ? '#465FFF' : '#E2E8F0',
                        }} />
                      )}

                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: done ? '#465FFF' : active ? 'rgba(70, 95, 255, 0.08)' : '#F1F5F9',
                        color: done ? 'white' : active ? '#465FFF' : '#94A3B8',
                        border: active ? '2px solid #465FFF' : done ? 'none' : '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        zIndex: 1,
                      }}>
                        {done ? <Check size={14} strokeWidth={3} /> : idx + 1}
                      </div>

                      <div style={{ paddingTop: '0.15rem', flex: 1 }}>
                        {(() => {
                          let statusTime = null;
                          if (request.statusHistory && Array.isArray(request.statusHistory)) {
                            const h = request.statusHistory.find((item) => item.status === status || (status === 'ready' && item.status === 'ready_for_pickup') || (status === 'pending' && item.status === 'submitted'));
                            if (h) statusTime = h.createdAt || h.created_at;
                          }
                          if (!statusTime) {
                            if (status === 'pending') statusTime = request.submittedAt || request.createdAt;
                            else if (status === 'accepted') statusTime = request.acceptedAt;
                            else if (status === 'queued') statusTime = request.queuedAt;
                            else if (status === 'printing') statusTime = request.printingStartedAt;
                            else if (status === 'ready') statusTime = request.readyAt;
                            else if (status === 'picked_up') statusTime = request.pickedUpAt;
                            else if (status === 'completed') statusTime = request.completedAt;
                          }

                          const formattedTime = statusTime ? new Date(statusTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : null;

                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: active || done ? 700 : 500, color: active ? '#465FFF' : done ? '#465FFF' : '#94A3B8' }}>
                                    {info.label}
                                  </span>
                                  {active && (
                                    <span className="badge-premium-sky !py-0.5 !px-2 !text-[10px]">
                                      Current
                                    </span>
                                  )}
                                </div>
                                {(done || active) && formattedTime && (
                                  <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>
                                    {formattedTime}
                                  </span>
                                )}
                              </div>
                              {active && (
                                <div style={{ fontSize: '0.725rem', color: '#64748B', marginTop: '0.15rem' }}>
                                  {info.desc}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {request.status === 'completed' && (
            <div style={{
              background: 'white',
              borderRadius: '0.875rem',
              padding: '1.25rem 1.35rem',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            }}>
              {request.review?.rating ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>
                      <CheckCircle2 size={18} color="#16A34A" /> Your Review &amp; Rating
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {request.review.isAnonymous && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '9999px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                          👤 Anonymous
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {new Date(request.review.reviewedAt || request.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={20}
                        fill={star <= request.review.rating ? '#F59E0B' : '#E2E8F0'}
                        color={star <= request.review.rating ? '#F59E0B' : '#CBD5E1'}
                      />
                    ))}
                    <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem', marginLeft: '0.35rem' }}>
                      {request.review.rating}.0 / 5.0
                    </span>
                  </div>

                  {Array.isArray(request.review.tags) && request.review.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                      {request.review.tags.map((tag) => (
                        <span key={tag} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '9999px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#64748B', background: '#F8FAFC', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', marginBottom: '0.75rem' }}>
                    <div>Quality: <strong style={{ color: '#0F172A' }}>{request.review.printQuality || 5}/5</strong></div>
                    <div>Speed: <strong style={{ color: '#0F172A' }}>{request.review.speedRating || 5}/5</strong></div>
                  </div>

                  {request.review.comment && (
                    <div style={{ fontSize: '0.85rem', color: '#334155', fontStyle: 'italic', background: '#F8FAFC', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}>
                      "{request.review.comment}"
                    </div>
                  )}
                </div>
              ) : (
                <ReviewForm
                  requestId={request._id}
                  shopName={request.shopId?.shopName || request.shopName}
                  onReviewSubmitted={() => fetchRequest(true)}
                />
              )}
            </div>
          )}

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '1.5rem' }}>

          <div style={{
            background: 'white',
            borderRadius: '0.875rem',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#465FFF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Printer size={14} /> Printing Shop
              </div>

              <Link
                to="/find-shop"
                target="_blank"
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  color: '#465FFF',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                View on Map <ExternalLink size={12} />
              </Link>
            </div>

            <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <ShopFacadeImage
                src={request.shopId?.storefrontPhotoUrl}
                shopName={request.shopId?.shopName}
                className="w-full h-full"
                textClassName="text-xl font-bold"
              />
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#465FFF', margin: 0, lineHeight: 1.25 }}>
                {request.shopId?.shopName || request.shopName || 'Naval Printing Press'}
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem' }}>
                <MapPin size={13} color="#64748B" style={{ flexShrink: 0 }} />
                <span>{request.shopId?.address || 'Naval, Biliran'}</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: '#F8FAFC',
              padding: '0.55rem 0.75rem',
              borderRadius: '0.6rem',
              fontSize: '0.725rem',
              color: '#334155',
              border: '1px solid #E2E8F0',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={13} color="#465FFF" /> ~{request.estimatedPrintingTime || 2}m print
              </span>
              <span style={{ color: '#CBD5E1' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                {request.travelMode === 'walking' ? '🚶' : request.travelMode === 'vehicle' ? '🚗' : '🏍️'} ~{request.estimatedTravelTime || 1}m {request.travelMode === 'walking' ? 'walk' : request.travelMode === 'vehicle' ? 'drive' : 'transit'}
              </span>
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '0.875rem',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Document Specifications
            </div>

            {doc && (
              <div style={{
                background: '#F8FAFC',
                borderRadius: '0.65rem',
                padding: '0.75rem',
                border: '1px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
              }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', background: 'rgba(70, 95, 255, 0.08)', color: '#465FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#465FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.originalFilename || 'Document.pdf'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                    Verified PDF upload
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.45rem', fontSize: '0.75rem' }}>
              <div style={{ background: '#F8FAFC', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.675rem' }}>Print Volume</span>
                <strong style={{ color: '#465FFF' }}>
                  {request.printingSpecifications?.totalPages || 1} {request.printingSpecifications?.serviceType === 'photo_print' ? 'photos' : 'pgs'} × {request.printingSpecifications?.copies || 1} {request.printingSpecifications?.copies === 1 ? 'copy' : 'copies'}
                </strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.675rem' }}>Color Mode</span>
                <strong style={{ color: '#465FFF' }}>{request.printingSpecifications?.colorMode === 'color' ? 'Full Color' : 'Black & White'}</strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.675rem' }}>Paper &amp; Finish</span>
                <strong style={{ color: '#465FFF' }}>
                  {request.printingSpecifications?.paperSize || 'A4'}
                  {request.printingSpecifications?.serviceType === 'photo_print' || request.printingSpecifications?.paperType === 'photo' || request.printingSpecifications?.paperType === 'matte'
                    ? ` (${request.printingSpecifications?.paperType === 'matte' ? 'Matte Photo' : 'Glossy Photo'})`
                    : ''}
                </strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.675rem' }}>Binding / Service</span>
                <strong style={{ color: '#465FFF' }}>
                  {request.printingSpecifications?.serviceType === 'photo_print'
                    ? 'Photo Print'
                    : request.printingSpecifications?.binding === 'spiral'
                    ? 'Spiral'
                    : request.printingSpecifications?.binding === 'soft_bound'
                    ? 'Softbound'
                    : 'Standard'}
                </strong>
              </div>
              <div style={{ background: '#F8FAFC', padding: '0.5rem', borderRadius: '0.45rem', border: '1px solid #E2E8F0' }}>
                <span style={{ color: '#64748B', display: 'block', fontSize: '0.675rem' }}>Travel Mode</span>
                <strong style={{ color: '#465FFF' }}>{request.travelMode === 'walking' ? 'Walking' : request.travelMode === 'vehicle' ? 'Vehicle' : 'Motorcycle'}</strong>
              </div>
            </div>

            <div style={{
              fontSize: '0.725rem',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.35rem',
              borderTop: '1px dashed #CBD5E1',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <ShieldCheck size={13} color="#465FFF" />
                {isDocPurged ? 'File purged from storage' : 'Protected data privacy'}
              </span>

              {!isDocPurged && isTerminal && (
                <button
                  type="button"
                  onClick={handlePurgeDocument}
                  disabled={purging}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#DC2626',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: 0,
                  }}
                >
                  <Trash2 size={11} /> {purging ? 'Purging...' : 'Purge Now'}
                </button>
              )}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '0.875rem',
            padding: '1.25rem',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(6,63,92,0.04), 0 4px 14px -2px rgba(6,63,92,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#465FFF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Order Price Breakdown
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8rem', color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Print Volume ({request.printingSpecifications?.totalPages || 1} pgs × {request.printingSpecifications?.copies || 1} c):</span>
                <strong style={{ color: '#465FFF' }}>₱{(parseFloat(request.estimatedCost || 0) - (request.isRush ? (request.rushFee || 20) : 0)).toFixed(2)}</strong>
              </div>

              {request.isRush && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#D97706', fontWeight: 700 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Zap size={13} className="fill-amber-500 text-amber-500" /> Rush Priority Fee:
                  </span>
                  <span>+₱{Number(request.rushFee || 20).toFixed(2)}</span>
                </div>
              )}

              <div style={{
                background: '#F8FAFC',
                borderRadius: '0.6rem',
                padding: '0.75rem 0.85rem',
                border: '1px solid #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                fontSize: '0.75rem',
                marginTop: '0.25rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>Payment Method:</span>
                  <span style={{ fontWeight: 700, color: '#0F172A', textTransform: 'uppercase' }}>
                    {request.paymentMethod || 'GCASH'}
                  </span>
                </div>

                {request.paymentRefNumber && request.paymentRefNumber !== 'GCash Receipt Attached' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Reference No:</span>
                    <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{request.paymentRefNumber}</strong>
                  </div>
                )}

                {request.paymentProofUrl ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px dashed #CBD5E1' }}>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Receipt Proof:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedProofUrl(request.paymentProofUrl)}
                      className="btn-premium-secondary !py-1 !px-2.5 !text-xs flex items-center gap-1 text-slate-800"
                    >
                      <Eye size={12} /> View Screenshot
                    </button>
                  </div>
                ) : !['completed', 'cancelled', 'rejected'].includes(request.status) ? (
                  <div style={{ paddingTop: '0.4rem', borderTop: '1px dashed #CBD5E1' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#0F172A', fontWeight: 600, fontSize: '0.725rem' }}>
                      <Upload size={13} />
                      <span>{isUploadingProof ? 'Uploading...' : '+ Attach Payment Receipt'}</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleUploadTrackProof}
                        style={{ display: 'none' }}
                        disabled={isUploadingProof}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div style={{
                background: '#101828',
                borderRadius: '0.75rem',
                padding: '1rem 1.15rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '0.35rem',
                boxShadow: '0 4px 14px rgba(6,63,92,0.15)',
              }}>
                <div style={{ fontSize: '0.725rem', fontWeight: 800, color: 'rgba(70, 95, 255, 0.25)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Amount
                </div>
                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#FFFFFF', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  ₱{parseFloat(request.estimatedCost || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.45rem',
              marginTop: '0.25rem',
              padding: '0.75rem 0.5rem',
              background: '#F8FAFC',
              borderRadius: '0.65rem',
              textAlign: 'center',
              border: '1px solid #CBD5E1',
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#465FFF' }}>{request.estimatedTravelTime || 1}m</div>
                <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>Travel</div>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#465FFF' }}>{request.estimatedWaitingTime || 0}m</div>
                <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>Wait</div>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#465FFF' }}>{request.estimatedPrintingTime || 1}m</div>
                <div style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>Print</div>
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#465FFF' }}>{request.estimatedCompletionTime || 2}m</div>
                <div style={{ fontSize: '0.625rem', color: '#465FFF', fontWeight: 800 }}>Total</div>
              </div>
            </div>

            {isCancellable && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  width: '100%',
                  height: '40px',
                  background: '#FEF2F2',
                  color: '#DC2626',
                  border: '1.5px solid #FECACA',
                  borderRadius: '0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  marginTop: '0.5rem',
                  transition: 'all 0.15s ease',
                }}
              >
                {cancelling ? <div className="spinner-sm" /> : <><XCircle size={15} /> Cancel Print Order</>}
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Payment Proof Modal */}
      {selectedProofUrl && (
        <div
          onClick={() => setSelectedProofUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '1rem',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.15rem',
              borderBottom: '1px solid #E2E8F0',
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                Payment Receipt Proof
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofUrl(null)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <a
                  href={requestAPI.getPaymentProofUrl(request?._id, selectedProofUrl)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.75rem', color: '#465FFF', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Open original
                </a>
              </div>
              <img
                src={requestAPI.getPaymentProofUrl(request?._id, selectedProofUrl)}
                alt="Payment Receipt"
                style={{
                  maxHeight: '65vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: '0.5rem',
                  border: '1px solid #E2E8F0',
                }}
              />
            </div>

            <div style={{
              padding: '0.75rem 1.15rem',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                {request.paymentRefNumber ? `Ref: ${request.paymentRefNumber}` : 'GCash Confirmation'}
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofUrl(null)}
                className="btn-premium-sky !py-1.5 !px-4 !text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ReviewForm({ requestId, shopName, onReviewSubmitted }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [printQuality, setPrintQuality] = useState(5);
  const [speedRating, setSpeedRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState(['⚡ Fast Turnaround', '📄 Crisp & Clear Text']);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const RATING_MOODS = {
    5: { label: 'Outstanding! 🤩', color: '#16A34A', desc: 'Exceeded all expectations' },
    4: { label: 'Very Good! 😊', color: '#2563EB', desc: 'Satisfied with the print' },
    3: { label: 'Fair / Average 🙂', color: '#D97706', desc: 'Acceptable service' },
    2: { label: 'Disappointed 😕', color: '#EA580C', desc: 'Needs improvement' },
    1: { label: 'Poor Experience 😞', color: '#DC2626', desc: 'Did not meet expectations' },
  };

  const QUICK_TAGS = [
    '⚡ Fast Turnaround',
    '📄 Crisp & Clear Text',
    '🎨 Vibrant Colors',
    '💰 Student-Friendly Price',
    '🤝 Friendly Staff',
    '📦 Neat Binding',
    '🕒 Ready on Time',
    '✨ High Quality Paper',
  ];

  const COMMENT_STARTERS = [
    'Ready right on time for class!',
    'Crisp text clarity and deep ink contrast.',
    'Accommodating and very polite shop staff.',
    'Affordable rates, perfect for students!',
    'Clean paper edges and neat staples.',
  ];

  const currentDisplayRating = hoverRating || rating;
  const mood = RATING_MOODS[currentDisplayRating] || RATING_MOODS[5];

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addStarter = (starter) => {
    setComment((prev) => {
      const cleanPrev = prev.trim();
      if (!cleanPrev) return starter;
      if (cleanPrev.includes(starter)) return prev;
      return `${cleanPrev} ${starter}`;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error('Please select a star rating.');
      return;
    }

    setSubmitting(true);
    try {
      await requestAPI.submitReview(requestId, {
        rating,
        printQuality,
        speedRating,
        tags: selectedTags,
        isAnonymous,
        comment: comment.trim(),
      });
      toast.success('Thank you for rating your printing experience! ⭐', {
        duration: 4000,
        icon: '🎉',
      });
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Star size={18} fill="#F59E0B" color="#F59E0B" /> Rate Your Printing Experience
          </h4>
          {shopName && (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
              {shopName}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>
          Share quick feedback to help fellow students find reliable printing in Naval.
        </p>
      </div>

      {/* Shopee Big Stars + Emotion Tag */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.85rem 1rem',
        borderRadius: '0.75rem',
        background: '#FFFBEB',
        border: '1px solid #FDE68A',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                transition: 'transform 0.15s ease',
              }}
              onMouseEnterCapture={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeaveCapture={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
              title={`${star} Star${star > 1 ? 's' : ''}`}
            >
              <Star
                size={30}
                fill={star <= currentDisplayRating ? '#F59E0B' : '#E2E8F0'}
                color={star <= currentDisplayRating ? '#F59E0B' : '#CBD5E1'}
              />
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: mood.color }}>
            {mood.label}
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748B' }}>
            {mood.desc}
          </span>
        </div>
      </div>

      {/* Shopee Quick Tags */}
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
          🏷️ Quick Tags (Tap to highlight):
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {QUICK_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  padding: '0.3rem 0.6rem',
                  borderRadius: '9999px',
                  border: active ? '1.5px solid #F59E0B' : '1px solid #E2E8F0',
                  background: active ? '#FEF3C7' : '#F8FAFC',
                  color: active ? '#92400E' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {active ? '✓ ' : '+ '}
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Criteria Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#F8FAFC', padding: '0.65rem 0.75rem', borderRadius: '0.6rem', border: '1px solid #E2E8F0' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#334155' }}>Print Clarity:</span>
            <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#F59E0B' }}>{printQuality}/5</span>
          </div>
          <div style={{ display: 'flex', gap: '0.2rem' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrintQuality(s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px' }}
              >
                <Star size={16} fill={s <= printQuality ? '#F59E0B' : '#E2E8F0'} color={s <= printQuality ? '#F59E0B' : '#CBD5E1'} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#334155' }}>Turnaround Speed:</span>
            <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#F59E0B' }}>{speedRating}/5</span>
          </div>
          <div style={{ display: 'flex', gap: '0.2rem' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeedRating(s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px' }}
              >
                <Star size={16} fill={s <= speedRating ? '#F59E0B' : '#E2E8F0'} color={s <= speedRating ? '#F59E0B' : '#CBD5E1'} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shopee Comment & Suggestions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
            💬 Leave a Comment &amp; Review (Optional):
          </label>
          <span style={{ fontSize: '0.7rem', color: comment.length > 350 ? '#D97706' : '#94A3B8', fontFamily: 'monospace' }}>
            {comment.length} / 400
          </span>
        </div>

        <textarea
          rows={3}
          maxLength={400}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            rating >= 4
              ? 'What did you like most? (e.g. sharp text clarity, smooth pickup, friendly shop owner...)'
              : 'How can this print shop improve? (e.g. wait time, ink clarity, paper handling...)'
          }
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1.5px solid #CBD5E1',
            fontSize: '0.8rem',
            resize: 'vertical',
            color: '#0F172A',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        {/* Quick Comment Starters */}
        <div style={{ marginTop: '0.4rem' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.25rem' }}>
            💡 Quick Idea Starters (Tap to insert):
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {COMMENT_STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => addStarter(starter)}
                style={{
                  fontSize: '0.68rem',
                  padding: '0.2rem 0.45rem',
                  borderRadius: '0.35rem',
                  background: '#F1F5F9',
                  color: '#475569',
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                + "{starter}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shopee Post Anonymously Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 0.75rem',
        borderRadius: '0.5rem',
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem' }}>👤</span>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A', display: 'block' }}>
              Post review anonymously
            </span>
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
              {isAnonymous ? 'Your name will show as "Anonymous Student"' : 'Your name will appear with your review'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAnonymous(!isAnonymous)}
          style={{
            width: '36px',
            height: '20px',
            borderRadius: '9999px',
            background: isAnonymous ? '#16A34A' : '#CBD5E1',
            border: 'none',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
            padding: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: 'white',
              position: 'absolute',
              top: '2px',
              left: isAnonymous ? '18px' : '2px',
              transition: 'left 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        style={{
          width: '100%',
          height: '42px',
          borderRadius: '0.6rem',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: 'white',
          fontWeight: 800,
          fontSize: '0.85rem',
          border: 'none',
          cursor: submitting ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          opacity: submitting ? 0.7 : 1,
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
          transition: 'transform 0.1s ease',
        }}
      >
        <Star size={16} fill="#F59E0B" color="#F59E0B" />
        {submitting ? 'Submitting Review...' : 'Submit Rating &amp; Review'}
      </button>
    </form>
  );
}
