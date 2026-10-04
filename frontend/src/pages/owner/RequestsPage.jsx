import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { shopAPI, requestAPI, documentAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  FileText, Trash2, RefreshCw, Clock, CheckCircle2,
  XCircle, Printer, Package, Inbox, Copy, Palette, Search, X,
  AlertTriangle, MessageSquare, Zap, Wrench, Send, ChevronDown,
  LayoutGrid, Table, MoreHorizontal, Eye, ArrowRight,
  CreditCard, Check, ExternalLink, ImageOff
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  paid_verifying: {
    label: 'Verifying Payment',
    textColor: 'text-amber-800',
    bgColor: 'bg-[#FFF7ED]',
    borderColor: 'border-[#FDBA74]',
    dotColor: 'bg-amber-500',
    iconColor: 'text-amber-600',
  },
  pending: {
    label: 'Pending',
    textColor: 'text-amber-800',
    bgColor: 'bg-[#FFF7ED]',
    borderColor: 'border-[#FDBA74]',
    dotColor: 'bg-amber-500',
    iconColor: 'text-amber-600',
  },
  accepted: {
    label: 'Accepted',
    textColor: 'text-blue-800',
    bgColor: 'bg-[#EFF6FF]',
    borderColor: 'border-[#BFDBFE]',
    dotColor: 'bg-blue-600',
    iconColor: 'text-blue-600',
  },
  queued: {
    label: 'Queued',
    textColor: 'text-blue-800',
    bgColor: 'bg-[#EFF6FF]',
    borderColor: 'border-[#BFDBFE]',
    dotColor: 'bg-blue-600',
    iconColor: 'text-blue-600',
  },
  printing: {
    label: 'Printing',
    textColor: 'text-blue-800',
    bgColor: 'bg-[#EFF6FF]',
    borderColor: 'border-[#BFDBFE]',
    dotColor: 'bg-blue-600',
    iconColor: 'text-blue-600',
  },
  ready: {
    label: 'Ready for Pickup',
    textColor: 'text-emerald-800',
    bgColor: 'bg-[#ECFDF5]',
    borderColor: 'border-[#A7F3D0]',
    dotColor: 'bg-emerald-600',
    iconColor: 'text-emerald-600',
  },
  picked_up: {
    label: 'Picked Up',
    textColor: 'text-teal-800',
    bgColor: 'bg-[#F0FDFA]',
    borderColor: 'border-[#99F6E4]',
    dotColor: 'bg-teal-600',
    iconColor: 'text-teal-600',
  },
  completed: {
    label: 'Completed',
    textColor: 'text-emerald-900',
    bgColor: 'bg-[#F0FDF4]',
    borderColor: 'border-[#BBF7D0]',
    dotColor: 'bg-emerald-700',
    iconColor: 'text-emerald-700',
  },
  rejected: {
    label: 'Rejected',
    textColor: 'text-slate-700',
    bgColor: 'bg-[#F1F5F9]',
    borderColor: 'border-[#CBD5E1]',
    dotColor: 'bg-slate-500',
    iconColor: 'text-slate-500',
  },
  cancelled: {
    label: 'Cancelled',
    textColor: 'text-slate-700',
    bgColor: 'bg-[#F1F5F9]',
    borderColor: 'border-[#CBD5E1]',
    dotColor: 'bg-slate-500',
    iconColor: 'text-slate-500',
  },
};

const TABS = [
  {
    key: 'all',
    label: 'All Orders',
    statuses: null,
    emptyTitle: 'No Orders Yet',
    emptyMsg: 'New customer print orders will appear here automatically via real-time updates.',
  },
  {
    key: 'pending',
    label: 'New Orders (Verifying)',
    statuses: ['paid_verifying', 'pending', 'submitted'],
    emptyTitle: 'No New Orders',
    emptyMsg: 'New prepaid orders from customers will appear here instantly. Verify their GCash receipt to accept them.',
  },
  {
    key: 'queued',
    label: 'Accepted / Queued',
    statuses: ['accepted', 'queued'],
    emptyTitle: 'No Accepted Orders',
    emptyMsg: 'Orders you have accepted and are waiting in queue will appear here.',
  },
  {
    key: 'printing',
    label: 'Printing',
    statuses: ['printing'],
    emptyTitle: 'Nothing Being Printed',
    emptyMsg: 'Orders currently being printed on your machines will appear here.',
  },
  {
    key: 'ready',
    label: 'Ready for Pickup',
    statuses: ['ready', 'ready_for_pickup'],
    emptyTitle: 'No Orders Ready',
    emptyMsg: 'Orders marked as ready for customer pickup will appear here.',
  },
  {
    key: 'completed',
    label: 'Completed',
    statuses: ['completed', 'picked_up'],
    emptyTitle: 'No Completed Orders',
    emptyMsg: 'Orders that have been fully completed and picked up by customers will appear here.',
  },
  {
    key: 'archived',
    label: 'Cancelled / Declined',
    statuses: ['cancelled', 'rejected', 'declined'],
    emptyTitle: 'No Cancelled or Declined Orders',
    emptyMsg: 'Rejected, declined, or cancelled orders are stored here for your records.',
  },
];

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${date} • ${time}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatSpecs(specs) {
  const parts = [];
  if (specs.totalPages) parts.push(`${specs.totalPages} page${specs.totalPages !== 1 ? 's' : ''}`);
  if (specs.copies) parts.push(`${specs.copies} ${specs.copies !== 1 ? 'copies' : 'copy'}`);
  if (specs.colorMode) parts.push(specs.colorMode === 'color' ? 'Color' : 'B&W');
  if (specs.paperSize) parts.push(specs.paperSize);
  if (specs.binding && specs.binding !== 'none') parts.push(specs.binding);
  return parts.join(' • ') || 'Standard Print';
}

const NOTE_PRESETS = [
  {
    category: 'file_issue',
    icon: FileText,
    label: 'Cannot Open / Damaged File',
    color: '#DC2626',
    defaultMsg: 'We are unable to open your document because it is unreadable, corrupted, or password-protected. Please upload or send a valid file.',
    defaultDelay: 0,
  },
  {
    category: 'layout_issue',
    icon: AlertTriangle,
    label: 'Distorted Layout / Page Formatting Cut Off',
    color: '#D97706',
    defaultMsg: 'Your document layout has distorted margins, overflowing text, or cut-off sections (e.g., page 3/headers). Please review and confirm.',
    defaultDelay: 0,
  },
  {
    category: 'power_outage',
    icon: Zap,
    label: 'Power Interruption (Brownout in Naval)',
    color: '#EA580C',
    defaultMsg: 'Electrical power is currently cut off in Naval (BILECO outage). Expect a printing delay until electricity is restored.',
    defaultDelay: 45,
  },
  {
    category: 'equipment_maintenance',
    icon: Wrench,
    label: 'Printer Maintenance / Paper Jam',
    color: '#465FFF',
    defaultMsg: 'Our printer is temporarily undergoing quick maintenance / paper jam resolution. We will resume printing shortly.',
    defaultDelay: 15,
  },
  {
    category: 'custom',
    icon: MessageSquare,
    label: 'Custom Notice / Note...',
    color: '#465FFF',
    defaultMsg: '',
    defaultDelay: 0,
  },
];

export default function OwnerRequestsPage() {
  const [shopId, setShopId] = useState(null);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [purgingDocId, setPurgingDocId] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

  const [noteModalReq, setNoteModalReq] = useState(null);
  const [noteCategory, setNoteCategory] = useState('file_issue');
  const [noteMessage, setNoteMessage] = useState('');
  const [noteDelayMinutes, setNoteDelayMinutes] = useState(0);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [expandedNotesId, setExpandedNotesId] = useState(null);

  // Confirm Pickup Modal State
  const [confirmingPickupReq, setConfirmingPickupReq] = useState(null);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);

  // Payment Proof Modal State
  const [proofModalReq, setProofModalReq] = useState(null);
  const [verifyingPaymentId, setVerifyingPaymentId] = useState(null);

  const handleVerifyPayment = async (requestId, paymentStatus = 'verified') => {
    setVerifyingPaymentId(requestId);
    try {
      await requestAPI.verifyPayment(requestId, paymentStatus);
      toast.success(paymentStatus === 'verified' ? 'Payment marked as verified!' : 'Payment marked as unverified.');
      setAllRequests((prev) =>
        prev.map((r) => (r._id === requestId ? { ...r, paymentStatus } : r))
      );
      if (proofModalReq && proofModalReq._id === requestId) {
        setProofModalReq((prev) => prev ? { ...prev, paymentStatus } : null);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update payment status.');
    } finally {
      setVerifyingPaymentId(null);
    }
  };

  const { socket, joinShopRoom } = useSocket() || {};
  const actionMenuRef = useRef(null);

  // Close action menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRequests = useCallback(() => {
    if (!shopId) return;
    setLoading(true);
    requestAPI.getShopRequests(shopId, {})
      .then((res) => setAllRequests(res.data?.requests || []))
      .catch((err) => {
        console.error('Failed to load shop requests:', err);
      })
      .finally(() => setLoading(false));
  }, [shopId]);

  useEffect(() => {
    shopAPI.getMyShop().then((res) => {
      const sId = res.data?._id;
      setShopId(sId);
      if (sId) joinShopRoom?.(sId);
    }).catch(() => { });
  }, [joinShopRoom]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!socket || !shopId) return;
    const refresh = () => fetchRequests();
    socket.on('request:new', refresh);
    socket.on('request:status_changed', refresh);
    socket.on('queue:update', refresh);
    socket.on('request:cancelled', refresh);
    return () => {
      socket.off('request:new', refresh);
      socket.off('request:status_changed', refresh);
      socket.off('queue:update', refresh);
      socket.off('request:cancelled', refresh);
    };
  }, [socket, shopId, fetchRequests]);

  const tabCounts = useMemo(() => {
    const counts = {};
    TABS.forEach(tab => {
      counts[tab.key] = tab.statuses
        ? allRequests.filter(r => tab.statuses.includes(r.status)).length
        : allRequests.length;
    });
    return counts;
  }, [allRequests]);

  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];

  const filteredRequests = useMemo(() => {
    let list = currentTab.statuses
      ? allRequests.filter(r => currentTab.statuses.includes(r.status))
      : allRequests;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.customerId?.name?.toLowerCase().includes(q) ||
        r.documentId?.originalFilename?.toLowerCase().includes(q) ||
        r._id?.toLowerCase().includes(q)
      );
    }

    // Prioritize rush orders first
    return [...list].sort((a, b) => {
      if (a.isRush && !b.isRush) return -1;
      if (!a.isRush && b.isRush) return 1;
      return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
    });
  }, [allRequests, currentTab, search]);

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    setActionMenuId(null);
    try {
      await requestAPI.updateStatus(id, status);
      const statusLabel = STATUS_CONFIG[status]?.label || status;
      toast.success(`Marked as ${statusLabel}`);
      setAllRequests(prev => prev.map(r => r._id === id ? { ...r, status } : r));
    } catch (err) {
      toast.error(err.message || 'Status update failed.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Confirm Pickup Handler (Ready for Pickup -> Picked Up -> Completed)
  const handleConfirmPickup = async () => {
    if (!confirmingPickupReq?._id) return;
    setIsConfirmingPickup(true);
    try {
      // 1. Transition to picked_up
      await requestAPI.updateStatus(confirmingPickupReq._id, 'picked_up');
      // 2. Transition to completed
      await requestAPI.updateStatus(confirmingPickupReq._id, 'completed');
      toast.success('Pickup confirmed and order completed!');
      setAllRequests(prev =>
        prev.map(r => (r._id === confirmingPickupReq._id ? { ...r, status: 'completed', pickedUpAt: new Date(), completedAt: new Date() } : r))
      );
      setConfirmingPickupReq(null);
    } catch (err) {
      toast.error(err.message || 'Unable to confirm pickup. Please try again.');
    } finally {
      setIsConfirmingPickup(false);
    }
  };

  const handleViewDocument = (docOrId, fallbackFilename = '') => {
    const docId = typeof docOrId === 'object' ? docOrId?._id : docOrId;
    const filename = typeof docOrId === 'object' ? (docOrId?.originalFilename || '') : fallbackFilename;
    const ext = (filename.split('.').pop() || '').toLowerCase();

    if (!docId) {
      toast.error('Document ID not found.');
      return;
    }

    const fileUrl = documentAPI.getViewUrl(docId);

    if (ext === 'docx' || ext === 'doc') {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = filename || 'document.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Downloading Word document for viewing...');
    } else {
      window.open(fileUrl, '_blank');
    }
  };

  const handlePurgeDocument = async (docId) => {
    if (!confirm('Permanently purge this document file from storage for customer data privacy?')) return;
    setPurgingDocId(docId);
    setActionMenuId(null);
    try {
      await documentAPI.delete(docId);
      toast.success('Document file wiped from server storage.');
      fetchRequests();
    } catch (err) {
      toast.error(err.message || 'Failed to purge document.');
    } finally {
      setPurgingDocId(null);
    }
  };

  const openNoteModal = (req) => {
    setActionMenuId(null);
    setNoteModalReq(req);
    const initialPreset = NOTE_PRESETS[0];
    setNoteCategory(initialPreset.category);
    setNoteMessage(initialPreset.defaultMsg);
    setNoteDelayMinutes(initialPreset.defaultDelay);
  };

  const selectPreset = (preset) => {
    setNoteCategory(preset.category);
    setNoteMessage(preset.defaultMsg);
    setNoteDelayMinutes(preset.defaultDelay);
  };

  const handleSendNote = async (e) => {
    if (e) e.preventDefault();
    if (!noteMessage.trim()) {
      toast.error('Please enter a note message for the customer.');
      return;
    }
    setSubmittingNote(true);
    try {
      const res = await requestAPI.addShopNote(noteModalReq._id, {
        category: noteCategory,
        message: noteMessage.trim(),
        delayMinutes: noteDelayMinutes,
      });
      toast.success('Customer notified and alert banner activated!');
      const updatedReq = res.data?.data || res.data;
      setAllRequests(prev => prev.map(r => {
        if (r._id !== noteModalReq._id) return r;
        const existingNotes = r.shopNotes || [];
        const newNoteObj = {
          category: noteCategory,
          message: noteMessage.trim(),
          createdAt: new Date(),
        };
        const newDelay = (noteCategory === 'power_outage' || Number(noteDelayMinutes) > 0)
          ? {
            isDelayed: true,
            reason: noteMessage.trim(),
            estimatedDelayMinutes: Number(noteDelayMinutes) || 0,
            reportedAt: new Date(),
          }
          : r.delayNotice;
        return {
          ...r,
          shopNotes: updatedReq.shopNotes || [...existingNotes, newNoteObj],
          delayNotice: updatedReq.delayNotice || newDelay,
        };
      }));
      setNoteModalReq(null);
    } catch (err) {
      toast.error(err.message || 'Failed to send note to customer.');
    } finally {
      setSubmittingNote(false);
    }
  };

  return (
    <div className="w-full font-outfit">
      {/* 2. Status Filters */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          const count = tabCounts[key] || 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setActiveTab(key); setSearch(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#465FFF] text-white border-[#465FFF] shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>{label}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Search + View Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 sm:p-2.5 flex items-center justify-between gap-3 mb-4 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or file..."
            className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200 focus:border-[#465FFF] focus:bg-white focus:ring-1 focus:ring-[#465FFF]/20 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Grid View"
            className={`p-1.5 sm:p-2 rounded-lg border text-xs transition-all flex items-center justify-center ${
              viewMode === 'grid'
                ? 'bg-[#465FFF] text-white border-[#465FFF] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            title="Table View"
            className={`p-1.5 sm:p-2 rounded-lg border text-xs transition-all flex items-center justify-center ${
              viewMode === 'table'
                ? 'bg-[#465FFF] text-white border-[#465FFF] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Table size={15} />
          </button>
          <button
            type="button"
            onClick={() => fetchRequests()}
            title="Refresh"
            disabled={loading}
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs transition-all flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-[#465FFF] rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <Inbox size={22} className="text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 mb-0.5">
            {search ? `No results for "${search}"` : currentTab.emptyTitle}
          </h3>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            {search ? 'Try a different customer name or file name.' : currentTab.emptyMsg}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* 4. DEFAULT VIEW — GRID (2-Column Responsive Layout) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRequests.map((req) => {
            const doc = req.documentId;
            const isTerminal = ['completed', 'rejected', 'cancelled'].includes(req.status);
            const isPurged = doc?.isDeletedFromStorage;
            const specs = req.printingSpecifications || {};
            const customerName = req.customerId?.name || 'Unknown Customer';
            const isUpdating = updatingId === req._id;
            const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;

            return (
              <div
                key={req._id}
                className={`bg-white rounded-xl border transition-all p-4 flex flex-col justify-between shadow-xs hover:border-slate-300 ${
                  req.isRush ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Customer → Date → Status */}
                  <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#465FFF] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(customerName)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {customerName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {formatDateTime(req.submittedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {req.isRush && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-black text-[10px] flex items-center gap-0.5">
                          <Zap size={10} className="fill-white" /> RUSH
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border flex items-center gap-1.5 ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                        {statusConfig.label}
                      </span>

                      {/* Secondary Card Options Menu [ ⋯ ] */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActionMenuId(actionMenuId === `grid-${req._id}` ? null : `grid-${req._id}`)}
                          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                          title="More options"
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {actionMenuId === `grid-${req._id}` && (
                          <div
                            ref={actionMenuRef}
                            className="absolute right-0 top-7 z-30 w-44 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg py-1 text-left text-xs"
                          >
                            {doc && !isPurged && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuId(null);
                                  handleViewDocument(doc);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                              >
                                <Eye size={13} />
                                <span>View File</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openNoteModal(req)}
                              className="w-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                            >
                              <MessageSquare size={13} />
                              <span>Add Note / Issue</span>
                            </button>
                            {isTerminal && !isPurged && doc && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuId(null);
                                  handlePurgeDocument(doc._id);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 font-semibold flex items-center gap-2"
                              >
                                <Trash2 size={13} />
                                <span>Purge File</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File + Clickable Preview */}
                  <div className="py-2.5">
                    {doc ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewDocument(doc)}
                          disabled={isPurged}
                          title={isPurged ? 'File purged from storage' : 'Click to preview file'}
                          className={`text-xs font-semibold flex items-center gap-1.5 text-left truncate transition-colors ${
                            isPurged
                              ? 'text-slate-400 cursor-not-allowed italic'
                              : 'text-[#465FFF] hover:text-[#354EDB] hover:underline cursor-pointer'
                          }`}
                        >
                          <FileText size={13} className="shrink-0 text-[#465FFF]" />
                          <span className="truncate">{doc.originalFilename || 'Document'}</span>
                        </button>
                        {isPurged && (
                          <span className="text-[10px] text-slate-400 italic shrink-0">(purged)</span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic flex items-center gap-1">
                        <FileText size={13} />
                        <span>No file attached</span>
                      </div>
                    )}

                    {/* Specifications */}
                    <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                      {formatSpecs(specs)}
                    </div>

                    {/* Estimated Price */}
                    <div className="text-xs font-bold text-slate-900 mt-2">
                      ₱{parseFloat(req.estimatedCost || 0).toFixed(2)}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">estimated</span>
                    </div>

                    {/* Payment Status & Proof */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CreditCard size={12} className="text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700 uppercase text-[10px]">
                          {req.paymentMethod || 'GCash'}
                        </span>
                        {req.paymentRefNumber && (
                          <span className="font-mono text-slate-500 truncate text-[10px]" title={req.paymentRefNumber}>
                            #{req.paymentRefNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setProofModalReq(req)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 transition-colors cursor-pointer ${
                            req.paymentStatus === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : req.paymentRefNumber
                                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Click to manage payment verification"
                        >
                          <span>{req.paymentStatus === 'verified' ? 'Verified' : req.paymentRefNumber ? 'Verifying' : 'Unpaid'}</span>
                          {req.paymentProofUrl && <Eye size={10} />}
                        </button>

                      </div>
                    </div>

                    {/* Delay Alert if any */}
                    {req.delayNotice?.isDelayed && (
                      <div className="mt-2.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-1.5">
                        <Zap size={12} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-bold">Delay Active:</span> {req.delayNotice.reason}
                          {req.delayNotice.estimatedDelayMinutes > 0 && (
                            <span className="font-bold ml-1">(~{req.delayNotice.estimatedDelayMinutes}m)</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Shop Notes if any */}
                    {req.shopNotes && req.shopNotes.length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-600 bg-slate-50 rounded-lg p-1.5 border border-slate-100 flex items-center justify-between">
                        <span className="truncate flex items-center gap-1">
                          <MessageSquare size={11} className="text-[#465FFF]" />
                          <span className="font-medium text-slate-700">Note:</span> "{req.shopNotes[req.shopNotes.length - 1].message}"
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedNotesId(expandedNotesId === req._id ? null : req._id)}
                          className="text-[10px] text-[#465FFF] font-bold shrink-0 ml-2 hover:underline"
                        >
                          {expandedNotesId === req._id ? 'Hide' : `(${req.shopNotes.length})`}
                        </button>
                      </div>
                    )}

                    {/* Expanded notes history */}
                    {expandedNotesId === req._id && req.shopNotes && (
                      <div className="mt-1.5 space-y-1 text-[10px]">
                        {req.shopNotes.map((n, i) => (
                          <div key={i} className="p-1.5 rounded bg-slate-50 border border-slate-200">
                            <div className="flex justify-between text-slate-400 mb-0.5">
                              <span className="font-bold text-slate-600 capitalize">{n.category?.replace('_', ' ')}</span>
                              <span>{formatDateTime(n.createdAt)}</span>
                            </div>
                            <p className="text-slate-700 m-0">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Order Card Actions */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 mt-1">
                  {/* Ready for Pickup: Primary Action is [ ✓ Confirm Pickup ] (Full-width on mobile, right on desktop) */}
                  {req.status === 'ready' ? (
                    <div className="w-full flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmingPickupReq(req)}
                        disabled={isUpdating}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] focus:ring-2 focus:ring-[#465FFF]/30 focus:outline-hidden text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Confirm customer pickup"
                      >
                        <CheckCircle2 size={14} />
                        <span>Confirm Pickup</span>
                      </button>
                    </div>
                  ) : req.status === 'completed' ? (
                    /* Completed State: Non-primary completed indicator */
                    <div className="w-full flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#009B6B] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 size={13} />
                        <span>Completed</span>
                      </span>

                      {isTerminal && !isPurged && doc && (
                        <button
                          type="button"
                          onClick={() => handlePurgeDocument(doc._id)}
                          disabled={purgingDocId === doc._id}
                          className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800/60 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                          title="Purge document for privacy"
                        >
                          <Trash2 size={12} />
                          <span>Purge File</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Pending, Active, and other statuses */
                    <>
                      <button
                        type="button"
                        onClick={() => openNoteModal(req)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Report issue or send notice to customer"
                      >
                        <MessageSquare size={12} className="text-slate-500" />
                        <span>Note</span>
                      </button>

                      <div className="flex items-center gap-1.5 ml-auto">
                        {(req.status === 'pending' || req.status === 'paid_verifying') && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateStatus(req._id, 'rejected')}
                              disabled={isUpdating}
                              className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/60 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStatus(req._id, 'accepted')}
                              disabled={isUpdating}
                              className="px-3.5 py-1.5 rounded-lg bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={12} />
                              <span>Accept</span>
                            </button>
                          </>
                        )}

                        {req.status === 'accepted' && (
                          <button
                            type="button"
                            onClick={() => updateStatus(req._id, 'queued')}
                            disabled={isUpdating}
                            className="px-3.5 py-1.5 rounded-lg bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                          >
                            <Package size={12} />
                            <span>Add to Queue</span>
                          </button>
                        )}

                        {req.status === 'queued' && (
                          <button
                            type="button"
                            onClick={() => updateStatus(req._id, 'printing')}
                            disabled={isUpdating}
                            className="px-3.5 py-1.5 rounded-lg bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                          >
                            <Printer size={12} />
                            <span>Start Printing</span>
                          </button>
                        )}

                        {req.status === 'printing' && (
                          <button
                            type="button"
                            onClick={() => updateStatus(req._id, 'ready')}
                            disabled={isUpdating}
                            className="px-3.5 py-1.5 rounded-lg bg-[#009B6B] hover:bg-[#008259] text-white text-xs font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 size={12} />
                            <span>Mark Ready</span>
                          </button>
                        )}

                        {isTerminal && !isPurged && doc && (
                          <button
                            type="button"
                            onClick={() => handlePurgeDocument(doc._id)}
                            disabled={purgingDocId === doc._id}
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800/60 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            title="Purge document for privacy"
                          >
                            <Trash2 size={12} />
                            <span>Purge File</span>
                          </button>
                        )}

                        {isUpdating && (
                          <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#465FFF] rounded-full animate-spin" />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 7. TABLE VIEW (Compact Management Table) */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3.5">Customer</th>
                  <th className="py-2.5 px-3.5">File</th>
                  <th className="py-2.5 px-3.5">Details</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5">Payment</th>
                  <th className="py-2.5 px-3.5">Total</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const doc = req.documentId;
                  const isTerminal = ['completed', 'rejected', 'cancelled'].includes(req.status);
                  const isPurged = doc?.isDeletedFromStorage;
                  const specs = req.printingSpecifications || {};
                  const customerName = req.customerId?.name || 'Unknown Customer';
                  const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const isMenuOpen = actionMenuId === req._id;

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Customer */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-[#465FFF] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getInitials(customerName)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                              <span>{customerName}</span>
                              {req.isRush && (
                                <span className="px-1 py-0.2 rounded bg-amber-500 text-white font-black text-[9px]">
                                  RUSH
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {formatDateTime(req.submittedAt)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* File */}
                      <td className="py-2.5 px-3.5 max-w-[180px]">
                        {doc ? (
                          <button
                            type="button"
                            onClick={() => handleViewDocument(doc)}
                            disabled={isPurged}
                            title={isPurged ? 'File purged' : 'Preview file'}
                            className={`truncate text-xs font-semibold flex items-center gap-1 text-left ${
                              isPurged
                                ? 'text-slate-400 cursor-not-allowed italic'
                                : 'text-[#465FFF] hover:underline cursor-pointer'
                            }`}
                          >
                            <FileText size={12} className="shrink-0" />
                            <span className="truncate">{doc.originalFilename || 'Document'}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="py-2.5 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                        {formatSpecs(specs)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border inline-flex items-center gap-1.5 ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setProofModalReq(req)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                              req.paymentStatus === 'verified'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : req.paymentRefNumber
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Manage Payment Verification"
                          >
                            <span>{req.paymentStatus === 'verified' ? 'Verified' : req.paymentRefNumber ? 'Verifying' : 'Unpaid'}</span>
                            {req.paymentProofUrl && <Eye size={10} />}
                          </button>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-2.5 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                        ₱{parseFloat(req.estimatedCost || 0).toFixed(2)}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right relative whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setActionMenuId(isMenuOpen ? null : req._id)}
                          title="Actions"
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            ref={actionMenuRef}
                            className="absolute right-3.5 top-8 z-30 w-44 bg-white rounded-lg border border-slate-200 shadow-lg py-1 text-left text-xs"
                          >
                            {doc && !isPurged && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuId(null);
                                  handleViewDocument(doc);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                              >
                                <Eye size={13} />
                                <span>View File</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openNoteModal(req)}
                              className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                            >
                              <MessageSquare size={13} />
                              <span>Add Note / Issue</span>
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            {(req.status === 'pending' || req.status === 'paid_verifying') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => updateStatus(req._id, 'accepted')}
                                  className="w-full px-3 py-1.5 hover:bg-blue-50 text-[#465FFF] font-semibold flex items-center gap-2"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Accept Order</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateStatus(req._id, 'rejected')}
                                  className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2"
                                >
                                  <XCircle size={13} />
                                  <span>Reject Order</span>
                                </button>
                              </>
                            )}
                            {req.status === 'accepted' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(req._id, 'queued')}
                                className="w-full px-3 py-1.5 hover:bg-blue-50 text-[#465FFF] font-semibold flex items-center gap-2"
                              >
                                <Package size={13} />
                                <span>Add to Queue</span>
                              </button>
                            )}
                            {req.status === 'queued' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(req._id, 'printing')}
                                className="w-full px-3 py-1.5 hover:bg-blue-50 text-[#465FFF] font-semibold flex items-center gap-2"
                              >
                                <Printer size={13} />
                                <span>Start Printing</span>
                              </button>
                            )}
                            {req.status === 'printing' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(req._id, 'ready')}
                                className="w-full px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-2"
                              >
                                <CheckCircle2 size={13} />
                                <span>Mark Ready</span>
                              </button>
                            )}
                            {req.status === 'ready' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuId(null);
                                  setConfirmingPickupReq(req);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-[#465FFF] dark:text-sky-400 font-semibold flex items-center gap-2 cursor-pointer"
                              >
                                <CheckCircle2 size={13} />
                                <span>Confirm Pickup</span>
                              </button>
                            )}
                            {isTerminal && !isPurged && doc && (
                              <button
                                type="button"
                                onClick={() => handlePurgeDocument(doc._id)}
                                className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2"
                              >
                                <Trash2 size={13} />
                                <span>Purge File</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Proof Verification Modal */}
      {proofModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard size={17} className="text-[#465FFF]" />
                  <h3 className="font-extrabold text-[#465FFF] text-sm sm:text-base">
                    GCash Payment Proof &amp; Verification
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Order #{proofModalReq._id.slice(-6).toUpperCase()} • Customer:{' '}
                  <span className="font-bold text-slate-700">
                    {proofModalReq.customerId?.name || 'Customer'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofModalReq(null)}
                className="w-7 h-7 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[60vh] bg-slate-50/50">
              {/* Payment Details Card */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Order Total Due:</span>
                  <span className="font-extrabold text-sm text-[#465FFF]">
                    ₱{parseFloat(proofModalReq.estimatedCost || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Payment Method:</span>
                  <span className="font-bold uppercase text-slate-800">
                    {proofModalReq.paymentMethod || 'GCash'}
                  </span>
                </div>
                {proofModalReq.paymentRefNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Reference Number:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <span>{proofModalReq.paymentRefNumber}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(proofModalReq.paymentRefNumber);
                          toast.success('Reference number copied!');
                        }}
                        className="text-slate-500 hover:text-[#465FFF]"
                        title="Copy reference number"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Current Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                    proofModalReq.paymentStatus === 'verified'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {proofModalReq.paymentStatus === 'verified' ? 'Paid & Verified' : 'Verifying / Awaiting Approval'}
                  </span>
                </div>
              </div>

              {/* Receipt Image Screenshot */}
              {proofModalReq.paymentProofUrl ? (
                <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col items-center">
                  <div className="text-[11px] font-bold text-slate-700 mb-2 w-full flex items-center justify-between">
                    <span>Customer Uploaded Screenshot:</span>
                    <a
                      href={requestAPI.getPaymentProofUrl(proofModalReq._id, proofModalReq.paymentProofUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#465FFF] hover:underline text-[10px] flex items-center gap-0.5"
                    >
                      Open original <ExternalLink size={10} />
                    </a>
                  </div>
                  <img
                    src={requestAPI.getPaymentProofUrl(proofModalReq._id, proofModalReq.paymentProofUrl)}
                    alt="Customer Payment Receipt"
                    className="max-h-[42vh] max-w-full rounded-lg border border-slate-200 object-contain shadow-xs bg-slate-100"
                  />
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <ImageOff size={24} className="mb-2 opacity-50" />
                  <span className="text-[11px] font-semibold text-center">No receipt image was attached to this order.</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setProofModalReq(null)}
                className="btn-premium-secondary !py-2 !px-4 !text-xs"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {proofModalReq.paymentStatus === 'verified' ? (
                  <button
                    type="button"
                    disabled={verifyingPaymentId === proofModalReq._id}
                    onClick={() => handleVerifyPayment(proofModalReq._id, 'paid_verifying')}
                    className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Mark as Unverified
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={verifyingPaymentId === proofModalReq._id}
                    onClick={() => handleVerifyPayment(proofModalReq._id, 'verified')}
                    className="btn-premium-sky !py-2 !px-5 !text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Check size={14} strokeWidth={3} />
                    {verifyingPaymentId === proofModalReq._id ? 'Verifying...' : 'Mark Payment as Verified'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note / Customer Notification Modal */}
      {noteModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#465FFF]" />
                  <h3 className="font-extrabold text-[#465FFF] text-sm sm:text-base">
                    Notify Customer / Report Issue
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Order #{noteModalReq._id.slice(-6).toUpperCase()} • Customer:{' '}
                  <span className="font-bold text-slate-700">
                    {noteModalReq.customerId?.name || 'Customer'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalReq(null)}
                className="w-7 h-7 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSendNote} className="p-5 overflow-y-auto space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Quick Scenario or Note Category:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NOTE_PRESETS.map((preset) => {
                    const isSelected = noteCategory === preset.category;
                    const IconComp = preset.icon;
                    return (
                      <button
                        key={preset.category}
                        type="button"
                        onClick={() => selectPreset(preset)}
                        className={`text-left p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-[#465FFF] text-white border-[#465FFF] shadow-xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${preset.color}15`,
                            color: isSelected ? '#FFFFFF' : preset.color,
                          }}
                        >
                          <IconComp size={13} />
                        </div>
                        <span className="leading-tight text-[11px]">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(noteCategory === 'power_outage' || noteCategory === 'equipment_maintenance' || noteDelayMinutes > 0) && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                    <Zap size={13} className="text-amber-600" />
                    <span>Estimated Printing Delay</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setNoteDelayMinutes(mins)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                          noteDelayMinutes === mins
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-100/50'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-auto">
                      <input
                        type="number"
                        min="0"
                        max="360"
                        value={noteDelayMinutes}
                        onChange={(e) => setNoteDelayMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-14 px-1.5 py-0.5 bg-white border border-amber-300 rounded text-xs font-bold text-amber-900 text-center"
                      />
                      <span className="text-amber-800 font-semibold text-[10px]">mins</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message to Customer:
                </label>
                <textarea
                  rows={3}
                  required
                  value={noteMessage}
                  onChange={(e) => setNoteMessage(e.target.value)}
                  placeholder="Explain the document issue or reason for delay clearly..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:border-[#465FFF] focus:ring-1 focus:ring-[#465FFF]/20 text-xs text-slate-800 placeholder:text-slate-400 outline-none leading-relaxed transition-all"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNoteModalReq(null)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNote || !noteMessage.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#465FFF] hover:bg-[#354EDB] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {submittingNote ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  <span>{submittingNote ? 'Sending...' : 'Send Alert'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Pickup Modal */}
      {confirmingPickupReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-slate-700 w-full max-w-md overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 bg-[#F4F7FB] dark:bg-slate-700/60 border-b border-[#E2E8F0] dark:border-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#465FFF] dark:text-sky-400" />
                <h3 className="font-extrabold text-[#101828] dark:text-white text-sm sm:text-base">
                  Confirm Pickup?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isConfirmingPickup && setConfirmingPickupReq(null)}
                disabled={isConfirmingPickup}
                className="w-7 h-7 rounded-lg bg-slate-200/60 hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-[#101828] dark:text-slate-200 font-medium text-sm leading-relaxed">
                The customer has received the printed documents.
              </p>

              {/* Order summary preview */}
              <div className="p-3.5 rounded-xl bg-[#F4F7FB] dark:bg-slate-700/40 border border-[#E2E8F0] dark:border-slate-600 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#60728F] dark:text-slate-400">Customer:</span>
                  <span className="font-bold text-[#101828] dark:text-white">
                    {confirmingPickupReq.customerId?.name || 'Customer'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#60728F] dark:text-slate-400">File:</span>
                  <span className="font-bold text-[#101828] dark:text-white truncate max-w-[200px]">
                    {confirmingPickupReq.documentId?.originalFilename || 'Document'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#60728F] dark:text-slate-400">Details:</span>
                  <span className="font-bold text-[#101828] dark:text-white">
                    {formatSpecs(confirmingPickupReq.printingSpecifications || {})}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#E2E8F0]/60 dark:border-slate-600">
                  <span className="text-[#60728F] dark:text-slate-400">Price:</span>
                  <span className="font-black text-sm text-[#465FFF] dark:text-sky-400">
                    ₱{parseFloat(confirmingPickupReq.estimatedCost || 0).toFixed(2)} estimated
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-[#E2E8F0]/60 dark:border-slate-600">
                  <span className="text-[#60728F] dark:text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Ready for Pickup
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-[#F4F7FB] dark:bg-slate-700/60 border-t border-[#E2E8F0] dark:border-slate-600 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingPickupReq(null)}
                disabled={isConfirmingPickup}
                className="px-4 py-2 rounded-xl border border-[#E2E8F0] dark:border-slate-600 bg-white dark:bg-slate-700 text-[#101828] dark:text-white font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPickup}
                disabled={isConfirmingPickup}
                className="px-4 py-2 rounded-xl bg-[#465FFF] hover:bg-[#354EDB] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isConfirmingPickup ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Confirm Pickup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
