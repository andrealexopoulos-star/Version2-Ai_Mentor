import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'biqc_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
    window.__biqc_enable_analytics?.();
  };

  const handleReject = () => {
    localStorage.setItem(STORAGE_KEY, 'rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.bar}>
        <p style={styles.text}>
          We use cookies for analytics to improve your experience.{' '}
          <a href="/trust/privacy" style={styles.link}>Privacy Policy</a>
        </p>
        <div style={styles.buttons}>
          <button onClick={handleReject} style={styles.rejectBtn}>
            Reject
          </button>
          <button onClick={handleAccept} style={styles.acceptBtn}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: '12px 16px',
    pointerEvents: 'none',
  },
  bar: {
    pointerEvents: 'auto',
    maxWidth: 680,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 20px',
    background: 'var(--surface, #0E1628)',
    border: '1px solid var(--border, rgba(140,170,210,0.12))',
    borderRadius: 'var(--r-lg, 12px)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
    fontFamily: 'var(--font-ui, "Inter", sans-serif)',
  },
  text: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.45,
    color: 'var(--ink, #C8D4E4)',
    flex: 1,
  },
  link: {
    color: 'var(--lava, #E85D00)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
  buttons: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  rejectBtn: {
    background: 'transparent',
    color: 'var(--ink, #C8D4E4)',
    border: '1px solid var(--border, rgba(140,170,210,0.12))',
    borderRadius: 'var(--r-lg, 12px)',
    padding: '7px 16px',
    fontSize: 13,
    fontFamily: 'var(--font-ui, "Inter", sans-serif)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  acceptBtn: {
    background: 'var(--lava, #E85D00)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 'var(--r-lg, 12px)',
    padding: '7px 16px',
    fontSize: 13,
    fontFamily: 'var(--font-ui, "Inter", sans-serif)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
};
