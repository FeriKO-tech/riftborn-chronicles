import { RoomType } from '@riftborn/shared';
import type { ZoneDto, RoomDto, EnemyTemplateDto } from '@riftborn/shared';

const ROOMS_PER_ZONE = 10;
const BOSS_ROOM = 10;

function makeEnemy(
  id: string,
  name: string,
  zone: number,
  room: number,
  isBoss = false,
): EnemyTemplateDto {
  const basePow = zone * 80 + room * 12;
  const mult = isBoss ? 5 : 1;
  // Bosses are slower (tanky, deliberate) — normal mobs scale with room depth
  const baseSpeed = Math.floor(zone * 15 + room * 5);
  const speed = isBoss ? Math.floor(baseSpeed * 0.7) : baseSpeed;
  return {
    id,
    name,
    level: Math.max(1, zone * 3 + room - 2),
    hp: Math.floor(basePow * mult * 8),
    attack: Math.floor(basePow * mult * 0.6),
    defense: Math.floor(basePow * mult * 0.2),
    speed,
    expReward: Math.floor(basePow * mult * 1.5),
    goldReward: Math.floor(basePow * mult * 1.2),
  };
}

function makeRooms(
  zone: number,
  normalEnemyNames: string[],
  eliteEnemyName: string,
  bossName: string,
): RoomDto[] {
  return Array.from({ length: ROOMS_PER_ZONE }, (_, i) => {
    const room = i + 1;
    const isBoss = room === BOSS_ROOM;
    const isElite = room === 5;
    const type = isBoss ? RoomType.BOSS : isElite ? RoomType.ELITE : RoomType.NORMAL;
    const enemyName = isBoss
      ? bossName
      : isElite
        ? eliteEnemyName
        : normalEnemyNames[room % normalEnemyNames.length];

    const enemyId = `z${zone}_r${room}_enemy`;
    const enemyCount = isBoss ? 1 : isElite ? 1 : room <= 3 ? 1 : 2;

    return {
      room,
      type,
      enemies: Array.from({ length: enemyCount }, (_, ei) =>
        makeEnemy(`${enemyId}_${ei}`, enemyName, zone, room, isBoss),
      ),
      clearGoldBonus: isBoss
        ? zone * 500
        : isElite
          ? zone * 120
          : zone * 30,
    };
  });
}

export const ZONES: ReadonlyMap<number, ZoneDto> = new Map<number, ZoneDto>([
  [
    1,
    {
      zone: 1,
      name: 'Shattered Approach',
      description: 'The fractured outer ring — where Rift energy first bleeds into the mortal world.',
      minLevel: 1,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(1, ['Rift Wisp', 'Shard Imp'], 'Blighted Hound', 'Fracture Keeper'),
    },
  ],
  [
    2,
    {
      zone: 2,
      name: 'Void Sands',
      description: 'A desert carved by void storms, stalked by crystalline predators.',
      minLevel: 4,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(2, ['Sand Wraith', 'Crystal Scorpion'], 'Dune Stalker', 'Sand Colossus'),
    },
  ],
  [
    3,
    {
      zone: 3,
      name: 'Ember Ruins',
      description: 'Scorched remains of a city swallowed by a Rift eruption centuries ago.',
      minLevel: 7,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        3,
        ['Cinder Shade', 'Ash Revenant'],
        'Ember Knight',
        'Ruin Tyrant',
      ),
    },
  ],
  [
    4,
    {
      zone: 4,
      name: 'Thornwood',
      description: 'A forest corrupted by void sap — every tree hides something hungry.',
      minLevel: 10,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        4,
        ['Thorn Lurker', 'Vinesnarl Beast'],
        'Blight Dryad',
        'Ancient Thornlord',
      ),
    },
  ],
  [
    5,
    {
      zone: 5,
      name: 'Sunken Cathedral',
      description: 'A submerged temple where zealots once sealed a Rift — the seal is breaking.',
      minLevel: 13,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        5,
        ['Drowned Acolyte', 'Void Gargoyle'],
        'Cursed Paladin',
        'Riftbound Abbot',
      ),
    },
  ],
  [
    6,
    {
      zone: 6,
      name: 'Iron Steppes',
      description: 'Flat iron plains patrolled by mechanical constructs of unknown origin.',
      minLevel: 16,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        6,
        ['Iron Scout', 'Rust Golem'],
        'Siege Automaton',
        'Forge Titan',
      ),
    },
  ],
  [
    7,
    {
      zone: 7,
      name: 'Hollow Peaks',
      description: 'Mountains hollowed by void worms — their nests pulse with dark energy.',
      minLevel: 19,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        7,
        ['Peak Raptor', 'Void Worm'],
        'Alpha Worm',
        'Nest Mother',
      ),
    },
  ],
  [
    8,
    {
      zone: 8,
      name: 'Mirror Lake',
      description: 'A lake that reflects another dimension — what surfaces is never friendly.',
      minLevel: 22,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        8,
        ['Mirror Shade', 'Echo Phantom'],
        'Reflection Horror',
        'Lake Sovereign',
      ),
    },
  ],
  [
    9,
    {
      zone: 9,
      name: 'Abyssal Bridge',
      description: 'An ancient bridge over the void abyss — gravity is merely a suggestion here.',
      minLevel: 25,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        9,
        ['Void Drifter', 'Abyss Predator'],
        'Bridge Warden',
        'Abyss Sovereign',
      ),
    },
  ],
  [
    10,
    {
      zone: 10,
      name: 'Fracture Core',
      description: 'The heart of the first Fracture Zone — raw Rift energy tears reality apart.',
      minLevel: 28,
      roomCount: ROOMS_PER_ZONE,
      rooms: makeRooms(
        10,
        ['Core Fragment', 'Reality Shard'],
        'Rift Zealot',
        'Fracture Overseer',
      ),
    },
  ],
]);

export const TOTAL_ZONES = 100;
export const ROOMS_PER_ZONE_COUNT = ROOMS_PER_ZONE;
