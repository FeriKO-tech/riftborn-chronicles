export interface AchievementDefinitionDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Category for grouping in UI */
  category: 'combat' | 'progression' | 'economy' | 'collection' | 'social';
  /** Reward gold on first unlock */
  rewardGold: number;
  /** Reward diamonds on first unlock */
  rewardDiamonds: number;
  /** Progressive group id — achievements in same group form a tier chain */
  progressGroup?: string;
  /** Tier within the group (1, 2, 3…) */
  progressTier?: number;
  /** Target value for this tier */
  progressTarget?: number;
}

export interface PlayerAchievementDto {
  achievementId: string;
  unlockedAt: string;
  definition: AchievementDefinitionDto;
}

export interface AchievementStateDto {
  unlocked: PlayerAchievementDto[];
  all: AchievementDefinitionDto[];
}

export interface AchievementUnlockResponseDto {
  achievement: PlayerAchievementDto;
  goldAwarded: number;
  diamondsAwarded: number;
}
