import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ItemRarity, ItemSlot, PlayerClass } from '@riftborn/shared';
import type { InventoryItemDto, PlayerCompanionDto, CompanionTemplateDto } from '@riftborn/shared';
import { inventoryApi } from '../api/inventory.api';
import { companionsApi } from '../api/companions.api';
import { usePlayerStore } from '../store/player.store';
import { useAuthStore } from '../store/auth.store';
import { PLAYER_STATE_KEY } from '../hooks/usePlayerQuery';
import { notify } from '../store/notification.store';

interface Props { onClose: () => void; }

// ── Constants ──────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  [ItemRarity.COMMON]: '#9ca3af',
  [ItemRarity.UNCOMMON]: '#4ade80',
  [ItemRarity.RARE]: '#60a5fa',
  [ItemRarity.EPIC]: '#c084fc',
  [ItemRarity.LEGENDARY]: '#fbbf24',
};

const SLOT_LABEL: Record<string, string> = {
  [ItemSlot.WEAPON]: 'Weapon',
  [ItemSlot.ARMOR]: 'Armor',
  [ItemSlot.HELMET]: 'Helmet',
  [ItemSlot.ACCESSORY]: 'Ring',
};

const SLOT_ICON: Record<string, string> = {
  [ItemSlot.WEAPON]: '\u2694\ufe0f',
  [ItemSlot.ARMOR]: '\ud83d\udee1\ufe0f',
  [ItemSlot.HELMET]: '\u26d1\ufe0f',
  [ItemSlot.ACCESSORY]: '\ud83d\udc8d',
};

const SLOT_ORDER = [ItemSlot.WEAPON, ItemSlot.HELMET, ItemSlot.ARMOR, ItemSlot.ACCESSORY];

type SubTab = 'equipment' | 'companions' | 'enhance';

// ── Styles ─────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 110, backdropFilter: 'blur(6px)',
};

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, #130a2e, #1a0a3e)',
  border: '1px solid rgba(167,139,250,0.3)',
  borderRadius: '16px',
  width: 'min(680px, 95vw)',
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  display: 'flex', flexDirection: 'column' as const,
};

// ── Hero Panel ─────────────────────────────────────────────────────────────────

export default function HeroPanel({ onClose }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('equipment');
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const playerState = usePlayerStore((s) => s.playerState);
  const authPlayer = useAuthStore((s) => s.player);
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
        notify.info(`PS: ${oldPS.toLocaleString()} -> ${result.newPowerScore.toLocaleString()} (${diff >= 0 ? '+' : ''}${diff})`);
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
        notify.success(`PS: ${oldPS.toLocaleString()} -> ${newPowerScore.toLocaleString()} (${diff >= 0 ? '+' : ''}${diff})`);
      }
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActingOn(null);
    }
  };

  const equipped = Object.fromEntries(
    SLOT_ORDER.map((s) => [s, items.find((i) => i.isEquipped && i.slot === s) ?? null]),
  ) as Record<ItemSlot, InventoryItemDto | null>;

  const profile = playerState?.profile ?? authPlayer ?? null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 0' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#e8e0ff' }}>Hero</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '18px', cursor: 'pointer' }}>
            X
          </button>
        </div>

        {/* Hero avatar + equipment grid */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px 20px 8px' }}>
          {/* Left slots: Weapon, Helmet */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <EquipSlot slot={ItemSlot.WEAPON} item={equipped[ItemSlot.WEAPON]} onToggle={handleToggleEquip} busy={actingOn} />
            <EquipSlot slot={ItemSlot.HELMET} item={equipped[ItemSlot.HELMET]} onToggle={handleToggleEquip} busy={actingOn} />
          </div>

          {/* Center: Hero silhouette */}
          <div style={{
            width: '120px', height: '160px', borderRadius: '12px',
            background: 'linear-gradient(180deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))',
            border: '1px solid rgba(167,139,250,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            <div style={{ fontSize: '38px' }}>{profile?.class === PlayerClass.VOIDBLADE ? '\u2694\ufe0f' : profile?.class === PlayerClass.AETHERMAGE ? '\u2728' : '\ud83d\udee1\ufe0f'}</div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa' }}>{profile?.name ?? 'Hero'}</span>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>Lv {profile?.level ?? '?'} {profile?.class ?? ''}</span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>PS {profile?.powerScore?.toLocaleString() ?? '?'}</span>
          </div>

          {/* Right slots: Armor, Accessory */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <EquipSlot slot={ItemSlot.ARMOR} item={equipped[ItemSlot.ARMOR]} onToggle={handleToggleEquip} busy={actingOn} />
            <EquipSlot slot={ItemSlot.ACCESSORY} item={equipped[ItemSlot.ACCESSORY]} onToggle={handleToggleEquip} busy={actingOn} />
          </div>
        </div>

        {/* Stat summary */}
        <StatSummary items={items} />

        {/* Sub-tab bar */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.06)', margin: '0 20px' }}>
          {([
            ['equipment', 'Equipment'],
            ['companions', 'Companions'],
            ['enhance', 'Enhance'],
          ] as [SubTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSubTab(key)} style={{
              flex: 1, padding: '10px 0', border: 'none', fontSize: '11px', fontWeight: 700,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
              color: subTab === key ? '#a78bfa' : '#6b7280',
              background: 'transparent',
              borderBottom: subTab === key ? '2px solid #7c3aed' : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Sub-tab content */}
        <div style={{ padding: '16px 20px 20px', flex: 1, overflowY: 'auto' }}>
          {subTab === 'equipment' && (
            <EquipmentList items={items} loading={loading} actingOn={actingOn} onToggle={handleToggleEquip} />
          )}
          {subTab === 'companions' && <CompanionsSubTab />}
          {subTab === 'enhance' && <EnhanceSubTab items={items.filter((i) => i.isEquipped)} />}
        </div>
      </div>
    </div>
  );
}

// ── Equipment Slot ─────────────────────────────────────────────────────────────

function EquipSlot({ slot, item, onToggle, busy }: {
  slot: ItemSlot;
  item: InventoryItemDto | null;
  onToggle: (item: InventoryItemDto) => void;
  busy: string | null;
}) {
  return (
    <div
      onClick={() => item && onToggle(item)}
      style={{
        width: '64px', height: '64px', borderRadius: '10px',
        background: item ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${item ? (RARITY_COLOR[item.rarity] ?? '#6b7280') + '55' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
        cursor: item ? 'pointer' : 'default',
        transition: 'all 0.2s',
        opacity: busy === item?.id ? 0.5 : 1,
      }}
    >
      {item ? (
        <>
          <span style={{ fontSize: '10px', fontWeight: 700, color: RARITY_COLOR[item.rarity] ?? '#e8e0ff', textAlign: 'center', lineHeight: 1.2, maxWidth: '58px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.name}
          </span>
          <span style={{ fontSize: '8px', color: '#6b7280' }}>Lv{item.itemLevel}</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: '16px' }}>{SLOT_ICON[slot]}</span>
          <span style={{ fontSize: '8px', color: '#4b5563' }}>{SLOT_LABEL[slot]}</span>
        </>
      )}
    </div>
  );
}

// ── Stat Summary ───────────────────────────────────────────────────────────────

function StatSummary({ items }: { items: InventoryItemDto[] }) {
  const eq = items.filter((i) => i.isEquipped);
  const atk = eq.reduce((s, i) => s + i.atkBonus, 0);
  const def = eq.reduce((s, i) => s + i.defBonus, 0);
  const hp = eq.reduce((s, i) => s + i.hpBonus, 0);
  if (atk + def + hp === 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '8px 20px 14px', fontSize: '11px' }}>
      <span style={{ color: '#ef4444' }}>+{atk} ATK</span>
      <span style={{ color: '#60a5fa' }}>+{def} DEF</span>
      <span style={{ color: '#4ade80' }}>+{hp} HP</span>
    </div>
  );
}

// ── Equipment List ─────────────────────────────────────────────────────────────

function EquipmentList({ items, loading, actingOn, onToggle }: {
  items: InventoryItemDto[];
  loading: boolean;
  actingOn: string | null;
  onToggle: (item: InventoryItemDto) => void;
}) {
  if (loading) return <p style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</p>;
  if (items.length === 0) return <p style={{ color: '#6b7280', fontSize: '12px' }}>No items yet. Keep battling!</p>;

  const sorted = [...items].sort((a, b) => {
    if (a.isEquipped !== b.isEquipped) return a.isEquipped ? -1 : 1;
    return b.itemLevel - a.itemLevel;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {sorted.map((item) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
          borderRadius: '8px',
          background: item.isEquipped ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${item.isEquipped ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)'}`,
        }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{SLOT_ICON[item.slot] ?? '?'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: RARITY_COLOR[item.rarity] ?? '#e8e0ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.name} {item.isEquipped && <span style={{ color: '#4ade80', fontSize: '9px' }}>[E]</span>}
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280' }}>
              {SLOT_LABEL[item.slot]} Lv{item.itemLevel}
              {item.enhancementLevel > 0 && <span style={{ color: '#fbbf24' }}> +{item.enhancementLevel}</span>}
              {item.atkBonus > 0 && ` +${item.atkBonus}ATK`}
              {item.defBonus > 0 && ` +${item.defBonus}DEF`}
              {item.hpBonus > 0 && ` +${item.hpBonus}HP`}
            </div>
          </div>
          <button
            onClick={() => onToggle(item)}
            disabled={actingOn === item.id}
            style={{
              padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
              background: item.isEquipped ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.4)',
              color: item.isEquipped ? '#9ca3af' : '#e8e0ff',
            }}
          >
            {actingOn === item.id ? '...' : item.isEquipped ? 'Unequip' : 'Equip'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Companions Sub-tab ─────────────────────────────────────────────────────────

function CompanionsSubTab() {
  const [companions, setCompanions] = useState<PlayerCompanionDto[]>([]);
  const [templates, setTemplates] = useState<CompanionTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    Promise.all([companionsApi.getState(), companionsApi.getTemplates()])
      .then(([state, tmpl]) => { setCompanions(state.owned); setTemplates(tmpl); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleActivate = async (templateId: string) => {
    if (activating) return;
    setActivating(templateId);
    try {
      await companionsApi.activate(templateId);
      // Update local state: deactivate previous, set new active
      setCompanions((prev) => prev.map((c) => ({
        ...c,
        isActive: c.templateId === templateId,
      })));
      notify.success(`Companion activated!`);
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActivating(null);
    }
  };

  if (loading) return <p style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</p>;

  const active = companions.find((c) => c.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {active && (
        <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80' }}>Active: {active.templateId}</div>
          <div style={{ fontSize: '9px', color: '#6b7280' }}>
            +{active.bonus.atkPct}% ATK, +{active.bonus.defPct}% DEF, +{active.bonus.hpPct}% HP
          </div>
        </div>
      )}
      {templates.map((t) => {
        const owned = companions.find((c) => c.templateId === t.id);
        const isActive = owned?.isActive ?? false;
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px',
            background: isActive ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isActive ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#e8e0ff' }}>
                {t.name} {isActive && <span style={{ color: '#4ade80', fontSize: '9px' }}>[Active]</span>}
              </div>
              <div style={{ fontSize: '9px', color: '#6b7280' }}>{t.rarity} - {t.description}</div>
            </div>
            {owned && !isActive && (
              <button
                onClick={() => handleActivate(t.id)}
                disabled={activating === t.id}
                style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                  background: 'rgba(124,58,237,0.4)', color: '#e8e0ff',
                }}
              >
                {activating === t.id ? '...' : 'Activate'}
              </button>
            )}
            {!owned && <span style={{ fontSize: '9px', color: '#4b5563' }}>Locked</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Enhance Sub-tab ────────────────────────────────────────────────────────────

function EnhanceSubTab({ items }: { items: InventoryItemDto[] }) {
  if (items.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: '12px' }}>Equip items first to enhance them.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
        Enhance your equipped gear to increase stats.
      </p>
      {items.map((item) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '14px' }}>{SLOT_ICON[item.slot] ?? '?'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: RARITY_COLOR[item.rarity] ?? '#e8e0ff' }}>
              {item.name}
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280' }}>
              +{item.enhancementLevel} enhancement
            </div>
          </div>
          <button style={{
            padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(234,88,12,0.2))',
            color: '#fbbf24',
          }}>
            Enhance
          </button>
        </div>
      ))}
    </div>
  );
}
