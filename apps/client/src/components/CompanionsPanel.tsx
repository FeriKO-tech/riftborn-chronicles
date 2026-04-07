import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlayerCompanionDto } from '@riftborn/shared';
import { companionsApi } from '../api/companions.api';
import { notify } from '../store/notification.store';
import { PLAYER_STATE_KEY } from '../hooks/usePlayerQuery';

interface Props { onClose: () => void; }

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#9ca3af', UNCOMMON: '#4ade80', RARE: '#60a5fa', EPIC: '#c084fc', LEGENDARY: '#facc15',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg, #1e1a2e 0%, #0f0c1a 100%)',
  border: '1px solid rgba(124,58,237,0.4)', borderRadius: 16,
  padding: 28, width: 440, maxHeight: '80vh', overflowY: 'auto', color: '#e8e0ff',
};

export default function CompanionsPanel({ onClose }: Props) {
  const qc = useQueryClient();
  const [activating, setActivating] = useState<string | null>(null);

  const { data: state, isLoading } = useQuery({
    queryKey: ['companions'],
    queryFn: companionsApi.getState,
  });

  const activateMutation = useMutation({
    mutationFn: companionsApi.activate,
    onSuccess: (result) => {
      notify.success(`✨ ${result.activeCompanion.name} is now your companion! PS: ${result.newPowerScore.toLocaleString()}`);
      void qc.invalidateQueries({ queryKey: ['companions'] });
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
    },
    onError: (err: unknown) => {
      notify.error(err instanceof Error ? err.message : 'Failed to activate companion');
    },
    onSettled: () => setActivating(null),
  });

  const handleActivate = (companion: PlayerCompanionDto) => {
    if (activating || companion.isActive) return;
    setActivating(companion.templateId);
    activateMutation.mutate(companion.templateId);
  };

  const bonusSummary = (c: PlayerCompanionDto) => {
    const parts: string[] = [];
    if (c.bonus.atkPct > 0) parts.push(`ATK +${c.bonus.atkPct}%`);
    if (c.bonus.defPct > 0) parts.push(`DEF +${c.bonus.defPct}%`);
    if (c.bonus.hpPct > 0) parts.push(`HP +${c.bonus.hpPct}%`);
    return parts.join(' · ') || 'No bonus';
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>🌟 Companions</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 30 }}>Loading companions…</div>
        ) : !state?.owned.length ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 30 }}>No companions yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {state.owned.map((c) => (
              <div key={c.templateId} style={{
                background: c.isActive ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${c.isActive ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 36 }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: RARITY_COLOR[c.rarity] ?? '#e8e0ff' }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px' }}>{c.rarity}</span>
                    {c.isActive && <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>● ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{c.rarity}</div>
                  <div style={{ fontSize: 13, color: '#4ade80', marginTop: 4, fontWeight: 600 }}>{bonusSummary(c)}</div>
                </div>
                <button
                  onClick={() => handleActivate(c)}
                  disabled={c.isActive || activating === c.templateId}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: c.isActive
                      ? 'rgba(124,58,237,0.3)'
                      : 'linear-gradient(90deg, #7c3aed, #5b21b6)',
                    color: c.isActive ? '#a78bfa' : '#fff',
                    fontWeight: 600, fontSize: 13,
                    cursor: c.isActive ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.isActive ? '✓ Active' : activating === c.templateId ? '…' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
