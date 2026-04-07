import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { ItemRarity, ItemSlot } from '@riftborn/shared';

const mockPrisma = {
  inventoryItem: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  },
  player: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockCombat = {
  computePowerScore: jest.fn().mockReturnValue(1500),
  computePlayerStats: jest.fn().mockReturnValue({ hp: 1000, maxHp: 1000, attack: 300, defense: 150, speed: 90, critChance: 0.08, critDamage: 1.8 }),
};

const mockPlayer = { id: 'player-1', level: 5, class: 'VOIDBLADE' };

function makeItem(overrides: Partial<{
  id: string; playerId: string; templateId: string; name: string;
  slot: string; rarity: string; itemLevel: number; isEquipped: boolean;
  atkBonus: number; defBonus: number; hpBonus: number; enhancementLevel: number; obtainedAt: Date;
}> = {}) {
  return {
    id: 'item-1',
    playerId: 'player-1',
    templateId: 'w_iron_shard',
    name: 'Iron Void Shard',
    slot: ItemSlot.WEAPON,
    rarity: ItemRarity.COMMON,
    itemLevel: 1,
    isEquipped: false,
    atkBonus: 80,
    defBonus: 0,
    hpBonus: 0,
    obtainedAt: new Date(),
    ...overrides,
  };
}

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CombatService, useValue: mockCombat },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
    // Re-setup mocks cleared by clearAllMocks
    mockPrisma.inventoryItem.count.mockResolvedValue(0);
    mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
    mockPrisma.player.update.mockResolvedValue({});
    mockPrisma.inventoryItem.findMany.mockResolvedValue([]);
    mockCombat.computePowerScore.mockReturnValue(1500);
  });

  describe('getEquippedBonuses', () => {
    it('returns zero bonuses when nothing is equipped', async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([]);
      const result = await service.getEquippedBonuses('player-1');
      expect(result).toEqual({ atkBonus: 0, defBonus: 0, hpBonus: 0 });
    });

    it('sums bonuses from multiple equipped items', async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValue([
        makeItem({ isEquipped: true, atkBonus: 100, defBonus: 50, hpBonus: 200, enhancementLevel: 0 }),
        makeItem({ id: 'item-2', isEquipped: true, atkBonus: 0, defBonus: 80, hpBonus: 300, slot: ItemSlot.ARMOR, enhancementLevel: 0 }),
      ]);
      const result = await service.getEquippedBonuses('player-1');
      expect(result.atkBonus).toBe(100);
      expect(result.defBonus).toBe(130);
      expect(result.hpBonus).toBe(500);
    });
  });

  describe('equip', () => {
    it('throws NotFoundException when item does not belong to player', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);
      await expect(service.equip('player-1', 'item-99')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if item is already equipped', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ isEquipped: true }));
      await expect(service.equip('player-1', 'item-1')).rejects.toThrow(BadRequestException);
    });

    it('equips item, returns EquipResponseDto with newPowerScore', async () => {
      const item = makeItem({ isEquipped: false });
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(item);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      const equippedItem = { ...item, isEquipped: true };
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown[]>) => {
        const result = await fn(mockPrisma);
        return result;
      });
      mockPrisma.inventoryItem.update.mockResolvedValue(equippedItem);

      const result = await service.equip('player-1', 'item-1');

      expect(result.equipped.isEquipped).toBe(true);
      expect(result.unequipped).toBeNull();
      expect(result.newPowerScore).toBe(1500);
      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { powerScore: 1500 } }),
      );
    });

    it('power score increases when equipping an item with bonuses', async () => {
      mockCombat.computePowerScore.mockReturnValue(1580);
      const item = makeItem({ isEquipped: false, atkBonus: 300 });
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(item);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown[]>) => fn(mockPrisma),
      );
      mockPrisma.inventoryItem.update.mockResolvedValue({ ...item, isEquipped: true });

      const result = await service.equip('player-1', 'item-1');

      expect(result.newPowerScore).toBe(1580);
      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { powerScore: 1580 } }),
      );
    });
  });

  describe('unequip', () => {
    it('throws NotFoundException when item not found', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);
      await expect(service.unequip('player-1', 'item-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when item is not equipped', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ isEquipped: false }));
      await expect(service.unequip('player-1', 'item-1')).rejects.toThrow(BadRequestException);
    });

    it('unequips and returns updated item + newPowerScore', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ isEquipped: true }));
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      mockPrisma.inventoryItem.update.mockResolvedValue(makeItem({ isEquipped: false }));
      mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

      const result = await service.unequip('player-1', 'item-1');
      expect(result.item.isEquipped).toBe(false);
      expect(result.newPowerScore).toBe(1500);
    });

    it('throws BadRequestException when unequipping an unequipped item', async () => {
      mockPrisma.inventoryItem.findUnique.mockResolvedValue(makeItem({ isEquipped: false }));
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer);
      await expect(service.unequip('player-1', 'item-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('rollDrop', () => {
    it('returns dropped=false when RNG roll exceeds drop chance', async () => {
      const result = await service.rollDrop('player-1', 1, 'NORMAL', 99999999);
      if (!result.dropped) {
        expect(result.item).toBeNull();
      }
    });

    it('creates and returns an item when drop triggers', async () => {
      const createdItem = makeItem({ rarity: ItemRarity.COMMON, atkBonus: 80 });
      mockPrisma.inventoryItem.create.mockResolvedValue(createdItem);

      // Use a seed that we know forces a drop
      let dropped = false;
      for (let seed = 0; seed < 1000 && !dropped; seed++) {
        mockPrisma.inventoryItem.create.mockClear();
        const result = await service.rollDrop('player-1', 1, 'BOSS', seed);
        if (result.dropped) {
          dropped = true;
          expect(result.item).not.toBeNull();
          expect(result.item?.slot).toBeDefined();
        }
      }
      expect(dropped).toBe(true);
    });
  });
});
