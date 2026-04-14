import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--canvas, #FAFAFA)',
        fontFamily: 'var(--font-ui)',
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {/* Brand mark */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            background: 'var(--lava, #E85D00)',
            borderRadius: 14,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-display)',
            }}
          >
            B
          </span>
        </div>

        {/* 404 */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(4rem, 10vw, 7rem)',
            fontWeight: 400,
            color: 'var(--ink-display, #0A0A0A)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            margin: '0 0 8px 0',
          }}
        >
          404
        </h1>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--ink, #171717)',
            margin: '0 0 12px 0',
            letterSpacing: '-0.01em',
          }}
        >
          Page not found
        </h2>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--ink-secondary, #525252)',
            margin: '0 0 32px 0',
          }}
        >
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </p>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: 'var(--lava, #E85D00)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 12,
              letterSpacing: '-0.005em',
              transition: 'background 200ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lava-warm, #FF7A1A)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--lava, #E85D00)')}
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>

          <Link
            to="/pricing"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: 'var(--surface, #FFFFFF)',
              color: 'var(--ink, #171717)',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 12,
              letterSpacing: '-0.005em',
              border: '1px solid var(--border, rgba(10,10,10,0.08))',
              transition: 'border-color 200ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-hover, rgba(10,10,10,0.2))')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border, rgba(10,10,10,0.08))')}
          >
            <Search size={16} />
            View pricing
          </Link>
        </div>

        {/* Support link */}
        <p
          style={{
            fontSize: 13,
            color: 'var(--ink-muted, #737373)',
            marginTop: 40,
          }}
        >
          Need help?{' '}
          <a
            href="mailto:support@biqc.ai"
            style={{ color: 'var(--lava, #E85D00)', textDecoration: 'none' }}
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
