import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon, iconBg = '#eef2fc', iconColor = '#19398d', trend, description, onClick }) {
  const isUp = trend >= 0;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        border: '1px solid #e3e3e3',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={onClick ? (e) => {
        e.currentTarget.style.borderColor = '#d4d4d4';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        e.currentTarget.style.borderColor = '#e3e3e3';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
      } : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <p style={{ fontSize: '0.78rem', fontWeight: 500, color: '#64748B', marginBottom: '0.25rem' }}>{title}</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0a0a0a', lineHeight: 1 }}>{value}</p>
        </div>
        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '0.75rem',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      {(trend !== undefined || description) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {trend !== undefined && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.78rem', fontWeight: 600, color: isUp ? '#16A34A' : '#9b0033' }}>
              {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isUp ? '+' : ''}{trend}%
            </span>
          )}
          {description && (
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{description}</span>
          )}
        </div>
      )}
    </div>
  );
}

