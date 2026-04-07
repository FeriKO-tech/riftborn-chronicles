export interface BossConfigDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  zoneRequirement: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  level: number;
  rewards: {
    goldShards: number;
    voidCrystals: number;
    resonanceCores: number;
    expBonus: number;
  };
  maxAttemptsPerDay: number;
}

export interface BossAttemptStatusDto {
  bossId: string;
  attemptsUsed: number;
  maxAttempts: number;
  attemptsRemaining: number;
  lastAttemptAt: string | null;
  resetsAt: string;
}

export interface BossFightResponseDto {
  victory: boolean;
  rounds: number;
  totalDamageDealt: number;
  rewards: {
    goldShards: number;
    voidCrystals: number;
    resonanceCores: number;
    expEarned: number;
  } | null;
  attemptsRemaining: number;
  leveledUp: boolean;
  newLevel: number;
}
