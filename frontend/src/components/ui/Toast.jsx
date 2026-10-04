import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

let addToastFn = null;

export function toast(message, type = 'info', duration = 4000) {
  addToastFn?.({ id: Date.now(), message, type, duration });
}
toast.success = (msg) => toast(msg, 'success');
toast.error   = (msg) => toast(msg, 'error');
toast.warning = (msg) => toast(msg, 'warning');
toast.info    = (msg) => toast(msg, 'info');

const typeConfig = {
  success: { icon: <CheckCircle2 size={18} />, bg: '#f0fdf4', border: '#86efac', color: '#166534', iconColor: '#16a34a' },
  error:   { icon: <XCircle size={18} />,      bg: '#fef2f2', border: '#fca5a5', color: '#9b0033', iconColor: '#9b0033' },
  warning: { icon: <AlertTriangle size={18} />,bg: '#fffbeb', border: '#fcd34d', color: '#92400e', iconColor: '#d97706' },
  info:    { icon: <Info size={18} />,         bg: '#eef2fc', border: '#d2defc', color: '#001B3C', iconColor: '#19398d' },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  addToastFn = useCallback(({ id, message, type, duration }) => {
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  return (
    <div
      style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.625rem',
        maxWidth: '360px', width: '100%',
      }}
    >
      {toasts.map((t) => {
        const cfg = typeConfig[t.type] || typeConfig.info;
        return (
          <div
            key={t.id}
            className="slide-up"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              padding: '0.875rem 1rem',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: '0.875rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              color: cfg.color,
            }}
          >
            <span style={{ color: cfg.iconColor, flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 }}>{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              aria-label="Close notification"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, opacity: 0.6, padding: 0, flexShrink: 0 }}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
