export interface DailyRewardStatusDto {
  canClaim: boolean;
  streak: number;
  longestStreak: number;
  lastClaimedAt: string | null;
  totalClaimed: number;
  nextReward: DailyRewardPreviewDto;
  hoursUntilReset: number | null;
}

export interface DailyRewardPreviewDto {
  goldShards: number;
  voidCrystals: number;
  streakBonus: number;
  streakDay: number;
}

export interface ClaimDailyRewardResponseDto {
  goldShards: number;
  voidCrystals: number;
  streakBonus: number;
  newStreak: number;
  longestStreak: number;
  newGoldBalance: number;
  newCrystalBalance: number;
}
