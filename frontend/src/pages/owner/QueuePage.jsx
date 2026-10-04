import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { shopAPI, requestAPI, documentAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import {
  Printer, CheckCircle2, Clock, Zap, FileText, Eye,
  RefreshCw, Play, Check, ChevronRight, AlertCircle, Phone,
  ArrowUp, ArrowDown, MoreHorizontal, MessageSquare, Pause,
  X, Send, ChevronDown, CheckCheck, GripVertical
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  calculateQueueStats,
  getRemainingJobTime,
  estimateJobPrintingTime,
  detectPrinterChannel
} from '../../utils/queueCalculator';

const QUEUE_STAGES = [
  { key: 'all', label: 'All Jobs' },
  { key: 'printing', label: 'Printing' },
  { key: 'queued', label: 'Waiting' },
  { key: 'ready', label: 'Ready' },
];

const PRINT_TYPE_OPTIONS = [
  { key: 'all', label: 'All Types' },
  { key: 'bw_laser', label: 'Black & White' },
  { key: 'color_inkjet', label: 'Color' },
];

const STATUS_CONFIG = {
  queued: {
    label: 'WAITING',
    textColor: 'text-amber-800',
    bgColor: 'bg-[#FFF7ED]',
    borderColor: 'border-[#FDBA74]',
    dotColor: 'bg-amber-500',
  },
  accepted: {
    label: 'WAITING',
    textColor: 'text-amber-800',
    bgColor: 'bg-[#FFF7ED]',
    borderColor: 'border-[#FDBA74]',
    dotColor: 'bg-amber-500',
  },
  printing: {
    label: 'PRINTING',
    textColor: 'text-blue-800',
    bgColor: 'bg-[#EFF6FF]',
    borderColor: 'border-[#BFDBFE]',
    dotColor: 'bg-blue-600',
  },
  ready: {
    label: 'READY',
    textColor: 'text-emerald-800',
    bgColor: 'bg-[#ECFDF5]',
    borderColor: 'border-[#A7F3D0]',
    dotColor: 'bg-emerald-600',
  },
  completed: {
    label: 'COMPLETED',
    textColor: 'text-emerald-900',
    bgColor: 'bg-[#F0FDF4]',
    borderColor: 'border-[#BBF7D0]',
    dotColor: 'bg-emerald-700',
  },
};

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
    icon: AlertCircle,
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
    icon: Printer,
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

export default function OwnerQueuePage() {
  const [shop, setShop] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeStage, setActiveStage] = useState('all');
  const [printerFilter, setPrinterFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);

  // Note Modal State
  const [noteModalReq, setNoteModalReq] = useState(null);
  const [noteCategory, setNoteCategory] = useState('file_issue');
  const [noteMessage, setNoteMessage] = useState('');
  const [noteDelayMinutes, setNoteDelayMinutes] = useState(0);
  const [submittingNote, setSubmittingNote] = useState(false);

  const { socket, joinShopRoom } = useSocket() || {};
  const actionMenuRef = useRef(null);

  const shopId = shop?._id;

  // Close action menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchShopAndQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const resShop = await shopAPI.getMyShop();
      const sData = resShop.data;
      setShop(sData);
      if (sData?._id) {
        joinShopRoom?.(sData._id);
        const resReqs = await requestAPI.getShopRequests(sData._id);
        const reqsList = resReqs.data?.requests || (Array.isArray(resReqs.data) ? resReqs.data : []);
        setRequests(reqsList);
      }
    } catch (err) {
      console.error('Error fetching queue:', err);
      setError(err.message || 'Unable to calculate queue.');
      toast.error('Unable to load queue data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [joinShopRoom]);

  useEffect(() => {
    fetchShopAndQueue();
  }, [fetchShopAndQueue]);

  useEffect(() => {
    if (!socket || !shopId) return;
    const refresh = () => {
      requestAPI.getShopRequests(shopId).then(res => {
        const reqsList = res.data?.requests || (Array.isArray(res.data) ? res.data : []);
        setRequests(reqsList);
        setError(null);
      }).catch(err => {
        console.error('Realtime queue update error:', err);
      });
    };

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
  }, [socket, shopId]);

  const activeQueue = useMemo(() => {
    const list = Array.isArray(requests) ? requests : (requests?.requests || []);
    return list.filter(r => ['accepted', 'queued', 'printing', 'ready'].includes(r.status));
  }, [requests]);

  // Centralized Queue & Workload Calculation
  const stats = useMemo(() => {
    return calculateQueueStats(requests, shop?.pricing);
  }, [requests, shop?.pricing]);

  const filteredQueue = useMemo(() => {
    const list = activeQueue.filter(r => {
      const matchStage =
        activeStage === 'all' ? true :
        activeStage === 'printing' ? r.status === 'printing' :
        activeStage === 'queued' ? ['accepted', 'queued'].includes(r.status) :
        activeStage === 'ready' ? r.status === 'ready' : true;

      const itemChannel = detectPrinterChannel(r);
      const matchPrinter = printerFilter === 'all' || itemChannel === printerFilter;

      const customerName = r.customerId?.name || 'Customer';
      const fileName = r.documentId?.originalFilename || '';
      const orderId = r._id || '';
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        customerName.toLowerCase().includes(q) ||
        fileName.toLowerCase().includes(q) ||
        orderId.toLowerCase().includes(q);

      return matchStage && matchPrinter && matchSearch;
    });

    // Priority sorting: Active printing first, then Rush orders, then FIFO
    return [...list].sort((a, b) => {
      if (a.status === 'printing' && b.status !== 'printing') return -1;
      if (b.status === 'printing' && a.status !== 'printing') return 1;

      if (a.isRush && !b.isRush) return -1;
      if (!a.isRush && b.isRush) return 1;

      const timeA = new Date(a.acceptedAt || a.submittedAt || a.createdAt).getTime();
      const timeB = new Date(b.acceptedAt || b.submittedAt || b.createdAt).getTime();
      return timeA - timeB;
    });
  }, [activeQueue, activeStage, printerFilter, search]);

  const updateStatus = async (id, newStatus) => {
    setUpdatingId(id);
    setActionMenuId(null);
    try {
      await requestAPI.updateStatus(id, newStatus);
      const label = STATUS_CONFIG[newStatus]?.label || newStatus;
      toast.success(`Job marked as ${label}`);
      setRequests(prev => (Array.isArray(prev) ? prev : []).map(r => r._id === id ? { ...r, status: newStatus } : r));
    } catch (err) {
      toast.error(err.message || 'Status update failed.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmPickup = async (id) => {
    setUpdatingId(id);
    setActionMenuId(null);
    try {
      await requestAPI.updateStatus(id, 'picked_up');
      await requestAPI.updateStatus(id, 'completed');
      toast.success('Pickup confirmed and order completed!');
      setRequests(prev => (Array.isArray(prev) ? prev : []).filter(r => r._id !== id));
    } catch (err) {
      toast.error(err.message || 'Pickup confirmation failed.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMoveQueue = (idx, direction) => {
    setActionMenuId(null);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= filteredQueue.length) return;

    const newList = [...filteredQueue];
    const temp = newList[idx];
    newList[idx] = newList[targetIdx];
    newList[targetIdx] = temp;

    // Update state order
    setRequests(prev => {
      const remaining = prev.filter(r => !newList.some(n => n._id === r._id));
      return [...newList, ...remaining];
    });
    toast.success(`Moved #${idx + 1} to position #${targetIdx + 1}`);
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
      await requestAPI.addShopNote(noteModalReq._id, {
        category: noteCategory,
        message: noteMessage.trim(),
        delayMinutes: noteDelayMinutes,
      });
      toast.success('Customer notified of alert!');
      setNoteModalReq(null);
    } catch (err) {
      toast.error(err.message || 'Failed to send note to customer.');
    } finally {
      setSubmittingNote(false);
    }
  };

  const formatSpecsLine = (specs) => {
    const parts = [];
    const p = specs.totalPages || 1;
    const c = specs.copies || 1;
    parts.push(`${p}p • ${c}c`);
    parts.push(specs.colorMode === 'color' ? 'Color' : 'B&W');
    return parts.join(' ');
  };

  return (
    <div className="w-full space-y-4 font-outfit">
      {/* 1. Queue Overview (4 Responsive Compact KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* PRINTING */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            PRINTING
          </div>
          <div className="text-2xl font-black text-[#465FFF] mt-1 leading-none">
            {loading ? '—' : error ? '—' : stats.printingCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Active jobs
          </div>
        </div>

        {/* WAITING */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            WAITING
          </div>
          <div className="text-2xl font-black text-[#465FFF] mt-1 leading-none">
            {loading ? '—' : error ? '—' : stats.queuedCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Next jobs
          </div>
        </div>

        {/* READY */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            READY
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1 leading-none">
            {loading ? '—' : error ? '—' : stats.readyCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Pickup
          </div>
        </div>

        {/* QUEUE TIME */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            QUEUE TIME
          </div>
          <div className="text-2xl font-black text-[#465FFF] mt-1 leading-none">
            {loading ? (
              <span className="text-slate-400 font-bold">—</span>
            ) : error ? (
              <span className="text-slate-400 font-bold">—</span>
            ) : (
              <>
                {stats.totalWaitMinutes}{' '}
                <span className="text-xs font-bold text-slate-400">min</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {loading ? (
              'Calculating...'
            ) : error ? (
              'Unable to calculate'
            ) : (stats.totalWaitMinutes === 0 && stats.printingCount === 0 && stats.queuedCount === 0) ? (
              'No active workload'
            ) : (
              'Estimated wait time'
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Section — Print Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header + Search + Refresh */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            PRINT QUEUE
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customer or file..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#465FFF] focus:bg-white focus:ring-1 focus:ring-[#465FFF]/20 transition-all"
              />
              <Clock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={fetchShopAndQueue}
              disabled={loading}
              title="Refresh queue"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 shrink-0"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filter Bar (One Clean Row) */}
        <div className="px-3 sm:px-3.5 py-2 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {QUEUE_STAGES.map(stage => {
              const isActive = activeStage === stage.key;
              const count =
                stage.key === 'all' ? stats.totalCount :
                stage.key === 'printing' ? stats.printingCount :
                stage.key === 'queued' ? stats.queuedCount :
                stage.key === 'ready' ? stats.readyCount : 0;

              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setActiveStage(stage.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#465FFF] text-white border-[#465FFF] shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{stage.label}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <label className="text-[11px] font-semibold text-slate-500">Print Type:</label>
            <select
              value={printerFilter}
              onChange={e => setPrinterFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-none focus:border-[#465FFF]"
            >
              {PRINT_TYPE_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 10. Empty Queue State */}
        {filteredQueue.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5">
              <CheckCheck size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-800 m-0">Queue is clear</h3>
            <p className="text-xs text-slate-400 mt-1 m-0">
              No active print jobs right now.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Queue Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">CUSTOMER / FILE</th>
                    <th className="py-2.5 px-3">SPECIFICATION</th>
                    <th className="py-2.5 px-3">PRINT TYPE</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">TIME</th>
                    <th className="py-2.5 px-3 text-right w-12">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQueue.map((req, idx) => {
                    const customerName = req.customerId?.name || 'Customer';
                    const specs = req.printingSpecifications || {};
                    const doc = req.documentId;
                    const isPrinting = req.status === 'printing';
                    const isReady = req.status === 'ready';
                    const isWaiting = req.status === 'queued' || req.status === 'accepted';
                    const channel = detectPrinterChannel(req);
                    const printerLabel = channel === 'color_inkjet' ? 'Color Printing' : 'Black & White Printing';
                    const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.queued;
                    const isMenuOpen = actionMenuId === req._id;

                    const jobRemainingMinutes = getRemainingJobTime(req, shop?.pricing);
                    const jobEstimatedMinutes = estimateJobPrintingTime(req, shop?.pricing);

                    return (
                      <tr key={req._id} className="hover:bg-slate-50/50 transition-colors">
                        {/* # Sequence Number */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 text-slate-400">
                            <span className="text-slate-300">⋮⋮</span>
                            <span className="font-bold text-slate-700 font-mono text-xs">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </div>
                        </td>

                        {/* CUSTOMER / FILE */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                            <span>{customerName}</span>
                            {req.isRush && (
                              <span className="px-1 py-0.2 rounded bg-amber-500 text-white font-black text-[9px] flex items-center gap-0.5">
                                <Zap size={9} className="fill-white" /> RUSH
                              </span>
                            )}
                          </div>
                          {doc ? (
                            <button
                              type="button"
                              onClick={() => handleViewDocument(doc)}
                              title="Click to preview file"
                              className="text-xs text-[#465FFF] hover:underline font-semibold flex items-center gap-1 text-left truncate max-w-[200px] mt-0.5 cursor-pointer"
                            >
                              <FileText size={11} className="shrink-0" />
                              <span className="truncate">{doc.originalFilename || 'Document'}</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* SPECIFICATION */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {formatSpecsLine(specs)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {specs.paperSize || 'A4'}
                            {specs.binding && specs.binding !== 'none' && ` • ${specs.binding}`}
                          </div>
                        </td>

                        {/* PRINTER */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              channel === 'color_inkjet'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {printerLabel}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border inline-flex items-center gap-1.5 ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                            {statusConfig.label}
                          </span>
                        </td>

                        {/* TIME */}
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600">
                          {isReady ? (
                            <span className="text-emerald-700 font-bold">Pickup</span>
                          ) : isPrinting ? (
                            <span className="text-blue-700 font-semibold">~{jobRemainingMinutes} min</span>
                          ) : (
                            <span>{jobEstimatedMinutes} min</span>
                          )}
                        </td>

                        {/* ACTIONS (⋯ Menu) */}
                        <td className="py-2.5 px-3 text-right relative whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setActionMenuId(isMenuOpen ? null : req._id)}
                            title="Actions"
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                          >
                            <MoreHorizontal size={15} />
                          </button>

                          {isMenuOpen && (
                            <div
                              ref={actionMenuRef}
                              className="absolute right-3 top-8 z-30 w-44 bg-white rounded-lg border border-slate-200 shadow-lg py-1 text-left text-xs"
                            >
                              {/* Waiting Actions */}
                              {isWaiting && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(req._id, 'printing')}
                                    className="w-full px-3 py-1.5 hover:bg-blue-50 text-[#465FFF] font-semibold flex items-center gap-2"
                                  >
                                    <Play size={13} />
                                    <span>Start Printing</span>
                                  </button>
                                  {idx > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveQueue(idx, 'up')}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                    >
                                      <ArrowUp size={13} />
                                      <span>Move Up</span>
                                    </button>
                                  )}
                                  {idx < filteredQueue.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleMoveQueue(idx, 'down')}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                    >
                                      <ArrowDown size={13} />
                                      <span>Move Down</span>
                                    </button>
                                  )}
                                </>
                              )}

                              {/* Printing Actions */}
                              {isPrinting && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(req._id, 'queued')}
                                    className="w-full px-3 py-1.5 hover:bg-amber-50 text-amber-700 flex items-center gap-2"
                                  >
                                    <Pause size={13} />
                                    <span>Pause to Waiting</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(req._id, 'ready')}
                                    className="w-full px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-2"
                                  >
                                    <Check size={13} />
                                    <span>Mark as Ready</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStatus(req._id, 'completed')}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Mark as Completed</span>
                                  </button>
                                </>
                              )}

                              {/* Ready Actions */}
                              {isReady && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmPickup(req._id)}
                                  className="w-full px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-2"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Mark as Picked Up</span>
                                </button>
                              )}

                              <div className="my-1 border-t border-slate-100" />

                              {doc && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionMenuId(null);
                                    handleViewDocument(doc);
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                                >
                                  <Eye size={13} />
                                  <span>View File</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openNoteModal(req)}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                              >
                                <MessageSquare size={13} />
                                <span>Add Note</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Queue Card View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredQueue.map((req, idx) => {
                const customerName = req.customerId?.name || 'Customer';
                const specs = req.printingSpecifications || {};
                const doc = req.documentId;
                const channel = req.printerChannel || (specs.colorMode === 'color' ? 'color_inkjet' : 'bw_laser');
                const printerLabel = channel === 'color_inkjet' ? 'Color Printing' : 'Black & White Printing';
                const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.queued;
                const isMenuOpen = actionMenuId === req._id;

                return (
                  <div key={req._id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-500 font-mono text-xs">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{customerName}</span>
                          {req.isRush && (
                            <span className="px-1 py-0.2 rounded bg-amber-500 text-white font-black text-[9px]">
                              RUSH
                            </span>
                          )}
                        </div>
                        {doc && (
                          <button
                            type="button"
                            onClick={() => handleViewDocument(doc)}
                            className="text-xs text-[#465FFF] hover:underline font-semibold flex items-center gap-1 mt-0.5"
                          >
                            <FileText size={11} />
                            <span className="truncate max-w-[180px]">{doc.originalFilename}</span>
                          </button>
                        )}
                      </div>

                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border inline-flex items-center gap-1 ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                          {statusConfig.label}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {req.status === 'ready'
                            ? 'Pickup'
                            : req.status === 'printing'
                            ? `~${getRemainingJobTime(req, shop?.pricing)} min`
                            : `${estimateJobPrintingTime(req, shop?.pricing)} min`}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium">
                      {specs.colorMode === 'color' ? 'Color' : 'B&W'} • {specs.paperSize || 'A4'} • {specs.totalPages || 1} pages
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-[11px] text-slate-600 font-semibold">{printerLabel}</span>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setActionMenuId(isMenuOpen ? null : req._id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-600"
                        >
                          <MoreHorizontal size={16} />
                        </button>

                        {isMenuOpen && (
                          <div
                            ref={actionMenuRef}
                            className="absolute right-0 bottom-7 z-30 w-44 bg-white rounded-lg border border-slate-200 shadow-lg py-1 text-left text-xs"
                          >
                            {req.status === 'queued' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(req._id, 'printing')}
                                className="w-full px-3 py-1.5 hover:bg-blue-50 text-[#465FFF] font-semibold flex items-center gap-2"
                              >
                                <Play size={13} />
                                <span>Start Printing</span>
                              </button>
                            )}
                            {req.status === 'printing' && (
                              <button
                                type="button"
                                onClick={() => updateStatus(req._id, 'ready')}
                                className="w-full px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-2"
                              >
                                <Check size={13} />
                                <span>Mark as Ready</span>
                              </button>
                            )}
                            {req.status === 'ready' && (
                              <button
                                type="button"
                                onClick={() => handleConfirmPickup(req._id)}
                                className="w-full px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-2"
                              >
                                <CheckCircle2 size={13} />
                                <span>Confirm Pickup</span>
                              </button>
                            )}
                            {doc && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuId(null);
                                  handleViewDocument(doc);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                              >
                                <Eye size={13} />
                                <span>View File</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openNoteModal(req)}
                              className="w-full px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                            >
                              <MessageSquare size={13} />
                              <span>Add Note</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 9. Printer Queue Section */}
      <div>
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2.5">
          PRINTER QUEUE
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Black & White Printing */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="font-bold text-sm text-slate-900">
              Black & White Printing
            </div>
            <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Available
            </div>
            <div className="text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Currently Printing:</span>
                <span className="font-bold text-slate-800">
                  {loading ? '—' : error ? '—' : stats.bwPrinting}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Jobs Waiting:</span>
                <span className="font-bold text-slate-800">
                  {loading ? '—' : error ? '—' : stats.bwWaiting}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>Estimated Wait:</span>
              <strong className="text-slate-800">
                {loading ? 'Calculating...' : error ? '—' : `${stats.bwEstMinutes} min`}
              </strong>
            </div>
          </div>

          {/* Color Printing */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
            <div className="font-bold text-sm text-slate-900">
              Color Printing
            </div>
            <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Available
            </div>
            <div className="text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Currently Printing:</span>
                <span className="font-bold text-slate-800">
                  {loading ? '—' : error ? '—' : stats.colorPrinting}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Jobs Waiting:</span>
                <span className="font-bold text-slate-800">
                  {loading ? '—' : error ? '—' : stats.colorWaiting}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 font-medium flex items-center justify-between">
              <span>Estimated Wait:</span>
              <strong className="text-slate-800">
                {loading ? 'Calculating...' : error ? '—' : `${stats.colorEstMinutes} min`}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Note Modal */}
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
    </div>
  );
}
