export interface CompanionBonusDto {
  atkPct: number;
  defPct: number;
  hpPct: number;
}

export interface CompanionTemplateDto {
  id: string;
  name: string;
  title: string;
  icon: string;
  rarity: string;
  description: string;
  bonus: CompanionBonusDto;
}

export interface PlayerCompanionDto {
  id: string;
  templateId: string;
  name: string;
  icon: string;
  rarity: string;
  bonus: CompanionBonusDto;
  isActive: boolean;
  obtainedAt: string;
}

export interface ActivateCompanionResponseDto {
  activeCompanion: PlayerCompanionDto;
  previousCompanion: PlayerCompanionDto | null;
  newPowerScore: number;
}

export interface CompanionStateDto {
  owned: PlayerCompanionDto[];
  activeCompanionId: string | null;
}
