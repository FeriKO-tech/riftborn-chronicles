export enum QuestType {
  CLEAR_ROOMS = 'CLEAR_ROOMS',
  WIN_BATTLES = 'WIN_BATTLES',
  EARN_GOLD = 'EARN_GOLD',
  DEFEAT_BOSS = 'DEFEAT_BOSS',
  REACH_ZONE = 'REACH_ZONE',
  ENHANCE_ITEM = 'ENHANCE_ITEM',
  CLAIM_OFFLINE_REWARD = 'CLAIM_OFFLINE_REWARD',
}

export enum QuestPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export interface QuestTemplateDto {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  period: QuestPeriod;
  targetValue: number;
  goldReward: number;
  crystalReward: number;
  expReward: number;
  icon: string;
}

export interface PlayerQuestDto {
  id: string;
  templateId: string;
  name: string;
  description: string;
  icon: string;
  type: QuestType;
  period: QuestPeriod;
  progress: number;
  targetValue: number;
  claimed: boolean;
  completed: boolean;
  goldReward: number;
  crystalReward: number;
  expReward: number;
  periodKey: string;
}

export interface ClaimQuestResponseDto {
  goldEarned: number;
  crystalsEarned: number;
  expEarned: number;
  newGoldBalance: number;
  newCrystalBalance: number;
}
