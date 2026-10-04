import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PrintDayon UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f5fb',
          padding: '1.5rem',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1.25rem',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 10px 25px -5px rgba(0, 27, 60, 0.1)',
            border: '1px solid #E2E8F0',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <AlertTriangle size={24} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#001B3C', margin: '0 0 0.5rem' }}>
              Something went wrong
            </h2>

            <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
              An unexpected error occurred while rendering this section. You can refresh the page or return to the main portal.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.75rem',
                color: '#DC2626',
                fontFamily: 'monospace',
                textAlign: 'left',
                marginBottom: '1.5rem',
                wordBreak: 'break-word',
                maxHeight: '100px',
                overflowY: 'auto'
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: '#19398d',
                  color: 'white',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={16} />
                <span>Reload Page</span>
              </button>

              <a
                href="/"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: '#F1F5F9',
                  color: '#001B3C',
                  border: '1px solid #E2E8F0',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textDecoration: 'none'
                }}
              >
                <Home size={16} />
                <span>Go Home</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
