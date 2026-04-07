import React from 'react';

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: '#0d0821',
    gap: '12px',
  },
  ring: {
    width: '48px',
    height: '48px',
    border: '3px solid rgba(167,139,250,0.2)',
    borderTopColor: '#a78bfa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#a78bfa',
    letterSpacing: '0.04em',
  },
  sub: {
    fontSize: '12px',
    color: '#6b7280',
  },
};

const spinKeyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export default function LoadingScreen() {
  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={s.root}>
        <div style={s.ring} />
        <div style={s.title}>Riftborn Chronicles</div>
        <div style={s.sub}>Entering the void…</div>
      </div>
    </>
  );
}
