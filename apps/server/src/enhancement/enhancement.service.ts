import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EnhanceItemResponseDto, EnhancementCostDto, EnhancementInfoDto } from '@riftborn/shared';
import { QuestType } from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { QuestService } from '../quests/quest.service';

const MAX_ENHANCEMENT_LEVEL = 10;
// Cost per level: resonanceCores = level×100, forgeDust = level×150
const COST_CORES_PER_LEVEL = 100;
const COST_DUST_PER_LEVEL = 150;
// Each level: +5% to base item stats (multiplicative)
const STAT_MULT_PER_LEVEL = 0.05;

@Injectable()
export class EnhancementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly quests: QuestService,
  ) {}

  // ── Get enhancement info for an item ─────────────────────────────────────

  async getEnhancementInfo(playerId: string, itemId: string): Promise<EnhancementInfoDto> {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item || item.playerId !== playerId) throw new NotFoundException('Item not found');

    const isMaxLevel = item.enhancementLevel >= MAX_ENHANCEMENT_LEVEL;
    return {
      currentLevel: item.enhancementLevel,
      maxLevel: MAX_ENHANCEMENT_LEVEL,
      cost: isMaxLevel ? null : this.computeCost(item.enhancementLevel + 1),
      statMultiplier: 1 + item.enhancementLevel * STAT_MULT_PER_LEVEL,
      isMaxLevel,
    };
  }

  // ── Upgrade item enhancement level ───────────────────────────────────────

  async upgradeItem(playerId: string, itemId: string): Promise<EnhanceItemResponseDto> {
    const [item, player, currencies] = await Promise.all([
      this.prisma.inventoryItem.findUnique({ where: { id: itemId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
      this.prisma.playerCurrencies.findUnique({ where: { playerId } }),
    ]);

    if (!item || item.playerId !== playerId) throw new NotFoundException('Item not found');
    if (!player) throw new NotFoundException('Player not found');
    if (!currencies) throw new NotFoundException('Currencies not found');
    if (item.enhancementLevel >= MAX_ENHANCEMENT_LEVEL) {
      throw new BadRequestException(`Item is already at max enhancement level (${MAX_ENHANCEMENT_LEVEL})`);
    }

    const nextLevel = item.enhancementLevel + 1;
    const cost = this.computeCost(nextLevel);

    if (currencies.resonanceCores < cost.resonanceCores) {
      throw new BadRequestException(
        `Insufficient Resonance Cores. Need ${cost.resonanceCores}, have ${currencies.resonanceCores}.`,
      );
    }
    if (currencies.forgeDust < cost.forgeDust) {
      throw new BadRequestException(
        `Insufficient Forge Dust. Need ${cost.forgeDust}, have ${currencies.forgeDust}.`,
      );
    }

    // Apply enhancement in transaction
    const [updatedItem, updatedCurrencies] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({
        where: { id: itemId },
        data: { enhancementLevel: nextLevel },
      }),
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: {
          resonanceCores: { decrement: cost.resonanceCores },
          forgeDust: { decrement: cost.forgeDust },
        },
      }),
    ]);

    // Recalculate enhanced stat values (for response)
    const newMult = 1 + nextLevel * STAT_MULT_PER_LEVEL;
    const newAtkBonus = Math.floor(item.atkBonus * newMult);
    const newDefBonus = Math.floor(item.defBonus * newMult);
    const newHpBonus = Math.floor(item.hpBonus * newMult);

    // Recalculate and persist power score
    const newPowerScore = await this.inventory.recalcAndPersistPowerScore(
      playerId,
      player.level,
      player.class,
    );

    // Track quest (non-critical)
    this.quests.trackSingleEvent(playerId, QuestType.ENHANCE_ITEM).catch(() => undefined);

    return {
      itemId,
      newEnhancementLevel: nextLevel,
      newAtkBonus,
      newDefBonus,
      newHpBonus,
      cost,
      newPowerScore,
      newResonanceCores: updatedCurrencies.resonanceCores,
      newForgeDust: updatedCurrencies.forgeDust,
    };
  }

  // ── Pure helper ───────────────────────────────────────────────────────────

  computeCost(level: number): EnhancementCostDto {
    return {
      resonanceCores: level * COST_CORES_PER_LEVEL,
      forgeDust: level * COST_DUST_PER_LEVEL,
    };
  }
}
