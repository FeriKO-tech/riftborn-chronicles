import React, { useState } from 'react';
import type { OfflineRewardPreviewDto } from '@riftborn/shared';
import { playerApi } from '../api/player.api';
import { usePlayerStore } from '../store/player.store';

interface Props {
  preview: OfflineRewardPreviewDto;
  onClaimed: () => void;
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  backdropFilter: 'blur(4px)',
};

const card: React.CSSProperties = {
  background: 'linear-gradient(160deg, #130a2e 0%, #1a0a3e 100%)',
  border: '1px solid rgba(167,139,250,0.35)',
  borderRadius: '16px',
  padding: '36px 32px',
  width: '320px',
  textAlign: 'center',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '13px',
  letterSpacing: '0.12em',
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: '8px',
};

const goldStyle: React.CSSProperties = {
  fontSize: '44px',
  fontWeight: 800,
  color: '#f59e0b',
  letterSpacing: '-0.01em',
  lineHeight: 1.1,
  marginBottom: '4px',
};

const goldLabel: React.CSSProperties = {
  fontSize: '13px',
  color: '#9ca3af',
  marginBottom: '20px',
};

const timeRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '12px',
  color: '#6b7280',
  marginBottom: '28px',
  padding: '0 4px',
};

const claimBtn: React.CSSProperties = {
  width: '100%',
  padding: '13px',
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
  border: 'none',
  borderRadius: '10px',
  color: '#fff',
  fontSize: '15px',
  fontWeight: 700,
  cursor: 'pointer',
  letterSpacing: '0.03em',
};

const claimedStyle: React.CSSProperties = {
  ...claimBtn,
  background: 'rgba(255,255,255,0.06)',
  color: '#6b7280',
  cursor: 'default',
};

export default function OfflineRewardsModal({ preview, onClaimed }: Props) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const updateCurrencies = usePlayerStore((s) => s.updateCurrencies);

  const handleClaim = async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    try {
      const result = await playerApi.claimOfflineReward();
      // Patch the store so top bar updates immediately without a refetch
      const current = usePlayerStore.getState().playerState?.currencies;
      if (current) {
        updateCurrencies({ ...current, goldShards: result.newGoldBalance });
      }
      setClaimed(true);
      setTimeout(onClaimed, 900);
    } catch {
      setClaiming(false);
    }
  };

  const hoursLabel =
    preview.idleHours < 0.02
      ? 'Less than a minute'
      : preview.idleHours < 1
        ? `${Math.round(preview.idleHours * 60)} minutes`
        : `${preview.idleHours.toFixed(1)} hours`;

  if (preview.goldEarned === 0 && preview.expEarned === 0) {
    onClaimed();
    return null;
  }

  return (
    <div style={overlay} onClick={claimed ? onClaimed : undefined}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <p style={titleStyle}>While you were away</p>
        <div style={goldStyle}>🟡 {preview.goldEarned.toLocaleString()}</div>
        <p style={goldLabel}>Gold Shards earned</p>

        {preview.expEarned > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#60a5fa' }}>
              ✨ {preview.expEarned.toLocaleString()} EXP
            </div>
          </div>
        )}

        <div style={timeRow}>
          <span>⏰ Away for: {hoursLabel}</span>
          <span>Cap: {preview.cappedAt}h</span>
        </div>

        <button
          style={claimed ? claimedStyle : claimBtn}
          onClick={handleClaim}
          disabled={claiming || claimed}
        >
          {claimed ? 'Claimed ✓' : claiming ? 'Claiming…' : 'Claim Rewards'}
        </button>
      </div>
    </div>
  );
}
