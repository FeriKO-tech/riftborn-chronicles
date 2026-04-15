import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ItemRarity, ItemSlot, PlayerClass } from '@riftborn/shared';
import type { InventoryItemDto, PlayerCompanionDto } from '@riftborn/shared';
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

/** Apply enhancement multiplier to a stat value */
function enhStat(base: number, enhLevel: number): number {
  return Math.floor(base * (1 + enhLevel * 0.05));
}

type SubTab = 'equipment' | 'companions' | 'enhance' | 'salvage';
type SortKey = 'level' | 'rarity' | 'atk' | 'def' | 'hp' | 'name';

const RARITY_ORDER: Record<string, number> = {
  [ItemRarity.COMMON]: 0,
  [ItemRarity.UNCOMMON]: 1,
  [ItemRarity.RARE]: 2,
  [ItemRarity.EPIC]: 3,
  [ItemRarity.LEGENDARY]: 4,
};

function sortItems(items: InventoryItemDto[], key: SortKey, desc: boolean): InventoryItemDto[] {
  const sorted = [...items].sort((a, b) => {
    // Equipped always first
    if (a.isEquipped !== b.isEquipped) return a.isEquipped ? -1 : 1;
    let cmp = 0;
    switch (key) {
      case 'level': cmp = a.itemLevel - b.itemLevel; break;
      case 'rarity': cmp = (RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0); break;
      case 'atk': cmp = a.atkBonus - b.atkBonus; break;
      case 'def': cmp = a.defBonus - b.defBonus; break;
      case 'hp': cmp = a.hpBonus - b.hpBonus; break;
      case 'name': cmp = a.name.localeCompare(b.name); break;
    }
    return desc ? -cmp : cmp;
  });
  return sorted;
}

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

// ── Item Tooltip ──────────────────────────────────────────────────────────────

function ItemTooltip({ item, compareItem, mousePos }: {
  item: InventoryItemDto;
  compareItem: InventoryItemDto | null;
  mousePos: { x: number; y: number };
}) {
  const enhance = item.enhancementLevel > 0 ? item.enhancementLevel : 0;
  const enhPct = enhance * 5;

  const statLine = (label: string, val: number, cmpVal: number | null, color: string) => {
    const diff = cmpVal !== null ? val - cmpVal : null;
    return (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '1px 0' }}>
        <span style={{ color: '#9ca3af' }}>{label}</span>
        <span>
          <span style={{ color, fontWeight: 600 }}>{val > 0 ? `+${val}` : val}</span>
          {diff !== null && diff !== 0 && (
            <span style={{ color: diff > 0 ? '#4ade80' : '#f87171', fontSize: '10px', marginLeft: '4px' }}>
              ({diff > 0 ? '+' : ''}{diff})
            </span>
          )}
        </span>
      </div>
    );
  };

  // Position tooltip near cursor, clamped to viewport
  const left = Math.min(mousePos.x + 16, window.innerWidth - 240);
  const top = Math.min(mousePos.y - 10, window.innerHeight - 280);

  return (
    <div style={{
      position: 'fixed', left, top, zIndex: 200, pointerEvents: 'none',
      background: 'linear-gradient(160deg, #1a0d3d, #12083a)',
      border: `1px solid ${RARITY_COLOR[item.rarity] ?? '#6b7280'}66`,
      borderRadius: '10px', padding: '12px 14px', width: '220px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: RARITY_COLOR[item.rarity] ?? '#e8e0ff', marginBottom: '2px' }}>
        {item.name}{enhance > 0 && <span style={{ color: '#fbbf24' }}> +{enhance}</span>}
      </div>
      <div style={{ fontSize: '9px', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {item.rarity} {SLOT_LABEL[item.slot]} · Lv {item.itemLevel}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
        {statLine('ATK', enhStat(item.atkBonus, item.enhancementLevel), compareItem ? enhStat(compareItem.atkBonus, compareItem.enhancementLevel) : null, '#ef4444')}
        {statLine('DEF', enhStat(item.defBonus, item.enhancementLevel), compareItem ? enhStat(compareItem.defBonus, compareItem.enhancementLevel) : null, '#60a5fa')}
        {statLine('HP', enhStat(item.hpBonus, item.enhancementLevel), compareItem ? enhStat(compareItem.hpBonus, compareItem.enhancementLevel) : null, '#4ade80')}
      </div>
      {enhance > 0 && (
        <div style={{ fontSize: '10px', color: '#fbbf24', marginTop: '6px' }}>✨ +{enhPct}% stat bonus from enchant</div>
      )}
      {item.isLocked && <div style={{ fontSize: '10px', color: '#fbbf24', marginTop: '4px' }}>🔒 Locked</div>}
      {compareItem && (
        <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px' }}>
          Compared to equipped {SLOT_LABEL[item.slot]}
        </div>
      )}
    </div>
  );
}

export default function HeroPanel({ onClose }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('equipment');
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('level');
  const [sortDesc, setSortDesc] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<InventoryItemDto | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
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

  const handleLock = async (item: InventoryItemDto) => {
    if (actingOn) return;
    setActingOn(item.id);
    try {
      const updated = await inventoryApi.toggleLock(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      notify.info(updated.isLocked ? '🔒 Item locked' : '🔓 Item unlocked');
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActingOn(null);
    }
  };

  const handleSalvage = async (item: InventoryItemDto) => {
    if (actingOn) return;
    if (item.isLocked) { notify.error('Unlock item first'); return; }
    if (item.isEquipped) { notify.error('Unequip item first'); return; }
    setActingOn(item.id);
    try {
      const result = await inventoryApi.salvage(item.id);
      setItems((prev) => prev.filter((i) => i.id !== result.deletedItemId));
      notify.success(`Salvaged! +${result.goldGained}🟡 +${result.stonesGained}🪨`);
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActingOn(null);
    }
  };

  const handleEnchant = async (item: InventoryItemDto) => {
    if (actingOn) return;
    setActingOn(item.id);
    try {
      const result = await inventoryApi.enchant(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? result.item : i)));
      notify.success(`Enchanted to +${result.item.enhancementLevel}! (-${result.stonesCost} stones)`);
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

  const handleItemHover = (item: InventoryItemDto | null, e?: React.MouseEvent) => {
    setHoveredItem(item);
    if (e) setMousePos({ x: e.clientX, y: e.clientY });
  };
  const handleItemMouseMove = (e: React.MouseEvent) => {
    if (hoveredItem) setMousePos({ x: e.clientX, y: e.clientY });
  };
  const tooltipCompareItem = hoveredItem && !hoveredItem.isEquipped ? equipped[hoveredItem.slot as ItemSlot] : null;

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
            ['salvage', 'Salvage'],
            ['enhance', 'Enchant'],
            ['companions', 'Companions'],
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
            <EquipmentList
              items={items} loading={loading} actingOn={actingOn}
              onToggle={handleToggleEquip} onLock={handleLock}
              sortKey={sortKey} sortDesc={sortDesc}
              onSortKey={setSortKey} onToggleDir={() => setSortDesc((v) => !v)}
              onItemHover={handleItemHover} onItemMouseMove={handleItemMouseMove}
            />
          )}
          {subTab === 'salvage' && (
            <SalvageSubTab
              items={items.filter((i) => !i.isEquipped)}
              loading={loading} actingOn={actingOn}
              onSalvage={handleSalvage} onLock={handleLock}
              onItemHover={handleItemHover} onItemMouseMove={handleItemMouseMove}
            />
          )}
          {subTab === 'enhance' && (
            <EnhanceSubTab
              items={items.filter((i) => i.isEquipped)} actingOn={actingOn} onEnchant={handleEnchant}
              enchantStones={playerState?.currencies?.enchantStones ?? 0}
              onItemHover={handleItemHover} onItemMouseMove={handleItemMouseMove}
            />
          )}
          {subTab === 'companions' && <CompanionsSubTab />}
        </div>

        {/* Item Tooltip */}
        {hoveredItem && (
          <ItemTooltip item={hoveredItem} compareItem={tooltipCompareItem} mousePos={mousePos} />
        )}
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
  const atk = eq.reduce((s, i) => s + enhStat(i.atkBonus, i.enhancementLevel), 0);
  const def = eq.reduce((s, i) => s + enhStat(i.defBonus, i.enhancementLevel), 0);
  const hp = eq.reduce((s, i) => s + enhStat(i.hpBonus, i.enhancementLevel), 0);
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

function EquipmentList({ items, loading, actingOn, onToggle, onLock, sortKey, sortDesc, onSortKey, onToggleDir, onItemHover, onItemMouseMove }: {
  items: InventoryItemDto[];
  loading: boolean;
  actingOn: string | null;
  onToggle: (item: InventoryItemDto) => void;
  onLock: (item: InventoryItemDto) => void;
  sortKey: SortKey;
  sortDesc: boolean;
  onSortKey: (k: SortKey) => void;
  onToggleDir: () => void;
  onItemHover: (item: InventoryItemDto | null, e?: React.MouseEvent) => void;
  onItemMouseMove: (e: React.MouseEvent) => void;
}) {
  if (loading) return <p style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</p>;
  if (items.length === 0) return <p style={{ color: '#6b7280', fontSize: '12px' }}>No items yet. Keep battling!</p>;

  const sorted = sortItems(items, sortKey, sortDesc);

  const sortBtnStyle = (k: SortKey): React.CSSProperties => ({
    padding: '3px 8px', borderRadius: '4px', border: 'none', fontSize: '9px', fontWeight: 600, cursor: 'pointer',
    background: sortKey === k ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.05)',
    color: sortKey === k ? '#c4b5fd' : '#6b7280',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* Sort controls */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: '#6b7280', marginRight: '4px' }}>Sort:</span>
        {(['level', 'rarity', 'atk', 'def', 'hp', 'name'] as SortKey[]).map((k) => (
          <button key={k} onClick={() => onSortKey(k)} style={sortBtnStyle(k)}>
            {k.toUpperCase()}
          </button>
        ))}
        <button onClick={onToggleDir} style={{ ...sortBtnStyle('level'), background: 'rgba(255,255,255,0.06)' }}>
          {sortDesc ? '↓' : '↑'}
        </button>
      </div>

      {sorted.map((item) => (
        <div key={item.id}
          onMouseEnter={(e) => onItemHover(item, e)}
          onMouseMove={onItemMouseMove}
          onMouseLeave={() => onItemHover(null)}
          style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
          borderRadius: '8px',
          background: item.isEquipped ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${item.isEquipped ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.04)'}`,
        }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{SLOT_ICON[item.slot] ?? '?'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: RARITY_COLOR[item.rarity] ?? '#e8e0ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.isLocked && '\ud83d\udd12 '}{item.name} {item.isEquipped && <span style={{ color: '#4ade80', fontSize: '9px' }}>[E]</span>}
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280' }}>
              {SLOT_LABEL[item.slot]} Lv{item.itemLevel}
              {item.enhancementLevel > 0 && <span style={{ color: '#fbbf24' }}> +{item.enhancementLevel}</span>}
              {item.atkBonus > 0 && ` +${enhStat(item.atkBonus, item.enhancementLevel)}ATK`}
              {item.defBonus > 0 && ` +${enhStat(item.defBonus, item.enhancementLevel)}DEF`}
              {item.hpBonus > 0 && ` +${enhStat(item.hpBonus, item.enhancementLevel)}HP`}
            </div>
          </div>
          <button
            onClick={() => onLock(item)}
            disabled={actingOn === item.id}
            title={item.isLocked ? 'Unlock' : 'Lock'}
            style={{
              padding: '4px 6px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', color: item.isLocked ? '#fbbf24' : '#4b5563',
            }}
          >
            {item.isLocked ? '\ud83d\udd12' : '\ud83d\udd13'}
          </button>
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    companionsApi.getState()
      .then((state) => setCompanions(state.owned))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleActivate = async (templateId: string) => {
    if (busy) return;
    setBusy(templateId);
    try {
      await companionsApi.activate(templateId);
      setCompanions((prev) => prev.map((c) => ({ ...c, isActive: c.templateId === templateId })));
      notify.success('Companion activated!');
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const handleUpgrade = async (templateId: string) => {
    if (busy) return;
    setBusy(templateId);
    try {
      const result = await companionsApi.upgrade(templateId);
      setCompanions((prev) => prev.map((c) => (c.templateId === templateId ? result.companion : c)));
      notify.success(`Upgraded to Lv${result.companion.level}! (-${result.goldCost}\ud83d\udfe1)`);
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>
        Two companions: Mage &amp; Archer. Upgrade with gold to boost their bonuses.
      </p>
      {companions.map((c) => (
        <div key={c.id} style={{
          padding: '12px', borderRadius: '10px',
          background: c.isActive ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${c.isActive ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.06)'}`,
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '26px' }}>{c.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#e8e0ff' }}>
              {c.name} <span style={{ color: '#a78bfa', fontSize: '10px' }}>Lv{c.level}</span>
              {c.isActive && <span style={{ color: '#4ade80', fontSize: '9px', marginLeft: '6px' }}>[Active]</span>}
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
              +{c.bonus.atkPct}% ATK  +{c.bonus.defPct}% DEF  +{c.bonus.hpPct}% HP
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
            {!c.isActive && (
              <button
                onClick={() => handleActivate(c.templateId)}
                disabled={busy === c.templateId}
                style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                  background: 'rgba(124,58,237,0.4)', color: '#e8e0ff',
                }}
              >
                {busy === c.templateId ? '...' : 'Activate'}
              </button>
            )}
            <button
              onClick={() => handleUpgrade(c.templateId)}
              disabled={busy === c.templateId}
              style={{
                padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(234,88,12,0.15))',
                color: '#fbbf24',
              }}
            >
              {busy === c.templateId ? '...' : `Upgrade (${c.upgradeCost}\ud83d\udfe1)`}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Salvage Sub-tab ─────────────────────────────────────────────────────────────

function SalvageSubTab({ items, loading, actingOn, onSalvage, onLock, onItemHover, onItemMouseMove }: {
  items: InventoryItemDto[];
  loading: boolean;
  actingOn: string | null;
  onSalvage: (item: InventoryItemDto) => void;
  onLock: (item: InventoryItemDto) => void;
  onItemHover: (item: InventoryItemDto | null, e?: React.MouseEvent) => void;
  onItemMouseMove: (e: React.MouseEvent) => void;
}) {
  if (loading) return <p style={{ color: '#6b7280', fontSize: '12px' }}>Loading...</p>;
  if (items.length === 0) return <p style={{ color: '#6b7280', fontSize: '12px' }}>No unequipped items to salvage.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '6px' }}>
        Salvage unwanted items for gold and enchant stones. Lock items to prevent accidental salvage.
      </p>
      {items.map((item) => (
        <div key={item.id}
          onMouseEnter={(e) => onItemHover(item, e)}
          onMouseMove={onItemMouseMove}
          onMouseLeave={() => onItemHover(null)}
          style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px',
          background: item.isLocked ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${item.isLocked ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)'}`,
        }}>
          <span style={{ fontSize: '14px' }}>{SLOT_ICON[item.slot] ?? '?'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: RARITY_COLOR[item.rarity] ?? '#e8e0ff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.isLocked && '\ud83d\udd12 '}{item.name}
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280' }}>
              {item.rarity} Lv{item.itemLevel}
              {item.atkBonus > 0 && ` +${enhStat(item.atkBonus, item.enhancementLevel)}ATK`}
              {item.defBonus > 0 && ` +${enhStat(item.defBonus, item.enhancementLevel)}DEF`}
              {item.hpBonus > 0 && ` +${enhStat(item.hpBonus, item.enhancementLevel)}HP`}
            </div>
          </div>
          <button
            onClick={() => onLock(item)}
            disabled={actingOn === item.id}
            style={{
              padding: '4px 6px', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', color: item.isLocked ? '#fbbf24' : '#4b5563',
            }}
          >
            {item.isLocked ? '\ud83d\udd12' : '\ud83d\udd13'}
          </button>
          <button
            onClick={() => onSalvage(item)}
            disabled={actingOn === item.id || item.isLocked}
            style={{
              padding: '4px 10px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
              background: item.isLocked ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.25)',
              color: item.isLocked ? '#4b5563' : '#f87171',
            }}
          >
            {actingOn === item.id ? '...' : 'Salvage'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Enchant Sub-tab ─────────────────────────────────────────────────────────────

function EnhanceSubTab({ items, actingOn, onEnchant, enchantStones, onItemHover, onItemMouseMove }: {
  items: InventoryItemDto[];
  actingOn: string | null;
  onEnchant: (item: InventoryItemDto) => void;
  enchantStones: number;
  onItemHover: (item: InventoryItemDto | null, e?: React.MouseEvent) => void;
  onItemMouseMove: (e: React.MouseEvent) => void;
}) {
  if (items.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: '12px' }}>Equip items first to enchant them.</p>;
  }

  const stoneCost = (level: number) => Math.max(2, Math.floor(2 + level * 1.5));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
          Use enchant stones to boost equipped gear. +5% stats per level.
        </p>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', whiteSpace: 'nowrap', marginLeft: '12px' }}>
          {enchantStones} 🪨
        </span>
      </div>
      {items.map((item) => (
        <div key={item.id}
          onMouseEnter={(e) => onItemHover(item, e)}
          onMouseMove={onItemMouseMove}
          onMouseLeave={() => onItemHover(null)}
          style={{
          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '14px' }}>{SLOT_ICON[item.slot] ?? '?'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: RARITY_COLOR[item.rarity] ?? '#e8e0ff' }}>
              {item.name} {item.enhancementLevel > 0 && <span style={{ color: '#fbbf24' }}>+{item.enhancementLevel}</span>}
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280' }}>
              Next: {stoneCost(item.enhancementLevel)} stones → +{item.enhancementLevel + 1}
            </div>
          </div>
          <button
            onClick={() => onEnchant(item)}
            disabled={actingOn === item.id}
            style={{
              padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(234,88,12,0.2))',
              color: '#fbbf24',
            }}
          >
            {actingOn === item.id ? '...' : `Enchant (${stoneCost(item.enhancementLevel)}🪨)`}
          </button>
        </div>
      ))}
    </div>
  );
}
