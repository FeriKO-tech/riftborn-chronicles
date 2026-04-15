export interface SkillDefinitionDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  class: string;
  maxLevel: number;
  cooldownMs: number;
  /** Base damage multiplier at level 1 (e.g., 1.5 = 150% ATK) */
  baseDmgMult: number;
  /** Extra multiplier per level */
  dmgMultPerLevel: number;
  /** Gold cost to unlock (level 0 → 1) */
  unlockCost: number;
  /** Gold cost per upgrade level */
  upgradeCostPerLevel: number;
}

export interface PlayerSkillDto {
  skillId: string;
  level: number;
  definition: SkillDefinitionDto;
}

export interface SkillStateDto {
  skills: PlayerSkillDto[];
}

export interface SkillUpgradeResponseDto {
  skill: PlayerSkillDto;
  goldCost: number;
}
