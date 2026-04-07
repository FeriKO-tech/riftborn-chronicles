import type { EnemyTypeDto, SpawnPointDto, ZoneDefinitionDto } from '@riftborn/shared';
import type { EnemyTemplateDto } from '@riftborn/shared';

// ── Internal zone definition (server-only boss combat stats) ─────────────────

export interface ZoneSceneDefinition extends ZoneDefinitionDto {
  boss: EnemyTemplateDto;
}

// ── Standard spawn point grid (800×460 field) ────────────────────────────────
// Hero region: x 40–160, y 180–280
// Enemy region: x 380–740, y 130–330

export const STANDARD_SPAWN_POINTS: ReadonlyArray<SpawnPointDto> = [
  { id: 'sp_near_top',    x: 430, y: 150, lane: 'near' },
  { id: 'sp_near_bot',    x: 430, y: 310, lane: 'near' },
  { id: 'sp_mid_top',     x: 560, y: 165, lane: 'mid'  },
  { id: 'sp_mid_center',  x: 560, y: 230, lane: 'mid'  },
  { id: 'sp_mid_bot',     x: 560, y: 295, lane: 'mid'  },
  { id: 'sp_far_top',     x: 690, y: 175, lane: 'far'  },
  { id: 'sp_far_bot',     x: 690, y: 285, lane: 'far'  },
];

// ── Enemy type helpers ────────────────────────────────────────────────────────

function beast(zone: number, nameSuffix: string, color: string): EnemyTypeDto {
  const pow = zone * 60;
  return {
    id: `beast_z${zone}`,
    name: `${nameSuffix}`,
    archetype: 'beast',
    baseHp: Math.floor(pow * 6),
    baseAtk: Math.floor(pow * 0.8),
    spawnWeight: 45,
    color,
    accentColor: '#dc2626',
    size: 36,
    goldReward: Math.floor(pow * 0.9),
    expReward: Math.floor(pow * 1.2),
    dropChance: 0.06,
  };
}

function scout(zone: number, nameSuffix: string, color: string): EnemyTypeDto {
  const pow = zone * 70;
  return {
    id: `scout_z${zone}`,
    name: `${nameSuffix}`,
    archetype: 'scout',
    baseHp: Math.floor(pow * 4.5),
    baseAtk: Math.floor(pow * 1.1),
    spawnWeight: 35,
    color,
    accentColor: '#7c3aed',
    size: 30,
    goldReward: Math.floor(pow * 1.1),
    expReward: Math.floor(pow * 1.5),
    dropChance: 0.08,
  };
}

function brute(zone: number, nameSuffix: string, color: string): EnemyTypeDto {
  const pow = zone * 80;
  return {
    id: `brute_z${zone}`,
    name: `${nameSuffix}`,
    archetype: 'brute',
    baseHp: Math.floor(pow * 14),
    baseAtk: Math.floor(pow * 0.6),
    spawnWeight: 20,
    color,
    accentColor: '#f97316',
    size: 52,
    goldReward: Math.floor(pow * 1.8),
    expReward: Math.floor(pow * 2.2),
    dropChance: 0.14,
  };
}

function makeBossTemplate(
  id: string,
  name: string,
  zone: number,
): EnemyTemplateDto {
  const pow = zone * 200;
  return {
    id,
    name,
    level: Math.max(1, zone * 3),
    hp: Math.floor(pow * 18),
    attack: Math.floor(pow * 0.9),
    defense: Math.floor(pow * 0.3),
    speed: Math.max(30, 80 - zone * 3),
    expReward: Math.floor(pow * 8),
    goldReward: Math.floor(pow * 6),
  };
}

// ── Handcrafted zone definitions (zones 1–10) ────────────────────────────────

const ZONE_DEFS: ZoneSceneDefinition[] = [
  {
    zone: 1,
    name: 'Shattered Approach',
    backgroundId: 'bg_shattered_approach',
    ambientColor: '#1e1b4b',
    fogColor: '#312e81',
    requiredKills: 10,
    maxLiveEnemies: 5,
    spawnIntervalMs: 3000,
    bossId: 'fracture_keeper_z1',
    bossName: 'Fracture Keeper',
    bossIcon: '💀',
    bossMaxHp: 3600,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(1, 'Rift Wisp', '#6b7280'),
      scout(1, 'Shard Imp', '#7c3aed'),
    ],
    boss: makeBossTemplate('fracture_keeper_z1', 'Fracture Keeper', 1),
  },
  {
    zone: 2,
    name: 'Void Sands',
    backgroundId: 'bg_void_sands',
    ambientColor: '#292524',
    fogColor: '#57534e',
    requiredKills: 10,
    maxLiveEnemies: 5,
    spawnIntervalMs: 2800,
    bossId: 'sand_colossus_z2',
    bossName: 'Sand Colossus',
    bossIcon: '🏜️',
    bossMaxHp: 7200,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(2, 'Sand Wraith', '#a8a29e'),
      scout(2, 'Crystal Scorpion', '#06b6d4'),
      brute(2, 'Dune Lurker', '#78716c'),
    ],
    boss: makeBossTemplate('sand_colossus_z2', 'Sand Colossus', 2),
  },
  {
    zone: 3,
    name: 'Ember Ruins',
    backgroundId: 'bg_ember_ruins',
    ambientColor: '#431407',
    fogColor: '#7c2d12',
    requiredKills: 10,
    maxLiveEnemies: 5,
    spawnIntervalMs: 2600,
    bossId: 'ruin_tyrant_z3',
    bossName: 'Ruin Tyrant',
    bossIcon: '🔥',
    bossMaxHp: 10800,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(3, 'Cinder Shade', '#78350f'),
      scout(3, 'Ash Revenant', '#d97706'),
      brute(3, 'Ember Colossus', '#991b1b'),
    ],
    boss: makeBossTemplate('ruin_tyrant_z3', 'Ruin Tyrant', 3),
  },
  {
    zone: 4,
    name: 'Thornwood',
    backgroundId: 'bg_thornwood',
    ambientColor: '#14532d',
    fogColor: '#166534',
    requiredKills: 10,
    maxLiveEnemies: 5,
    spawnIntervalMs: 2500,
    bossId: 'thornlord_z4',
    bossName: 'Ancient Thornlord',
    bossIcon: '🌿',
    bossMaxHp: 14400,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(4, 'Thorn Lurker', '#365314'),
      scout(4, 'Vinesnarl Beast', '#4d7c0f'),
      brute(4, 'Blight Dryad', '#166534'),
    ],
    boss: makeBossTemplate('thornlord_z4', 'Ancient Thornlord', 4),
  },
  {
    zone: 5,
    name: 'Sunken Cathedral',
    backgroundId: 'bg_sunken_cathedral',
    ambientColor: '#0c4a6e',
    fogColor: '#0369a1',
    requiredKills: 10,
    maxLiveEnemies: 5,
    spawnIntervalMs: 2400,
    bossId: 'riftbound_abbot_z5',
    bossName: 'Riftbound Abbot',
    bossIcon: '⛪',
    bossMaxHp: 18000,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(5, 'Drowned Acolyte', '#0e7490'),
      scout(5, 'Void Gargoyle', '#7c3aed'),
      brute(5, 'Cathedral Knight', '#1e3a5f'),
    ],
    boss: makeBossTemplate('riftbound_abbot_z5', 'Riftbound Abbot', 5),
  },
  {
    zone: 6,
    name: 'Iron Steppes',
    backgroundId: 'bg_iron_steppes',
    ambientColor: '#1c1917',
    fogColor: '#44403c',
    requiredKills: 10,
    maxLiveEnemies: 6,
    spawnIntervalMs: 2200,
    bossId: 'forge_titan_z6',
    bossName: 'Forge Titan',
    bossIcon: '⚙️',
    bossMaxHp: 21600,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      scout(6, 'Iron Scout', '#9ca3af'),
      brute(6, 'Rust Golem', '#78716c'),
    ],
    boss: makeBossTemplate('forge_titan_z6', 'Forge Titan', 6),
  },
  {
    zone: 7,
    name: 'Hollow Peaks',
    backgroundId: 'bg_hollow_peaks',
    ambientColor: '#0f172a',
    fogColor: '#1e293b',
    requiredKills: 10,
    maxLiveEnemies: 6,
    spawnIntervalMs: 2100,
    bossId: 'nest_mother_z7',
    bossName: 'Nest Mother',
    bossIcon: '🐛',
    bossMaxHp: 25200,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(7, 'Peak Raptor', '#374151'),
      scout(7, 'Void Worm', '#6d28d9'),
      brute(7, 'Alpha Worm', '#1e1b4b'),
    ],
    boss: makeBossTemplate('nest_mother_z7', 'Nest Mother', 7),
  },
  {
    zone: 8,
    name: 'Mirror Lake',
    backgroundId: 'bg_mirror_lake',
    ambientColor: '#0c4a6e',
    fogColor: '#164e63',
    requiredKills: 10,
    maxLiveEnemies: 6,
    spawnIntervalMs: 2000,
    bossId: 'lake_sovereign_z8',
    bossName: 'Lake Sovereign',
    bossIcon: '🌊',
    bossMaxHp: 28800,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(8, 'Mirror Shade', '#6b7280'),
      scout(8, 'Echo Phantom', '#4f46e5'),
      brute(8, 'Reflection Horror', '#083344'),
    ],
    boss: makeBossTemplate('lake_sovereign_z8', 'Lake Sovereign', 8),
  },
  {
    zone: 9,
    name: 'Abyssal Bridge',
    backgroundId: 'bg_abyssal_bridge',
    ambientColor: '#0c0117',
    fogColor: '#1a0d3d',
    requiredKills: 10,
    maxLiveEnemies: 6,
    spawnIntervalMs: 1800,
    bossId: 'abyss_sovereign_z9',
    bossName: 'Abyss Sovereign',
    bossIcon: '🌑',
    bossMaxHp: 32400,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(9, 'Void Drifter', '#1f2937'),
      scout(9, 'Abyss Predator', '#4c1d95'),
      brute(9, 'Bridge Colossus', '#111827'),
    ],
    boss: makeBossTemplate('abyss_sovereign_z9', 'Abyss Sovereign', 9),
  },
  {
    zone: 10,
    name: 'Fracture Core',
    backgroundId: 'bg_fracture_core',
    ambientColor: '#2e1065',
    fogColor: '#4c1d95',
    requiredKills: 12,
    maxLiveEnemies: 6,
    spawnIntervalMs: 1600,
    bossId: 'fracture_overseer_z10',
    bossName: 'Fracture Overseer',
    bossIcon: '☄️',
    bossMaxHp: 36000,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(10, 'Core Fragment', '#312e81'),
      scout(10, 'Reality Shard', '#7c3aed'),
      brute(10, 'Null Colossus', '#1e1b4b'),
    ],
    boss: makeBossTemplate('fracture_overseer_z10', 'Fracture Overseer', 10),
  },
];

const ZONE_DEF_MAP: ReadonlyMap<number, ZoneSceneDefinition> = new Map(
  ZONE_DEFS.map((d) => [d.zone, d]),
);

// ── Generator for zones 11+ ──────────────────────────────────────────────────

function generateZoneSceneDefinition(zone: number): ZoneSceneDefinition {
  const bossPow = zone * 200;
  const bossHp = Math.floor(bossPow * 18);
  return {
    zone,
    name: `Fracture Zone ${zone}`,
    backgroundId: zone % 2 === 0 ? 'bg_void_sands' : 'bg_abyssal_bridge',
    ambientColor: '#0c0117',
    fogColor: '#1a0d3d',
    requiredKills: 10 + Math.floor(zone / 5),
    maxLiveEnemies: Math.min(8, 5 + Math.floor(zone / 5)),
    spawnIntervalMs: Math.max(1000, 3000 - zone * 80),
    bossId: `void_sovereign_z${zone}`,
    bossName: `Void Sovereign Mk.${zone}`,
    bossIcon: '💀',
    bossMaxHp: bossHp,
    spawnPoints: [...STANDARD_SPAWN_POINTS],
    enemyTypes: [
      beast(zone, `Zone ${zone} Wraith`, '#374151'),
      scout(zone, `Zone ${zone} Shade`, '#6d28d9'),
      brute(zone, `Zone ${zone} Titan`, '#111827'),
    ],
    boss: makeBossTemplate(`void_sovereign_z${zone}`, `Void Sovereign Mk.${zone}`, zone),
  };
}

// ── Public accessor ───────────────────────────────────────────────────────────

export function getZoneSceneDefinition(zone: number): ZoneSceneDefinition {
  return ZONE_DEF_MAP.get(zone) ?? generateZoneSceneDefinition(zone);
}
