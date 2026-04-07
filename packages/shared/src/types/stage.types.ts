export enum RoomType {
  NORMAL = 'NORMAL',
  ELITE = 'ELITE',
  BOSS = 'BOSS',
  TREASURE = 'TREASURE',
}

export interface EnemyTemplateDto {
  id: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  expReward: number;
  goldReward: number;
}

export interface RoomDto {
  room: number;
  type: RoomType;
  enemies: EnemyTemplateDto[];
  clearGoldBonus: number;
}

export interface ZoneDto {
  zone: number;
  name: string;
  description: string;
  minLevel: number;
  roomCount: number;
  rooms: RoomDto[];
}

export interface ZoneSummaryDto {
  zone: number;
  name: string;
  description: string;
  minLevel: number;
  roomCount: number;
  bossRoom: number;
}

export interface StageProgressResponseDto {
  currentZone: number;
  currentRoom: number;
  highestZone: number;
  zoneInfo: ZoneSummaryDto;
}

export interface AdvanceRoomResponseDto {
  advanced: boolean;
  newZone: number;
  newRoom: number;
  rewards: {
    goldEarned: number;
    expEarned: number;
  };
  zoneCleared: boolean;
}
