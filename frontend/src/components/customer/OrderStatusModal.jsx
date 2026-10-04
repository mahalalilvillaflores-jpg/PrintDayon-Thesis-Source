import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { requestAPI } from '../../services/api';
import {
  X, Store, Check, Clock, Printer, Package, CheckCircle2,
  AlertTriangle, XCircle, FileText, ExternalLink, RefreshCw,
  Sparkles, Layers
} from 'lucide-react';

const LIFECYCLE_STAGES = [
  { key: 'submitted', label: 'Submitted', altKeys: ['pending'], desc: 'Order placed online' },
  { key: 'accepted', label: 'Accepted', altKeys: [], desc: 'Shop approved order' },
  { key: 'queued', label: 'Order in Queue', altKeys: [], desc: 'Waiting in printing line' },
  { key: 'printing', label: 'Printing', altKeys: [], desc: 'Document running on printer' },
  { key: 'ready', label: 'Ready for Pickup', altKeys: ['ready_for_pickup'], desc: 'Ready to collect at shop' },
  { key: 'picked_up', label: 'Picked Up', altKeys: [], desc: 'Received by customer' },
  { key: 'completed', label: 'Completed', altKeys: [], desc: 'Order fulfilled' },
];

export default function OrderStatusModal({ order, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const orderId = order?._id || order?.id;

  // Format timestamp helper
  const formatDateTime = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Fetch complete status history if needed
  useEffect(() => {
    if (!isOpen || !orderId) return;

    if (order?.statusHistory && Array.isArray(order.statusHistory) && order.statusHistory.length > 0) {
      setHistory(order.statusHistory);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await requestAPI.getStatusHistory(orderId);
        if (isMounted) {
          setHistory(res.data?.data || res.data || []);
        }
      } catch (err) {
        // Fallback: build basic history from timestamps on the order object
        if (isMounted) {
          const fallback = [];
          const shopName = order.shopName || order.shopId?.shopName || 'Shop';
          if (order.submittedAt || order.createdAt) {
            fallback.push({ status: 'submitted', message: `Order submitted to ${shopName}`, createdAt: order.submittedAt || order.createdAt });
          }
          if (order.acceptedAt) {
            fallback.push({ status: 'accepted', message: `Order accepted by ${shopName}`, createdAt: order.acceptedAt });
          }
          if (order.queuedAt) {
            fallback.push({ status: 'queued', message: `Order placed in queue`, createdAt: order.queuedAt });
          }
          if (order.printingStartedAt) {
            fallback.push({ status: 'printing', message: `Printing in progress`, createdAt: order.printingStartedAt });
          }
          if (order.readyAt) {
            fallback.push({ status: 'ready', message: `Ready for pickup`, createdAt: order.readyAt });
          }
          if (order.pickedUpAt) {
            fallback.push({ status: 'picked_up', message: `Documents picked up`, createdAt: order.pickedUpAt });
          }
          if (order.completedAt) {
            fallback.push({ status: 'completed', message: `Order completed`, createdAt: order.completedAt });
          }
          if (order.rejectedAt || (order.status === 'rejected' && order.updatedAt)) {
            fallback.push({ status: 'rejected', message: order.rejectionReason ? `Order declined: ${order.rejectionReason}` : 'Order declined', createdAt: order.rejectedAt || order.updatedAt });
          }
          if (order.cancelledAt || (order.status === 'cancelled' && order.updatedAt)) {
            fallback.push({ status: 'cancelled', message: order.cancellationReason ? `Order cancelled: ${order.cancellationReason}` : 'Order cancelled', createdAt: order.cancelledAt || order.updatedAt });
          }
          setHistory(fallback);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [isOpen, orderId, order]);

  // Map each lifecycle stage to its history entry and timing
  const timelineStages = useMemo(() => {
    if (!order) return [];

    const currentStatus = order.status || 'submitted';
    const isTerminalFail = currentStatus === 'rejected' || currentStatus === 'cancelled';

    // Map history entries by status key
    const historyMap = {};
    history.forEach((h) => {
      const s = h.status;
      if (s === 'pending') historyMap['submitted'] = h;
      else if (s === 'ready_for_pickup') historyMap['ready'] = h;
      else historyMap[s] = h;
    });

    // Determine current index in standard lifecycle
    let currentIdx = LIFECYCLE_STAGES.findIndex(
      (stage) => stage.key === currentStatus || stage.altKeys.includes(currentStatus)
    );
    if (currentIdx === -1) {
      if (currentStatus === 'pending') currentIdx = 0;
      else if (currentStatus === 'ready_for_pickup') currentIdx = 4;
      else currentIdx = 0;
    }

    const stages = LIFECYCLE_STAGES.map((stage, idx) => {
      const histItem = historyMap[stage.key];
      let timestamp = histItem ? histItem.createdAt || histItem.created_at : null;

      // Fallback to order fields if histItem not found
      if (!timestamp) {
        if (stage.key === 'submitted') timestamp = order.submittedAt || order.createdAt;
        else if (stage.key === 'accepted') timestamp = order.acceptedAt;
        else if (stage.key === 'queued') timestamp = order.queuedAt;
        else if (stage.key === 'printing') timestamp = order.printingStartedAt;
        else if (stage.key === 'ready') timestamp = order.readyAt;
        else if (stage.key === 'picked_up') timestamp = order.pickedUpAt;
        else if (stage.key === 'completed') timestamp = order.completedAt;
      }

      const isCurrent = !isTerminalFail && idx === currentIdx;
      const isCompleted = !isTerminalFail && idx < currentIdx;
      const isUpcoming = !isTerminalFail && idx > currentIdx;

      return {
        ...stage,
        isCurrent,
        isCompleted,
        isUpcoming,
        timestamp: formatDateTime(timestamp),
        rawTimestamp: timestamp,
        message: histItem?.message || stage.desc,
      };
    });

    // If cancelled or rejected, append terminal notice
    if (isTerminalFail) {
      const failHist = historyMap[currentStatus];
      const failTime = failHist?.createdAt || failHist?.created_at || order.updatedAt;
      const failReason = order.rejectionReason || order.cancellationReason || failHist?.message || '';

      stages.push({
        key: currentStatus,
        label: currentStatus === 'rejected' ? 'Order Declined' : 'Order Cancelled',
        desc: failReason || (currentStatus === 'rejected' ? 'Declined by shop' : 'Cancelled by customer'),
        isCurrent: true,
        isCompleted: false,
        isUpcoming: false,
        isTerminal: true,
        timestamp: formatDateTime(failTime),
        message: failReason,
      });
    }

    return stages;
  }, [order, history]);

  if (!isOpen || !order) return null;

  const claimCode = order.claimCode || (order._id ? `#PD-${order._id.slice(-4).toUpperCase()}` : '#PD-ORDER');
  const shopName = order.shopName || order.shopId?.shopName || 'Printing Shop';
  const docName = order.documentName || order.documentId?.originalFilename || order.fileName || 'Document.pdf';
  const specs = order.specsSummary || order.printingSpecificationsSummary || '';
  const totalCost = order.estimatedCost
    ? (typeof order.estimatedCost === 'number' ? `₱${order.estimatedCost.toFixed(2)}` : order.estimatedCost)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-lg w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-xs text-[#19398d] dark:text-sky-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">
                {claimCode}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Order Lifecycle
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[#172033] dark:text-white mt-1 m-0 flex items-center gap-1.5">
              <Store size={15} className="text-[#19398d] dark:text-sky-400 shrink-0" />
              <span className="truncate">{shopName}</span>
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Order Details Banner */}
        <div className="p-3 sm:px-5 sm:py-3 bg-slate-50/80 dark:bg-slate-750 border-b border-slate-100 dark:border-slate-700 text-xs shrink-0 flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <div className="font-bold text-[#172033] dark:text-white truncate max-w-[280px]">
              {docName}
            </div>
            {specs && (
              <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                {specs}
              </span>
            )}
          </div>
          {totalCost && (
            <div className="text-right shrink-0">
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">Total</span>
              <span className="font-black text-[#19398d] dark:text-sky-400 text-sm">
                {totalCost}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Progress Timeline */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 m-0">
              Status Progress Timeline
            </h4>
            {loading && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <RefreshCw size={11} className="animate-spin" /> Syncing...
              </span>
            )}
          </div>

          {/* Vertical Progress Timeline with Timestamps */}
          <div className="relative pl-6 space-y-3.5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-700">
            {timelineStages.map((stage, idx) => {
              const { key, label, isCurrent, isCompleted, isUpcoming, isTerminal, timestamp, message } = stage;

              let dotBg = 'bg-slate-200 dark:bg-slate-700 text-slate-400';
              let ringClass = '';
              let titleColor = 'text-slate-400 dark:text-slate-500';

              if (isTerminal) {
                dotBg = 'bg-rose-600 text-white';
                ringClass = 'ring-4 ring-rose-100 dark:ring-rose-950/60 animate-pulse';
                titleColor = 'text-rose-700 dark:text-rose-400 font-bold';
              } else if (isCurrent) {
                dotBg = 'bg-[#19398d] text-white';
                ringClass = 'ring-4 ring-blue-100 dark:ring-blue-950/60 animate-pulse';
                titleColor = 'text-[#19398d] dark:text-sky-400 font-black';
              } else if (isCompleted) {
                dotBg = 'bg-emerald-600 text-white';
                titleColor = 'text-slate-800 dark:text-slate-200 font-bold';
              }

              return (
                <div key={key || idx} className="relative flex items-start gap-3 text-xs">
                  {/* Circle Indicator */}
                  <div
                    className={`absolute -left-[24px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${dotBg} ${ringClass}`}
                  >
                    {isCompleted ? (
                      <Check size={11} strokeWidth={3} />
                    ) : isTerminal ? (
                      '✕'
                    ) : isCurrent ? (
                      '●'
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Stage Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${titleColor}`}>
                          {label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-[#19398d] dark:text-sky-300">
                            Current
                          </span>
                        )}
                      </div>

                      {/* Actual Timestamp */}
                      {timestamp && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock size={10} className="text-slate-400" />
                          <span>{timestamp}</span>
                        </span>
                      )}
                    </div>

                    <p className="m-0 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {message || stage.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:px-5 sm:py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
          <Link
            to={`/my-requests/${orderId}`}
            onClick={onClose}
            className="py-1.5 px-3.5 rounded-lg bg-[#19398d] hover:bg-[#122b6d] text-white font-bold text-xs inline-flex items-center gap-1.5 transition-colors shadow-2xs no-underline"
          >
            <span>Full Tracking Details</span>
            <ExternalLink size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
