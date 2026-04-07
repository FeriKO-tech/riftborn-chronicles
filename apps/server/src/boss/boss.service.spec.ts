import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BossService } from './boss.service';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { InventoryService } from '../inventory/inventory.service';
import { QuestService } from '../quests/quest.service';

const mockPrisma = {
  bossAttempt: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  player: { findUnique: jest.fn(), update: jest.fn() },
  stageProgress: { findUnique: jest.fn() },
  playerCurrencies: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

const mockCombat = {
  computePlayerStats: jest.fn().mockReturnValue({
    hp: 2000, maxHp: 2000, attack: 600, defense: 300,
    speed: 110, critChance: 0.09, critDamage: 1.8,
  }),
  simulateSingleEnemy: jest.fn().mockReturnValue({ victory: true, rounds: 5, totalDamageDealt: 3000 }),
  computeLevelUp: jest.fn().mockReturnValue({ newLevel: 5, newExp: 500, leveledUp: false }),
  computePowerScore: jest.fn().mockReturnValue(2500),
};

const mockInventory = {
  getEquippedBonuses: jest.fn().mockResolvedValue({ atkBonus: 0, defBonus: 0, hpBonus: 0 }),
};

const mockQuests = {
  trackSingleEvent: jest.fn().mockResolvedValue(undefined),
};

const stubPlayer = { id: 'player-1', level: 5, class: 'VOIDBLADE', experience: BigInt(0), activeCompanionId: null };
const richCurrencies = { goldShards: BigInt(10000), voidCrystals: 0, resonanceCores: 0, forgeDust: 0 };
const progressUnlocked = { playerId: 'player-1', highestZone: 1 };
const progressLocked = { playerId: 'player-1', highestZone: 0 };

describe('BossService', () => {
  let service: BossService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BossService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CombatService, useValue: mockCombat },
        { provide: InventoryService, useValue: mockInventory },
        { provide: QuestService, useValue: mockQuests },
      ],
    }).compile();

    service = module.get<BossService>(BossService);
    jest.clearAllMocks();

    mockCombat.simulateSingleEnemy.mockReturnValue({ victory: true, rounds: 5, totalDamageDealt: 3000 });
    mockCombat.computeLevelUp.mockReturnValue({ newLevel: 5, newExp: 500, leveledUp: false });
    mockCombat.computePowerScore.mockReturnValue(2500);
    mockInventory.getEquippedBonuses.mockResolvedValue({ atkBonus: 0, defBonus: 0, hpBonus: 0 });
    mockQuests.trackSingleEvent.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.bossAttempt.upsert.mockResolvedValue({});
  });

  // ── Boss state ────────────────────────────────────────────────────────────

  describe('getBossState', () => {
    it('returns all 5 bosses', async () => {
      mockPrisma.bossAttempt.findMany.mockResolvedValue([]);
      const state = await service.getBossState('player-1');
      expect(state.bosses).toHaveLength(5);
    });

    it('shows 0 attempts used when no record exists', async () => {
      mockPrisma.bossAttempt.findMany.mockResolvedValue([]);
      const state = await service.getBossState('player-1');
      expect(state.attempts['fracture_warden'].attemptsUsed).toBe(0);
      expect(state.attempts['fracture_warden'].attemptsRemaining).toBe(3);
    });
  });

  // ── Fight ─────────────────────────────────────────────────────────────────

  describe('fight', () => {
    const setupMocks = (options: { highestZone?: number; attempts?: number } = {}) => {
      mockPrisma.player.findUnique.mockResolvedValue(stubPlayer);
      mockPrisma.stageProgress.findUnique.mockResolvedValue(
        options.highestZone !== undefined
          ? { ...progressUnlocked, highestZone: options.highestZone }
          : progressUnlocked,
      );
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(richCurrencies);
      const today = new Date();
      mockPrisma.bossAttempt.findUnique.mockResolvedValue(
        options.attempts != null
          ? { attemptsUsed: options.attempts, lastAttemptAt: today }
          : null,
      );
    };

    it('returns victory and rewards on win', async () => {
      setupMocks();
      const result = await service.fight('player-1', 'fracture_warden');
      expect(result.victory).toBe(true);
      expect(result.rewards).not.toBeNull();
      expect(result.rewards?.goldShards).toBe(5000);
      expect(result.rewards?.voidCrystals).toBe(2);
    });

    it('returns defeat with null rewards on loss', async () => {
      setupMocks();
      mockCombat.simulateSingleEnemy.mockReturnValue({ victory: false, rounds: 8, totalDamageDealt: 500 });
      const result = await service.fight('player-1', 'fracture_warden');
      expect(result.victory).toBe(false);
      expect(result.rewards).toBeNull();
    });

    it('throws ForbiddenException when zone requirement not met', async () => {
      setupMocks({ highestZone: 0 });
      await expect(service.fight('player-1', 'fracture_warden')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when all daily attempts used', async () => {
      setupMocks({ attempts: 3 });
      await expect(service.fight('player-1', 'fracture_warden')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown boss id', async () => {
      await expect(service.fight('player-1', 'nonexistent_boss')).rejects.toThrow(NotFoundException);
    });

    it('decrements attemptsRemaining correctly', async () => {
      setupMocks({ attempts: 1 });
      const result = await service.fight('player-1', 'fracture_warden');
      expect(result.attemptsRemaining).toBe(1); // 3 max - 2 used = 1
    });

    it('persists rewards in transaction on victory', async () => {
      setupMocks();
      await service.fight('player-1', 'fracture_warden');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('daily reset: past attempt counts as 0 if from yesterday', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      mockPrisma.player.findUnique.mockResolvedValue(stubPlayer);
      mockPrisma.stageProgress.findUnique.mockResolvedValue(progressUnlocked);
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(richCurrencies);
      mockPrisma.bossAttempt.findUnique.mockResolvedValue({ attemptsUsed: 3, lastAttemptAt: yesterday });
      const result = await service.fight('player-1', 'fracture_warden');
      expect(result.attemptsRemaining).toBe(2); // reset: 3 - 1 = 2
    });
  });
});
