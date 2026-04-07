import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PvpService } from './pvp.service';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { InventoryService } from '../inventory/inventory.service';

const baseStats = { hp: 2000, maxHp: 2000, attack: 600, defense: 300, speed: 110, critChance: 0.09, critDamage: 1.8 };
const defenseSnapshot = { level: 5, class: 'VOIDBLADE', powerScore: 2500, stats: baseStats };

const mockPrisma = {
  pvpProfile: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  pvpBattle: { create: jest.fn(), findMany: jest.fn() },
  player: { findUnique: jest.fn(), update: jest.fn() },
  playerCurrencies: { update: jest.fn() },
  $transaction: jest.fn(),
};

const mockCombat = {
  computePlayerStats: jest.fn().mockReturnValue(baseStats),
  computePowerScore: jest.fn().mockReturnValue(2500),
  simulateSingleEnemy: jest.fn().mockReturnValue({ victory: true, rounds: 4, totalDamageDealt: 1200 }),
};

const mockInventory = {
  getEquippedBonuses: jest.fn().mockResolvedValue({ atkBonus: 0, defBonus: 0, hpBonus: 0 }),
};

const stubProfile = (rating = 1200) => ({
  id: 'pvp-1', playerId: 'player-1', rating, wins: 3, losses: 1,
  defenseSnapshot, updatedAt: new Date(),
});
const stubPlayer = { id: 'player-1', level: 5, class: 'VOIDBLADE', experience: BigInt(0), activeCompanionId: null, powerScore: BigInt(2500) };

describe('PvpService', () => {
  let service: PvpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PvpService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CombatService, useValue: mockCombat },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();

    service = module.get<PvpService>(PvpService);
    jest.clearAllMocks();

    mockPrisma.$transaction.mockResolvedValue([]);
    mockPrisma.pvpProfile.upsert.mockResolvedValue(stubProfile());
    mockPrisma.pvpProfile.findUniqueOrThrow.mockResolvedValue(stubProfile());
    mockPrisma.pvpBattle.findMany.mockResolvedValue([]);
    mockPrisma.pvpProfile.findMany.mockResolvedValue([]);
    mockPrisma.player.findUnique.mockResolvedValue(stubPlayer);
    mockCombat.simulateSingleEnemy.mockReturnValue({ victory: true, rounds: 4, totalDamageDealt: 1200 });
  });

  // ── getState ──────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('returns profile, opponents and recent battles', async () => {
      mockPrisma.pvpProfile.findUnique.mockResolvedValue(stubProfile());
      const state = await service.getState('player-1');
      expect(state.profile.rating).toBe(1200);
      expect(state.profile.wins).toBe(3);
      expect(Array.isArray(state.opponents)).toBe(true);
      expect(Array.isArray(state.recentBattles)).toBe(true);
    });

    it('computes win rate correctly', async () => {
      mockPrisma.pvpProfile.findUnique.mockResolvedValue(stubProfile());
      const state = await service.getState('player-1');
      expect(state.profile.winRate).toBeCloseTo(0.75);
    });

    it('creates profile if not exists', async () => {
      mockPrisma.pvpProfile.findUnique.mockResolvedValue(null);
      mockPrisma.pvpProfile.findUniqueOrThrow.mockResolvedValue(stubProfile());
      await service.getState('player-1');
      expect(mockPrisma.pvpProfile.upsert).toHaveBeenCalled();
    });
  });

  // ── fight ─────────────────────────────────────────────────────────────────

  describe('fight', () => {
    const setupFight = (win: boolean, opponentProfile = stubProfile(1180)) => {
      mockPrisma.pvpProfile.findUnique
        .mockResolvedValueOnce(stubProfile()) // attacker
        .mockResolvedValueOnce(opponentProfile); // defender
      mockCombat.simulateSingleEnemy.mockReturnValue({
        victory: win, rounds: 5, totalDamageDealt: 800,
      });
    };

    it('returns victory and positive ratingChange on win', async () => {
      setupFight(true);
      const result = await service.fight('player-1', 'player-2');
      expect(result.victory).toBe(true);
      expect(result.ratingChange).toBe(25);
      expect(result.newRating).toBe(1225);
    });

    it('returns loss and negative ratingChange on defeat', async () => {
      setupFight(false);
      const result = await service.fight('player-1', 'player-2');
      expect(result.victory).toBe(false);
      expect(result.ratingChange).toBe(-15);
      expect(result.newRating).toBe(1185);
    });

    it('grants gold rewards only on win', async () => {
      setupFight(true);
      const result = await service.fight('player-1', 'player-2');
      expect(result.rewards?.goldShards).toBe(800);
    });

    it('returns null rewards on loss', async () => {
      setupFight(false);
      const result = await service.fight('player-1', 'player-2');
      expect(result.rewards).toBeNull();
    });

    it('throws BadRequestException when fighting self', async () => {
      await expect(service.fight('player-1', 'player-1')).rejects.toThrow(BadRequestException);
    });

    it('rating cannot drop below 100', async () => {
      mockPrisma.pvpProfile.findUnique
        .mockResolvedValueOnce(stubProfile(105)) // attacker with low rating
        .mockResolvedValueOnce(stubProfile(1200));
      mockCombat.simulateSingleEnemy.mockReturnValue({ victory: false, rounds: 3, totalDamageDealt: 0 });
      const result = await service.fight('player-1', 'player-2');
      expect(result.newRating).toBeGreaterThanOrEqual(100);
    });

    it('persists battle and profile update in transaction', async () => {
      setupFight(true);
      await service.fight('player-1', 'player-2');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
