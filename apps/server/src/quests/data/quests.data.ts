import { QuestPeriod, QuestType } from '@riftborn/shared';
import type { QuestTemplateDto } from '@riftborn/shared';

export const QUEST_TEMPLATES: ReadonlyMap<string, QuestTemplateDto> = new Map([
  // ── Daily quests ────────────────────────────────────────────────────────────
  ['d_clear_rooms', {
    id: 'd_clear_rooms',
    name: 'Room Clearer',
    description: 'Clear 10 rooms in battle.',
    type: QuestType.CLEAR_ROOMS,
    period: QuestPeriod.DAILY,
    targetValue: 10,
    goldReward: 1500,
    crystalReward: 0,
    expReward: 300,
    icon: '⚔️',
  }],
  ['d_win_battles', {
    id: 'd_win_battles',
    name: 'Warrior\'s Resolve',
    description: 'Win 5 battles.',
    type: QuestType.WIN_BATTLES,
    period: QuestPeriod.DAILY,
    targetValue: 5,
    goldReward: 1000,
    crystalReward: 1,
    expReward: 200,
    icon: '🏆',
  }],
  ['d_earn_gold', {
    id: 'd_earn_gold',
    name: 'Gold Rush',
    description: 'Earn 5,000 gold shards in battle.',
    type: QuestType.EARN_GOLD,
    period: QuestPeriod.DAILY,
    targetValue: 5000,
    goldReward: 2000,
    crystalReward: 0,
    expReward: 150,
    icon: '🟡',
  }],
  ['d_defeat_boss', {
    id: 'd_defeat_boss',
    name: 'Boss Slayer',
    description: 'Defeat a boss room (Room 10).',
    type: QuestType.DEFEAT_BOSS,
    period: QuestPeriod.DAILY,
    targetValue: 1,
    goldReward: 3000,
    crystalReward: 1,
    expReward: 500,
    icon: '👑',
  }],

  ['d_enhance_item', {
    id: 'd_enhance_item',
    name: 'Forgemaster',
    description: 'Enhance an item once.',
    type: QuestType.ENHANCE_ITEM,
    period: QuestPeriod.DAILY,
    targetValue: 1,
    goldReward: 1200,
    crystalReward: 1,
    expReward: 250,
    icon: '🔨',
  }],
  ['d_claim_offline', {
    id: 'd_claim_offline',
    name: 'Rest & Return',
    description: 'Claim your offline reward today.',
    type: QuestType.CLAIM_OFFLINE_REWARD,
    period: QuestPeriod.DAILY,
    targetValue: 1,
    goldReward: 800,
    crystalReward: 0,
    expReward: 100,
    icon: '💤',
  }],

  // ── Weekly quests ───────────────────────────────────────────────────────────
  ['w_clear_rooms', {
    id: 'w_clear_rooms',
    name: 'Zone Conqueror',
    description: 'Clear 50 rooms this week.',
    type: QuestType.CLEAR_ROOMS,
    period: QuestPeriod.WEEKLY,
    targetValue: 50,
    goldReward: 10000,
    crystalReward: 5,
    expReward: 2000,
    icon: '🗺️',
  }],
  ['w_win_battles', {
    id: 'w_win_battles',
    name: 'Veteran Fighter',
    description: 'Win 25 battles this week.',
    type: QuestType.WIN_BATTLES,
    period: QuestPeriod.WEEKLY,
    targetValue: 25,
    goldReward: 8000,
    crystalReward: 3,
    expReward: 1500,
    icon: '⚡',
  }],
]);

export const DAILY_QUEST_IDS = [...QUEST_TEMPLATES.values()]
  .filter((q) => q.period === QuestPeriod.DAILY)
  .map((q) => q.id);

export const WEEKLY_QUEST_IDS = [...QUEST_TEMPLATES.values()]
  .filter((q) => q.period === QuestPeriod.WEEKLY)
  .map((q) => q.id);
