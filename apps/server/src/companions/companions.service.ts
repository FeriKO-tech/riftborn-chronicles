import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ActivateCompanionResponseDto,
  CompanionStateDto,
  CompanionUpgradeResponseDto,
} from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  COMPANION_TEMPLATES,
  COMPANION_TEMPLATE_LIST,
  STARTER_COMPANION_ID,
  STARTER_COMPANION_IDS,
  getCompanionBonus,
  scaledCompanionBonus,
  companionUpgradeCost,
} from './data/companions.data';

@Injectable()
export class CompanionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async getState(playerId: string): Promise<CompanionStateDto> {
    const [owned, player] = await Promise.all([
      this.prisma.playerCompanion.findMany({ where: { playerId } }),
      this.prisma.player.findUnique({ where: { id: playerId }, select: { activeCompanionId: true } }),
    ]);

    return {
      owned: owned.map((pc) => {
        const t = COMPANION_TEMPLATES.get(pc.templateId)!;
        const bonus = scaledCompanionBonus(pc.templateId, pc.level);
        return {
          id: pc.id,
          templateId: pc.templateId,
          name: t.name,
          icon: t.icon,
          rarity: t.rarity,
          level: pc.level,
          bonus,
          upgradeCost: companionUpgradeCost(pc.level),
          isActive: player?.activeCompanionId === pc.templateId,
          obtainedAt: pc.obtainedAt.toISOString(),
        };
      }),
      activeCompanionId: player?.activeCompanionId ?? null,
    };
  }

  async ensureStarterCompanion(playerId: string): Promise<void> {
    // Ensure starter companions exist
    for (const id of STARTER_COMPANION_IDS) {
      const existing = await this.prisma.playerCompanion.findUnique({
        where: { playerId_templateId: { playerId, templateId: id } },
      });
      if (!existing) {
        await this.prisma.playerCompanion.create({
          data: { playerId, templateId: id },
        });
      }
    }
    // Set default active if none
    const player = await this.prisma.player.findUnique({
      where: { id: playerId }, select: { activeCompanionId: true },
    });
    if (!player?.activeCompanionId) {
      await this.prisma.player.update({
        where: { id: playerId },
        data: { activeCompanionId: STARTER_COMPANION_ID },
      });
    }
  }

  async activate(playerId: string, templateId: string): Promise<ActivateCompanionResponseDto> {
    if (!COMPANION_TEMPLATES.has(templateId)) throw new NotFoundException('Companion not found');
    const owned = await this.prisma.playerCompanion.findUnique({
      where: { playerId_templateId: { playerId, templateId } },
    });
    if (!owned) throw new BadRequestException('Companion not owned');

    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found');

    const prev = player.activeCompanionId;

    await this.prisma.player.update({
      where: { id: playerId },
      data: { activeCompanionId: templateId },
    });

    const newPowerScore = await this.inventory.recalcAndPersistPowerScore(
      playerId, player.level, player.class,
    );

    const t = COMPANION_TEMPLATES.get(templateId)!;
    const bonus = scaledCompanionBonus(templateId, owned.level);
    const prevOwned = prev ? await this.prisma.playerCompanion.findUnique({
      where: { playerId_templateId: { playerId, templateId: prev } },
    }) : null;
    const prevT = prev ? COMPANION_TEMPLATES.get(prev) : null;

    return {
      activeCompanion: {
        id: owned.id, templateId, name: t.name, icon: t.icon, rarity: t.rarity,
        level: owned.level, bonus, upgradeCost: companionUpgradeCost(owned.level),
        isActive: true, obtainedAt: owned.obtainedAt.toISOString(),
      },
      previousCompanion: prevT && prev && prevOwned ? {
        id: prevOwned.id, templateId: prev, name: prevT.name, icon: prevT.icon, rarity: prevT.rarity,
        level: prevOwned.level, bonus: scaledCompanionBonus(prev, prevOwned.level),
        upgradeCost: companionUpgradeCost(prevOwned.level),
        isActive: false, obtainedAt: prevOwned.obtainedAt.toISOString(),
      } : null,
      newPowerScore,
    };
  }

  async upgradeCompanion(playerId: string, templateId: string): Promise<CompanionUpgradeResponseDto> {
    if (!COMPANION_TEMPLATES.has(templateId)) throw new NotFoundException('Companion not found');
    const owned = await this.prisma.playerCompanion.findUnique({
      where: { playerId_templateId: { playerId, templateId } },
    });
    if (!owned) throw new BadRequestException('Companion not owned');

    const [player, currencies] = await Promise.all([
      this.prisma.player.findUnique({ where: { id: playerId } }),
      this.prisma.playerCurrencies.findUnique({ where: { playerId } }),
    ]);
    if (!player || !currencies) throw new NotFoundException('Player not found');

    const cost = companionUpgradeCost(owned.level);
    if (Number(currencies.goldShards) < cost) {
      throw new BadRequestException(`Need ${cost} gold (have ${Number(currencies.goldShards)})`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.playerCompanion.update({
        where: { id: owned.id },
        data: { level: { increment: 1 } },
      }),
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: { goldShards: { decrement: BigInt(cost) } },
      }),
    ]);

    const newPowerScore = await this.inventory.recalcAndPersistPowerScore(
      playerId, player.level, player.class,
    );

    const t = COMPANION_TEMPLATES.get(templateId)!;
    const bonus = scaledCompanionBonus(templateId, updated.level);

    return {
      companion: {
        id: updated.id, templateId, name: t.name, icon: t.icon, rarity: t.rarity,
        level: updated.level, bonus, upgradeCost: companionUpgradeCost(updated.level),
        isActive: player.activeCompanionId === templateId,
        obtainedAt: updated.obtainedAt.toISOString(),
      },
      goldCost: cost,
      newPowerScore,
    };
  }

  async grantCompanion(playerId: string, templateId: string): Promise<void> {
    if (!COMPANION_TEMPLATES.has(templateId)) throw new NotFoundException('Companion template not found');
    const existing = await this.prisma.playerCompanion.findUnique({
      where: { playerId_templateId: { playerId, templateId } },
    });
    if (!existing) {
      await this.prisma.playerCompanion.create({ data: { playerId, templateId } });
    }
  }

  getAvailableTemplates() { return COMPANION_TEMPLATE_LIST; }

  async getCompanionBonusForPlayer(playerId: string, activeCompanionId: string | null) {
    if (!activeCompanionId) return { atkPct: 0, defPct: 0, hpPct: 0 };
    const owned = await this.prisma.playerCompanion.findUnique({
      where: { playerId_templateId: { playerId, templateId: activeCompanionId } },
    });
    return getCompanionBonus(activeCompanionId, owned?.level ?? 1);
  }
}
