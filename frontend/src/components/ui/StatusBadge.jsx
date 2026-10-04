import React from 'react';

const statusConfig = {
  pending:   { label: 'Pending',   bg: '#FEF7E8', color: '#92400e', dot: '#F59E0B', border: '#FDE3A7' },
  accepted:  { label: 'Accepted',  bg: '#eef2fc', color: '#19398d', dot: '#19398d', border: '#dce5f8' },
  queued:    { label: 'Queued',    bg: '#F5F3FF', color: '#7c3aed', dot: '#7c3aed', border: '#DDD6FE' },
  printing:  { label: 'Printing',  bg: '#eef2fc', color: '#19398d', dot: '#19398d', border: '#dce5f8' },
  ready:     { label: 'Ready',     bg: '#ECFDF5', color: '#16a34a', dot: '#16a34a', border: '#A7F3D0' },
  completed: { label: 'Completed', bg: '#f5f5f5', color: '#0a0a0a', dot: '#64748b', border: '#e3e3e3' },
  rejected:  { label: 'Rejected',  bg: '#FEF2F2', color: '#9b0033', dot: '#9b0033', border: '#FECACA' },
  cancelled: { label: 'Cancelled', bg: '#ffedd5', color: '#9a3412', dot: '#f97316', border: '#FED7AA' },
  open:      { label: 'Open',      bg: '#ECFDF5', color: '#16a34a', dot: '#16a34a', border: '#A7F3D0' },
  closed:    { label: 'Closed',    bg: '#FEF2F2', color: '#9b0033', dot: '#9b0033', border: '#FECACA' },
  busy:      { label: 'Busy',      bg: '#FEF7E8', color: '#92400e', dot: '#F59E0B', border: '#FDE3A7' },
  verified:  { label: 'Verified',  bg: '#eef2fc', color: '#19398d', dot: '#19398d', border: '#dce5f8' },
  approved:  { label: 'Approved',  bg: '#eef2fc', color: '#19398d', dot: '#19398d', border: '#dce5f8' },
  active:    { label: 'Active',    bg: '#eef2fc', color: '#19398d', dot: '#19398d', border: '#dce5f8' },
  inactive:  { label: 'Inactive',  bg: '#f5f5f5', color: '#64748b', dot: '#94a3b8', border: '#e3e3e3' },
};

export default function StatusBadge({ status = 'pending', label, showDot = true }) {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const cfg = statusConfig[key] || { label: status, bg: '#f5f5f5', color: '#0a0a0a', dot: '#94a3b8', border: '#e3e3e3' };
  const displayLabel = label || cfg.label;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.6rem',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border || '#e3e3e3'}`,
        whiteSpace: 'nowrap',
        letterSpacing: '0em',
      }}
    >
      {showDot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: cfg.dot,
            flexShrink: 0,
          }}
        />
      )}
      {displayLabel}
    </span>
  );
}

