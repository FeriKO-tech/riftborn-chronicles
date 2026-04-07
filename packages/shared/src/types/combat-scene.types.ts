// ── Enemy archetypes ────────────────────────────────────────────────────────

export type EnemyArchetype = 'beast' | 'scout' | 'brute' | 'boss';

export interface EnemyTypeDto {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  baseHp: number;
  baseAtk: number;
  spawnWeight: number;
  color: string;
  accentColor: string;
  size: number;
  goldReward: number;
  expReward: number;
  dropChance: number;
}

// ── Spawn points ─────────────────────────────────────────────────────────────

export type SpawnLane = 'near' | 'mid' | 'far';

export interface SpawnPointDto {
  id: string;
  x: number;
  y: number;
  lane: SpawnLane;
}

// ── Zone definition ─────────────────────────────────────────────────────────

export interface ZoneDefinitionDto {
  zone: number;
  name: string;
  backgroundId: string;
  ambientColor: string;
  fogColor: string;
  requiredKills: number;
  maxLiveEnemies: number;
  spawnIntervalMs: number;
  enemyTypes: EnemyTypeDto[];
  bossId: string;
  spawnPoints: SpawnPointDto[];
}

// ── Server-authoritative combat state per zone ───────────────────────────────

export interface ZoneCombatStateDto {
  zone: number;
  kills: number;
  requiredKills: number;
  bossUnlocked: boolean;
  zoneCleared: boolean;
}

// ── Full scene config (initial load) ────────────────────────────────────────

export interface ZoneSceneConfigDto {
  definition: ZoneDefinitionDto;
  combatState: ZoneCombatStateDto;
}

// ── Kill enemy ───────────────────────────────────────────────────────────────

export interface KillEnemyRequestDto {
  zone: number;
  enemyTypeId: string;
}

export interface KillEnemyResponseDto {
  kills: number;
  requiredKills: number;
  bossUnlocked: boolean;
  goldEarned: number;
  expEarned: number;
  drop: boolean;
  leveledUp: boolean;
  newLevel: number;
}

// ── Zone clear ───────────────────────────────────────────────────────────────

export interface ZoneClearResponseDto {
  clearedZone: number;
  newZone: number;
  newZoneName: string;
  rewards: { goldBonus: number };
}
