export interface LeaderboardEntryDto {
  rank: number;
  playerId: string;
  name: string;
  class: string;
  level: number;
  powerScore: number;
  highestZone: number;
}

export interface LeaderboardResponseDto {
  entries: LeaderboardEntryDto[];
  myRank: number | null;
}
