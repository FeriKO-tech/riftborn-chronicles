import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { QuestService } from './quest.service';
import { PrismaService } from '../database/prisma.service';
import { QuestPeriod, QuestType } from '@riftborn/shared';
import { QUEST_TEMPLATES } from './data/quests.data';

const mockPrisma = {
  playerQuest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
  },
  playerCurrencies: { update: jest.fn() },
  $transaction: jest.fn(),
};

function makeQuest(overrides: Partial<{
  id: string; playerId: string; templateId: string; progress: number;
  targetValue: number; claimed: boolean; periodKey: string;
}> = {}) {
  return {
    id: 'quest-1', playerId: 'player-1',
    templateId: 'd_clear_rooms', progress: 0, targetValue: 10,
    claimed: false, periodKey: '2026-04-07',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('QuestService', () => {
  let service: QuestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<QuestService>(QuestService);
    jest.clearAllMocks();
  });

  // ── Period key helpers ─────────────────────────────────────────────────────

  describe('dailyKey', () => {
    it('returns ISO date string YYYY-MM-DD', () => {
      const key = service.dailyKey(new Date('2026-04-07T15:30:00Z'));
      expect(key).toBe('2026-04-07');
    });
  });

  describe('weeklyKey', () => {
    it('returns week-YYYY-MM-DD anchored to the Monday of that week', () => {
      const key = service.weeklyKey(new Date('2026-04-09T10:00:00Z')); // Thursday
      expect(key).toBe('week-2026-04-06'); // Monday of that week
    });

    it('same week key for Monday and Sunday', () => {
      const monday = service.weeklyKey(new Date('2026-04-06T00:00:00Z'));
      const sunday = service.weeklyKey(new Date('2026-04-12T23:59:59Z'));
      expect(monday).toBe(sunday);
    });

    it('different week key for two different weeks', () => {
      const week1 = service.weeklyKey(new Date('2026-04-07T00:00:00Z'));
      const week2 = service.weeklyKey(new Date('2026-04-14T00:00:00Z'));
      expect(week1).not.toBe(week2);
    });
  });

  // ── Template catalogue ──────────────────────────────────────────────────────

  describe('QUEST_TEMPLATES', () => {
    it('has 6 daily quests', () => {
      const daily = [...QUEST_TEMPLATES.values()].filter((q) => q.period === QuestPeriod.DAILY);
      expect(daily.length).toBe(6);
    });

    it('has 2 weekly quests', () => {
      const weekly = [...QUEST_TEMPLATES.values()].filter((q) => q.period === QuestPeriod.WEEKLY);
      expect(weekly.length).toBe(2);
    });

    it('every template has a positive gold reward', () => {
      for (const t of QUEST_TEMPLATES.values()) {
        expect(t.goldReward).toBeGreaterThan(0);
      }
    });

    it('every template has an icon', () => {
      for (const t of QUEST_TEMPLATES.values()) {
        expect(t.icon.length).toBeGreaterThan(0);
      }
    });
  });

  // ── claimQuest validation ──────────────────────────────────────────────────

  describe('claimQuest', () => {
    it('throws NotFoundException when quest does not belong to player', async () => {
      mockPrisma.playerQuest.findUnique.mockResolvedValue(null);
      await expect(service.claimQuest('player-1', 'quest-99')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if quest already claimed', async () => {
      mockPrisma.playerQuest.findUnique.mockResolvedValue(makeQuest({ claimed: true }));
      await expect(service.claimQuest('player-1', 'quest-1')).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if quest not completed', async () => {
      mockPrisma.playerQuest.findUnique.mockResolvedValue(makeQuest({ progress: 5, targetValue: 10 }));
      await expect(service.claimQuest('player-1', 'quest-1')).rejects.toThrow(BadRequestException);
    });

    it('claims completed quest and returns rewards', async () => {
      mockPrisma.playerQuest.findUnique.mockResolvedValue(makeQuest({ progress: 10, targetValue: 10 }));
      const currencies = { goldShards: BigInt(5000), voidCrystals: 0 };
      mockPrisma.$transaction.mockResolvedValue([{ ...currencies, goldShards: BigInt(6500) }]);

      const result = await service.claimQuest('player-1', 'quest-1');

      const template = QUEST_TEMPLATES.get('d_clear_rooms')!;
      expect(result.goldEarned).toBe(template.goldReward);
      expect(result.newGoldBalance).toBe(6500);
    });
  });

  // ── updateBattleProgress ───────────────────────────────────────────────────

  describe('updateBattleProgress', () => {
    it('does nothing when no active unclaimed quests exist', async () => {
      mockPrisma.playerQuest.findMany
        .mockResolvedValueOnce([]) // ensureQuestsExist - existing
        .mockResolvedValueOnce([]); // getActiveQuests for progress
      mockPrisma.playerQuest.createMany.mockResolvedValue({ count: 6 });
      mockPrisma.playerQuest.findMany.mockResolvedValue([]);

      await service.updateBattleProgress('player-1', {
        victory: true, goldEarned: 500, zone: 1, room: 1, isBoss: false,
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('increments CLEAR_ROOMS quest on victory', async () => {
      const quest = makeQuest({ templateId: 'd_clear_rooms', progress: 3, targetValue: 10 });
      mockPrisma.playerQuest.findMany
        .mockResolvedValueOnce([{ templateId: 'd_clear_rooms', periodKey: quest.periodKey }]) // existing in ensureQuestsExist
        .mockResolvedValueOnce([quest]); // unclaimed quests for updateBattleProgress
      mockPrisma.playerQuest.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateBattleProgress('player-1', {
        victory: true, goldEarned: 500, zone: 1, room: 1, isBoss: false,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('does NOT increment CLEAR_ROOMS on defeat', async () => {
      const quest = makeQuest({ templateId: 'd_clear_rooms', progress: 3, targetValue: 10 });
      mockPrisma.playerQuest.findMany
        .mockResolvedValueOnce([{ templateId: 'd_clear_rooms', periodKey: quest.periodKey }])
        .mockResolvedValueOnce([quest]);
      mockPrisma.playerQuest.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateBattleProgress('player-1', {
        victory: false, goldEarned: 0, zone: 1, room: 1, isBoss: false,
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('increments EARN_GOLD by goldEarned amount', async () => {
      const quest = makeQuest({ templateId: 'd_earn_gold', progress: 1000, targetValue: 5000 });
      mockPrisma.playerQuest.findMany
        .mockResolvedValueOnce([{ templateId: 'd_earn_gold', periodKey: quest.periodKey }])
        .mockResolvedValueOnce([quest]);
      mockPrisma.playerQuest.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateBattleProgress('player-1', {
        victory: true, goldEarned: 780, zone: 1, room: 1, isBoss: false,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('increments DEFEAT_BOSS only on boss victory', async () => {
      const quest = makeQuest({ templateId: 'd_defeat_boss', progress: 0, targetValue: 1 });
      mockPrisma.playerQuest.findMany
        .mockResolvedValueOnce([{ templateId: 'd_defeat_boss', periodKey: quest.periodKey }])
        .mockResolvedValueOnce([quest]);
      mockPrisma.playerQuest.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.$transaction.mockResolvedValue([]);

      await service.updateBattleProgress('player-1', {
        victory: true, goldEarned: 5000, zone: 1, room: 10, isBoss: true,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
