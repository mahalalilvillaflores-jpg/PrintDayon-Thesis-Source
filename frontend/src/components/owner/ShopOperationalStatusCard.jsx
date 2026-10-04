import { useMemo } from 'react';
import {
  Power,
  Clock,
  RotateCcw,
  Edit3,
  Store,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

const REASON_LABELS = {
  closing_early: 'Closing Early',
  temporary_closure: 'Temporary Closure',
  power_outage: 'Power Outage',
  equipment_problem: 'Equipment Problem',
  emergency: 'Emergency',
  other: 'Temporarily Unavailable',
};

export default function ShopOperationalStatusCard({
  shop,
  onOpenClosureModal,
  onReopenNow,
  reopening = false,
}) {
  const closure = shop?.temporaryClosure;
  const isManualClosure = Boolean(
    shop?.isManualClosure ||
    (closure?.isClosed && (!closure?.reopenAt || new Date() < new Date(closure?.reopenAt)))
  );

  // If manual closure is not active, status is strictly automatic based on schedule
  const isOpen = isManualClosure ? false : Boolean(shop?.isOpen);

  // Reason label
  const reasonKey = closure?.reason;
  const reasonText = closure?.customReason || REASON_LABELS[reasonKey] || 'Temporary Closure';

  // Reopen formatted text
  const reopenDisplay = useMemo(() => {
    if (shop?.reopenFormatted) return shop.reopenFormatted;
    if (closure?.reopenAt) {
      try {
        const d = new Date(closure.reopenAt);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const tmrw = new Date();
        tmrw.setDate(tmrw.getDate() + 1);
        const isTomorrow = d.toDateString() === tmrw.toDateString();
        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        if (isToday) return `Today at ${timeStr}`;
        if (isTomorrow) return `Tomorrow at ${timeStr}`;
        const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return `${dateStr} at ${timeStr}`;
      } catch {
        return '';
      }
    }
    if (shop?.nextOpening?.formattedText) {
      return shop.nextOpening.formattedText;
    }
    return 'Next scheduled opening';
  }, [shop?.reopenFormatted, closure?.reopenAt, shop?.nextOpening]);

  const advisory = closure?.advisoryMessage || shop?.advisoryMessage || '';

  return (
    <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-700/40 border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between h-full">
      {/* 1. Header with Title & Schedule Indicator */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-200/70 dark:border-slate-700/60">
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-slate-500 dark:text-slate-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Shop Status
            </span>
          </div>

          <div>
            {isManualClosure && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Manual Override</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Main Status Content Display */}
        {isManualClosure ? (
          /* 🔴 TEMPORARILY CLOSED (Manual Override Active) */
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-lg font-black text-rose-600 dark:text-rose-400 tracking-tight">
                TEMPORARILY CLOSED
              </span>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Reason:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{reasonText}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Reopens:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{reopenDisplay}</span>
              </div>
            </div>

            {advisory && (
              <div className="text-[11px] italic text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                &ldquo;{advisory}&rdquo;
              </div>
            )}
          </div>
        ) : isOpen ? (
          /* 🟢 OPEN (Based on schedule) */
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  OPEN
                </span>
              </div>
              {shop?.operationalCondition && shop.operationalCondition !== 'normal' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
                  {shop.operationalCondition === 'high_walkin'
                    ? 'High Counter Demand'
                    : shop.operationalCondition === 'service_delay'
                    ? 'Service Delay'
                    : shop.operationalCondition === 'equipment_problem'
                    ? 'Equipment Maintenance'
                    : 'Active Delay'}
                </span>
              )}
            </div>
            {shop?.nextOpening?.closeFormatted && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <Clock size={12} className="text-emerald-500" />
                <span>Open until {shop.nextOpening.closeFormatted}</span>
              </div>
            )}
            {shop?.operationalDelayMinutes > 0 && (
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                +{shop.operationalDelayMinutes} min added turnaround delay
              </div>
            )}
            {shop?.operationalMessage && (
              <div className="text-[11px] italic text-slate-600 dark:text-slate-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                &ldquo;{shop.operationalMessage}&rdquo;
              </div>
            )}
          </div>
        ) : (
          /* ⚪ CLOSED */
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
              <span className="text-lg font-black text-slate-700 dark:text-slate-300 tracking-tight">
                CLOSED
              </span>
            </div>
            {shop?.nextOpening?.formattedText && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs">
                <Clock size={13} className="text-[#465FFF] dark:text-sky-400" />
                <span>Next opening: {shop.nextOpening.formattedText}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Action Buttons */}
      <div className="pt-3 mt-2 border-t border-slate-200/70 dark:border-slate-700/60">
        {isManualClosure ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenClosureModal}
              className="flex-1 h-9 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Edit3 size={13} />
              <span>Edit Closure</span>
            </button>
            <button
              type="button"
              onClick={onReopenNow}
              disabled={reopening}
              className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={13} className={reopening ? 'animate-spin' : ''} />
              <span>Reopen Now</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenClosureModal}
            className="w-full h-9 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Power size={13} className="text-rose-500" />
            <span>Close Shop Temporarily</span>
          </button>
        )}
      </div>
    </div>
  );
}
