export interface EnhancementCostDto {
  resonanceCores: number;
  forgeDust: number;
}

export interface EnhancementInfoDto {
  currentLevel: number;
  maxLevel: number;
  cost: EnhancementCostDto | null;
  statMultiplier: number;
  isMaxLevel: boolean;
}

export interface EnhanceItemResponseDto {
  itemId: string;
  newEnhancementLevel: number;
  newAtkBonus: number;
  newDefBonus: number;
  newHpBonus: number;
  cost: EnhancementCostDto;
  newPowerScore: number;
  newResonanceCores: number;
  newForgeDust: number;
}
