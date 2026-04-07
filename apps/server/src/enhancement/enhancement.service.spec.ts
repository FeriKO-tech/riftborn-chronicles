import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EnhancementService } from './enhancement.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { QuestService } from '../quests/quest.service';

const mockPrisma = {
  inventoryItem: { findUnique: jest.fn(), update: jest.fn() },
  player: { findUnique: jest.fn() },
  playerCurrencies: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

const mockInventory = {
  recalcAndPersistPowerScore: jest.fn().mockResolvedValue(2000),
};

const mockQuests = {
  trackSingleEvent: jest.fn().mockResolvedValue(undefined),
};

function makeItem(level = 0, overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1', playerId: 'player-1',
    templateId: 'w_iron_shard', name: 'Iron Void Shard',
    slot: 'WEAPON', rarity: 'COMMON', itemLevel: 3,
    isEquipped: false, atkBonus: 200, defBonus: 0, hpBonus: 0,
    enhancementLevel: level, obtainedAt: new Date(),
    ...overrides,
  };
}

const stubPlayer = { id: 'player-1', level: 5, class: 'VOIDBLADE' };
const richCurrencies = { id: 'c-1', playerId: 'player-1', resonanceCores: 9999, forgeDust: 9999 };
const poorCurrencies = { id: 'c-1', playerId: 'player-1', resonanceCores: 0, forgeDust: 0 };

describe('EnhancementService', () => {
  let service: EnhancementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
        { provide: QuestService, useValue: mockQuests },
      ],
    }).compile();

    service = module.get<EnhancementService>(EnhancementService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockResolvedValue([makeItem(1), richCurrencies]);
    mockInventory.recalcAndPersistPowerScore.mockResolvedValue(2000);
  });

  // ── computeCost (pure) ────────────────────────────────────────────────────

  describe('computeCost', () => {
    it('level 1 costs 100 cores + 150 dust', () => {
      expect(service.computeCost(1)).toEqual({ resonanceCores: 100, forgeDust: 150 });
    });
    it('level 5 costs 500 cores + 750 dust', () => {
      expect(service.computeCost(5)).toEqual({ resonanceCores: 500, forgeDust: 750 });
    });
    it('level 10 costs 1000 cores + 1500 dust', () => {
      expect(service.computeCost(10)).toEqual({ resonanceCores: 1000, forgeDust: 1500 });
    });
    it('cost scales linearly with level', () => {
      const c3 = service.computeCost(3);
      const c6 = service.computeCost(6);
      expect(c6.resonanceCores).toBe(c3.resonanceCores * 2);
    });
  });

  // ── getEnhancementInfo ────────────────────────────────────────────────────

  describe('getEnhancementInfo', () => {
    it('returns correct info for level 0 item', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem(0));
      const info = await service.getEnhancementInfo('player-1', 'item-1');
      expect(info.currentLevel).toBe(0);
      expect(info.isMaxLevel).toBe(false);
      expect(info.cost).toEqual({ resonanceCores: 100, forgeDust: 150 });
      expect(info.statMultiplier).toBe(1.0);
    });

    it('shows isMaxLevel=true and null cost at level 10', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem(10));
      const info = await service.getEnhancementInfo('player-1', 'item-1');
      expect(info.isMaxLevel).toBe(true);
      expect(info.cost).toBeNull();
      expect(info.statMultiplier).toBe(1.5); // 1 + 10×0.05
    });

    it('throws NotFoundException for unknown item', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);
      await expect(service.getEnhancementInfo('player-1', 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  // ── upgradeItem ───────────────────────────────────────────────────────────

  describe('upgradeItem', () => {
    it('upgrades item from 0 to 1 and returns newPowerScore', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem(0));
      mockPrisma.player.findUnique.mockResolvedValue(stubPlayer);
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(richCurrencies);

      const result = await service.upgradeItem('player-1', 'item-1');

      expect(result.newEnhancementLevel).toBe(1);
      expect(result.newPowerScore).toBe(2000);
      expect(result.cost).toEqual({ resonanceCores: 100, forgeDust: 150 });
      // +5% to base 200 ATK = 210
      expect(result.newAtkBonus).toBe(210);
    });

    it('returns correct enhanced stats at level 5 (+25%)', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem(4)); // upgrading 4→5
      mockPrisma.player.findUnique.mockResolvedValue(stubPlayer);
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(richCurrencies);
      mockPrisma.$transaction.mockResolvedValue([makeItem(5), richCurrencies]);

      const result = await service.upgradeItem('player-1', 'item-1');

      expect(result.newEnhancementLevel).toBe(5);
      expect(result.newAtkBonus).toBe(250); // 200 × 1.25
    });

    it('throws BadRequestException when already at max level', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem(10));
      mockPrisma.player.findUnique.mockResolvedValue(stubPlayer);
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(richCurrencies);
      await expect(service.upgradeItem('player-1', 'item-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when insufficient Resonance Cores', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem(0));
      mockPrisma.player.findUnique.mockResolvedValue(stubPlayer);
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(poorCurrencies);
      await expect(service.upgradeItem('player-1', 'item-1')).rejects.toThrow(BadRequestException);
    });
  });
});
