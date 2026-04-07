import type { BossConfigDto } from '@riftborn/shared';

export const BOSS_TEMPLATES: ReadonlyMap<string, BossConfigDto> = new Map([
  [
    'fracture_warden',
    {
      id: 'fracture_warden',
      name: 'Fracture Warden',
      description: 'The sentinel of the first shattered reality. Slow but devastating.',
      icon: '🗡️',
      zoneRequirement: 1,
      hp: 3000,
      attack: 180,
      defense: 80,
      speed: 70,
      level: 5,
      rewards: { goldShards: 5000, voidCrystals: 2, resonanceCores: 3, expBonus: 500 },
      maxAttemptsPerDay: 3,
    },
  ],
  [
    'void_hound',
    {
      id: 'void_hound',
      name: 'Void Hound',
      description: 'A beast born from pure fracture energy. Fast and ferocious.',
      icon: '🐺',
      zoneRequirement: 3,
      hp: 6500,
      attack: 320,
      defense: 140,
      speed: 130,
      level: 12,
      rewards: { goldShards: 10000, voidCrystals: 4, resonanceCores: 6, expBonus: 1200 },
      maxAttemptsPerDay: 3,
    },
  ],
  [
    'ember_titan',
    {
      id: 'ember_titan',
      name: 'Ember Titan',
      description: 'A colossal entity of solidified flame. Immune to fear.',
      icon: '🔥',
      zoneRequirement: 5,
      hp: 14000,
      attack: 550,
      defense: 260,
      speed: 90,
      level: 20,
      rewards: { goldShards: 20000, voidCrystals: 8, resonanceCores: 12, expBonus: 2500 },
      maxAttemptsPerDay: 3,
    },
  ],
  [
    'rift_colossus',
    {
      id: 'rift_colossus',
      name: 'Rift Colossus',
      description: 'Ancient guardian of the deepest fractures. Its gaze alone shatters resolve.',
      icon: '🏔️',
      zoneRequirement: 7,
      hp: 30000,
      attack: 900,
      defense: 420,
      speed: 80,
      level: 30,
      rewards: { goldShards: 40000, voidCrystals: 15, resonanceCores: 20, expBonus: 5000 },
      maxAttemptsPerDay: 3,
    },
  ],
  [
    'void_sovereign',
    {
      id: 'void_sovereign',
      name: 'Void Sovereign',
      description: 'The apex predator of the Fracture Realm. None have survived twice.',
      icon: '👑',
      zoneRequirement: 10,
      hp: 70000,
      attack: 1800,
      defense: 800,
      speed: 150,
      level: 50,
      rewards: { goldShards: 100000, voidCrystals: 30, resonanceCores: 50, expBonus: 12000 },
      maxAttemptsPerDay: 3,
    },
  ],
]);

export const BOSS_LIST = [...BOSS_TEMPLATES.values()];

export const DAILY_RESET_HOUR_UTC = 0; // midnight UTC
