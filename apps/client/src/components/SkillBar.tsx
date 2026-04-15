import React, { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlayerSkillDto } from '@riftborn/shared';
import { skillsApi } from '../api/skills.api';

const SKILL_STATE_KEY = ['skills-state'];

const HOTKEYS = ['1', '2', '3'];

interface Props {
  onUseSkill: (skillId: string, dmgMult: number, cooldownMs: number) => void;
}

export default function SkillBar({ onUseSkill }: Props) {
  const { data } = useQuery({
    queryKey: SKILL_STATE_KEY,
    queryFn: skillsApi.getState,
    staleTime: 30_000,
  });

  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Tick cooldowns
  useEffect(() => {
    const id = setInterval(() => {
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          const nv = Math.max(0, v - 100);
          if (nv !== v) changed = true;
          if (nv > 0) next[k] = nv;
        }
        return changed ? next : prev;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);

  const handleUse = useCallback((skill: PlayerSkillDto) => {
    if (skill.level === 0) return;
    if ((cooldowns[skill.skillId] ?? 0) > 0) return;
    const mult = skill.definition.baseDmgMult + (skill.level - 1) * skill.definition.dmgMultPerLevel;
    setCooldowns((prev) => ({ ...prev, [skill.skillId]: skill.definition.cooldownMs }));
    onUseSkill(skill.skillId, mult, skill.definition.cooldownMs);
  }, [cooldowns, onUseSkill]);

  // Keyboard hotkeys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const idx = HOTKEYS.indexOf(e.key);
      if (idx >= 0 && data?.skills[idx] && data.skills[idx].level > 0) {
        handleUse(data.skills[idx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [data, handleUse]);

  if (!data || data.skills.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '6px', pointerEvents: 'auto', zIndex: 12,
    }}>
      {data.skills.map((skill, idx) => {
        const cd = cooldowns[skill.skillId] ?? 0;
        const cdPct = cd > 0 ? cd / skill.definition.cooldownMs : 0;
        const locked = skill.level === 0;
        return (
          <button
            key={skill.skillId}
            onClick={() => handleUse(skill)}
            disabled={locked || cd > 0}
            title={`${skill.definition.name} (${HOTKEYS[idx]}) — ${skill.definition.description}${locked ? ' [LOCKED]' : ` Lv${skill.level}`}`}
            style={{
              width: '44px', height: '44px', borderRadius: '10px', border: 'none',
              position: 'relative', overflow: 'hidden', cursor: locked ? 'not-allowed' : 'pointer',
              background: locked
                ? 'rgba(255,255,255,0.04)'
                : 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(124,58,237,0.15))',
              opacity: locked ? 0.4 : (cd > 0 ? 0.7 : 1),
              transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* Cooldown overlay */}
            {cd > 0 && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${cdPct * 100}%`,
                background: 'rgba(0,0,0,0.6)',
                transition: 'height 0.1s linear',
              }} />
            )}
            <span style={{ fontSize: '18px', position: 'relative', zIndex: 1 }}>
              {skill.definition.icon}
            </span>
            <span style={{
              fontSize: '8px', fontWeight: 700, color: '#9ca3af',
              position: 'absolute', bottom: '2px', right: '4px', zIndex: 1,
            }}>
              {HOTKEYS[idx]}
            </span>
            {cd > 0 && (
              <span style={{
                position: 'absolute', fontSize: '10px', fontWeight: 700, color: '#fbbf24', zIndex: 1,
              }}>
                {(cd / 1000).toFixed(1)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { SKILL_STATE_KEY };
