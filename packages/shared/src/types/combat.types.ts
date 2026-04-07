import type { ItemDropDto } from './item.types';

export interface CombatStatsDto {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critDamage: number;
}

export interface BattleRoundDto {
  round: number;
  playerDmg: number;
  enemyDmg: number;
  playerHpLeft: number;
  enemyHpLeft: number;
  playerCrit: boolean;
}

export interface BattleResultDto {
  victory: boolean;
  rounds: BattleRoundDto[];
  totalDamageDealt: number;
  roundsCount: number;
  goldEarned: number;
  expEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newZone: number;
  newRoom: number;
  zoneCleared: boolean;
  playerStats: CombatStatsDto;
  drop: ItemDropDto;
}
