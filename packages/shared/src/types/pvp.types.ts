export interface PvpProfileDto {
  playerId: string;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PvpOpponentDto {
  playerId: string;
  playerName: string;
  playerClass: string;
  level: number;
  powerScore: number;
  rating: number;
  ratingDiff: number;
}

export interface PvpFightResultDto {
  victory: boolean;
  ratingChange: number;
  newRating: number;
  opponent: PvpOpponentDto;
  rewards: {
    goldShards: number;
    voidCrystals: number;
  } | null;
  battleRounds: number;
  totalDamageDealt: number;
}

export interface PvpStateDto {
  profile: PvpProfileDto;
  opponents: PvpOpponentDto[];
  recentBattles: PvpBattleHistoryDto[];
}

export interface PvpBattleHistoryDto {
  id: string;
  opponentName: string;
  opponentClass: string;
  result: 'WIN' | 'LOSS';
  ratingChange: number;
  createdAt: string;
}
