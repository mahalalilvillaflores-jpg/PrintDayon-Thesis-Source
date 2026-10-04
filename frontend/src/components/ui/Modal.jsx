import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle, CheckCircle2, Trash2, Info } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  danger = false,
  icon = null,
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resolvedIcon = icon || (danger ? 'trash' : null);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity"
    >
      <div
        className="relative bg-white dark:bg-[#101828] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 max-w-[420px] w-full shadow-2xl transform transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors bg-transparent border-none cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Icon Badges */}
        {resolvedIcon === 'trash' && (
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-xs">
              <Trash2 size={24} />
            </div>
          </div>
        )}

        {resolvedIcon === 'warning' && (
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-500 shadow-xs">
              <AlertTriangle size={24} />
            </div>
          </div>
        )}

        {resolvedIcon === 'success' && (
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center text-emerald-500 shadow-xs">
              <CheckCircle2 size={24} />
            </div>
          </div>
        )}

        {resolvedIcon === 'info' && (
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-500 shadow-xs">
              <Info size={24} />
            </div>
          </div>
        )}

        {/* Text Content */}
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white text-center mb-2">
          {title}
        </h2>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed mb-6">
            {description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white transition-all cursor-pointer shadow-xs border-none ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                : 'bg-[#465FFF] hover:bg-[#354EDB] active:bg-[#2B3FA0]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
