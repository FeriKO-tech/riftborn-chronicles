import React from 'react';
import type { PlayerProfileDto, PlayerCurrenciesDto } from '@riftborn/shared';

interface Props {
  profile: PlayerProfileDto | null;
  currencies: PlayerCurrenciesDto | null;
  currentZone?: number;
  currentRoom?: number;
  questsReady?: number;
}

const bar: React.CSSProperties = {
  width: '100%',
  height: '48px',
  background: 'rgba(13,8,33,0.92)',
  borderBottom: '1px solid rgba(167,139,250,0.15)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  gap: '12px',
};

const left: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minWidth: 0,
};

const right: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  flexShrink: 0,
};

const pill = (active?: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 600,
  background: active ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.06)',
  color: active ? '#a78bfa' : '#9ca3af',
  border: `1px solid ${active ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
  whiteSpace: 'nowrap',
});

const xpBarOuter: React.CSSProperties = {
  width: '80px',
  height: '4px',
  background: 'rgba(255,255,255,0.08)',
  borderRadius: '2px',
  overflow: 'hidden',
};

export default function HUD({ profile, currencies, currentZone, currentRoom, questsReady }: Props) {
  const expPct = profile && profile.expToNextLevel > 0
    ? Math.min(1, profile.experience / profile.expToNextLevel)
    : 0;

  return (
    <div style={bar}>
      {/* Left: identity + XP */}
      <div style={left}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', flexShrink: 0 }}>
          {profile?.name ?? '—'}
        </span>
        <span style={pill()}>Lv {profile?.level ?? '—'}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={xpBarOuter}>
            <div style={{
              height: '100%',
              width: `${(expPct * 100).toFixed(1)}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
              borderRadius: '2px',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: '9px', color: '#6b7280', lineHeight: 1 }}>
            {profile?.experience?.toLocaleString() ?? 0} / {profile?.expToNextLevel?.toLocaleString() ?? '—'} XP
          </span>
        </div>
        <span style={pill()}>PS {profile?.powerScore?.toLocaleString() ?? '—'}</span>
      </div>

      {/* Center: stage position */}
      {currentZone && (
        <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
          Zone <strong style={{ color: '#e8e0ff' }}>{currentZone}</strong>
          {' '}· Room <strong style={{ color: '#e8e0ff' }}>{currentRoom ?? '—'}</strong>/10
        </span>
      )}

      {/* Right: currencies + quest badge */}
      <div style={right}>
        {questsReady != null && questsReady > 0 && (
          <span style={{ ...pill(true), color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.1)' }}>
            📋 {questsReady}
          </span>
        )}
        <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
          🟡 {currencies ? Math.floor(currencies.goldShards).toLocaleString() : '—'}
        </span>
        <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600 }}>
          💎 {currencies?.voidCrystals ?? '—'}
        </span>
      </div>
    </div>
  );
}
