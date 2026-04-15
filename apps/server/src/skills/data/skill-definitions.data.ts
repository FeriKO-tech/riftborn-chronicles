import type { SkillDefinitionDto } from '@riftborn/shared';

export const SKILL_DEFINITIONS: SkillDefinitionDto[] = [
  // ── VOIDBLADE ───────────────────────────────────────────────
  {
    id: 'vb_shadowstrike',
    name: 'Shadow Strike',
    description: 'A swift void-infused slash dealing heavy single-target damage.',
    icon: '🗡️',
    class: 'VOIDBLADE',
    maxLevel: 10,
    cooldownMs: 4000,
    baseDmgMult: 2.0,
    dmgMultPerLevel: 0.25,
    unlockCost: 500,
    upgradeCostPerLevel: 300,
  },
  {
    id: 'vb_bladestorm',
    name: 'Blade Storm',
    description: 'Unleash a flurry of blades hitting all enemies in range.',
    icon: '🌀',
    class: 'VOIDBLADE',
    maxLevel: 10,
    cooldownMs: 8000,
    baseDmgMult: 1.2,
    dmgMultPerLevel: 0.15,
    unlockCost: 1500,
    upgradeCostPerLevel: 500,
  },
  {
    id: 'vb_voidexecute',
    name: 'Void Execute',
    description: 'Massive damage to a single target. Extra damage on low HP enemies.',
    icon: '💀',
    class: 'VOIDBLADE',
    maxLevel: 10,
    cooldownMs: 12000,
    baseDmgMult: 3.5,
    dmgMultPerLevel: 0.4,
    unlockCost: 3000,
    upgradeCostPerLevel: 800,
  },

  // ── AETHERMAGE ──────────────────────────────────────────────
  {
    id: 'am_arcaneblast',
    name: 'Arcane Blast',
    description: 'A focused bolt of arcane energy.',
    icon: '🔮',
    class: 'AETHERMAGE',
    maxLevel: 10,
    cooldownMs: 4000,
    baseDmgMult: 2.2,
    dmgMultPerLevel: 0.3,
    unlockCost: 500,
    upgradeCostPerLevel: 300,
  },
  {
    id: 'am_chainlightning',
    name: 'Chain Lightning',
    description: 'Lightning jumps between multiple enemies.',
    icon: '⚡',
    class: 'AETHERMAGE',
    maxLevel: 10,
    cooldownMs: 8000,
    baseDmgMult: 1.0,
    dmgMultPerLevel: 0.15,
    unlockCost: 1500,
    upgradeCostPerLevel: 500,
  },
  {
    id: 'am_meteor',
    name: 'Meteor Strike',
    description: 'Call down a meteor dealing massive AoE damage.',
    icon: '☄️',
    class: 'AETHERMAGE',
    maxLevel: 10,
    cooldownMs: 12000,
    baseDmgMult: 3.0,
    dmgMultPerLevel: 0.35,
    unlockCost: 3000,
    upgradeCostPerLevel: 800,
  },

  // ── IRONVEIL ────────────────────────────────────────────────
  {
    id: 'iv_shieldbash',
    name: 'Shield Bash',
    description: 'Slam your shield into the enemy, dealing damage and stunning.',
    icon: '🛡️',
    class: 'IRONVEIL',
    maxLevel: 10,
    cooldownMs: 4000,
    baseDmgMult: 1.8,
    dmgMultPerLevel: 0.2,
    unlockCost: 500,
    upgradeCostPerLevel: 300,
  },
  {
    id: 'iv_ironwall',
    name: 'Iron Wall',
    description: 'Fortify yourself, reducing incoming damage for 5 seconds.',
    icon: '🏰',
    class: 'IRONVEIL',
    maxLevel: 10,
    cooldownMs: 10000,
    baseDmgMult: 0,
    dmgMultPerLevel: 0,
    unlockCost: 1500,
    upgradeCostPerLevel: 500,
  },
  {
    id: 'iv_earthquake',
    name: 'Earthquake',
    description: 'Slam the ground, damaging all enemies in the area.',
    icon: '🌋',
    class: 'IRONVEIL',
    maxLevel: 10,
    cooldownMs: 12000,
    baseDmgMult: 2.5,
    dmgMultPerLevel: 0.3,
    unlockCost: 3000,
    upgradeCostPerLevel: 800,
  },
];

const SKILL_MAP = new Map(SKILL_DEFINITIONS.map((s) => [s.id, s]));

export function getSkillDefinition(id: string): SkillDefinitionDto | undefined {
  return SKILL_MAP.get(id);
}

export function getSkillsForClass(playerClass: string): SkillDefinitionDto[] {
  return SKILL_DEFINITIONS.filter((s) => s.class === playerClass);
}
