import React from 'react';

interface Props {
  topBar: React.ReactNode;
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  bottomNav: React.ReactNode;
}

const root: React.CSSProperties = {
  display: 'grid',
  gridTemplateRows: '48px 1fr 56px',
  gridTemplateColumns: '1fr',
  width: '100%',
  height: '100%',
  background: '#0d0821',
  overflow: 'hidden',
};

const topBarArea: React.CSSProperties = {
  gridRow: '1',
  gridColumn: '1',
  zIndex: 10,
};

const main: React.CSSProperties = {
  gridRow: '2',
  gridColumn: '1',
  display: 'grid',
  gridTemplateColumns: '220px 1fr 240px',
  overflow: 'hidden',
};

const leftArea: React.CSSProperties = {
  overflowY: 'auto',
  borderRight: '1px solid rgba(167,139,250,0.1)',
  background: 'rgba(13,8,33,0.6)',
};

const centerArea: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
};

const rightArea: React.CSSProperties = {
  overflowY: 'auto',
  borderLeft: '1px solid rgba(167,139,250,0.1)',
  background: 'rgba(13,8,33,0.6)',
};

const bottomNavArea: React.CSSProperties = {
  gridRow: '3',
  gridColumn: '1',
  zIndex: 10,
};

export default function GameLayout({ topBar, left, center, right, bottomNav }: Props) {
  return (
    <div style={root}>
      <div style={topBarArea}>{topBar}</div>
      <div style={main}>
        <div style={leftArea}>{left}</div>
        <div style={centerArea}>{center}</div>
        <div style={rightArea}>{right}</div>
      </div>
      <div style={bottomNavArea}>{bottomNav}</div>
    </div>
  );
}
