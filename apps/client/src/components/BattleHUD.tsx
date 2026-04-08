import React from 'react';

interface Props {
  zoneName: string;
  kills: number;
  requiredKills: number;
  bossUnlocked: boolean;
  bossActive: boolean;
  bossName: string;
  zoneCleared: boolean;
  bossHpPercent: number;
  heroHpPercent: number;
  onBossClick: () => void;
}

const hudRoot: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 10,
};

const zoneBadge: React.CSSProperties = {
  position: 'absolute',
  top: '10px',
  left: '12px',
  background: 'rgba(13,8,33,0.72)',
  border: '1px solid rgba(124,58,237,0.35)',
  borderRadius: '8px',
  padding: '4px 10px',
  fontSize: '11px',
  fontWeight: 700,
  color: '#a78bfa',
  letterSpacing: '0.06em',
  backdropFilter: 'blur(4px)',
};

const killBarWrap: React.CSSProperties = {
  position: 'absolute',
  bottom: '64px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  pointerEvents: 'auto',
  minWidth: '220px',
};

const killLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#9ca3af',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

function KillBar({ kills, required }: { kills: number; required: number }) {
  const pct = Math.min(1, kills / required);
  const full = pct >= 1;
  return (
    <div style={{ width: '200px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '10px', color: '#6b7280' }}>KILLS</span>
        <span style={{
          fontSize: '11px', fontWeight: 700,
          color: full ? '#4ade80' : '#e8e0ff',
        }}>
          {kills} / {required}
        </span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct * 100}%`,
          borderRadius: '3px',
          background: full
            ? 'linear-gradient(90deg,#4ade80,#22c55e)'
            : 'linear-gradient(90deg,#7c3aed,#a855f7)',
          transition: 'width 0.3s ease',
          boxShadow: full ? '0 0 8px #4ade80' : '0 0 6px #7c3aed',
        }} />
      </div>
    </div>
  );
}

function BossButton({ unlocked, active, bossName, onClick }: {
  unlocked: boolean; active: boolean; bossName: string; onClick: () => void;
}) {
  const glowing = unlocked && !active;
  return (
    <button
      onClick={onClick}
      disabled={!unlocked || active}
      style={{
        marginTop: '4px',
        padding: '9px 22px',
        borderRadius: '10px',
        border: glowing ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
        background: active
          ? 'rgba(239,68,68,0.2)'
          : glowing
          ? 'linear-gradient(135deg,rgba(245,158,11,0.22),rgba(239,68,68,0.18))'
          : 'rgba(255,255,255,0.04)',
        color: active ? '#fca5a5' : glowing ? '#fbbf24' : '#6b7280',
        fontWeight: 700,
        fontSize: '12px',
        cursor: (unlocked && !active) ? 'pointer' : 'not-allowed',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        pointerEvents: 'auto',
        animation: glowing ? 'bossGlow 1.5s ease-in-out infinite' : 'none',
        transition: 'all 0.2s',
        boxShadow: glowing ? '0 0 18px rgba(245,158,11,0.35)' : 'none',
      }}
    >
      {active
        ? `⚔️ Fighting ${bossName}…`
        : glowing
        ? `☠️ Challenge ${bossName}`
        : `🔒 ${bossName}`}
    </button>
  );
}

function ZoneClearBanner() {
  return (
    <div style={{
      position: 'absolute',
      top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'rgba(13,8,33,0.88)',
      border: '1px solid #f59e0b',
      borderRadius: '16px',
      padding: '20px 40px',
      textAlign: 'center',
      boxShadow: '0 0 40px rgba(245,158,11,0.4)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: '28px', marginBottom: '4px' }}>⚔️</div>
      <div style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24', letterSpacing: '0.1em' }}>
        ZONE CLEARED
      </div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
        Advancing to next zone…
      </div>
    </div>
  );
}

function BossHpBar({ percent, name }: { percent: number; name: string }) {
  return (
    <div style={{
      position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      pointerEvents: 'none', minWidth: '200px',
    }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        ☠ {name}
      </span>
      <div style={{ width: '200px', height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.max(0, percent) * 100}%`, borderRadius: '4px',
          background: percent > 0.5
            ? 'linear-gradient(90deg,#ef4444,#dc2626)'
            : percent > 0.25
            ? 'linear-gradient(90deg,#f97316,#ea580c)'
            : 'linear-gradient(90deg,#fbbf24,#f59e0b)',
          transition: 'width 0.15s ease',
          boxShadow: '0 0 8px rgba(239,68,68,0.5)',
        }} />
      </div>
      <span style={{ fontSize: '10px', color: '#9ca3af' }}>{Math.round(percent * 100)}%</span>
    </div>
  );
}

function HeroHpIndicator({ percent }: { percent: number }) {
  const color = percent > 0.5 ? '#4ade80' : percent > 0.25 ? '#fbbf24' : '#f87171';
  return (
    <div style={{
      position: 'absolute', top: '10px', right: '12px',
      display: 'flex', alignItems: 'center', gap: '6px',
      background: 'rgba(13,8,33,0.72)', border: '1px solid rgba(74,222,128,0.25)',
      borderRadius: '8px', padding: '4px 10px',
      backdropFilter: 'blur(4px)', pointerEvents: 'none',
    }}>
      <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 700 }}>HP</span>
      <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.max(0, percent) * 100}%`, borderRadius: '3px',
          background: color, transition: 'width 0.15s ease',
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
      <span style={{ fontSize: '10px', fontWeight: 700, color }}>{Math.round(percent * 100)}%</span>
    </div>
  );
}

export default function BattleHUD({
  zoneName, kills, requiredKills, bossUnlocked,
  bossActive, bossName, zoneCleared, bossHpPercent, heroHpPercent, onBossClick,
}: Props) {
  return (
    <div style={hudRoot}>
      <style>{`
        @keyframes bossGlow {
          0%,100% { box-shadow: 0 0 14px rgba(245,158,11,0.3); }
          50%      { box-shadow: 0 0 28px rgba(245,158,11,0.65); }
        }
      `}</style>

      {/* Zone badge */}
      {zoneName && <div style={zoneBadge}>⚔ {zoneName}</div>}

      {/* Hero HP */}
      <HeroHpIndicator percent={heroHpPercent} />

      {/* Boss HP bar (shown during boss fight) */}
      {bossActive && <BossHpBar percent={bossHpPercent} name={bossName || 'Zone Boss'} />}

      {/* Kill bar + boss button */}
      <div style={killBarWrap}>
        <span style={killLabel}>Kill Progress</span>
        <KillBar kills={kills} required={requiredKills} />
        <BossButton
          unlocked={bossUnlocked}
          active={bossActive}
          bossName={bossName || 'Zone Boss'}
          onClick={onBossClick}
        />
      </div>

      {/* Zone clear banner */}
      {zoneCleared && <ZoneClearBanner />}
    </div>
  );
}
