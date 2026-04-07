import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { EnhancementInfoDto, InventoryItemDto } from '@riftborn/shared';
import { enhancementApi } from '../api/enhancement.api';
import { notify } from '../store/notification.store';
import { PLAYER_STATE_KEY } from '../hooks/usePlayerQuery';

interface Props {
  item: InventoryItemDto;
  onClose: () => void;
  onUpgraded: () => void;
}

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#9ca3af', UNCOMMON: '#4ade80', RARE: '#60a5fa', EPIC: '#c084fc', LEGENDARY: '#facc15',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
};
const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg, #1e1a2e 0%, #0f0c1a 100%)',
  border: '1px solid rgba(124,58,237,0.4)', borderRadius: 16,
  padding: 28, width: 380, color: '#e8e0ff', fontFamily: 'inherit',
};

export default function EnhancementPanel({ item, onClose, onUpgraded }: Props) {
  const [info, setInfo] = useState<EnhancementInfoDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    enhancementApi.getInfo(item.id)
      .then(setInfo)
      .catch(() => notify.error('Failed to load enhancement info'))
      .finally(() => setLoading(false));
  }, [item.id]);

  const handleUpgrade = async () => {
    if (upgrading || !info || info.isMaxLevel) return;
    setUpgrading(true);
    try {
      const result = await enhancementApi.upgrade(item.id);
      notify.success(`⚒️ Enhanced to +${result.newEnhancementLevel}! PS: ${result.newPowerScore.toLocaleString()}`);
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
      onUpgraded();
      onClose();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Enhancement failed');
    } finally {
      setUpgrading(false);
    }
  };

  const enhLevel = (item as InventoryItemDto & { enhancementLevel?: number }).enhancementLevel ?? 0;
  const rarityColor = RARITY_COLOR[item.rarity] ?? '#9ca3af';

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>⚒️ Enhancement</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Item header */}
        <div style={{ background: 'rgba(124,58,237,0.12)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚔️</span>
            <div>
              <div style={{ fontWeight: 700, color: rarityColor }}>{item.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{item.rarity} · {item.slot}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>+{enhLevel}</div>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 13 }}>
            {item.atkBonus > 0 && <div style={{ color: '#f87171' }}>ATK +{item.atkBonus}</div>}
            {item.defBonus > 0 && <div style={{ color: '#60a5fa' }}>DEF +{item.defBonus}</div>}
            {item.hpBonus > 0 && <div style={{ color: '#4ade80' }}>HP +{item.hpBonus}</div>}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>Loading…</div>
        ) : info ? (
          <>
            {/* Enhancement level bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: '#9ca3af' }}>Level</span>
                <span style={{ color: '#a78bfa', fontWeight: 700 }}>{info.currentLevel} / {info.maxLevel}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6,
                  width: `${(info.currentLevel / info.maxLevel) * 100}%`,
                  background: info.isMaxLevel ? '#f59e0b' : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Stat multiplier */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ color: '#9ca3af', marginBottom: 4 }}>Current stat bonus</div>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 16 }}>
                ×{info.statMultiplier.toFixed(2)}
              </div>
              {!info.isMaxLevel && info.cost && (
                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                  Next: ×{(1 + (info.currentLevel + 1) * 0.05).toFixed(2)}
                </div>
              )}
            </div>

            {/* Cost */}
            {!info.isMaxLevel && info.cost ? (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
                <div style={{ color: '#9ca3af', marginBottom: 6 }}>Upgrade cost</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span>🔮 <strong>{info.cost.resonanceCores}</strong> Resonance Cores</span>
                  <span>🔥 <strong>{info.cost.forgeDust}</strong> Forge Dust</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 700, padding: '12px 0', marginBottom: 20 }}>
                ✨ MAX LEVEL REACHED
              </div>
            )}

            <button
              onClick={handleUpgrade}
              disabled={upgrading || info.isMaxLevel}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                background: info.isMaxLevel
                  ? 'rgba(255,255,255,0.05)'
                  : upgrading
                  ? 'rgba(124,58,237,0.4)'
                  : 'linear-gradient(90deg, #7c3aed, #5b21b6)',
                color: info.isMaxLevel ? '#4b5563' : '#fff',
                fontWeight: 700, fontSize: 15, cursor: info.isMaxLevel ? 'not-allowed' : 'pointer',
              }}
            >
              {upgrading ? 'Enhancing…' : info.isMaxLevel ? 'Max Level' : `⚒️ Enhance to +${info.currentLevel + 1}`}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
