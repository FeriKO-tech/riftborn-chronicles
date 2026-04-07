import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { BossConfigDto, BossFightResponseDto } from '@riftborn/shared';
import { bossApi } from '../api/boss.api';
import { notify } from '../store/notification.store';
import { PLAYER_STATE_KEY } from '../hooks/usePlayerQuery';

interface Props { onClose: () => void; }

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg, #1e1a2e 0%, #0f0c1a 100%)',
  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16,
  padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto', color: '#e8e0ff',
};

export default function BossPanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [fighting, setFighting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BossFightResponseDto | null>(null);
  const [lastBossName, setLastBossName] = useState('');

  const { data: state, isLoading, refetch } = useQuery({
    queryKey: ['boss-state'],
    queryFn: bossApi.getState,
  });

  const handleFight = async (boss: BossConfigDto) => {
    if (fighting) return;
    setFighting(boss.id);
    setLastResult(null);
    try {
      const result = await bossApi.fight(boss.id);
      setLastResult(result);
      setLastBossName(boss.name);
      if (result.victory) {
        const r = result.rewards!;
        notify.success(`⚔️ Defeated ${boss.name}! +${r.goldShards.toLocaleString()} gold · +${r.voidCrystals} crystals`);
        void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
      } else {
        notify.info(`💀 Defeated by ${boss.name} — try again!`);
      }
      void refetch();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Fight failed');
    } finally {
      setFighting(null);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>☠️ Boss Challenge</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Last result */}
        {lastResult && (
          <div style={{
            background: lastResult.victory ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${lastResult.victory ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13,
          }}>
            <div style={{ fontWeight: 700, color: lastResult.victory ? '#4ade80' : '#ef4444', marginBottom: 6 }}>
              {lastResult.victory ? `✅ Victory vs ${lastBossName}` : `💀 Defeated by ${lastBossName}`}
            </div>
            <div style={{ color: '#9ca3af' }}>
              {lastResult.rounds} rounds · {lastResult.totalDamageDealt.toLocaleString()} dmg dealt
            </div>
            {lastResult.rewards && (
              <div style={{ marginTop: 6, display: 'flex', gap: 16, color: '#f59e0b', flexWrap: 'wrap' }}>
                <span>💰 {lastResult.rewards.goldShards.toLocaleString()}</span>
                <span>💎 {lastResult.rewards.voidCrystals}</span>
                <span>🔮 {lastResult.rewards.resonanceCores}</span>
                <span>⭐ +{lastResult.rewards.expEarned} XP</span>
              </div>
            )}
          </div>
        )}

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
                    onClick={() => handleFight(boss)}
                    disabled={!canFight || fighting === boss.id}
                    style={{
                      width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                      background: !canFight ? 'rgba(255,255,255,0.04)' : 'linear-gradient(90deg, #dc2626, #991b1b)',
                      color: !canFight ? '#4b5563' : '#fff',
                      fontWeight: 700, cursor: !canFight ? 'not-allowed' : 'pointer', fontSize: 14,
                    }}
                  >
                    {fighting === boss.id ? 'Fighting…' : !canFight ? 'No Attempts Left' : '⚔️ Challenge'}
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
