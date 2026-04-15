import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from './achievements.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';

const mockRedis = {
  hgetall: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
};

const mockPrisma = {
  playerCurrencies: {
    update: jest.fn(),
  },
};

describe('AchievementsService', () => {
  let service: AchievementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getState', () => {
    it('returns all definitions with empty unlocked when nothing in redis', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      const state = await service.getState('p1');
      expect(state.all.length).toBeGreaterThan(20);
      expect(state.unlocked).toHaveLength(0);
    });

    it('returns unlocked achievements from redis', async () => {
      mockRedis.hgetall.mockResolvedValue({ kill_1: '2025-01-01T00:00:00Z' });
      const state = await service.getState('p1');
      expect(state.unlocked).toHaveLength(1);
      expect(state.unlocked[0].achievementId).toBe('kill_1');
    });
  });

  describe('tryUnlock', () => {
    it('returns null for already unlocked', async () => {
      mockRedis.hget.mockResolvedValue('2025-01-01');
      const r = await service.tryUnlock('p1', 'kill_1');
      expect(r).toBeNull();
    });

    it('returns null for unknown achievement', async () => {
      const r = await service.tryUnlock('p1', 'does_not_exist');
      expect(r).toBeNull();
    });

    it('unlocks and awards gold', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockRedis.hset.mockResolvedValue(1);
      mockPrisma.playerCurrencies.update.mockResolvedValue({});

      const r = await service.tryUnlock('p1', 'kill_1');
      expect(r).not.toBeNull();
      expect(r!.achievement.achievementId).toBe('kill_1');
      expect(r!.goldAwarded).toBe(100);
      expect(r!.diamondsAwarded).toBe(1);
    });
  });

  describe('checkAndUnlock', () => {
    it('unlocks multiple achievements at once', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockRedis.hset.mockResolvedValue(1);
      mockPrisma.playerCurrencies.update.mockResolvedValue({});

      const results = await service.checkAndUnlock('p1', {
        totalKills: 150,
        level: 6,
      });

      const ids = results.map((r) => r.achievement.achievementId);
      expect(ids).toContain('kill_1');
      expect(ids).toContain('kill_100');
      expect(ids).toContain('level_5');
    });

    it('does not unlock unmet achievements', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockRedis.hset.mockResolvedValue(1);
      mockPrisma.playerCurrencies.update.mockResolvedValue({});

      const results = await service.checkAndUnlock('p1', {
        totalKills: 5,
        level: 2,
      });

      const ids = results.map((r) => r.achievement.achievementId);
      expect(ids).toContain('kill_1');
      expect(ids).not.toContain('kill_100');
      expect(ids).not.toContain('level_5');
    });
  });
});
