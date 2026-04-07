import React, { useState } from 'react';
import type { DailyRewardStatusDto } from '@riftborn/shared';
import { dailyRewardApi } from '../api/daily-reward.api';
import { usePlayerStore } from '../store/player.store';

interface Props {
  status: DailyRewardStatusDto;
  onClaimed: () => void;
  onClose: () => void;
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 120,
  backdropFilter: 'blur(4px)',
};

const card: React.CSSProperties = {
  background: 'linear-gradient(160deg, #130a2e, #1a0a3e)',
  border: '1px solid rgba(167,139,250,0.35)',
  borderRadius: '20px',
  padding: '32px 28px',
  width: 'min(340px, 92vw)',
  textAlign: 'center',
  boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
};

const DAY_ICONS = ['🌙', '⭐', '💫', '✨', '🌟', '💥', '🔥'];

export default function DailyRewardModal({ status, onClaimed, onClose }: Props) {
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<{ gold: number; crystals: number; streak: number } | null>(null);
  const updateCurrencies = usePlayerStore((s) => s.updateCurrencies);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await dailyRewardApi.claim();
      setResult({ gold: res.goldShards, crystals: res.voidCrystals, streak: res.newStreak });
      const cur = usePlayerStore.getState().playerState?.currencies;
      if (cur) {
        updateCurrencies({
          ...cur,
          goldShards: res.newGoldBalance,
          voidCrystals: res.newCrystalBalance,
        });
      }
      setTimeout(onClaimed, 1800);
    } catch {
      setClaiming(false);
    }
  };

  const nextReward = status.nextReward;
  const streakIcons = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const claimed = day <= (status.streak % 7 || (status.streak > 0 && status.streak % 7 === 0 ? 7 : 0));
    return { day, icon: DAY_ICONS[i], claimed };
  });

  return (
    <div style={overlay} onClick={result ? onClaimed : undefined}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: '11px', letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
          Daily Login Reward
        </p>

        {/* 7-day streak strip */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px' }}>
          {streakIcons.map(({ day, icon, claimed }) => (
            <div key={day} style={{
              width: '36px', height: '40px',
              borderRadius: '8px',
              background: claimed ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${claimed ? '#a78bfa' : 'rgba(255,255,255,0.1)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>
              {icon}
              <span style={{ fontSize: '8px', color: claimed ? '#a78bfa' : '#4b5563' }}>D{day}</span>
            </div>
          ))}
        </div>

        {result ? (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎉</div>
            <p style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
              +{result.gold.toLocaleString()} 🟡
              {result.crystals > 0 && `  +${result.crystals} 💎`}
            </p>
            <p style={{ fontSize: '13px', color: '#a78bfa', marginTop: '8px' }}>
              Streak: {result.streak} days
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginBottom: '4px' }}>
              +{nextReward.goldShards.toLocaleString()} 🟡
              {nextReward.voidCrystals > 0 && <span style={{ marginLeft: '8px', color: '#60a5fa' }}>+{nextReward.voidCrystals} 💎</span>}
            </p>
            {nextReward.streakBonus > 0 && (
              <p style={{ fontSize: '11px', color: '#4ade80', marginBottom: '4px' }}>+{nextReward.streakBonus} streak bonus</p>
            )}
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
              {status.streak > 0 ? `Day ${status.streak + 1} · ${status.streak}-day streak 🔥` : 'Day 1 — Start your streak!'}
            </p>
            <button
              onClick={handleClaim}
              disabled={claiming}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
                background: claiming ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: claiming ? '#6b7280' : '#fff', fontSize: '15px', fontWeight: 700, cursor: claiming ? 'not-allowed' : 'pointer',
              }}
            >
              {claiming ? 'Claiming…' : 'Claim Reward'}
            </button>
            <button onClick={onClose} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#4b5563', fontSize: '12px', cursor: 'pointer' }}>
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
