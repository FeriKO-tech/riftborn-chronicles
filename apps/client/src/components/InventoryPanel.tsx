import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ItemRarity } from '@riftborn/shared';
import type { InventoryItemDto } from '@riftborn/shared';
import { inventoryApi } from '../api/inventory.api';
import { usePlayerStore } from '../store/player.store';
import { PLAYER_STATE_KEY } from '../hooks/usePlayerQuery';
import { notify } from '../store/notification.store';

interface Props {
  onClose: () => void;
}

const RARITY_COLOR: Record<string, string> = {
  [ItemRarity.COMMON]: '#9ca3af',
  [ItemRarity.UNCOMMON]: '#4ade80',
  [ItemRarity.RARE]: '#60a5fa',
  [ItemRarity.EPIC]: '#c084fc',
  [ItemRarity.LEGENDARY]: '#fbbf24',
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 110,
  backdropFilter: 'blur(4px)',
};

const panel: React.CSSProperties = {
  background: 'linear-gradient(160deg, #130a2e, #1a0a3e)',
  border: '1px solid rgba(167,139,250,0.3)',
  borderRadius: '16px',
  padding: '24px',
  width: 'min(420px, 95vw)',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
};

const title: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#e8e0ff',
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#6b7280',
  fontSize: '18px',
  cursor: 'pointer',
};

const itemRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 12px',
  borderRadius: '10px',
  marginBottom: '6px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
};

const itemEquippedRow: React.CSSProperties = {
  ...itemRow,
  background: 'rgba(124,58,237,0.15)',
  border: '1px solid rgba(167,139,250,0.3)',
};

const equipBtn = (equipped: boolean): React.CSSProperties => ({
  marginLeft: 'auto',
  padding: '4px 12px',
  borderRadius: '6px',
  border: 'none',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  background: equipped ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.5)',
  color: equipped ? '#9ca3af' : '#e8e0ff',
});

export default function InventoryPanel({ onClose }: Props) {
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const playerState = usePlayerStore((s) => s.playerState);
  const qc = useQueryClient();

  useEffect(() => {
    inventoryApi.getInventory().then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleToggleEquip = async (item: InventoryItemDto) => {
    if (actingOn) return;
    setActingOn(item.id);
    const oldPS = playerState?.profile?.powerScore ?? 0;
    try {
      if (item.isEquipped) {
        const result = await inventoryApi.unequip(item.id);
        setItems((prev) => prev.map((i) => (i.id === item.id ? result.item : i)));
        const diff = result.newPowerScore - oldPS;
        notify.info(`PS: ${oldPS.toLocaleString()} → ${result.newPowerScore.toLocaleString()} (${diff >= 0 ? '+' : ''}${diff})`);
        void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
      } else {
        const { equipped, unequipped, newPowerScore } = await inventoryApi.equip(item.id);
        setItems((prev) =>
          prev.map((i) => {
            if (i.id === equipped.id) return equipped;
            if (unequipped && i.id === unequipped.id) return unequipped;
            return i;
          }),
        );
        const diff = newPowerScore - oldPS;
        const variant = diff > 0 ? 'success' : 'info';
        notify[variant](`⚡ PS: ${oldPS.toLocaleString()} → ${newPowerScore.toLocaleString()} (${diff >= 0 ? '+' : ''}${diff})`);
        void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
      }
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed to update equipment');
    } finally {
      setActingOn(null);
    }
  };

  const enhMult = (lvl: number) => 1 + lvl * 0.05;
  const totalAtk = items.filter((i) => i.isEquipped).reduce((s, i) => s + Math.floor(i.atkBonus * enhMult(i.enhancementLevel)), 0);
  const totalDef = items.filter((i) => i.isEquipped).reduce((s, i) => s + Math.floor(i.defBonus * enhMult(i.enhancementLevel)), 0);
  const totalHp = items.filter((i) => i.isEquipped).reduce((s, i) => s + Math.floor(i.hpBonus * enhMult(i.enhancementLevel)), 0);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span style={title}>⚙️ Equipment</span>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        {(totalAtk + totalDef + totalHp) > 0 && (
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '14px', display: 'flex', gap: '16px' }}>
            <span>+{totalAtk} ATK</span>
            <span>+{totalDef} DEF</span>
            <span>+{totalHp} HP</span>
          </div>
        )}

        {loading && <p style={{ color: '#6b7280', fontSize: '13px' }}>Loading…</p>}
        {!loading && items.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '13px' }}>No items yet. Keep battling!</p>
        )}

        {items.map((item) => (
          <div key={item.id} style={item.isEquipped ? itemEquippedRow : itemRow}>
            <span style={{ fontSize: '20px' }}>{item.isEquipped ? '✨' : '📦'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: RARITY_COLOR[item.rarity] ?? '#e8e0ff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {item.name}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>
                {item.slot} · Lv{item.itemLevel} ·
                {item.atkBonus > 0 && ` +${Math.floor(item.atkBonus * enhMult(item.enhancementLevel))} ATK`}
                {item.defBonus > 0 && ` +${Math.floor(item.defBonus * enhMult(item.enhancementLevel))} DEF`}
                {item.hpBonus > 0 && ` +${Math.floor(item.hpBonus * enhMult(item.enhancementLevel))} HP`}
                {item.enhancementLevel > 0 && <span style={{ color: '#f59e0b' }}> +{item.enhancementLevel}</span>}
              </div>
            </div>
            <button
              style={equipBtn(item.isEquipped)}
              onClick={() => handleToggleEquip(item)}
              disabled={actingOn === item.id}
            >
              {actingOn === item.id ? '…' : item.isEquipped ? 'Unequip' : 'Equip'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
