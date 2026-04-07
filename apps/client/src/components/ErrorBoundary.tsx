import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const resetStyle: React.CSSProperties = {
  padding: '12px 24px',
  marginTop: '16px',
  borderRadius: '8px',
  border: '1px solid rgba(167,139,250,0.4)',
  background: 'rgba(124,58,237,0.15)',
  color: '#e8e0ff',
  fontSize: '13px',
  cursor: 'pointer',
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', width: '100%', height: '100%',
          background: '#0d0821', color: '#e8e0ff', textAlign: 'center', padding: '24px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '12px', color: '#6b7280', maxWidth: '320px', marginBottom: '16px' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button style={resetStyle} onClick={this.reset}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
