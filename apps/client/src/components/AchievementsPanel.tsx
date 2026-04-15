import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AchievementDefinitionDto, PlayerAchievementDto } from '@riftborn/shared';
import { achievementsApi } from '../api/achievements.api';

interface Props { onClose: () => void; }

const CATEGORIES = ['combat', 'progression', 'economy', 'collection', 'social'] as const;
type Category = typeof CATEGORIES[number];

const CAT_LABEL: Record<Category, string> = {
  combat: '⚔️ Combat',
  progression: '📈 Progression',
  economy: '💰 Economy',
  collection: '🎒 Collection',
  social: '🤝 Social',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
};

const panel: React.CSSProperties = {
  width: '540px', maxWidth: '96vw', maxHeight: '85vh',
  background: 'linear-gradient(160deg, #130a2e, #1a0a3e)',
  border: '1px solid rgba(167,139,250,0.25)',
  borderRadius: '16px',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

/** For progressive groups, pick the first uncompleted tier (or last completed if all done). */
function pickVisibleAchievements(
  all: AchievementDefinitionDto[],
  unlockedSet: Set<string>,
): AchievementDefinitionDto[] {
  const groups = new Map<string, AchievementDefinitionDto[]>();
  const standalone: AchievementDefinitionDto[] = [];

  for (const def of all) {
    if (def.progressGroup) {
      const list = groups.get(def.progressGroup) || [];
      list.push(def);
      groups.set(def.progressGroup, list);
    } else {
      standalone.push(def);
    }
  }

  const result: AchievementDefinitionDto[] = [];
  for (const [, tiers] of groups) {
    tiers.sort((a, b) => (a.progressTier ?? 0) - (b.progressTier ?? 0));
    const firstLocked = tiers.find((t) => !unlockedSet.has(t.id));
    result.push(firstLocked ?? tiers[tiers.length - 1]);
  }
  result.push(...standalone);
  return result;
}

function AchievementRow({ def, unlocked }: { def: AchievementDefinitionDto; unlocked: PlayerAchievementDto | null }) {
  const done = !!unlocked;
  const tierLabel = def.progressTier ? ` (${def.progressTier}/${def.progressGroup === 'kills' ? 5 : def.progressGroup === 'level' || def.progressGroup === 'zone' ? 5 : def.progressGroup === 'bosses' ? 4 : def.progressGroup === 'pvp' ? 3 : def.progressGroup === 'gold' ? 3 : def.progressGroup === 'enchant' ? 2 : 3})` : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 14px', borderRadius: '8px', marginBottom: '4px',
      background: done ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${done ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)'}`,
      opacity: done ? 1 : 0.55,
    }}>
      <span style={{ fontSize: '22px', filter: done ? 'none' : 'grayscale(1)' }}>{def.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: done ? '#4ade80' : '#9ca3af' }}>
          {def.name}
          {def.progressGroup && <span style={{ fontSize: '9px', color: '#6b7280', marginLeft: '4px' }}>{tierLabel}</span>}
          {done && <span style={{ fontSize: '9px', color: '#4ade80', marginLeft: '6px' }}>✓</span>}
        </div>
        <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px' }}>
          {def.description}
        </div>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px',
        fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        {def.rewardGold > 0 && <span style={{ color: done ? '#fbbf24' : '#4b5563' }}>{def.rewardGold.toLocaleString()}g</span>}
        {def.rewardDiamonds > 0 && <span style={{ color: done ? '#60a5fa' : '#4b5563' }}>💎{def.rewardDiamonds}</span>}
      </div>
    </div>
  );
}

export default function AchievementsPanel({ onClose }: Props) {
  const [cat, setCat] = useState<Category>('combat');

  const { data, isLoading } = useQuery({
    queryKey: ['achievements-state'],
    queryFn: achievementsApi.getState,
  });

  const unlockedMap = new Map(data?.unlocked.map((u) => [u.achievementId, u]) ?? []);
  const unlockedSet = new Set(data?.unlocked.map((u) => u.achievementId) ?? []);
  const total = data?.all.length ?? 0;
  const doneCount = data?.unlocked.length ?? 0;
  const visible = pickVisibleAchievements(data?.all ?? [], unlockedSet);
  const filtered = visible.filter((a) => a.category === cat);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid rgba(167,139,250,0.12)', flexShrink: 0,
        }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8e0ff' }}>
            🏅 Achievements
            <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '10px' }}>
              {doneCount}/{total}
            </span>
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

        {/* Category tabs */}
        <div style={{
          display: 'flex', gap: '4px', padding: '10px 16px', overflowX: 'auto',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                padding: '5px 10px', borderRadius: '6px', border: 'none',
                fontSize: '10px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                background: cat === c ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
                color: cat === c ? '#c4b5fd' : '#6b7280',
              }}
            >
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {isLoading && <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center' }}>Loading...</p>}
          {filtered.map((def) => (
            <AchievementRow key={def.id} def={def} unlocked={unlockedMap.get(def.id) ?? null} />
          ))}
          {!isLoading && filtered.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center' }}>No achievements in this category.</p>
          )}
        </div>
      </div>
    </div>
  );
}
