import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StagesService } from './stages.service';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { InventoryService } from '../inventory/inventory.service';
import { QuestService } from '../quests/quest.service';
import { RoomType } from '@riftborn/shared';
import type { CombatStatsDto } from '@riftborn/shared';
import type { SimulateResult } from '../combat/combat.service';
import { ROOMS_PER_ZONE_COUNT, TOTAL_ZONES } from './data/zones.data';

const mockPrisma = {
  stageProgress: { findUnique: jest.fn(), update: jest.fn() },
  playerCurrencies: { update: jest.fn() },
  battleLog: { create: jest.fn() },
  player: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};

const fakeCombatStats: CombatStatsDto = {
  hp: 1000, maxHp: 1000, attack: 300, defense: 150, speed: 90, critChance: 0.08, critDamage: 1.8,
};

const makeSimResult = (override: Partial<SimulateResult> = {}): SimulateResult => ({
  victory: true,
  rounds: [{ round: 1, playerDmg: 100, enemyDmg: 30, playerHpLeft: 970, enemyHpLeft: 0, playerCrit: false }],
  totalDamageDealt: 100,
  goldEarned: 780,
  expEarned: 864,
  ...override,
});

const mockInventory = {
  getEquippedBonuses: jest.fn().mockResolvedValue({ atkBonus: 0, defBonus: 0, hpBonus: 0 }),
  rollDrop: jest.fn().mockResolvedValue({ dropped: false, item: null }),
};

const mockQuests = {
  updateBattleProgress: jest.fn().mockResolvedValue(undefined),
};

const mockCombat = {
  computePlayerStats: jest.fn().mockReturnValue(fakeCombatStats),
  simulateRoom: jest.fn().mockReturnValue(makeSimResult()),
  computeLevelUp: jest.fn().mockReturnValue({ newLevel: 1, newExp: 864, leveledUp: false }),
  computePowerScore: jest.fn().mockReturnValue(500),
};

function makeProgress(currentZone: number, currentRoom: number, highestZone = 0) {
  return { id: 'sp-1', playerId: 'player-1', currentZone, currentRoom, highestZone };
}

describe('StagesService', () => {
  let service: StagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StagesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CombatService, useValue: mockCombat },
        { provide: InventoryService, useValue: mockInventory },
        { provide: QuestService, useValue: mockQuests },
      ],
    }).compile();

    service = module.get<StagesService>(StagesService);
    jest.clearAllMocks();
  });

  // ── Zone catalogue ──────────────────────────────────────────────────────────

  describe('listZoneSummaries', () => {
    it('returns exactly TOTAL_ZONES summaries', () => {
      const list = service.listZoneSummaries();
      expect(list).toHaveLength(TOTAL_ZONES);
    });

    it('first summary is zone 1 with static name', () => {
      const [first] = service.listZoneSummaries();
      expect(first.zone).toBe(1);
      expect(first.name).toBe('Shattered Approach');
    });

    it('last summary is zone 100 with generated name', () => {
      const list = service.listZoneSummaries();
      const last = list[TOTAL_ZONES - 1];
      expect(last.zone).toBe(100);
      expect(last.name).toContain('100');
    });
  });

  describe('getZone', () => {
    it('returns static data for zones 1–10', () => {
      const zone = service.getZone(1);
      expect(zone.zone).toBe(1);
      expect(zone.name).toBe('Shattered Approach');
      expect(zone.rooms).toHaveLength(ROOMS_PER_ZONE_COUNT);
    });

    it('room 10 is always BOSS type', () => {
      const zone = service.getZone(1);
      const boss = zone.rooms.find((r) => r.room === 10);
      expect(boss?.type).toBe(RoomType.BOSS);
    });

    it('room 5 is ELITE type', () => {
      const zone = service.getZone(1);
      const elite = zone.rooms.find((r) => r.room === 5);
      expect(elite?.type).toBe(RoomType.ELITE);
    });

    it('boss room grants more gold than normal rooms', () => {
      const zone = service.getZone(1);
      const boss = zone.rooms.find((r) => r.room === 10)!;
      const normal = zone.rooms.find((r) => r.room === 1)!;
      expect(boss.clearGoldBonus).toBeGreaterThan(normal.clearGoldBonus);
    });

    it('generates summary data for zones beyond static set (zone 50)', () => {
      const zone = service.getZone(50);
      expect(zone.zone).toBe(50);
      expect(zone.name).toContain('50');
    });

    it('throws NotFoundException for zone 0', () => {
      expect(() => service.getZone(0)).toThrow(NotFoundException);
    });

    it('throws NotFoundException for zone > 100', () => {
      expect(() => service.getZone(101)).toThrow(NotFoundException);
    });

    it('minLevel scales with zone number', () => {
      const z1 = service.getZone(1);
      const z10 = service.getZone(10);
      expect(z10.minLevel).toBeGreaterThan(z1.minLevel);
    });
  });

  // ── Player progression ──────────────────────────────────────────────────────

  describe('getPlayerProgress', () => {
    it('throws NotFoundException when progress row is missing', async () => {
      mockPrisma.stageProgress.findUnique.mockResolvedValue(null);
      await expect(service.getPlayerProgress('player-1')).rejects.toThrow(NotFoundException);
    });

    it('returns correct zone info for current zone', async () => {
      mockPrisma.stageProgress.findUnique.mockResolvedValue(makeProgress(3, 4, 2));
      const result = await service.getPlayerProgress('player-1');
      expect(result.currentZone).toBe(3);
      expect(result.currentRoom).toBe(4);
      expect(result.zoneInfo.name).toBe('Ember Ruins');
    });
  });

  describe('advanceRoom (real combat)', () => {
    const makePlayer = (level = 5) => ({
      id: 'player-1', level, class: 'VOIDBLADE', experience: BigInt(0),
    });

    beforeEach(() => {
      mockCombat.computePlayerStats.mockReturnValue(fakeCombatStats);
      mockCombat.simulateRoom.mockReturnValue(makeSimResult());
      mockCombat.computeLevelUp.mockReturnValue({ newLevel: 1, newExp: 864, leveledUp: false });
      mockCombat.computePowerScore.mockReturnValue(500);
      mockPrisma.$transaction.mockResolvedValue([]);
      mockInventory.getEquippedBonuses.mockResolvedValue({ atkBonus: 0, defBonus: 0, hpBonus: 0 });
      mockInventory.rollDrop.mockResolvedValue({ dropped: false, item: null });
      mockQuests.updateBattleProgress.mockResolvedValue(undefined);
    });

    it('returns victory=true and increments room on win', async () => {
      mockPrisma.stageProgress.findUnique.mockResolvedValue(makeProgress(1, 3));
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer());

      const result = await service.advanceRoom('player-1');

      expect(result.victory).toBe(true);
      expect(result.newZone).toBe(1);
      expect(result.newRoom).toBe(4);
      expect(result.zoneCleared).toBe(false);
    });

    it('advances to zone 2 room 1 after clearing zone 1 room 10', async () => {
      mockPrisma.stageProgress.findUnique.mockResolvedValue(makeProgress(1, 10, 0));
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer());

      const result = await service.advanceRoom('player-1');

      expect(result.newZone).toBe(2);
      expect(result.newRoom).toBe(1);
      expect(result.zoneCleared).toBe(true);
    });

    it('returns gold and exp earned from simulation', async () => {
      mockPrisma.stageProgress.findUnique.mockResolvedValue(makeProgress(1, 1));
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer());

      const result = await service.advanceRoom('player-1');

      expect(result.goldEarned).toBe(780);
      expect(result.expEarned).toBe(864);
    });

    it('does not advance room on defeat', async () => {
      mockCombat.simulateRoom.mockReturnValue(makeSimResult({ victory: false, goldEarned: 0 }));
      mockPrisma.stageProgress.findUnique.mockResolvedValue(makeProgress(1, 3));
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer());

      const result = await service.advanceRoom('player-1');

      expect(result.victory).toBe(false);
      expect(result.newRoom).toBe(3);
    });

    it('leveledUp flag is passed through from CombatService', async () => {
      mockCombat.computeLevelUp.mockReturnValue({ newLevel: 2, newExp: 0, leveledUp: true });
      mockPrisma.stageProgress.findUnique.mockResolvedValue(makeProgress(1, 1));
      mockPrisma.player.findUnique.mockResolvedValue(makePlayer());

      const result = await service.advanceRoom('player-1');

      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
    });

    it('throws NotFoundException when progress or player is missing', async () => {
      mockPrisma.stageProgress.findUnique.mockResolvedValue(null);
      mockPrisma.player.findUnique.mockResolvedValue(null);
      await expect(service.advanceRoom('player-1')).rejects.toThrow(NotFoundException);
    });
  });
});
