import React from 'react';
import { Star, MapPin, Clock, Users, Printer, Navigation } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

function queueLabel(count) {
  if (count <= 2) return 'Short queue';
  if (count <= 6) return 'Normal queue';
  return 'Busy queue';
}

export function ShopComparison({ shopA, shopB }) {
  if (!shopA || !shopB) return null;

  return (
    <div style={{ background: 'white', borderRadius: '1rem', border: '1px solid #e3e3e3', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e3e3e3' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Route &amp; Queue Comparison</p>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0a0a0a', margin: 0 }}>The closest shop isn't always the fastest.</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {[
          { shop: shopA, label: 'Option A', highlight: false },
          { shop: shopB, label: 'Option B', highlight: true },
        ].map(({ shop, label, highlight }) => (
          <div key={label} style={{ padding: '1.25rem 1.5rem', background: highlight ? '#eef2fc' : 'white', borderRight: label === 'Option A' ? '1px solid #e3e3e3' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: highlight ? '#19398d' : '#6b7280', textTransform: 'uppercase' }}>{label}</span>
              {highlight && <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#19398d', color: '#ffffff', padding: '0.15rem 0.5rem', borderRadius: '9999px', textTransform: 'uppercase' }}>Fastest Total Time</span>}
            </div>
            <p style={{ fontWeight: 700, color: '#0a0a0a', marginBottom: '0.75rem' }}>{shop.name || shop.shopName}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
              {[
                { label: 'Distance', value: `${shop.distance || shop.distanceKm || 0} km`, icon: <MapPin size={12} /> },
                { label: 'Travel',   value: `${shop.travelTime || shop.travelTimeMinutes || 0} min`, icon: <Navigation size={12} /> },
                { label: 'Queue',    value: `${shop.queue || shop.queueCount || 0} jobs`, icon: <Users size={12} /> },
                { label: 'Waiting',  value: `${shop.waitingTime || shop.waitingTimeMinutes || 0} min`, icon: <Clock size={12} /> },
                { label: 'Printing', value: `${shop.printingTime || shop.serviceTimeMinutes || 0} min`, icon: <Printer size={12} /> },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>{icon} {label}</span>
                  <span style={{ fontWeight: 500, color: '#374151' }}>{value}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #e3e3e3', paddingTop: '0.5rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: highlight ? '#19398d' : '#9b0033' }}>
                  {shop.completionTime || shop.estimatedCompletionMinutes || shop.estimatedCompletionTime || 0} min
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShopRow({ shop, rank, onView }) {
  if (!shop) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1rem',
      padding: '0.875rem 1rem',
      border: '1px solid #e3e3e3',
      borderRadius: '1rem',
      background: shop.recommended ? '#eef2fc' : 'white',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
    >
      {rank && (
        <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: rank === 1 ? '#19398d' : '#f3f4f6', color: rank === 1 ? 'white' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
          {rank}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0a0a0a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name || shop.shopName}</span>
          {shop.recommended && <span style={{ fontSize: '0.62rem', fontWeight: 700, background: '#19398d', color: '#ffffff', padding: '0.1rem 0.4rem', borderRadius: '9999px', whiteSpace: 'nowrap' }}>FASTEST ROUTE</span>}
          <StatusBadge status={shop.isOpen ? 'open' : 'closed'} showDot />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#6b7280', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><MapPin size={12} /> {shop.distance || shop.distanceKm || 0} km</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Users size={12} /> {shop.queue || shop.queueCount || 0} jobs · {queueLabel(shop.queue || shop.queueCount || 0)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Star size={12} className="fill-[#19398d] text-[#19398d]" /> {(shop.rating || 0).toFixed(1)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Est. Completion</div>
        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: shop.recommended ? '#19398d' : '#374151' }}>
          {shop.completionTime || shop.estimatedCompletionMinutes || shop.estimatedCompletionTime || 0} min
        </div>
      </div>
      {onView && (
        <button onClick={() => onView(shop)} className="btn btn-sm" style={{ background: shop.recommended ? '#19398d' : 'white', color: shop.recommended ? 'white' : '#374151', border: shop.recommended ? 'none' : '1px solid #e3e3e3', flexShrink: 0 }}>
          View
        </button>
      )}
    </div>
  );
}
