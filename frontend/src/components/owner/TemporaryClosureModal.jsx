import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  Zap,
  Wrench,
  AlertOctagon,
  HelpCircle,
  Calendar,
  Check,
  RefreshCw,
  Power
} from 'lucide-react';
import toast from 'react-hot-toast';

const REASONS = [
  { id: 'closing_early', label: 'Closing Early', icon: Clock, defaultAdvisory: 'Closing early for today. We will reopen on schedule.' },
  { id: 'temporary_closure', label: 'Temporary Closure', icon: Power, defaultAdvisory: 'The shop is temporarily closed and will reopen shortly.' },
  { id: 'power_outage', label: 'Power Outage', icon: Zap, defaultAdvisory: 'Printing services are temporarily paused due to a local power interruption.' },
  { id: 'equipment_problem', label: 'Equipment Problem', icon: Wrench, defaultAdvisory: 'Printers are currently undergoing maintenance. Resuming operations soon.' },
  { id: 'emergency', label: 'Emergency', icon: AlertOctagon, defaultAdvisory: 'Shop is closed due to an unforeseen emergency.' },
  { id: 'other', label: 'Other', icon: HelpCircle, defaultAdvisory: 'The shop is temporarily unavailable.' },
];

export default function TemporaryClosureModal({
  isOpen,
  onClose,
  shop,
  onConfirm,
  loading = false,
}) {
  const currentClosure = shop?.temporaryClosure || {};
  const isEditing = Boolean(currentClosure?.isClosed);

  // Form states
  const [reason, setReason] = useState('temporary_closure');
  const [customReason, setCustomReason] = useState('');
  const [advisoryMessage, setAdvisoryMessage] = useState('');
  const [reopenType, setReopenType] = useState('next_scheduled_opening');
  const [reopenDate, setReopenDate] = useState('');
  const [reopenTime, setReopenTime] = useState('17:00');

  // Pre-fill on open
  useEffect(() => {
    if (!isOpen) return;

    if (currentClosure?.isClosed) {
      setReason(currentClosure.reason || 'temporary_closure');
      setCustomReason(currentClosure.customReason || '');
      setAdvisoryMessage(currentClosure.advisoryMessage || '');
      setReopenType(currentClosure.reopenType || 'next_scheduled_opening');

      if (currentClosure.reopenAt) {
        const d = new Date(currentClosure.reopenAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setReopenDate(`${yyyy}-${mm}-${dd}`);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setReopenTime(`${hh}:${min}`);
      }
    } else {
      // Default to closing early or power outage
      setReason('closing_early');
      setCustomReason('');
      setAdvisoryMessage('');
      setReopenType('next_scheduled_opening');

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setReopenDate(`${yyyy}-${mm}-${dd}`);
      now.setHours(now.getHours() + 2);
      const hh = String(now.getHours()).padStart(2, '0');
      setReopenTime(`${hh}:00`);
    }
  }, [isOpen, currentClosure?.isClosed]);

  // When reason changes, set default advisory if user hasn't typed custom message
  const handleSelectReason = (rId) => {
    setReason(rId);
    const selected = REASONS.find((r) => r.id === rId);
    if (selected && (!advisoryMessage || REASONS.some((r) => r.defaultAdvisory === advisoryMessage))) {
      setAdvisoryMessage(selected.defaultAdvisory);
    }
  };

  // Next scheduled opening display text from shop
  const nextOpeningText = useMemo(() => {
    return shop?.nextOpening?.formattedText || 'Tomorrow at 8:00 AM';
  }, [shop?.nextOpening]);

  // Quick preset buttons for custom time
  const handleApplyPresetHours = (hoursToAdd) => {
    const target = new Date();
    target.setHours(target.getHours() + hoursToAdd);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    setReopenDate(`${yyyy}-${mm}-${dd}`);
    const hh = String(target.getHours()).padStart(2, '0');
    const min = String(target.getMinutes()).padStart(2, '0');
    setReopenTime(`${hh}:${min}`);
    setReopenType('specific_time');
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let finalReopenAt = null;
    if (reopenType === 'specific_time') {
      if (!reopenDate || !reopenTime) {
        toast.error('Please specify both a date and time for reopening.');
        return;
      }
      finalReopenAt = new Date(`${reopenDate}T${reopenTime}:00`);
      if (isNaN(finalReopenAt.getTime())) {
        toast.error('Invalid reopening date or time.');
        return;
      }
      if (finalReopenAt <= new Date()) {
        toast.error('Reopening time must be in the future.');
        return;
      }
    }

    onConfirm({
      reason,
      customReason: reason === 'other' ? customReason.trim() : '',
      advisoryMessage: advisoryMessage.trim(),
      reopenType,
      reopenAt: finalReopenAt ? finalReopenAt.toISOString() : null,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-theme-lg border border-gray-200 dark:border-gray-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400 flex items-center justify-center font-bold">
              <Power size={16} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base tracking-tight m-0">
                {isEditing ? 'Edit Temporary Closure' : 'Close Shop Temporarily'}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 m-0">
                Manual override will immediately close the shop until reopening.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4.5 text-xs flex-1">
          {/* 1. Reason Selection */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] mb-2">
              Closure Reason
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {REASONS.map((r) => {
                const isSelected = reason === r.id;
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectReason(r.id)}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-error-50 dark:bg-error-500/10 border-error-500 text-error-700 dark:text-error-300 ring-1 ring-error-500'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={14} className={isSelected ? 'text-error-600 dark:text-error-400' : 'text-gray-400'} />
                    <span className="text-[11px] truncate">{r.label}</span>
                  </button>
                );
              })}
            </div>

            {reason === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Specify custom reason..."
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none focus:border-brand-500"
                />
              </div>
            )}
          </div>

          {/* 2. Customer-Facing Advisory */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] mb-1.5">
              Customer Advisory Message (Optional)
            </label>
            <textarea
              rows={2}
              value={advisoryMessage}
              onChange={(e) => setAdvisoryMessage(e.target.value)}
              placeholder="Message displayed to customers on your shop profile and notifications..."
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none focus:border-brand-500 leading-relaxed"
            />
          </div>

          {/* 3. Reopening Schedule Options */}
          <div className="space-y-2.5 pt-1">
            <label className="block font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px]">
              When Should The Shop Reopen?
            </label>

            {/* Option A: Next scheduled opening */}
            <label
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                reopenType === 'next_scheduled_opening'
                  ? 'bg-brand-50/60 dark:bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-300 ring-1 ring-brand-500'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reopenType"
                value="next_scheduled_opening"
                checked={reopenType === 'next_scheduled_opening'}
                onChange={() => setReopenType('next_scheduled_opening')}
                className="mt-0.5 text-brand-500 focus:ring-brand-500"
              />
              <div className="space-y-0.5 min-w-0">
                <span className="font-semibold text-xs block text-gray-900 dark:text-white">
                  Resume automatically at next scheduled opening
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                  Next opening: <strong className="text-brand-500 dark:text-brand-400">{nextOpeningText}</strong>
                </span>
              </div>
            </label>

            {/* Option B: Specific date and time */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                reopenType === 'specific_time'
                  ? 'bg-brand-50/60 dark:bg-brand-500/10 border-brand-500 ring-1 ring-brand-500'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="reopenType"
                  value="specific_time"
                  checked={reopenType === 'specific_time'}
                  onChange={() => setReopenType('specific_time')}
                  className="mt-0.5 text-brand-500 focus:ring-brand-500"
                />
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold text-xs block text-gray-900 dark:text-white">
                    Set a specific reopening date and time
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Closure expires and automatic schedule resumes at this exact moment
                  </span>
                </div>
              </label>

              {reopenType === 'specific_time' && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 block mb-1">Date</label>
                      <input
                        type="date"
                        value={reopenDate}
                        onChange={(e) => setReopenDate(e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-semibold outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 block mb-1">Time</label>
                      <input
                        type="time"
                        value={reopenTime}
                        onChange={(e) => setReopenTime(e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-semibold outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase">Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetHours(1)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 hover:bg-gray-100 cursor-pointer"
                    >
                      +1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetHours(2)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 hover:bg-gray-100 cursor-pointer"
                    >
                      +2 Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetHours(4)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 hover:bg-gray-100 cursor-pointer"
                    >
                      +4 Hours
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-600 hover:text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-error-500 hover:bg-error-600 text-white text-xs font-medium transition-all shadow-theme-xs inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              <span>{isEditing ? 'Update Closure' : 'Confirm Temporary Closure'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
