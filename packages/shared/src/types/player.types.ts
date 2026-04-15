export enum PlayerClass {
  VOIDBLADE = 'VOIDBLADE',
  AETHERMAGE = 'AETHERMAGE',
  IRONVEIL = 'IRONVEIL',
}

export interface PlayerProfileDto {
  id: string;
  name: string;
  level: number;
  class: PlayerClass;
  powerScore: number;
  vipLevel: number;
  experience: number;
  expToNextLevel: number;
}

export interface PlayerCurrenciesDto {
  goldShards: number;
  voidCrystals: number;
  resonanceCores: number;
  forgeDust: number;
  enchantStones: number;
  echoShards: number;
  arenaMarks: number;
  bossSeals: number;
}

export interface StageProgressDto {
  currentZone: number;
  currentRoom: number;
  highestZone: number;
}

export interface PlayerStateDto {
  profile: PlayerProfileDto;
  currencies: PlayerCurrenciesDto;
  stageProgress: StageProgressDto;
}

export interface OfflineRewardPreviewDto {
  idleHours: number;
  goldEarned: number;
  expEarned: number;
  multiplier: number;
  cappedAt: number;
}

export interface ClaimOfflineRewardResponseDto {
  goldEarned: number;
  expEarned: number;
  idleHours: number;
  newGoldBalance: number;
}

export interface HeartbeatResponseDto {
  ok: true;
  serverTime: string;
}
