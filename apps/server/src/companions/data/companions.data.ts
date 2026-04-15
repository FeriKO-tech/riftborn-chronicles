import type { CompanionBonusDto, CompanionTemplateDto } from '@riftborn/shared';

export const COMPANION_TEMPLATES: ReadonlyMap<string, CompanionTemplateDto> = new Map([
  // ── Starters (auto-granted) ─────────────────────────────────
  ['companion_mage', {
    id: 'companion_mage', name: 'Arcanist', title: 'Void Mage', icon: '🔮', rarity: 'RARE',
    description: 'A mage companion who enhances attack power with arcane energy.',
    bonus: { atkPct: 5, defPct: 0, hpPct: 2 },
  }],
  ['companion_archer', {
    id: 'companion_archer', name: 'Shadowshot', title: 'Rift Archer', icon: '🏹', rarity: 'RARE',
    description: 'An archer companion who bolsters defense and HP with precision.',
    bonus: { atkPct: 2, defPct: 3, hpPct: 5 },
  }],
  // ── Obtainable (shop / drops) ───────────────────────────────
  ['companion_golem', {
    id: 'companion_golem', name: 'Ironclad', title: 'Stone Guardian', icon: '🪨', rarity: 'EPIC',
    description: 'A sturdy golem companion that massively boosts defense.',
    bonus: { atkPct: 1, defPct: 8, hpPct: 3 },
  }],
  ['companion_phoenix', {
    id: 'companion_phoenix', name: 'Emberwing', title: 'Rift Phoenix', icon: '🦅', rarity: 'EPIC',
    description: 'A fiery phoenix that greatly amplifies attack power.',
    bonus: { atkPct: 8, defPct: 1, hpPct: 3 },
  }],
  ['companion_wolf', {
    id: 'companion_wolf', name: 'Duskfang', title: 'Shadow Wolf', icon: '🐺', rarity: 'RARE',
    description: 'A swift wolf companion that balances all stats evenly.',
    bonus: { atkPct: 4, defPct: 3, hpPct: 4 },
  }],
  ['companion_dragon', {
    id: 'companion_dragon', name: 'Voidscale', title: 'Void Dragon', icon: '🐲', rarity: 'LEGENDARY',
    description: 'An ancient dragon that empowers all stats tremendously.',
    bonus: { atkPct: 6, defPct: 5, hpPct: 6 },
  }],
]);

export const STARTER_COMPANION_ID = 'companion_mage';
export const STARTER_COMPANION_IDS = ['companion_mage', 'companion_archer'];
export const COMPANION_TEMPLATE_LIST = [...COMPANION_TEMPLATES.values()];

/** Gold cost to upgrade a companion to `nextLevel`. */
export function companionUpgradeCost(level: number): number {
  return Math.floor(100 * Math.pow(1.35, level - 1));
}

/** Bonus scaled by companion level. Base bonus * (1 + (level-1) * 0.15) */
export function scaledCompanionBonus(templateId: string, level: number): CompanionBonusDto {
  const base = COMPANION_TEMPLATES.get(templateId)?.bonus ?? { atkPct: 0, defPct: 0, hpPct: 0 };
  const mult = 1 + (level - 1) * 0.15;
  return {
    atkPct: Math.floor(base.atkPct * mult * 10) / 10,
    defPct: Math.floor(base.defPct * mult * 10) / 10,
    hpPct:  Math.floor(base.hpPct * mult * 10) / 10,
  };
}

/** Pure helper — returns zero bonus if no companion or template not found */
export function getCompanionBonus(templateId: string | null | undefined, level = 1): CompanionBonusDto {
  if (!templateId) return { atkPct: 0, defPct: 0, hpPct: 0 };
  return scaledCompanionBonus(templateId, level);
}
