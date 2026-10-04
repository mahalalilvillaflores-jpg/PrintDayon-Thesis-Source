import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Store, Clock, Users, MapPin, Phone,
  CheckCircle2, ArrowRight, Sparkles, Copy, Check,
  Printer, AlertCircle, ChevronDown, ChevronUp, Map,
  Zap, ShieldCheck
} from 'lucide-react';

const STATUS_CONFIGS = {
  ready: {
    label: 'Ready for Pickup',
    color: 'teal',
    badgeClass: 'bg-[#eef2fc] dark:bg-blue-900/40 text-[#19398d] dark:text-blue-300 border-[#d2defc] dark:border-blue-700',
    dotClass: 'bg-[#13c9aa]',
    bannerClass: 'bg-[#eef2fc] dark:bg-blue-900/30 border-[#d2defc] dark:border-blue-700 text-[#19398d] dark:text-blue-200',
    bannerText: 'Your print job is ready for pickup! Present your claim code at the counter for instant Zero-Wait grab & go.',
    icon: Sparkles,
  },
  printing: {
    label: 'Currently Printing',
    color: 'blue',
    badgeClass: 'bg-[#eef2fc] dark:bg-blue-900/40 text-[#19398d] dark:text-blue-300 border-[#d2defc] dark:border-blue-700',
    dotClass: 'bg-[#19398d] animate-ping',
    bannerClass: 'bg-[#f3f5fb] dark:bg-slate-800 border-[#e3e3e3] dark:border-slate-700 text-[#19398d] dark:text-blue-300',
    bannerText: 'Printing in progress — the shop machine is running your pages right now.',
    icon: Printer,
  },
  queued: {
    label: 'In Print Queue',
    color: 'navy',
    badgeClass: 'bg-[#f5f5f5] dark:bg-slate-800 text-[#0a0a0a] dark:text-slate-200 border-[#e3e3e3] dark:border-slate-700',
    dotClass: 'bg-[#001B3C] animate-pulse',
    bannerClass: 'bg-[#f3f5fb] dark:bg-slate-800 border-[#e3e3e3] dark:border-slate-700 text-[#0a0a0a] dark:text-slate-200',
    bannerText: 'In Queue — your job is scheduled and next in line for the printing press.',
    icon: Users,
  },
  accepted: {
    label: 'Order Accepted',
    color: 'blue',
    badgeClass: 'bg-[#eef2fc] dark:bg-blue-900/40 text-[#19398d] dark:text-blue-300 border-[#d2defc] dark:border-blue-700',
    dotClass: 'bg-[#19398d]',
    bannerClass: 'bg-[#f3f5fb] dark:bg-slate-800 border-[#e3e3e3] dark:border-slate-700 text-[#19398d] dark:text-blue-300',
    bannerText: 'Accepted by Shop — staff confirmed your file specifications and is preparing materials.',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Awaiting Shop Confirmation',
    color: 'amber',
    badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700',
    dotClass: 'bg-amber-600 animate-pulse',
    bannerClass: 'bg-amber-50/70 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-200',
    bannerText: 'Submitted — awaiting operator verification at the shop front desk.',
    icon: Clock,
  },
};

const STAGES = [
  { key: 'pending', label: 'Submitted' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'queued', label: 'Queued' },
  { key: 'printing', label: 'Printing' },
  { key: 'ready', label: 'Ready' },
];

export default function ActiveOrderSpotlight({ activeRequest }) {
  const [showSpecs, setShowSpecs] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!activeRequest) return null;

  const status = (activeRequest.status || 'pending').toLowerCase();
  const cfg = STATUS_CONFIGS[status] || STATUS_CONFIGS.pending;
  const StatusIcon = cfg.icon;

  const trackingCode = activeRequest.trackingNumber || activeRequest._id?.slice(-6).toUpperCase() || 'PD-REQ';
  const claimCode = activeRequest.claimCode || `PD-${(activeRequest._id || '').slice(-4).toUpperCase() || '8349'}`;
  const shopName = activeRequest.shopId?.shopName || activeRequest.shopName || 'Printing Shop';
  const shopAddress = activeRequest.shopId?.address || 'Naval, Biliran';
  const shopPhone = activeRequest.shopId?.contactNumber || '09123456789';
  const docName = activeRequest.documentId?.originalFilename || activeRequest.documentName || 'Printing_Document.pdf';
  const estCost = typeof activeRequest.estimatedCost === 'number' ? activeRequest.estimatedCost : 0;
  const queuePos = activeRequest.queuePosition || (status === 'printing' ? 1 : 1);
  const estMins = activeRequest.estimatedCompletionTime || activeRequest.estimatedPrintingTime || 5;

  const specs = activeRequest.printingSpecifications || {};
  const totalPages = specs.totalPages || activeRequest.documentId?.pageCount || 1;
  const copies = specs.copies || 1;
  const colorMode = specs.colorMode === 'color' ? 'Color' : 'Black & White';
  const paperSize = specs.paperSize || 'A4';
  const sided = specs.sided === 'double' ? 'Back-to-Back' : 'Single-Sided';
  const binding = specs.binding && specs.binding !== 'none' ? specs.binding : 'None';

  const stageKeys = STAGES.map((s) => s.key);
  const activeIdx = stageKeys.indexOf(status);

  const handleCopyClaim = () => {
    navigator.clipboard?.writeText(claimCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-200 shadow-xs ${
        status === 'ready'
          ? 'border-[#d2defc] dark:border-blue-700 bg-white dark:bg-slate-900'
          : status === 'printing'
          ? 'border-[#324f9a] dark:border-blue-700 bg-white dark:bg-slate-900'
          : 'border-[#e3e3e3] dark:border-slate-700 bg-white dark:bg-slate-900'
      }`}
    >
      <div
        className={`h-1.5 w-full ${
          status === 'ready'
            ? 'bg-[#13c9aa]'
            : status === 'printing'
            ? 'bg-[#19398d]'
            : status === 'queued'
            ? 'bg-[#001B3C]'
            : 'bg-amber-500'
        }`}
      />

      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#001B3C] dark:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dotClass}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dotClass}`} />
              </span>
              <span>Live Active Order</span>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.badgeClass}`}>
              <StatusIcon size={13} className="shrink-0" />
              <span>{cfg.label}</span>
            </span>

            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tracking #{trackingCode}
            </span>
          </div>

          <Link
            to={`/my-requests/${activeRequest._id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#19398d] hover:text-[#142e70] dark:text-blue-400 dark:hover:text-blue-300 no-underline transition-colors"
          >
            <span>Full Order Details</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${cfg.bannerClass}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusIcon size={18} className="shrink-0 text-current" />
            <p className="text-xs sm:text-[13px] font-semibold leading-snug m-0">
              {cfg.bannerText}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyClaim}
            className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              status === 'ready'
                ? 'bg-[#19398d] hover:bg-[#142e70] text-white border-[#19398d]'
                : 'bg-white dark:bg-slate-700 text-[#0a0a0a] dark:text-slate-100 hover:bg-[#eef2fc] dark:hover:bg-slate-600 border-[#e3e3e3] dark:border-slate-600'
            }`}
            title="Click to copy Grab & Go Claim Code"
          >
            <span className="opacity-80 text-[10px] tracking-wider uppercase font-semibold">Claim Code:</span>
            <span className="tracking-widest font-mono text-sm">{claimCode}</span>
            {copiedCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={13} className="opacity-70" />}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#f3f5fb] dark:bg-slate-800 border border-[#e3e3e3] dark:border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-[#eef2fc] dark:bg-blue-900/40 text-[#19398d] dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-[#0a0a0a] dark:text-white truncate m-0">
                    {docName}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#eef2fc] dark:bg-blue-900/40 text-[#19398d] dark:text-blue-300">
                    {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} • {copies} {copies === 1 ? 'Copy' : 'Copies'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-[#e3e3e3] dark:border-slate-600 text-slate-700 dark:text-slate-200">
                    {colorMode} • {paperSize}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  <span>{sided}</span>
                  {binding !== 'None' && <span>• {binding}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-[#f3f5fb] dark:bg-slate-800 border border-[#e3e3e3] dark:border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-[#eef2fc] dark:bg-blue-900/40 text-[#19398d] dark:text-blue-400 flex items-center justify-center shrink-0">
                <Store size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#0a0a0a] dark:text-white truncate m-0">
                    {shopName}
                  </h4>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#19398d] dark:text-blue-400">
                    <ShieldCheck size={13} />
                    <span>Assigned Shop</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
                  <MapPin size={12} className="text-[#19398d] dark:text-blue-400 shrink-0" />
                  <span className="truncate">{shopAddress}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-[#f3f5fb] dark:bg-slate-800 border border-[#e3e3e3] dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Queue
              </span>
              <span className="text-base sm:text-lg font-bold text-[#19398d] dark:text-blue-400 mt-0.5">
                #{queuePos}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                {status === 'printing' ? 'On Machine' : 'In Line'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#f3f5fb] dark:bg-slate-800 border border-[#e3e3e3] dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Est. Time
              </span>
              <span className="text-base sm:text-lg font-bold text-[#13c9aa] dark:text-emerald-400 mt-0.5">
                ~{estMins}m
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                Remaining
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#f3f5fb] dark:bg-slate-800 border border-[#e3e3e3] dark:border-slate-700 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Total Cost
              </span>
              <span className="text-base sm:text-lg font-bold text-[#19398d] dark:text-blue-400 mt-0.5">
                ₱{estCost.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                GCash
              </span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-[#e3e3e3] dark:border-slate-700">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {STAGES.map((st, i) => {
              const isPast = activeIdx !== -1 && i < activeIdx;
              const isCurrent = activeIdx !== -1 && i === activeIdx;
              return (
                <div key={st.key} className="flex-1 flex flex-col items-center text-center relative">
                  {i > 0 && (
                    <div
                      className={`absolute top-2.5 -left-1/2 w-full h-1 -z-0 transition-all ${
                        isPast || isCurrent
                          ? 'bg-[#19398d] dark:bg-blue-600'
                          : 'bg-[#e3e3e3] dark:bg-slate-700'
                      }`}
                    />
                  )}

                  <div
                    className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCurrent
                        ? 'bg-[#19398d] dark:bg-blue-600 text-white ring-4 ring-[#324f9a]/20 scale-110'
                        : isPast
                        ? 'bg-[#13c9aa] dark:bg-emerald-500 text-white'
                        : 'bg-[#e3e3e3] dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {isPast ? '✓' : i + 1}
                  </div>

                  <span
                    className={`mt-1 text-[10.5px] sm:text-[11px] font-bold truncate max-w-full ${
                      isCurrent
                        ? 'text-[#19398d] dark:text-blue-400'
                        : isPast
                        ? 'text-[#13c9aa] dark:text-emerald-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-[#e3e3e3] dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/my-requests/${activeRequest._id}`}
              className="px-4 py-2 rounded-xl bg-[#19398d] hover:bg-[#142e70] dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors no-underline"
            >
              <Zap size={14} />
              <span>Track Live Machine Progress</span>
              <ArrowRight size={13} />
            </Link>

            <Link
              to="/find-shop"
              state={{ selectedShopId: activeRequest.shopId?._id }}
              className="px-3 py-2 rounded-xl bg-[#f3f5fb] dark:bg-slate-700 hover:bg-[#eef2fc] dark:hover:bg-slate-600 text-[#0a0a0a] dark:text-slate-100 font-bold text-xs flex items-center gap-1.5 border border-[#e3e3e3] dark:border-slate-600 transition-colors no-underline"
            >
              <Map size={14} className="text-[#19398d] dark:text-blue-400" />
              <span>View Shop on Map</span>
            </Link>

            {shopPhone && (
              <a
                href={`tel:${shopPhone}`}
                className="px-3 py-2 rounded-xl bg-[#eef2fc] dark:bg-blue-900/30 hover:bg-[#d2defc] dark:hover:bg-blue-900/50 text-[#19398d] dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-colors no-underline border border-[#d2defc] dark:border-blue-700"
                title={`Call ${shopName} at ${shopPhone}`}
              >
                <Phone size={13} className="text-[#19398d] dark:text-blue-400" />
                <span>Call Shop ({shopPhone})</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSpecs((prev) => !prev)}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>{showSpecs ? 'Hide' : 'View'} Specs</span>
            {showSpecs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showSpecs && (
          <div className="mt-2 p-3.5 rounded-xl bg-[#f3f5fb] dark:bg-slate-800 border border-[#e3e3e3] dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Paper Size</span>
              <span className="font-bold text-[#0a0a0a] dark:text-white">{paperSize} ({specs.paperType || 'Standard Bond'})</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Color Mode</span>
              <span className="font-bold text-[#0a0a0a] dark:text-white">{colorMode}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Sides &amp; Binding</span>
              <span className="font-bold text-[#0a0a0a] dark:text-white">{sided} • {binding}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Page Range</span>
              <span className="font-bold text-[#0a0a0a] dark:text-white">{specs.pageRange || 'All Pages'}</span>
            </div>
            {specs.additionalInstructions && (
              <div className="col-span-2 sm:col-span-4 pt-1 border-t border-[#e3e3e3] dark:border-slate-700">
                <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Special Instructions</span>
                <span className="italic text-slate-700 dark:text-slate-300 font-medium">"{specs.additionalInstructions}"</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
