import type { AchievementDefinitionDto } from '@riftborn/shared';

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinitionDto[] = [
  // ── Monster Slayer (progressive kills: one track) ──────────
  { id: 'kill_1',        name: 'Monster Slayer I',       description: 'Kill 1 enemy.',              icon: '🗡️', category: 'combat',      rewardGold: 100,   rewardDiamonds: 1,  progressGroup: 'kills',   progressTier: 1,  progressTarget: 1 },
  { id: 'kill_100',      name: 'Monster Slayer II',      description: 'Kill 100 enemies.',          icon: '⚔️', category: 'combat',      rewardGold: 500,   rewardDiamonds: 3,  progressGroup: 'kills',   progressTier: 2,  progressTarget: 100 },
  { id: 'kill_1000',     name: 'Monster Slayer III',     description: 'Kill 1,000 enemies.',        icon: '💀', category: 'combat',      rewardGold: 2000,  rewardDiamonds: 10, progressGroup: 'kills',   progressTier: 3,  progressTarget: 1000 },
  { id: 'kill_10000',    name: 'Monster Slayer IV',      description: 'Kill 10,000 enemies.',       icon: '☠️', category: 'combat',      rewardGold: 10000, rewardDiamonds: 30, progressGroup: 'kills',   progressTier: 4,  progressTarget: 10000 },
  { id: 'kill_100000',   name: 'Monster Slayer V',       description: 'Kill 100,000 enemies.',      icon: '�', category: 'combat',      rewardGold: 50000, rewardDiamonds: 150,progressGroup: 'kills',   progressTier: 5,  progressTarget: 100000 },

  // ── Boss Slayer (progressive boss kills) ───────────────────
  { id: 'boss_1',        name: 'Boss Slayer I',          description: 'Defeat 1 boss.',             icon: '👹', category: 'combat',      rewardGold: 300,   rewardDiamonds: 2,  progressGroup: 'bosses',  progressTier: 1,  progressTarget: 1 },
  { id: 'boss_10',       name: 'Boss Slayer II',         description: 'Defeat 10 bosses.',          icon: '🐉', category: 'combat',      rewardGold: 2000,  rewardDiamonds: 10, progressGroup: 'bosses',  progressTier: 2,  progressTarget: 10 },
  { id: 'boss_50',       name: 'Boss Slayer III',        description: 'Defeat 50 bosses.',          icon: '⚡', category: 'combat',      rewardGold: 8000,  rewardDiamonds: 30, progressGroup: 'bosses',  progressTier: 3,  progressTarget: 50 },
  { id: 'boss_100',      name: 'Boss Slayer IV',         description: 'Defeat 100 bosses.',         icon: '🌋', category: 'combat',      rewardGold: 20000, rewardDiamonds: 60, progressGroup: 'bosses',  progressTier: 4,  progressTarget: 100 },

  // ── Arena Fighter (progressive PvP) ────────────────────────
  { id: 'pvp_1',         name: 'Arena Fighter I',        description: 'Win 1 PvP fight.',           icon: '🏆', category: 'combat',      rewardGold: 500,   rewardDiamonds: 3,  progressGroup: 'pvp',     progressTier: 1,  progressTarget: 1 },
  { id: 'pvp_10',        name: 'Arena Fighter II',       description: 'Win 10 PvP fights.',         icon: '🥊', category: 'combat',      rewardGold: 3000,  rewardDiamonds: 15, progressGroup: 'pvp',     progressTier: 2,  progressTarget: 10 },
  { id: 'pvp_50',        name: 'Arena Fighter III',      description: 'Win 50 PvP fights.',         icon: '🏅', category: 'combat',      rewardGold: 10000, rewardDiamonds: 40, progressGroup: 'pvp',     progressTier: 3,  progressTarget: 50 },

  // ── Leveling (progressive) ─────────────────────────────────
  { id: 'level_5',       name: 'Leveling I',             description: 'Reach level 5.',             icon: '📖', category: 'progression', rewardGold: 200,   rewardDiamonds: 1,  progressGroup: 'level',   progressTier: 1,  progressTarget: 5 },
  { id: 'level_10',      name: 'Leveling II',            description: 'Reach level 10.',            icon: '📚', category: 'progression', rewardGold: 500,   rewardDiamonds: 3,  progressGroup: 'level',   progressTier: 2,  progressTarget: 10 },
  { id: 'level_25',      name: 'Leveling III',           description: 'Reach level 25.',            icon: '🎓', category: 'progression', rewardGold: 2000,  rewardDiamonds: 10, progressGroup: 'level',   progressTier: 3,  progressTarget: 25 },
  { id: 'level_50',      name: 'Leveling IV',            description: 'Reach level 50.',            icon: '👑', category: 'progression', rewardGold: 5000,  rewardDiamonds: 25, progressGroup: 'level',   progressTier: 4,  progressTarget: 50 },
  { id: 'level_100',     name: 'Leveling V',             description: 'Reach level 100.',           icon: '🌟', category: 'progression', rewardGold: 15000, rewardDiamonds: 80, progressGroup: 'level',   progressTier: 5,  progressTarget: 100 },

  // ── Zone Explorer (progressive) ────────────────────────────
  { id: 'zone_3',        name: 'Explorer I',             description: 'Clear zone 3.',              icon: '🗺️', category: 'progression', rewardGold: 500,   rewardDiamonds: 2,  progressGroup: 'zone',    progressTier: 1,  progressTarget: 3 },
  { id: 'zone_5',        name: 'Explorer II',            description: 'Clear zone 5.',              icon: '🧭', category: 'progression', rewardGold: 1500,  rewardDiamonds: 5,  progressGroup: 'zone',    progressTier: 2,  progressTarget: 5 },
  { id: 'zone_10',       name: 'Explorer III',           description: 'Clear zone 10.',             icon: '🌍', category: 'progression', rewardGold: 5000,  rewardDiamonds: 15, progressGroup: 'zone',    progressTier: 3,  progressTarget: 10 },
  { id: 'zone_20',       name: 'Explorer IV',            description: 'Clear zone 20.',             icon: '🌌', category: 'progression', rewardGold: 10000, rewardDiamonds: 30, progressGroup: 'zone',    progressTier: 4,  progressTarget: 20 },
  { id: 'zone_50',       name: 'Explorer V',             description: 'Clear zone 50.',             icon: '👁️', category: 'progression', rewardGold: 30000, rewardDiamonds: 100,progressGroup: 'zone',    progressTier: 5,  progressTarget: 50 },

  // ── Gold Collector (progressive) ───────────────────────────
  { id: 'gold_1000',     name: 'Gold Collector I',       description: 'Accumulate 1,000 gold.',     icon: '💰', category: 'economy',     rewardGold: 200,   rewardDiamonds: 1,  progressGroup: 'gold',    progressTier: 1,  progressTarget: 1000 },
  { id: 'gold_10000',    name: 'Gold Collector II',      description: 'Accumulate 10,000 gold.',    icon: '🏦', category: 'economy',     rewardGold: 1000,  rewardDiamonds: 5,  progressGroup: 'gold',    progressTier: 2,  progressTarget: 10000 },
  { id: 'gold_100000',   name: 'Gold Collector III',     description: 'Accumulate 100,000 gold.',   icon: '�', category: 'economy',     rewardGold: 5000,  rewardDiamonds: 20, progressGroup: 'gold',    progressTier: 3,  progressTarget: 100000 },

  // ── Enchanter (progressive) ────────────────────────────────
  { id: 'enchant_1',     name: 'Enchanter I',            description: 'Enchant an item once.',      icon: '✨', category: 'collection',  rewardGold: 300,   rewardDiamonds: 2,  progressGroup: 'enchant', progressTier: 1,  progressTarget: 1 },
  { id: 'enchant_10',    name: 'Enchanter II',           description: 'Enchant items 10 times.',    icon: '🔮', category: 'collection',  rewardGold: 2000,  rewardDiamonds: 10, progressGroup: 'enchant', progressTier: 2,  progressTarget: 10 },

  // ── One-off achievements ───────────────────────────────────
  { id: 'equip_full',    name: 'Fully Equipped',         description: 'Equip an item in every slot.',    icon: '�️', category: 'collection',  rewardGold: 500,   rewardDiamonds: 3 },
  { id: 'companion_first', name: 'Beast Tamer',          description: 'Activate your first companion.', icon: '🐾', category: 'collection',  rewardGold: 300,   rewardDiamonds: 2 },

  // ── Daily Login (progressive) ──────────────────────────────
  { id: 'daily_3',       name: 'Daily Login I',          description: 'Claim daily rewards 3 times.',    icon: '📅', category: 'social',  rewardGold: 300,   rewardDiamonds: 2,  progressGroup: 'daily',   progressTier: 1,  progressTarget: 3 },
  { id: 'daily_7',       name: 'Daily Login II',         description: 'Claim daily rewards 7 times.',    icon: '🗓️', category: 'social',  rewardGold: 1000,  rewardDiamonds: 5,  progressGroup: 'daily',   progressTier: 2,  progressTarget: 7 },
  { id: 'daily_30',      name: 'Daily Login III',        description: 'Claim daily rewards 30 times.',   icon: '🏅', category: 'social',  rewardGold: 5000,  rewardDiamonds: 25, progressGroup: 'daily',   progressTier: 3,  progressTarget: 30 },
];

const ACHIEVEMENT_MAP = new Map(ACHIEVEMENT_DEFINITIONS.map((a) => [a.id, a]));

export function getAchievementDefinition(id: string): AchievementDefinitionDto | undefined {
  return ACHIEVEMENT_MAP.get(id);
}
