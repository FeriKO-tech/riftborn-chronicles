import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BossConfigDto } from '@riftborn/shared';
import { bossApi } from '../api/boss.api';

interface Props {
  onClose: () => void;
  onStartFight: (boss: BossConfigDto) => void;
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg, #1e1a2e 0%, #0f0c1a 100%)',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16,
  padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto', color: '#e8e0ff',
};

export default function BossPanel({ onClose, onStartFight }: Props) {
  const { data: state, isLoading } = useQuery({
    queryKey: ['boss-state'],
    queryFn: bossApi.getState,
  });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>☠️ Boss Challenge</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 30 }}>Loading bosses…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(state?.bosses ?? []).map((boss) => {
              const attempt = state?.attempts[boss.id];
              const canFight = (attempt?.attemptsRemaining ?? 3) > 0;
              return (
                <div key={boss.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${canFight ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 32 }}>{boss.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: canFight ? '#ef4444' : '#6b7280' }}>{boss.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Zone {boss.zoneRequirement}+ · Lv.{boss.level}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#9ca3af' }}>
                      <div>{attempt?.attemptsRemaining ?? 3}/{boss.maxAttemptsPerDay} attempts</div>
                      <div style={{ color: '#4b5563' }}>Resets at midnight</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
                    <span>❤️ {boss.hp.toLocaleString()} HP</span>
                    <span>⚔️ {boss.attack} ATK</span>
                    <span>🛡️ {boss.defense} DEF</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#f59e0b', flexWrap: 'wrap', marginBottom: 12 }}>
                    <span>💰 {boss.rewards.goldShards.toLocaleString()}</span>
                    <span>💎 {boss.rewards.voidCrystals}</span>
                    <span>🔮 {boss.rewards.resonanceCores}</span>
                  </div>

                  <button
                    onClick={() => { onClose(); onStartFight(boss); }}
                    disabled={!canFight}
                    style={{
                      width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                      background: !canFight ? 'rgba(255,255,255,0.04)' : 'linear-gradient(90deg, #dc2626, #991b1b)',
                      color: !canFight ? '#4b5563' : '#fff',
                      fontWeight: 700, cursor: !canFight ? 'not-allowed' : 'pointer', fontSize: 14,
                    }}
                  >
                    {!canFight ? 'No Attempts Left' : '⚔️ Challenge'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
