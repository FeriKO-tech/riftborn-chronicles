import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlayersService } from './players.service';
import { PrismaService } from '../database/prisma.service';

const mockPrisma = {
  player: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  playerCurrencies: {
    update: jest.fn(),
  },
  offlineRewardLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

function makePlayer(hoursAgo: number, level = 1) {
  return {
    id: 'player-1',
    accountId: 'account-1',
    name: 'VoidSlayer',
    level,
    class: 'VOIDBLADE',
    powerScore: { toNumber: () => 0 },
    vipLevel: 0,
    lastHeartbeat: new Date(Date.now() - hoursAgo * 3_600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('PlayersService', () => {
  let service: PlayersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
    jest.clearAllMocks();
  });

  describe('getOfflineRewardPreview', () => {
    it('throws NotFoundException when player does not exist', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(null);
      await expect(service.getOfflineRewardPreview('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 0 gold when player just logged in (<4 seconds ago)', async () => {
      // 0.001h = 3.6s → floor(500 × 1^1.4 × 0.001) = floor(0.5) = 0
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer(0.001));
      const result = await service.getOfflineRewardPreview('player-1');
      expect(result.goldEarned).toBe(0);
      expect(result.idleHours).toBeLessThan(0.002);
    });

    it('calculates correct gold for exactly 1 hour idle at level 1', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer(1, 1));
      const result = await service.getOfflineRewardPreview('player-1');
      // formula: floor((500 + 100*1) * 1^1.4 * 1.0 * 1h) = 600
      expect(result.goldEarned).toBe(600);
      expect(result.multiplier).toBe(1.0);
      expect(result.expEarned).toBeGreaterThan(0);
    });

    it('calculates correct gold for 2 hours idle at level 1', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer(2, 1));
      const result = await service.getOfflineRewardPreview('player-1');
      // floor((500+100) * 1 * 1.0 * 2) = 1200
      expect(result.goldEarned).toBe(1200);
    });

    it('caps idle time at 12 hours regardless of actual elapsed time', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer(48, 1));
      const result = await service.getOfflineRewardPreview('player-1');
      // floor((500+100) * 1 * 1.0 * 12) = 7200
      expect(result.goldEarned).toBe(7200);
      expect(result.cappedAt).toBe(12);
    });

    it('scales with player level using level^1.4 formula', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer(1, 10));
      const result = await service.getOfflineRewardPreview('player-1');
      // (500 + 100*1) * 10^1.4 * 1.0 * 1
      const expected = Math.floor(600 * Math.pow(10, 1.4) * 1.0 * 1);
      expect(result.goldEarned).toBe(expected);
    });

    it('level 5 earns more than level 1 at same idle duration', async () => {
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer(2, 1));
      const lv1 = await service.getOfflineRewardPreview('player-1');

      mockPrisma.player.findUnique.mockResolvedValue(makePlayer(2, 5));
      const lv5 = await service.getOfflineRewardPreview('player-1');

      expect(lv5.goldEarned).toBeGreaterThan(lv1.goldEarned);
    });
  });

  describe('heartbeat', () => {
    it('updates lastHeartbeat and returns ok + serverTime', async () => {
      mockPrisma.player.update.mockResolvedValue({});
      const result = await service.heartbeat('player-1');
      expect(result.ok).toBe(true);
      expect(typeof result.serverTime).toBe('string');
      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'player-1' } }),
      );
    });
  });
});
