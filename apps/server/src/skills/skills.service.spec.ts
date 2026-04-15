import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';

const mockRedis = {
  hgetall: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
};

const mockPrisma = {
  playerCurrencies: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('SkillsService', () => {
  let service: SkillsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: RedisService, useValue: mockRedis },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getState', () => {
    it('returns 3 skills for VOIDBLADE with level 0 by default', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      const state = await service.getState('player-1', 'VOIDBLADE');
      expect(state.skills).toHaveLength(3);
      expect(state.skills.every((s) => s.level === 0)).toBe(true);
    });

    it('returns stored levels from redis', async () => {
      mockRedis.hgetall.mockResolvedValue({ vb_shadowstrike: '3' });
      const state = await service.getState('player-1', 'VOIDBLADE');
      const ss = state.skills.find((s) => s.skillId === 'vb_shadowstrike');
      expect(ss?.level).toBe(3);
    });
  });

  describe('upgrade', () => {
    it('throws on unknown skill', async () => {
      await expect(service.upgrade('p1', 'VOIDBLADE', 'nonexistent'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws on wrong class', async () => {
      await expect(service.upgrade('p1', 'IRONVEIL', 'vb_shadowstrike'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws on max level', async () => {
      mockRedis.hget.mockResolvedValue('10');
      await expect(service.upgrade('p1', 'VOIDBLADE', 'vb_shadowstrike'))
        .rejects.toThrow(BadRequestException);
    });

    it('throws on insufficient gold', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue({ goldShards: 100n });
      await expect(service.upgrade('p1', 'VOIDBLADE', 'vb_shadowstrike'))
        .rejects.toThrow(BadRequestException);
    });

    it('succeeds with enough gold', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue({ goldShards: 10000n });
      mockPrisma.playerCurrencies.update.mockResolvedValue({});
      mockRedis.hset.mockResolvedValue(1);

      const result = await service.upgrade('p1', 'VOIDBLADE', 'vb_shadowstrike');
      expect(result.skill.level).toBe(1);
      expect(result.goldCost).toBe(500);
    });
  });
});
