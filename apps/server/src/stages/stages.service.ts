import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BattleResultDto,
  StageProgressResponseDto,
  ZoneDto,
  ZoneSummaryDto,
} from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { InventoryService } from '../inventory/inventory.service';
import { QuestService } from '../quests/quest.service';
import { ROOMS_PER_ZONE_COUNT, TOTAL_ZONES, ZONES } from './data/zones.data';
import { getCompanionBonus } from '../companions/data/companions.data';

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly combat: CombatService,
    private readonly inventory: InventoryService,
    private readonly quests: QuestService,
  ) {}

  // ── Zone catalogue ────────────────────────────────────────────────────────

  listZoneSummaries(): ZoneSummaryDto[] {
    const summaries: ZoneSummaryDto[] = [];
    for (let z = 1; z <= TOTAL_ZONES; z++) {
      const data = ZONES.get(z);
      if (data) {
        summaries.push(this.toZoneSummary(data));
      } else {
        summaries.push(this.generateZoneSummary(z));
      }
    }
    return summaries;
  }

  getZone(zone: number): ZoneDto {
    const data = ZONES.get(zone);
    if (data) return data;
    if (zone < 1 || zone > TOTAL_ZONES) {
      throw new NotFoundException(`Zone ${zone} does not exist`);
    }
    return this.generateZone(zone);
  }

  // ── Player progression ────────────────────────────────────────────────────

  async getPlayerProgress(playerId: string): Promise<StageProgressResponseDto> {
    const progress = await this.prisma.stageProgress.findUnique({
      where: { playerId },
    });
    if (!progress) throw new NotFoundException('Stage progress not found');

    return {
      currentZone: progress.currentZone,
      currentRoom: progress.currentRoom,
      highestZone: progress.highestZone,
      zoneInfo: this.toZoneSummary(this.getZone(progress.currentZone)),
    };
  }

  async advanceRoom(playerId: string): Promise<BattleResultDto> {
    const [progress, player] = await Promise.all([
      this.prisma.stageProgress.findUnique({ where: { playerId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
    ]);

    if (!progress || !player) throw new NotFoundException('Player or progress not found');

    const zone = this.getZone(progress.currentZone);
    const currentRoom = zone.rooms[progress.currentRoom - 1];
    if (!currentRoom) throw new NotFoundException('Room not found');

    // ── Stage entry validation ────────────────────────────────────────────────
    if (player.level < zone.minLevel) {
      throw new ForbiddenException(
        `Zone ${zone.zone} requires level ${zone.minLevel} (you are level ${player.level})`,
      );
    }

    // ── Load equipped + companion bonuses ────────────────────────────────────
    const equipBonus = await this.inventory.getEquippedBonuses(player.id);
    const companionBonus = getCompanionBonus((player as { activeCompanionId?: string | null }).activeCompanionId);

    // ── Simulate battle ─────────────────────────────────────────────────────
    const playerStats = this.combat.computePlayerStats(player.level, player.class, equipBonus, companionBonus);
    const sim = this.combat.simulateRoom(playerStats, {
      zone: progress.currentZone,
      room: progress.currentRoom,
      enemies: currentRoom.enemies,
      clearGoldBonus: currentRoom.clearGoldBonus,
    });

    // ── Compute progression ──────────────────────────────────────────────────
    let newZone = progress.currentZone;
    let newRoom = progress.currentRoom;
    let zoneCleared = false;

    if (sim.victory) {
      newRoom = progress.currentRoom + 1;
      if (newRoom > ROOMS_PER_ZONE_COUNT) {
        newRoom = 1;
        newZone = Math.min(progress.currentZone + 1, TOTAL_ZONES);
        zoneCleared = true;
      }
    }

    const highestZone = Math.max(
      progress.highestZone,
      zoneCleared ? progress.currentZone : 0,
    );

    // ── Level-up calculation ─────────────────────────────────────────────────
    const { newLevel, newExp, leveledUp } = this.combat.computeLevelUp(
      player.level,
      Number(player.experience),
      sim.expEarned,
    );
    const newPowerScore = this.combat.computePowerScore(newLevel, player.class, equipBonus, companionBonus);

    // ── Persist in transaction ───────────────────────────────────────────────
    const battleLogCreate = this.prisma.battleLog.create({
      data: {
        playerId,
        zone: progress.currentZone,
        room: progress.currentRoom,
        victory: sim.victory,
        rounds: sim.rounds.length,
        goldEarned: sim.goldEarned,
        expEarned: sim.expEarned,
        leveledUp,
      },
    });

    const playerUpdate = this.prisma.player.update({
      where: { id: playerId },
      data: { experience: newExp, level: newLevel, powerScore: newPowerScore },
    });

    if (sim.victory) {
      await this.prisma.$transaction([
        battleLogCreate,
        playerUpdate,
        this.prisma.stageProgress.update({
          where: { playerId },
          data: { currentZone: newZone, currentRoom: newRoom, highestZone },
        }),
        this.prisma.playerCurrencies.update({
          where: { playerId },
          data: { goldShards: { increment: sim.goldEarned } },
        }),
      ]);
    } else {
      await this.prisma.$transaction([battleLogCreate, playerUpdate]);
    }

    // ── Quest progress (non-critical, fire-and-forget) ───────────────────────────
    const isBoss = currentRoom.type === 'BOSS' || progress.currentRoom === 10;
    this.quests
      .updateBattleProgress(player.id, {
        victory: sim.victory,
        goldEarned: sim.goldEarned,
        zone: progress.currentZone,
        room: progress.currentRoom,
        isBoss,
      })
      .catch(() => undefined);

    // ── Item drop (after transaction, non-critical) ───────────────────────────
    const roomType =
      currentRoom.room === 10 ? 'BOSS' : currentRoom.room === 5 ? 'ELITE' : 'NORMAL';
    const dropSeed = Date.now() ^ (progress.currentZone * 17) ^ (progress.currentRoom * 31);
    const drop = sim.victory
      ? await this.inventory.rollDrop(player.id, progress.currentZone, roomType, dropSeed)
      : { dropped: false as const, item: null };

    return {
      victory: sim.victory,
      rounds: sim.rounds,
      totalDamageDealt: sim.totalDamageDealt,
      roundsCount: sim.rounds.length,
      goldEarned: sim.goldEarned,
      expEarned: sim.expEarned,
      leveledUp,
      newLevel,
      newZone,
      newRoom,
      zoneCleared,
      playerStats,
      drop,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private toZoneSummary(zone: ZoneDto): ZoneSummaryDto {
    return {
      zone: zone.zone,
      name: zone.name,
      description: zone.description,
      minLevel: zone.minLevel,
      roomCount: zone.roomCount,
      bossRoom: zone.roomCount,
    };
  }

  private generateZoneSummary(zone: number): ZoneSummaryDto {
    return {
      zone,
      name: `Fracture Zone ${zone}`,
      description: `A deeper fracture of reality — only the strongest Riftborn survive here.`,
      minLevel: Math.max(1, (zone - 1) * 3),
      roomCount: ROOMS_PER_ZONE_COUNT,
      bossRoom: ROOMS_PER_ZONE_COUNT,
    };
  }

  private generateZone(zone: number): ZoneDto {
    const summary = this.generateZoneSummary(zone);
    return {
      ...summary,
      rooms: [],
    };
  }
}
