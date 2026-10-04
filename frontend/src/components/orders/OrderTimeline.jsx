import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { key: 'accepted',  label: 'Accepted',  desc: 'Your request has been received.' },
  { key: 'queued',    label: 'Queued',    desc: 'Your request is in the printing queue.' },
  { key: 'printing',  label: 'Printing',  desc: 'Your document is currently being printed.' },
  { key: 'ready',     label: 'Ready',     desc: 'Your document is ready for pickup.' },
  { key: 'completed', label: 'Completed', desc: 'Your printing request has been completed.' },
];

function getStepIndex(status) {
  const idx = STEPS.findIndex(s => s.key === (status || '').toLowerCase());
  return idx === -1 ? 0 : idx;
}

export default function OrderTimeline({ status = 'accepted', history = [], horizontal = false }) {
  const currentIdx = getStepIndex(status);

  if (status === 'cancelled' || status === 'rejected') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#fee2e2', borderRadius: '0.75rem', border: '1px solid #fecaca' }}>
        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: 700 }}>✕</span>
        </div>
        <div>
          <p style={{ fontWeight: 600, color: '#991b1b', textTransform: 'capitalize' }}>{status}</p>
          <p style={{ fontSize: '0.75rem', color: '#b91c1c' }}>This request has been {status}.</p>
        </div>
      </div>
    );
  }

  if (horizontal) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const waiting = i > currentIdx;
          return (
            <React.Fragment key={step.key}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: '2rem', height: '2rem', borderRadius: '50%',
                  background: done ? '#0D9488' : active ? '#0D9488' : '#e5e7eb',
                  color: (done || active) ? 'white' : '#9ca3af',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 600,
                  boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.15)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {done ? <Check size={14} /> : i + 1}
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: active ? 600 : 400, color: done ? '#0D9488' : active ? '#0D9488' : '#9ca3af', marginTop: '0.3rem', textAlign: 'center' }}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ height: '2px', flex: 1, background: i < currentIdx ? '#0D9488' : '#e5e7eb', marginBottom: '1.1rem', transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const histEntry = history.find(h => h.status?.toLowerCase() === step.key);

        return (
          <div key={step.key} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: '2rem', height: '2rem', borderRadius: '50%',
                background: done ? '#0D9488' : active ? '#0D9488' : '#e5e7eb',
                color: (done || active) ? 'white' : '#9ca3af',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 600,
                boxShadow: active ? '0 0 0 4px rgba(37,99,235,0.15)' : 'none',
                transition: 'all 0.2s',
              }}>
                {done ? <Check size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: '2px', height: '2.5rem', background: done ? '#0D9488' : '#e5e7eb', margin: '0.25rem 0', transition: 'background 0.3s' }} />
              )}
            </div>

            <div style={{ paddingTop: '0.3rem', paddingBottom: i < STEPS.length - 1 ? '0.5rem' : 0 }}>
              <p style={{ fontWeight: active ? 700 : 500, fontSize: '0.875rem', color: done ? '#0D9488' : active ? '#0D9488' : '#9ca3af' }}>
                {step.label}
              </p>
              {(active || done) && (
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                  {histEntry?.timestamp
                    ? new Date(histEntry.timestamp).toLocaleString()
                    : active ? step.desc : 'Completed'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
