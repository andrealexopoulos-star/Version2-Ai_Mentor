import React from 'react';
import { fontFamily } from '../design-system/tokens';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';

/** Generate a short, human-readable error reference code for support triage. */
function _errorRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ERR-${ts}-${rand}`;
}

class RouteErrorBoundary extends React.Component {
  state = { hasError: false, error: null, errorRef: null, copied: false };

  static getDerivedStateFromError(error) {
    return { hasError: true, error, errorRef: _errorRef() };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[RouteErrorBoundary] ref=${this.state.errorRef}`, error, errorInfo);
  }

  _copyRef = () => {
    if (this.state.errorRef) {
      navigator.clipboard?.writeText(this.state.errorRef).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

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
          <p style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary, #8FA0B8)', fontSize: 14, marginBottom: 16, maxWidth: 400 }}>
            Something unexpected happened loading this page. The rest of the app is unaffected.
          </p>
          {this.state.errorRef && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--surface-2, #1A2234)', border: '1px solid var(--border, #2A3548)',
              borderRadius: 8, padding: '6px 12px', marginBottom: 20,
            }}>
              <span style={{ fontFamily: fontFamily.mono || 'monospace', fontSize: 12, color: 'var(--ink-muted, #5C6E82)', letterSpacing: '0.04em' }}>
                Ref: {this.state.errorRef}
              </span>
              <button
                onClick={this._copyRef}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                title="Copy error reference"
              >
                <Copy style={{ width: 12, height: 12, color: this.state.copied ? 'var(--positive, #10B981)' : 'var(--ink-muted, #5C6E82)' }} />
              </button>
            </div>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorRef: null })}
            style={{
              fontFamily: fontFamily.body, background: 'var(--lava, #E85D00)', color: 'white',
              border: 'none', padding: '10px 24px', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} /> Try again
          </button>
          <p style={{ fontFamily: fontFamily.body, color: 'var(--ink-muted, #5C6E82)', fontSize: 12, marginTop: 16, maxWidth: 360 }}>
            If this keeps happening, contact{' '}
            <a href={`mailto:support@biqc.ai?subject=Error ${this.state.errorRef || ''}`} style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}>
              support@biqc.ai
            </a>{' '}
            with the reference code above.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
