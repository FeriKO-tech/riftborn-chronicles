import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DailyRewardService } from './daily-reward.service';
import { PrismaService } from '../database/prisma.service';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const mockPrisma = {
  dailyReward: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  playerCurrencies: { update: jest.fn() },
  $transaction: jest.fn(),
};

function makeRecord(overrides: Partial<{
  streak: number; longestStreak: number; lastClaimedAt: Date | null; totalClaimed: number;
}> = {}) {
  return {
    id: 'dr-1', playerId: 'player-1', updatedAt: new Date(),
    streak: 0, longestStreak: 0, lastClaimedAt: null, totalClaimed: 0,
    ...overrides,
  };
}

describe('DailyRewardService', () => {
  let service: DailyRewardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyRewardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DailyRewardService>(DailyRewardService);
    jest.clearAllMocks();
  });

  // ── computeReward (pure function) ────────────────────────────────────────────

  describe('computeReward', () => {
    it('day 1 gives base gold × 1.0', () => {
      const r = service.computeReward(1);
      expect(r.goldShards).toBe(500);
      expect(r.voidCrystals).toBe(0);
      expect(r.streakBonus).toBe(0);
    });

    it('day 7 gives maximum multiplier + crystals', () => {
      const r = service.computeReward(7);
      expect(r.goldShards).toBe(Math.floor(500 * 4.0));
      expect(r.voidCrystals).toBe(1);
    });

    it('day 14 gives crystals (every 7th day)', () => {
      const r = service.computeReward(14);
      expect(r.voidCrystals).toBe(2);
    });

    it('streaks beyond 7 accumulate bonus gold', () => {
      const day8 = service.computeReward(8);
      const day1 = service.computeReward(1);
      expect(day8.goldShards).toBeGreaterThan(day1.goldShards);
      expect(day8.streakBonus).toBe(50);
    });

    it('rewards scale progressively through the week', () => {
      const rewards = [1, 2, 3, 4, 5, 6, 7].map((d) => service.computeReward(d).goldShards);
      for (let i = 1; i < rewards.length; i++) {
        expect(rewards[i]).toBeGreaterThan(rewards[i - 1]);
      }
    });
  });

  // ── getStatus ─────────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('canClaim=true when no record exists yet', async () => {
      mockPrisma.dailyReward.findUnique.mockResolvedValue(null);
      mockPrisma.dailyReward.create.mockResolvedValue(makeRecord());

      const status = await service.getStatus('player-1');

      expect(status.canClaim).toBe(true);
      expect(status.streak).toBe(0);
    });

    it('canClaim=false when claimed less than 24h ago', async () => {
      const record = makeRecord({ lastClaimedAt: new Date(Date.now() - 3 * 3_600_000), streak: 3 });
      mockPrisma.dailyReward.findUnique.mockResolvedValue(record);

      const status = await service.getStatus('player-1');

      expect(status.canClaim).toBe(false);
      expect(status.streak).toBe(3);
    });

    it('canClaim=true when last claim was 25h ago', async () => {
      const record = makeRecord({ lastClaimedAt: new Date(Date.now() - 25 * 3_600_000), streak: 5 });
      mockPrisma.dailyReward.findUnique.mockResolvedValue(record);

      const status = await service.getStatus('player-1');

      expect(status.canClaim).toBe(true);
    });
  });

  // ── claim ─────────────────────────────────────────────────────────────────────

  describe('claim', () => {
    it('increments streak and returns reward on first claim', async () => {
      mockPrisma.dailyReward.findUnique.mockResolvedValue(makeRecord());
      const currencies = { goldShards: BigInt(2000), voidCrystals: 0 };
      mockPrisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => {
        return [{ ...currencies, goldShards: BigInt(2500) }];
      });

      const result = await service.claim('player-1');

      expect(result.newStreak).toBe(1);
      expect(result.goldShards).toBe(500);
    });

    it('throws ConflictException if already claimed today', async () => {
      const record = makeRecord({ lastClaimedAt: new Date(Date.now() - 3_600_000), streak: 2 });
      mockPrisma.dailyReward.findUnique.mockResolvedValue(record);

      await expect(service.claim('player-1')).rejects.toThrow(ConflictException);
    });

    it('resets streak to 1 if more than 28h have passed since last claim', async () => {
      const record = makeRecord({
        lastClaimedAt: new Date(Date.now() - 30 * 3_600_000),
        streak: 10,
      });
      mockPrisma.dailyReward.findUnique.mockResolvedValue(record);
      mockPrisma.$transaction.mockResolvedValue([{ goldShards: BigInt(1000), voidCrystals: 0 }]);

      const result = await service.claim('player-1');

      expect(result.newStreak).toBe(1);
    });

    it('extends streak when claimed within the 28h window', async () => {
      const record = makeRecord({
        lastClaimedAt: new Date(Date.now() - ONE_DAY_MS - 1_000),
        streak: 5,
      });
      mockPrisma.dailyReward.findUnique.mockResolvedValue(record);
      mockPrisma.$transaction.mockResolvedValue([{ goldShards: BigInt(3000), voidCrystals: 0 }]);

      const result = await service.claim('player-1');

      expect(result.newStreak).toBe(6);
    });

    it('updates longestStreak when new streak exceeds it', async () => {
      const record = makeRecord({
        lastClaimedAt: new Date(Date.now() - ONE_DAY_MS - 1_000),
        streak: 9,
        longestStreak: 9,
      });
      mockPrisma.dailyReward.findUnique.mockResolvedValue(record);
      mockPrisma.$transaction.mockResolvedValue([{ goldShards: BigInt(5000), voidCrystals: 1 }]);

      const result = await service.claim('player-1');

      expect(result.newStreak).toBe(10);
      expect(result.longestStreak).toBe(10);
    });
  });
});
