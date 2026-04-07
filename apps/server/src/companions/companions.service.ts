import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ActivateCompanionResponseDto, CompanionStateDto } from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  COMPANION_TEMPLATES,
  COMPANION_TEMPLATE_LIST,
  STARTER_COMPANION_ID,
  getCompanionBonus,
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
        return {
          id: pc.id,
          templateId: pc.templateId,
          name: t.name,
          icon: t.icon,
          rarity: t.rarity,
          bonus: t.bonus,
          isActive: player?.activeCompanionId === pc.templateId,
          obtainedAt: pc.obtainedAt.toISOString(),
        };
      }),
      activeCompanionId: player?.activeCompanionId ?? null,
    };
  }

  async ensureStarterCompanion(playerId: string): Promise<void> {
    const existing = await this.prisma.playerCompanion.findUnique({
      where: { playerId_templateId: { playerId, templateId: STARTER_COMPANION_ID } },
    });
    if (!existing) {
      await this.prisma.playerCompanion.create({
        data: { playerId, templateId: STARTER_COMPANION_ID },
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
    const prevT = prev ? COMPANION_TEMPLATES.get(prev) : null;

    return {
      activeCompanion: {
        id: owned.id, templateId, name: t.name, icon: t.icon, rarity: t.rarity,
        bonus: t.bonus, isActive: true, obtainedAt: owned.obtainedAt.toISOString(),
      },
      previousCompanion: prevT && prev ? {
        id: prev, templateId: prev, name: prevT.name, icon: prevT.icon, rarity: prevT.rarity,
        bonus: prevT.bonus, isActive: false, obtainedAt: new Date().toISOString(),
      } : null,
      newPowerScore,
    };
  }

  getAvailableTemplates() { return COMPANION_TEMPLATE_LIST; }

  getCompanionBonusForPlayer(activeCompanionId: string | null) {
    return getCompanionBonus(activeCompanionId);
  }
}
