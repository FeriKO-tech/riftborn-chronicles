import { useEffect, useRef, useState } from 'react';
import { usePixiApp } from '../game/usePixiApp';
import { useAuthStore } from '../store/auth.store';
import { usePlayerStore } from '../store/player.store';
import { playerApi } from '../api/player.api';
import type { OfflineRewardPreviewDto } from '@riftborn/shared';
import OfflineRewardsModal from '../components/OfflineRewardsModal';

const s: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: '#0d0821',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48px',
    background: 'rgba(13,8,33,0.85)',
    borderBottom: '1px solid rgba(167,139,250,0.15)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 10,
    pointerEvents: 'none',
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  playerName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#a78bfa',
  },
  psLabel: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  psValue: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f59e0b',
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  resource: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    color: '#e8e0ff',
  },
  devBadge: {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(124,58,237,0.2)',
    border: '1px solid rgba(124,58,237,0.4)',
    borderRadius: '20px',
    padding: '5px 14px',
    fontSize: '11px',
    color: '#a78bfa',
    pointerEvents: 'none',
    zIndex: 10,
  },
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '56px',
    background: 'rgba(13,8,33,0.92)',
    borderTop: '1px solid rgba(167,139,250,0.15)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 10,
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    cursor: 'pointer',
    opacity: 0.6,
    padding: '4px 12px',
  },
  navIcon: {
    fontSize: '18px',
  },
  navLabel: {
    fontSize: '10px',
    color: '#9ca3af',
  },
};

const NAV_ITEMS = [
  { icon: '🗺️', label: 'Zone' },
  { icon: '⚔️', label: 'Fight' },
  { icon: '👤', label: 'Hero' },
  { icon: '🏰', label: 'Guild' },
  { icon: '🎪', label: 'Events' },
];

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  usePixiApp(containerRef);

  const player = useAuthStore((s) => s.player);
  const playerState = usePlayerStore((s) => s.playerState);
  const setPlayerState = usePlayerStore((s) => s.setPlayerState);
  const [offlinePreview, setOfflinePreview] = useState<OfflineRewardPreviewDto | null>(null);

  // Load player state and fetch offline reward preview once on mount
  useEffect(() => {
    const init = async () => {
      const [state, preview] = await Promise.all([
        playerState ? Promise.resolve(playerState) : playerApi.getState(),
        playerApi.getOfflineRewardPreview(),
      ]);
      setPlayerState(state);
      if (preview.goldEarned > 0) setOfflinePreview(preview);
    };
    init().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heartbeat every 60 seconds to keep lastHeartbeat accurate for idle calc
  useEffect(() => {
    const id = setInterval(() => {
      playerApi.heartbeat().catch(() => undefined);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const currencies = playerState?.currencies;
  const name = player?.name ?? '…';
  const ps = player?.powerScore ?? 0;
  const gold = currencies ? Math.floor(currencies.goldShards).toLocaleString() : '…';
  const crystals = currencies?.voidCrystals ?? '…';
  const cores = currencies?.resonanceCores ?? '…';

  return (
    <div style={s.root}>
      {/* PixiJS canvas host */}
      <div ref={containerRef} style={s.canvas} />

      {/* Top bar */}
      <div style={s.topBar}>
        <div style={s.topBarLeft}>
          <span style={s.playerName}>{name}</span>
          <span style={s.psLabel}>Power:</span>
          <span style={s.psValue}>{ps.toLocaleString()}</span>
        </div>
        <div style={s.topBarRight}>
          <span style={s.resource}>🟡 {gold}</span>
          <span style={s.resource}>💎 {crystals}</span>
          <span style={s.resource}>⚡ {cores}</span>
        </div>
      </div>

      <div style={s.devBadge}>PixiJS active ✓</div>

      {/* Offline reward modal — shown once on game entry if gold was earned */}
      {offlinePreview && (
        <OfflineRewardsModal
          preview={offlinePreview}
          onClaimed={() => setOfflinePreview(null)}
        />
      )}

      {/* Bottom nav — Batch D: route to panels */}
      <div style={s.navBar}>
        {NAV_ITEMS.map(({ icon, label }) => (
          <div key={label} style={s.navItem}>
            <span style={s.navIcon}>{icon}</span>
            <span style={s.navLabel}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
