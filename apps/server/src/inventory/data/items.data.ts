import { ItemRarity, ItemSlot } from '@riftborn/shared';
import type { ItemTemplateDto } from '@riftborn/shared';

export const ITEM_TEMPLATES: ReadonlyMap<string, ItemTemplateDto> = new Map([
  // ── Weapons ──────────────────────────────────────────────────────────────
  ['w_iron_shard', { id: 'w_iron_shard', name: 'Iron Void Shard', slot: ItemSlot.WEAPON, rarity: ItemRarity.COMMON, description: 'A blade forged from Rift residue.', icon: '⚔️', baseAtk: 80, baseDef: 0, baseHp: 0, minZone: 1 }],
  ['w_shadow_fang', { id: 'w_shadow_fang', name: 'Shadow Fang', slot: ItemSlot.WEAPON, rarity: ItemRarity.UNCOMMON, description: 'Carved from a shadow beast\'s claw.', icon: '🗡️', baseAtk: 160, baseDef: 0, baseHp: 0, minZone: 2 }],
  ['w_aether_staff', { id: 'w_aether_staff', name: 'Aether Conduit Staff', slot: ItemSlot.WEAPON, rarity: ItemRarity.RARE, description: 'Channels raw void energy.', icon: '🪄', baseAtk: 280, baseDef: 0, baseHp: 0, minZone: 4 }],
  ['w_rift_blade', { id: 'w_rift_blade', name: 'Rift Blade', slot: ItemSlot.WEAPON, rarity: ItemRarity.EPIC, description: 'A sword that cuts between realities.', icon: '⚡', baseAtk: 480, baseDef: 0, baseHp: 0, minZone: 7 }],
  ['w_void_reaper', { id: 'w_void_reaper', name: 'Void Reaper', slot: ItemSlot.WEAPON, rarity: ItemRarity.LEGENDARY, description: 'The weapon that ended the first Fracture War.', icon: '💀', baseAtk: 900, baseDef: 0, baseHp: 0, minZone: 10 }],

  // ── Armor ─────────────────────────────────────────────────────────────────
  ['a_rift_plate', { id: 'a_rift_plate', name: 'Rift-Plate Vest', slot: ItemSlot.ARMOR, rarity: ItemRarity.COMMON, description: 'Basic protection, Rift-hardened.', icon: '🛡️', baseAtk: 0, baseDef: 60, baseHp: 200, minZone: 1 }],
  ['a_void_mantle', { id: 'a_void_mantle', name: 'Void Mantle', slot: ItemSlot.ARMOR, rarity: ItemRarity.UNCOMMON, description: 'Light cloth woven from void silk.', icon: '🧥', baseAtk: 0, baseDef: 100, baseHp: 350, minZone: 2 }],
  ['a_shadow_mail', { id: 'a_shadow_mail', name: 'Shadow Chainmail', slot: ItemSlot.ARMOR, rarity: ItemRarity.RARE, description: 'Interlinked shadow-forged rings.', icon: '⚙️', baseAtk: 0, baseDef: 200, baseHp: 600, minZone: 4 }],
  ['a_bastion', { id: 'a_bastion', name: 'Iron Bastion Plate', slot: ItemSlot.ARMOR, rarity: ItemRarity.EPIC, description: 'Near-impenetrable fortress armor.', icon: '🏰', baseAtk: 0, baseDef: 380, baseHp: 1000, minZone: 7 }],
  ['a_eternal_guard', { id: 'a_eternal_guard', name: 'Eternal Guardian Plate', slot: ItemSlot.ARMOR, rarity: ItemRarity.LEGENDARY, description: 'Blessed by the last Guardian of Eryndal.', icon: '✨', baseAtk: 0, baseDef: 700, baseHp: 2000, minZone: 10 }],

  // ── Helmets ───────────────────────────────────────────────────────────────
  ['h_shard_helm', { id: 'h_shard_helm', name: 'Shard Helm', slot: ItemSlot.HELMET, rarity: ItemRarity.COMMON, description: 'Crude but effective head protection.', icon: '⛑️', baseAtk: 0, baseDef: 30, baseHp: 150, minZone: 1 }],
  ['h_void_crown', { id: 'h_void_crown', name: 'Void Crown', slot: ItemSlot.HELMET, rarity: ItemRarity.RARE, description: 'Amplifies void energy resonance.', icon: '👑', baseAtk: 40, baseDef: 60, baseHp: 300, minZone: 5 }],
  ['h_rift_tiara', { id: 'h_rift_tiara', name: 'Rift Tiara', slot: ItemSlot.HELMET, rarity: ItemRarity.EPIC, description: 'A diadem crackling with fracture energy.', icon: '💎', baseAtk: 80, baseDef: 100, baseHp: 500, minZone: 8 }],

  // ── Accessories ───────────────────────────────────────────────────────────
  ['acc_rift_ring', { id: 'acc_rift_ring', name: 'Rift Ring', slot: ItemSlot.ACCESSORY, rarity: ItemRarity.COMMON, description: 'A ring humming with fractured energy.', icon: '💍', baseAtk: 20, baseDef: 20, baseHp: 100, minZone: 1 }],
  ['acc_amulet_shadows', { id: 'acc_amulet_shadows', name: 'Amulet of Shadows', slot: ItemSlot.ACCESSORY, rarity: ItemRarity.UNCOMMON, description: 'Grants a flicker of shadow-step.', icon: '🔮', baseAtk: 50, baseDef: 30, baseHp: 150, minZone: 3 }],
  ['acc_void_core', { id: 'acc_void_core', name: 'Void Core Fragment', slot: ItemSlot.ACCESSORY, rarity: ItemRarity.EPIC, description: 'A shard of pure void crystallized.', icon: '🌑', baseAtk: 150, baseDef: 80, baseHp: 400, minZone: 8 }],
]);

export const ITEM_TEMPLATE_LIST = [...ITEM_TEMPLATES.values()];

// ── Drop rate table by room type ───────────────────────────────────────────
export const DROP_CHANCE: Record<string, number> = {
  NORMAL: 0.06,
  ELITE: 0.28,
  BOSS: 0.80,
};

// ── Rarity weights by zone tier ────────────────────────────────────────────
export function getRarityWeights(zone: number): Record<ItemRarity, number> {
  const tier = Math.ceil(zone / 10);
  return {
    [ItemRarity.COMMON]: Math.max(0, 50 - tier * 8),
    [ItemRarity.UNCOMMON]: Math.max(0, 30 - tier * 3),
    [ItemRarity.RARE]: 10 + tier * 4,
    [ItemRarity.EPIC]: tier * 3,
    [ItemRarity.LEGENDARY]: Math.max(0, tier - 2),
  };
}
