import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemRarity, ItemSlot } from '@riftborn/shared';
import type {
  EquipmentBonusDto,
  EquipResponseDto,
  InventoryItemDto,
  ItemDropDto,
  UnequipResponseDto,
  SalvageResponseDto,
  EnchantItemResponseDto,
} from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { getCompanionBonus } from '../companions/data/companions.data';
import {
  DROP_CHANCE,
  getRarityWeights,
  ITEM_TEMPLATE_LIST,
  ITEM_TEMPLATES,
} from './data/items.data';

const INVENTORY_CAP = 50;

const SALVAGE_GOLD: Record<string, number> = {
  [ItemRarity.COMMON]: 15,
  [ItemRarity.UNCOMMON]: 35,
  [ItemRarity.RARE]: 80,
  [ItemRarity.EPIC]: 200,
  [ItemRarity.LEGENDARY]: 500,
};

const SALVAGE_STONES: Record<string, number> = {
  [ItemRarity.COMMON]: 1,
  [ItemRarity.UNCOMMON]: 2,
  [ItemRarity.RARE]: 4,
  [ItemRarity.EPIC]: 8,
  [ItemRarity.LEGENDARY]: 15,
};

const ENCHANT_STONE_COST = (level: number) => Math.max(2, Math.floor(2 + level * 1.5));

const RARITY_MULTIPLIER: Record<string, number> = {
  [ItemRarity.COMMON]: 1.0,
  [ItemRarity.UNCOMMON]: 1.4,
  [ItemRarity.RARE]: 2.0,
  [ItemRarity.EPIC]: 3.0,
  [ItemRarity.LEGENDARY]: 5.0,
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly combat: CombatService,
  ) {}

  // ── List inventory ─────────────────────────────────────────────────────────

  async getInventory(playerId: string): Promise<InventoryItemDto[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { playerId },
      orderBy: [{ isEquipped: 'desc' }, { obtainedAt: 'desc' }],
    });
    return items.map(this.toDto);
  }

  async getEquippedBonuses(playerId: string): Promise<EquipmentBonusDto> {
    const equipped = await this.prisma.inventoryItem.findMany({
      where: { playerId, isEquipped: true },
      select: { atkBonus: true, defBonus: true, hpBonus: true, enhancementLevel: true },
    });
    return equipped.reduce<EquipmentBonusDto>(
      (acc, item) => {
        // Enhancement multiplier: +5% per level
        const mult = 1 + item.enhancementLevel * 0.05;
        return {
          atkBonus: acc.atkBonus + Math.floor(item.atkBonus * mult),
          defBonus: acc.defBonus + Math.floor(item.defBonus * mult),
          hpBonus: acc.hpBonus + Math.floor(item.hpBonus * mult),
        };
      },
      { atkBonus: 0, defBonus: 0, hpBonus: 0 },
    );
  }

  // ── Equip / Unequip ────────────────────────────────────────────────────────

  async equip(playerId: string, itemId: string): Promise<EquipResponseDto> {
    const [item, player] = await Promise.all([
      this.prisma.inventoryItem.findUnique({ where: { id: itemId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
    ]);
    if (!item || item.playerId !== playerId) throw new NotFoundException('Item not found');
    if (!player) throw new NotFoundException('Player not found');
    if (item.isEquipped) throw new BadRequestException('Item is already equipped');

    const existing = await this.prisma.inventoryItem.findFirst({
      where: { playerId, slot: item.slot, isEquipped: true },
    });

    // Transfer enhancement from old item to new item (enchantment stays in slot)
    const transferLevel = existing ? existing.enhancementLevel : 0;

    const [equipped, unequipped] = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { isEquipped: false, enhancementLevel: 0 },
        });
      }
      const updated = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { isEquipped: true, enhancementLevel: transferLevel },
      });
      return [updated, existing ? { ...existing, isEquipped: false, enhancementLevel: 0 } : null];
    });

    const newPowerScore = await this.recalcAndPersistPowerScore(playerId, player.level, player.class);

    return {
      equipped: this.toDto(equipped),
      unequipped: unequipped ? this.toDto({ ...unequipped, isEquipped: false }) : null,
      newPowerScore,
    };
  }

  async unequip(playerId: string, itemId: string): Promise<UnequipResponseDto> {
    const [item, player] = await Promise.all([
      this.prisma.inventoryItem.findUnique({ where: { id: itemId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
    ]);
    if (!item || item.playerId !== playerId) throw new NotFoundException('Item not found');
    if (!player) throw new NotFoundException('Player not found');
    if (!item.isEquipped) throw new BadRequestException('Item is not equipped');

    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { isEquipped: false },
    });

    const newPowerScore = await this.recalcAndPersistPowerScore(playerId, player.level, player.class);

    return { item: this.toDto(updated), newPowerScore };
  }

  // ── Power score recalculation ─────────────────────────────────────────────

  async recalcAndPersistPowerScore(
    playerId: string,
    level: number,
    playerClass: string,
  ): Promise<number> {
    const [bonuses, player] = await Promise.all([
      this.getEquippedBonuses(playerId),
      this.prisma.player.findUnique({
        where: { id: playerId },
        select: { activeCompanionId: true },
      }),
    ]);
    // Look up companion level for scaled bonus
    let companionLevel = 1;
    if (player?.activeCompanionId) {
      const pc = await this.prisma.playerCompanion.findUnique({
        where: { playerId_templateId: { playerId, templateId: player.activeCompanionId } },
        select: { level: true },
      });
      companionLevel = pc?.level ?? 1;
    }
    const companionBonus = getCompanionBonus(player?.activeCompanionId, companionLevel);
    const newPowerScore = this.combat.computePowerScore(level, playerClass, bonuses, companionBonus);
    await this.prisma.player.update({
      where: { id: playerId },
      data: { powerScore: newPowerScore },
    });
    return newPowerScore;
  }

  // ── Salvage (smelt item into gold + enchant stones) ─────────────────────────

  async salvageItem(playerId: string, itemId: string): Promise<SalvageResponseDto> {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item || item.playerId !== playerId) throw new NotFoundException('Item not found');
    if (item.isEquipped) throw new BadRequestException('Cannot salvage equipped item');
    if (item.isLocked) throw new BadRequestException('Item is locked — unlock it first');

    const goldGained = (SALVAGE_GOLD[item.rarity] ?? 15) * Math.max(1, item.itemLevel);
    const stonesGained = SALVAGE_STONES[item.rarity] ?? 1;

    await this.prisma.$transaction([
      this.prisma.inventoryItem.delete({ where: { id: itemId } }),
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: {
          goldShards: { increment: BigInt(goldGained) },
          enchantStones: { increment: stonesGained },
        },
      }),
    ]);

    return { goldGained, stonesGained, deletedItemId: itemId };
  }

  // ── Toggle lock ──────────────────────────────────────────────────────────────

  async toggleLock(playerId: string, itemId: string): Promise<InventoryItemDto> {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item || item.playerId !== playerId) throw new NotFoundException('Item not found');
    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: { isLocked: !item.isLocked },
    });
    return this.toDto(updated);
  }

  // ── Enchant (use enchant stones to increase enhancement level) ──────────────

  async enchantItem(playerId: string, itemId: string): Promise<EnchantItemResponseDto> {
    const [item, player, currencies] = await Promise.all([
      this.prisma.inventoryItem.findUnique({ where: { id: itemId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
      this.prisma.playerCurrencies.findUnique({ where: { playerId } }),
    ]);
    if (!item || item.playerId !== playerId) throw new NotFoundException('Item not found');
    if (!player || !currencies) throw new NotFoundException('Player not found');
    if (!item.isEquipped) throw new BadRequestException('Only equipped items can be enchanted');

    const cost = ENCHANT_STONE_COST(item.enhancementLevel);
    if (currencies.enchantStones < cost) {
      throw new BadRequestException(`Need ${cost} enchant stones (have ${currencies.enchantStones})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({
        where: { id: itemId },
        data: { enhancementLevel: { increment: 1 } },
      }),
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: { enchantStones: { decrement: cost } },
      }),
    ]);

    const newPowerScore = await this.recalcAndPersistPowerScore(playerId, player.level, player.class);

    return { item: this.toDto(updated), stonesCost: cost, newPowerScore };
  }

  // ── Drop system ────────────────────────────────────────────────────────────

  async grantItem(
    playerId: string,
    templateId: string,
    rarity: ItemRarity = ItemRarity.COMMON,
    zone = 1,
  ): Promise<InventoryItemDto> {
    const count = await this.prisma.inventoryItem.count({ where: { playerId } });
    if (count >= INVENTORY_CAP) {
      throw new Error(`Inventory full (max ${INVENTORY_CAP} items)`);
    }
    const template = ITEM_TEMPLATES.get(templateId);
    if (!template) throw new Error(`Unknown item template: ${templateId}`);
    const mult = RARITY_MULTIPLIER[rarity] ?? 1.0;
    const lvScale = 1 + (zone - 1) * 0.15;
    const item = await this.prisma.inventoryItem.create({
      data: {
        playerId, templateId: template.id, name: template.name,
        slot: template.slot, rarity, itemLevel: Math.max(1, zone),
        atkBonus: Math.floor(template.baseAtk * mult * lvScale),
        defBonus: Math.floor(template.baseDef * mult * lvScale),
        hpBonus: Math.floor(template.baseHp * mult * lvScale),
      },
    });
    return this.toDto(item);
  }

  async rollDrop(
    playerId: string,
    zone: number,
    roomType: string,
    seed: number,
  ): Promise<ItemDropDto> {
    const count = await this.prisma.inventoryItem.count({ where: { playerId } });
    if (count >= INVENTORY_CAP) return { dropped: false, item: null };

    const dropChance = DROP_CHANCE[roomType] ?? 0.05;
    const rng = this.lcgRng(seed);

    if (rng() > dropChance) {
      return { dropped: false, item: null };
    }

    const rarity = this.weightedRarity(zone, rng());
    const template = this.pickTemplate(zone, rarity, rng());
    if (!template) return { dropped: false, item: null };

    const mult = RARITY_MULTIPLIER[rarity] ?? 1.0;
    const lvScale = 1 + (zone - 1) * 0.15;

    const item = await this.prisma.inventoryItem.create({
      data: {
        playerId,
        templateId: template.id,
        name: template.name,
        slot: template.slot,
        rarity,
        itemLevel: Math.max(1, zone),
        atkBonus: Math.floor(template.baseAtk * mult * lvScale),
        defBonus: Math.floor(template.baseDef * mult * lvScale),
        hpBonus: Math.floor(template.baseHp * mult * lvScale),
      },
    });

    return { dropped: true, item: this.toDto(item) };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private toDto(item: {
    id: string;
    templateId: string;
    name: string;
    slot: string;
    rarity: string;
    itemLevel: number;
    isEquipped: boolean;
    atkBonus: number;
    defBonus: number;
    hpBonus: number;
    enhancementLevel: number;
    isLocked: boolean;
    obtainedAt: Date;
  }): InventoryItemDto {
    return {
      id: item.id,
      templateId: item.templateId,
      name: item.name,
      slot: item.slot as ItemSlot,
      rarity: item.rarity as ItemRarity,
      itemLevel: item.itemLevel,
      isEquipped: item.isEquipped,
      atkBonus: item.atkBonus,
      defBonus: item.defBonus,
      hpBonus: item.hpBonus,
      enhancementLevel: item.enhancementLevel,
      isLocked: item.isLocked,
      obtainedAt: item.obtainedAt.toISOString(),
    };
  }

  private weightedRarity(zone: number, roll: number): ItemRarity {
    const weights = getRarityWeights(zone);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let cumulative = 0;
    for (const [rarity, weight] of Object.entries(weights)) {
      cumulative += weight / total;
      if (roll < cumulative) return rarity as ItemRarity;
    }
    return ItemRarity.COMMON;
  }

  private pickTemplate(zone: number, rarity: ItemRarity, roll: number) {
    const eligible = ITEM_TEMPLATE_LIST.filter(
      (t) => t.rarity === rarity && t.minZone <= zone,
    );
    if (eligible.length === 0) {
      const fallback = ITEM_TEMPLATE_LIST.filter((t) => t.minZone <= zone);
      if (fallback.length === 0) return ITEM_TEMPLATES.get('w_iron_shard') ?? null;
      return fallback[Math.floor(roll * fallback.length)];
    }
    return eligible[Math.floor(roll * eligible.length)];
  }

  private lcgRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s, 1664525) + 1013904223;
      s >>>= 0;
      return s / 0xffffffff;
    };
  }
}
