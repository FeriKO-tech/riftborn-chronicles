import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LeaderboardEntryDto } from '@riftborn/shared';
import { leaderboardApi } from '../api/leaderboard.api';
import { useAuthStore } from '../store/auth.store';

interface Props { onClose: () => void; }

const CLASS_ICON: Record<string, string> = {
  VOIDBLADE: '⚔️', AETHERMAGE: '🔮', IRONVEIL: '🛡️',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
};

const panel: React.CSSProperties = {
  width: '520px', maxWidth: '96vw', maxHeight: '85vh',
  background: 'linear-gradient(160deg, #130a2e, #1a0a3e)',
  border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: '16px',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

function rankColor(rank: number): string {
  if (rank === 1) return '#fbbf24';
  if (rank === 2) return '#c0c0c0';
  if (rank === 3) return '#cd7f32';
  return '#9ca3af';
}

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function Row({ entry, isMe }: { entry: LeaderboardEntryDto; isMe: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 16px', fontSize: '12px',
      background: isMe ? 'rgba(124,58,237,0.15)' : 'transparent',
      borderLeft: isMe ? '3px solid #7c3aed' : '3px solid transparent',
    }}>
      <span style={{ width: '36px', fontWeight: 700, color: rankColor(entry.rank), textAlign: 'center', fontSize: '13px' }}>
        {rankBadge(entry.rank)}
      </span>
      <span style={{ fontSize: '16px', width: '24px', textAlign: 'center' }}>
        {CLASS_ICON[entry.class] ?? '?'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, color: isMe ? '#a78bfa' : '#e8e0ff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {entry.name}
        </div>
        <div style={{ fontSize: '10px', color: '#6b7280' }}>
          Lv {entry.level} · Zone {entry.highestZone}
        </div>
      </div>
      <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '13px', whiteSpace: 'nowrap' }}>
        {entry.powerScore.toLocaleString()} PS
      </span>
    </div>
  );
}

export default function LeaderboardPanel({ onClose }: Props) {
  const myId = useAuthStore((s) => s.player?.id);
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: leaderboardApi.get,
  });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid rgba(167,139,250,0.12)', flexShrink: 0,
        }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8e0ff' }}>
            🏆 Leaderboard
          </span>
          {data?.myRank && (
            <span style={{ fontSize: '11px', color: '#a78bfa' }}>
              Your rank: <span style={{ fontWeight: 700, color: '#fbbf24' }}>#{data.myRank}</span>
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af',
              width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {isLoading && (
            <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
              Loading...
            </p>
          )}
          {error && (
            <p style={{ color: '#f87171', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
              Failed to load leaderboard
            </p>
          )}
          {data?.entries.map((entry) => (
            <Row key={entry.playerId} entry={entry} isMe={entry.playerId === myId} />
          ))}
          {data && data.entries.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
              No players yet. Be the first!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
