import React from 'react';
import { fontFamily } from '../design-system/tokens';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class RouteErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 40, textAlign: 'center',
        }}>
          <AlertTriangle style={{ width: 48, height: 48, color: 'var(--lava, #E85D00)', marginBottom: 16 }} />
          <h2 style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 24, marginBottom: 8 }}>
            This section hit a problem
          </h2>
          <p style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary, #8FA0B8)', fontSize: 14, marginBottom: 24, maxWidth: 400 }}>
            Something unexpected happened loading this page. The rest of the app is unaffected.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              fontFamily: fontFamily.body, background: 'var(--lava, #E85D00)', color: 'white',
              border: 'none', padding: '10px 24px', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
