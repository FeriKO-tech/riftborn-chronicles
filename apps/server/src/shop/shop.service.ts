import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  OfferStateDto,
  ShopCatalogDto,
  ShopFreePackResponseDto,
  ShopOfferDto,
  ShopPurchaseResponseDto,
  ShopRewardDto,
  ShopStateDto,
} from '@riftborn/shared';
import { ItemRarity } from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ITEM_TEMPLATE_LIST } from '../inventory/data/items.data';
import {
  FREE_PACK_OFFER_ID,
  SHOP_CATALOG,
  SHOP_CATALOG_MAP,
} from './data/shop-catalog.data';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickRandomItem(minRarity: ItemRarity): string {
  const pool = ITEM_TEMPLATE_LIST.filter((t) => {
    const order = [
      ItemRarity.COMMON,
      ItemRarity.UNCOMMON,
      ItemRarity.RARE,
      ItemRarity.EPIC,
      ItemRarity.LEGENDARY,
    ];
    return order.indexOf(t.rarity as ItemRarity) >= order.indexOf(minRarity);
  });
  const bucket = pool.length > 0 ? pool : ITEM_TEMPLATE_LIST;
  return bucket[Math.floor(Math.random() * bucket.length)].id;
}

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  // ── Catalog ────────────────────────────────────────────────────────────────

  getCatalog(): ShopCatalogDto {
    return { offers: SHOP_CATALOG as ShopOfferDto[] };
  }

  // ── State ──────────────────────────────────────────────────────────────────

  async getState(playerId: string): Promise<ShopStateDto> {
    const periodKey = todayKey();
    const records = await this.prisma.playerShopPurchase.findMany({
      where: { playerId, periodKey },
    });
    const recordMap = new Map(records.map((r) => [r.offerId, r.count]));

    const offerStates: OfferStateDto[] = SHOP_CATALOG.map((offer) => {
      const purchased = recordMap.get(offer.id) ?? 0;
      const canPurchase =
        offer.dailyLimit === null ? true : purchased < offer.dailyLimit;
      return {
        offerId: offer.id,
        purchasedToday: purchased,
        dailyLimit: offer.dailyLimit,
        canPurchase,
      };
    });

    const freePackRecord = recordMap.get(FREE_PACK_OFFER_ID) ?? 0;
    return { periodKey, offerStates, freePackClaimed: freePackRecord >= 1 };
  }

  // ── Purchase ───────────────────────────────────────────────────────────────

  async purchase(
    playerId: string,
    offerId: string,
  ): Promise<ShopPurchaseResponseDto> {
    const offer = SHOP_CATALOG_MAP.get(offerId);
    if (!offer) throw new NotFoundException(`Offer '${offerId}' not found`);
    if (offer.isFree) {
      throw new BadRequestException('Use claim-daily-free for free pack');
    }

    const periodKey = todayKey();

    const [currencies, existingRecord] = await Promise.all([
      this.prisma.playerCurrencies.findUnique({ where: { playerId } }),
      offer.dailyLimit !== null
        ? this.prisma.playerShopPurchase.findUnique({
            where: { playerId_offerId_periodKey: { playerId, offerId, periodKey } },
          })
        : Promise.resolve(null),
    ]);

    if (!currencies) throw new NotFoundException('Player currencies not found');

    // ── Daily limit check ───────────────────────────────────────────────────
    if (offer.dailyLimit !== null) {
      const usedToday = existingRecord?.count ?? 0;
      if (usedToday >= offer.dailyLimit) {
        throw new ForbiddenException(`Daily limit reached for offer '${offerId}'`);
      }
    }

    // ── Currency balance check ──────────────────────────────────────────────
    if (offer.currencyType === 'gold') {
      if (BigInt(currencies.goldShards) < BigInt(offer.cost)) {
        throw new BadRequestException('Not enough Gold');
      }
    } else {
      if (currencies.voidCrystals < offer.cost) {
        throw new BadRequestException('Not enough Diamonds');
      }
    }

    // ── Resolve item rewards before transaction ─────────────────────────────
    const resolvedRewards = this.resolveRewards(offer.rewards);

    // ── Transactional: deduct currency + track purchase ─────────────────────
    await this.prisma.$transaction(async (tx) => {
      if (offer.currencyType === 'gold') {
        await tx.playerCurrencies.update({
          where: { playerId },
          data: { goldShards: { decrement: BigInt(offer.cost) } },
        });
      } else {
        await tx.playerCurrencies.update({
          where: { playerId },
          data: { voidCrystals: { decrement: offer.cost } },
        });
      }

      if (offer.dailyLimit !== null) {
        await tx.playerShopPurchase.upsert({
          where: { playerId_offerId_periodKey: { playerId, offerId, periodKey } },
          create: { playerId, offerId, periodKey, count: 1 },
          update: { count: { increment: 1 } },
        });
      }
    });

    // ── Grant rewards (outside tx — item creation is idempotent-ish) ────────
    await this.grantRewards(playerId, resolvedRewards);

    const freshCurrencies = await this.prisma.playerCurrencies.findUniqueOrThrow({
      where: { playerId },
    });
    const newPurchaseCount = (existingRecord?.count ?? 0) + 1;

    return {
      offerId,
      rewards: resolvedRewards,
      newGoldBalance: Number(freshCurrencies.goldShards),
      newDiamondBalance: freshCurrencies.voidCrystals,
      offerState: {
        offerId,
        purchasedToday: newPurchaseCount,
        dailyLimit: offer.dailyLimit,
        canPurchase:
          offer.dailyLimit === null ? true : newPurchaseCount < offer.dailyLimit,
      },
    };
  }

  // ── Claim free daily pack ──────────────────────────────────────────────────

  async claimFreePack(playerId: string): Promise<ShopFreePackResponseDto> {
    const offer = SHOP_CATALOG_MAP.get(FREE_PACK_OFFER_ID)!;
    const periodKey = todayKey();

    const existing = await this.prisma.playerShopPurchase.findUnique({
      where: {
        playerId_offerId_periodKey: {
          playerId,
          offerId: FREE_PACK_OFFER_ID,
          periodKey,
        },
      },
    });

    if (existing && existing.count >= 1) {
      throw new ForbiddenException('Free daily pack already claimed today');
    }

    await this.prisma.playerShopPurchase.upsert({
      where: {
        playerId_offerId_periodKey: {
          playerId,
          offerId: FREE_PACK_OFFER_ID,
          periodKey,
        },
      },
      create: { playerId, offerId: FREE_PACK_OFFER_ID, periodKey, count: 1 },
      update: { count: 1 },
    });

    await this.grantRewards(playerId, offer.rewards);

    const currencies = await this.prisma.playerCurrencies.findUniqueOrThrow({
      where: { playerId },
    });

    return {
      rewards: offer.rewards,
      newGoldBalance: Number(currencies.goldShards),
      newDiamondBalance: currencies.voidCrystals,
      freePackClaimed: true,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveRewards(rewards: ShopRewardDto[]): ShopRewardDto[] {
    return rewards.map((r) => {
      if (r.kind !== 'item') return r;
      const tier = r.templateId === 'chest:rare' ? ItemRarity.RARE : ItemRarity.COMMON;
      const resolvedId = pickRandomItem(tier);
      return { ...r, templateId: resolvedId };
    });
  }

  private async grantRewards(
    playerId: string,
    rewards: ShopRewardDto[],
  ): Promise<void> {
    const currencyDelta: Record<string, number | bigint> = {};
    const itemTemplates: string[] = [];

    for (const r of rewards) {
      switch (r.kind) {
        case 'gold':
          currencyDelta['goldShards'] =
            BigInt(currencyDelta['goldShards'] ?? 0) + BigInt(r.amount ?? 0);
          break;
        case 'diamond':
          currencyDelta['voidCrystals'] =
            (Number(currencyDelta['voidCrystals'] ?? 0)) + (r.amount ?? 0);
          break;
        case 'forgeDust':
          currencyDelta['forgeDust'] =
            (Number(currencyDelta['forgeDust'] ?? 0)) + (r.amount ?? 0);
          break;
        case 'echoShards':
          currencyDelta['echoShards'] =
            (Number(currencyDelta['echoShards'] ?? 0)) + (r.amount ?? 0);
          break;
        case 'bossSeals':
          currencyDelta['bossSeals'] =
            (Number(currencyDelta['bossSeals'] ?? 0)) + (r.amount ?? 0);
          break;
        case 'item':
          if (r.templateId) itemTemplates.push(r.templateId);
          break;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (currencyDelta['goldShards'])
      updateData['goldShards'] = { increment: currencyDelta['goldShards'] };
    if (currencyDelta['voidCrystals'])
      updateData['voidCrystals'] = { increment: currencyDelta['voidCrystals'] };
    if (currencyDelta['forgeDust'])
      updateData['forgeDust'] = { increment: currencyDelta['forgeDust'] };
    if (currencyDelta['echoShards'])
      updateData['echoShards'] = { increment: currencyDelta['echoShards'] };
    if (currencyDelta['bossSeals'])
      updateData['bossSeals'] = { increment: currencyDelta['bossSeals'] };

    if (Object.keys(updateData).length > 0) {
      await this.prisma.playerCurrencies.update({
        where: { playerId },
        data: updateData,
      });
    }

    for (const templateId of itemTemplates) {
      await this.inventory.grantItem(playerId, templateId);
    }
  }
}
