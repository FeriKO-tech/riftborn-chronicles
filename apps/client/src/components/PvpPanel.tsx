import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PvpFightResultDto, PvpOpponentDto } from '@riftborn/shared';
import { pvpApi } from '../api/pvp.api';
import { notify } from '../store/notification.store';
import { PLAYER_STATE_KEY } from '../hooks/usePlayerQuery';

interface Props { onClose: () => void; }

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg, #1a1e2e 0%, #0f0c1a 100%)',
  border: '1px solid rgba(59,130,246,0.3)', borderRadius: 16,
  padding: 28, width: 500, maxHeight: '85vh', overflowY: 'auto', color: '#e8e0ff',
};

const CLASS_ICON: Record<string, string> = {
  VOIDBLADE: '⚔️', AETHERMAGE: '🔮', IRONCLAD: '🛡️',
};

export default function PvpPanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [fighting, setFighting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PvpFightResultDto | null>(null);

  const { data: state, isLoading, refetch } = useQuery({
    queryKey: ['pvp-state'],
    queryFn: pvpApi.getState,
  });

  const handleFight = async (opponent: PvpOpponentDto) => {
    if (fighting) return;
    setFighting(opponent.playerId);
    try {
      const result = await pvpApi.fight(opponent.playerId);
      setLastResult(result);
      if (result.victory) {
        notify.success(`⚔️ Victory! Rating: ${result.newRating} (+${result.ratingChange})`);
        if (result.rewards) {
          notify.info(`+${result.rewards.goldShards.toLocaleString()} gold · +${result.rewards.voidCrystals} crystals`);
        }
      } else {
        notify.info(`💀 Defeat. Rating: ${result.newRating} (${result.ratingChange})`);
      }
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
      void refetch();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'PvP failed');
    } finally {
      setFighting(null);
    }
  };

  const profile = state?.profile;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>⚔️ Async PvP</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Profile stats */}
        {profile && (
          <div style={{
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{profile.rating}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Rating</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80' }}>{profile.wins}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Wins</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{profile.losses}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Losses</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#e8e0ff' }}>{(profile.winRate * 100).toFixed(0)}%</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Win Rate</div>
            </div>
          </div>
        )}

        {/* Last result */}
        {lastResult && (
          <div style={{
            background: lastResult.victory ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${lastResult.victory ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.25)'}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13,
          }}>
            <span style={{ fontWeight: 700, color: lastResult.victory ? '#4ade80' : '#ef4444' }}>
              {lastResult.victory ? '✅ Victory' : '💀 Defeat'}
            </span>
            <span style={{ color: '#9ca3af', marginLeft: 12 }}>
              vs {lastResult.opponent.playerName} · {lastResult.battleRounds} rounds · {lastResult.ratingChange > 0 ? '+' : ''}{lastResult.ratingChange} rating
            </span>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>Finding opponents…</div>
        ) : !state?.opponents.length ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>No opponents found near your rating</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>⚔️ Available Opponents</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.opponents.map((opp) => (
                <div key={opp.playerId} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 10, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 28 }}>{CLASS_ICON[opp.playerClass] ?? '👤'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{opp.playerName}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      Lv.{opp.level} {opp.playerClass} · PS {opp.powerScore.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 12 }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b' }}>{opp.rating}</div>
                    <div style={{ fontSize: 11, color: opp.ratingDiff > 0 ? '#ef4444' : '#4ade80' }}>
                      {opp.ratingDiff > 0 ? '+' : ''}{opp.ratingDiff}
                    </div>
                  </div>
                  <button
                    onClick={() => handleFight(opp)}
                    disabled={fighting !== null}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: fighting ? 'rgba(59,130,246,0.3)' : 'linear-gradient(90deg, #1d4ed8, #1e40af)',
                      color: '#fff', fontWeight: 700, cursor: fighting ? 'not-allowed' : 'pointer', fontSize: 13,
                    }}
                  >
                    {fighting === opp.playerId ? '…' : 'Fight'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Recent battle history */}
        {(state?.recentBattles?.length ?? 0) > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>Recent Battles</div>
            {state!.recentBattles.slice(0, 5).map((b) => (
              <div key={b.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13,
              }}>
                <span style={{ color: b.result === 'WIN' ? '#4ade80' : '#ef4444' }}>
                  {b.result === 'WIN' ? '✅' : '❌'} {b.opponentName}
                </span>
                <span style={{ color: b.ratingChange > 0 ? '#4ade80' : '#ef4444', fontSize: 12 }}>
                  {b.ratingChange > 0 ? '+' : ''}{b.ratingChange}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
