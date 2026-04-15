import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlayerSkillDto } from '@riftborn/shared';
import { skillsApi } from '../api/skills.api';
import { usePlayerStore } from '../store/player.store';
import { notify } from '../store/notification.store';
import { PLAYER_STATE_KEY } from '../hooks/usePlayerQuery';
import { SKILL_STATE_KEY } from './SkillBar';

interface Props { onClose: () => void; }

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
};

const panel: React.CSSProperties = {
  width: '460px', maxWidth: '96vw', maxHeight: '85vh',
  background: 'linear-gradient(160deg, #130a2e, #1a0a3e)',
  border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: '16px',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

function costForLevel(skill: PlayerSkillDto): number {
  const def = skill.definition;
  return skill.level === 0 ? def.unlockCost : def.unlockCost + skill.level * def.upgradeCostPerLevel;
}

export default function SkillsPanel({ onClose }: Props) {
  const qc = useQueryClient();
  const gold = Number(usePlayerStore((s) => s.playerState?.currencies?.goldShards ?? 0));

  const { data, isLoading } = useQuery({
    queryKey: SKILL_STATE_KEY,
    queryFn: skillsApi.getState,
  });

  const upgradeMut = useMutation({
    mutationFn: (skillId: string) => skillsApi.upgrade(skillId),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: SKILL_STATE_KEY });
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
      notify.success(`${result.skill.definition.name} upgraded to Lv${result.skill.level}! (-${result.goldCost} gold)`);
    },
    onError: (err: Error) => notify.error(err.message),
  });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid rgba(167,139,250,0.12)', flexShrink: 0,
        }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8e0ff' }}>
            Skills
          </span>
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {isLoading && <p style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</p>}
          {data?.skills.map((skill) => {
            const def = skill.definition;
            const isMax = skill.level >= def.maxLevel;
            const cost = isMax ? 0 : costForLevel(skill);
            const canAfford = gold >= cost;
            const mult = skill.level > 0
              ? (def.baseDmgMult + (skill.level - 1) * def.dmgMultPerLevel).toFixed(1)
              : def.baseDmgMult.toFixed(1);

            return (
              <div key={skill.skillId} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px', borderRadius: '10px', marginBottom: '8px',
                background: skill.level > 0 ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${skill.level > 0 ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <span style={{ fontSize: '28px' }}>{def.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#e8e0ff' }}>
                    {def.name}
                    {skill.level > 0 && <span style={{ color: '#a78bfa', marginLeft: '6px' }}>Lv{skill.level}</span>}
                    {isMax && <span style={{ color: '#4ade80', marginLeft: '6px', fontSize: '10px' }}>MAX</span>}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                    {def.description}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                    {def.baseDmgMult > 0 ? `${mult}x ATK` : 'Buff'}
                    {' · '}{(def.cooldownMs / 1000).toFixed(0)}s cooldown
                  </div>
                </div>
                {!isMax && (
                  <button
                    onClick={() => upgradeMut.mutate(skill.skillId)}
                    disabled={upgradeMut.isPending || !canAfford}
                    style={{
                      padding: '8px 14px', borderRadius: '8px', border: 'none',
                      fontSize: '11px', fontWeight: 700, cursor: canAfford ? 'pointer' : 'not-allowed',
                      background: canAfford
                        ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(124,58,237,0.2))'
                        : 'rgba(255,255,255,0.04)',
                      color: canAfford ? '#e8e0ff' : '#4b5563',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {upgradeMut.isPending ? '...' : skill.level === 0 ? `Unlock (${cost}g)` : `Upgrade (${cost}g)`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
