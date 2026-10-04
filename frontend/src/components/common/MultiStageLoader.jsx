import { Loader2 } from 'lucide-react';

export default function MultiStageLoader({
  variant = 'pill',
  text = 'Finding nearby printing shops...',
  className = '',
}) {
  if (variant === 'overlay' || variant === 'pill') {
    return (
      <div
        className={`fixed top-[140px] left-1/2 -translate-x-1/2 z-[1000] pointer-events-none transition-all duration-300 ${className}`}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.55rem 1.15rem',
            background: '#ffffff',
            borderRadius: '9999px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e3e3e3',
            color: '#0a0a0a',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0em',
          }}
        >
          <Loader2
            size={16}
            style={{
              color: '#19398d',
              animation: 'spin 1s linear infinite',
              flexShrink: 0,
            }}
          />
          <span>{text}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        background: '#ffffff',
        border: '1px solid #e3e3e3',
        borderRadius: '1rem',
        padding: '2rem 1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '2.75rem',
          height: '2.75rem',
          borderRadius: '0.75rem',
          background: '#eef2fc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#19398d',
        }}
      >
        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0a0a0a' }}>
          {text}
        </p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
          Checking real-time availability and shortest routes
        </p>
      </div>
    </div>
  );
}

