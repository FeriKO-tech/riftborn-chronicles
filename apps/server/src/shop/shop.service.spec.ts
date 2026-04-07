import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ShopService } from './shop.service';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { SHOP_CATALOG } from './data/shop-catalog.data';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  playerShopPurchase: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  playerCurrencies: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockInventory = {
  grantItem: jest.fn(),
};

// ── Stubs ────────────────────────────────────────────────────────────────────

const PLAYER_ID = 'player-uuid-1';
const TODAY = new Date().toISOString().slice(0, 10);

const richCurrencies = {
  goldShards: BigInt(100_000),
  voidCrystals: 500,
  forgeDust: 0,
  echoShards: 0,
  bossSeals: 0,
};

const brokeCurrencies = {
  goldShards: BigInt(10),
  voidCrystals: 0,
  forgeDust: 0,
  echoShards: 0,
  bossSeals: 0,
};

// ── Suite ────────────────────────────────────────────────────────────────────

describe('ShopService', () => {
  let service: ShopService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();

    service = module.get<ShopService>(ShopService);
    jest.clearAllMocks();

    // Default happy-path setup
    mockPrisma.playerShopPurchase.findMany.mockResolvedValue([]);
    mockPrisma.playerShopPurchase.findUnique.mockResolvedValue(null);
    mockPrisma.playerShopPurchase.upsert.mockResolvedValue({});
    mockPrisma.playerCurrencies.findUnique.mockResolvedValue(richCurrencies);
    mockPrisma.playerCurrencies.findUniqueOrThrow.mockResolvedValue(richCurrencies);
    mockPrisma.playerCurrencies.update.mockResolvedValue(richCurrencies);
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
    mockInventory.grantItem.mockResolvedValue({});
  });

  // ── getCatalog ─────────────────────────────────────────────────────────────

  describe('getCatalog', () => {
    it('returns all offers from the static catalog', () => {
      const result = service.getCatalog();
      expect(result.offers).toHaveLength(SHOP_CATALOG.length);
      expect(result.offers.every((o) => o.id && o.name && o.rewards)).toBe(true);
    });

    it('includes offers in gold, diamond, and daily sections', () => {
      const { offers } = service.getCatalog();
      expect(offers.some((o) => o.section === 'gold')).toBe(true);
      expect(offers.some((o) => o.section === 'diamond')).toBe(true);
      expect(offers.some((o) => o.section === 'daily')).toBe(true);
    });

    it('has exactly one free offer', () => {
      const { offers } = service.getCatalog();
      const freeOffers = offers.filter((o) => o.isFree);
      expect(freeOffers).toHaveLength(1);
      expect(freeOffers[0].cost).toBe(0);
    });
  });

  // ── getState ───────────────────────────────────────────────────────────────

  describe('getState', () => {
    it('returns canPurchase:true for all offers when no purchases exist', async () => {
      const state = await service.getState(PLAYER_ID);
      expect(state.freePackClaimed).toBe(false);
      expect(state.periodKey).toBe(TODAY);
      state.offerStates.forEach((s) => {
        expect(s.canPurchase).toBe(true);
        expect(s.purchasedToday).toBe(0);
      });
    });

    it('marks free pack as claimed when count >= 1', async () => {
      mockPrisma.playerShopPurchase.findMany.mockResolvedValue([
        { offerId: 'free-daily-pack', count: 1 },
      ]);
      const state = await service.getState(PLAYER_ID);
      expect(state.freePackClaimed).toBe(true);
      const freeState = state.offerStates.find((s) => s.offerId === 'free-daily-pack');
      expect(freeState?.canPurchase).toBe(false);
    });

    it('sets canPurchase:false when daily limit is reached', async () => {
      mockPrisma.playerShopPurchase.findMany.mockResolvedValue([
        { offerId: 'daily-forge-deal', count: 2 }, // dailyLimit = 2
      ]);
      const state = await service.getState(PLAYER_ID);
      const offerState = state.offerStates.find((s) => s.offerId === 'daily-forge-deal');
      expect(offerState?.purchasedToday).toBe(2);
      expect(offerState?.canPurchase).toBe(false);
    });

    it('sets canPurchase:true for unlimited offers regardless of count', async () => {
      const state = await service.getState(PLAYER_ID);
      const unlimitedOffers = state.offerStates.filter((s) => s.dailyLimit === null);
      unlimitedOffers.forEach((s) => expect(s.canPurchase).toBe(true));
    });
  });

  // ── purchase ───────────────────────────────────────────────────────────────

  describe('purchase', () => {
    it('throws NotFoundException for unknown offerId', async () => {
      await expect(service.purchase(PLAYER_ID, 'not-a-real-offer')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects direct purchase of the free offer via purchase()', async () => {
      await expect(service.purchase(PLAYER_ID, 'free-daily-pack')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if player has no currencies row', async () => {
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(null);
      await expect(service.purchase(PLAYER_ID, 'gold-mat-s')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when daily limit already reached', async () => {
      mockPrisma.playerShopPurchase.findUnique.mockResolvedValue({ count: 2 });
      await expect(service.purchase(PLAYER_ID, 'daily-forge-deal')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when gold is insufficient', async () => {
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(brokeCurrencies);
      await expect(service.purchase(PLAYER_ID, 'gold-mat-s')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when diamonds are insufficient', async () => {
      mockPrisma.playerCurrencies.findUnique.mockResolvedValue(brokeCurrencies);
      await expect(service.purchase(PLAYER_ID, 'dia-rare-chest')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deducts gold for a gold offer inside a transaction', async () => {
      const goldOffer = SHOP_CATALOG.find((o) => o.id === 'gold-mat-s')!;
      await service.purchase(PLAYER_ID, 'gold-mat-s');
      expect(mockPrisma.playerCurrencies.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: PLAYER_ID },
          data: { goldShards: { decrement: BigInt(goldOffer.cost) } },
        }),
      );
    });

    it('deducts diamonds for a diamond offer inside a transaction', async () => {
      const diaOffer = SHOP_CATALOG.find((o) => o.id === 'dia-gold-m')!;
      await service.purchase(PLAYER_ID, 'dia-gold-m');
      expect(mockPrisma.playerCurrencies.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: PLAYER_ID },
          data: { voidCrystals: { decrement: diaOffer.cost } },
        }),
      );
    });

    it('upserts a purchase record for daily-limited offers', async () => {
      await service.purchase(PLAYER_ID, 'daily-forge-deal');
      expect(mockPrisma.playerShopPurchase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            playerId_offerId_periodKey: {
              playerId: PLAYER_ID,
              offerId: 'daily-forge-deal',
              periodKey: TODAY,
            },
          },
          create: expect.objectContaining({ count: 1 }),
          update: { count: { increment: 1 } },
        }),
      );
    });

    it('does NOT upsert a record for unlimited gold offers', async () => {
      await service.purchase(PLAYER_ID, 'gold-mat-s'); // dailyLimit: null
      expect(mockPrisma.playerShopPurchase.upsert).not.toHaveBeenCalled();
    });

    it('grants currency rewards after purchase', async () => {
      await service.purchase(PLAYER_ID, 'dia-gold-m'); // rewards: +25000 gold
      expect(mockPrisma.playerCurrencies.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: PLAYER_ID },
          data: expect.objectContaining({ goldShards: { increment: BigInt(25000) } }),
        }),
      );
    });

    it('grants forge dust currency reward', async () => {
      await service.purchase(PLAYER_ID, 'gold-mat-s'); // rewards: +15 forgeDust
      expect(mockPrisma.playerCurrencies.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ forgeDust: { increment: 15 } }),
        }),
      );
    });

    it('calls inventory.grantItem for chest offers', async () => {
      await service.purchase(PLAYER_ID, 'gold-chest-basic');
      expect(mockInventory.grantItem).toHaveBeenCalledWith(
        PLAYER_ID,
        expect.any(String), // resolved template ID
      );
    });

    it('returns the correct offerState in the response', async () => {
      const result = await service.purchase(PLAYER_ID, 'gold-mat-s');
      expect(result.offerId).toBe('gold-mat-s');
      expect(result.rewards.length).toBeGreaterThan(0);
      expect(result.offerState.offerId).toBe('gold-mat-s');
      expect(typeof result.newGoldBalance).toBe('number');
      expect(typeof result.newDiamondBalance).toBe('number');
    });

    it('allows purchasing an unlimited offer multiple times', async () => {
      await service.purchase(PLAYER_ID, 'gold-mat-s');
      await service.purchase(PLAYER_ID, 'gold-mat-s');
      expect(mockPrisma.playerShopPurchase.upsert).not.toHaveBeenCalled();
    });
  });

  // ── claimFreePack ──────────────────────────────────────────────────────────

  describe('claimFreePack', () => {
    it('throws ForbiddenException if already claimed today', async () => {
      mockPrisma.playerShopPurchase.findUnique.mockResolvedValue({ count: 1 });
      await expect(service.claimFreePack(PLAYER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('does not throw when pack has not been claimed', async () => {
      mockPrisma.playerShopPurchase.findUnique.mockResolvedValue(null);
      await expect(service.claimFreePack(PLAYER_ID)).resolves.not.toThrow();
    });

    it('marks the pack as claimed with upsert', async () => {
      await service.claimFreePack(PLAYER_ID);
      expect(mockPrisma.playerShopPurchase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            playerId_offerId_periodKey: {
              playerId: PLAYER_ID,
              offerId: 'free-daily-pack',
              periodKey: TODAY,
            },
          },
          create: expect.objectContaining({ count: 1 }),
          update: { count: 1 },
        }),
      );
    });

    it('grants gold and forgeDust from the free pack rewards', async () => {
      await service.claimFreePack(PLAYER_ID);
      expect(mockPrisma.playerCurrencies.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            goldShards: { increment: BigInt(1000) },
            forgeDust: { increment: 5 },
          }),
        }),
      );
    });

    it('returns freePackClaimed: true in the response', async () => {
      const result = await service.claimFreePack(PLAYER_ID);
      expect(result.freePackClaimed).toBe(true);
      expect(result.rewards.length).toBeGreaterThan(0);
    });
  });
});
