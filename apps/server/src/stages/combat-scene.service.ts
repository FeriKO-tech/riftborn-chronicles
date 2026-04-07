import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  KillEnemyRequestDto,
  KillEnemyResponseDto,
  ZoneClearResponseDto,
  ZoneCombatStateDto,
  ZoneSceneConfigDto,
} from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { InventoryService } from '../inventory/inventory.service';
import { getCompanionBonus } from '../companions/data/companions.data';
import { getZoneSceneDefinition } from './data/zone-definitions.data';

@Injectable()
export class CombatSceneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly combat: CombatService,
    private readonly inventory: InventoryService,
  ) {}

  // ── Scene config (initial load) ───────────────────────────────────────────

  async getSceneConfig(playerId: string): Promise<ZoneSceneConfigDto> {
    const progress = await this.prisma.stageProgress.findUnique({ where: { playerId } });
    if (!progress) throw new NotFoundException('Stage progress not found');

    const zone = progress.currentZone;
    const definition = getZoneSceneDefinition(zone);

    const killRecord = await this.prisma.zoneKillProgress.findUnique({
      where: { playerId_zone: { playerId, zone } },
    });

    const kills = killRecord?.kills ?? 0;

    return {
      definition,
      combatState: this.buildCombatState(zone, kills, definition.requiredKills),
    };
  }

  // ── Kill enemy (server-authoritative kill tracking) ──────────────────────

  async killEnemy(playerId: string, dto: KillEnemyRequestDto): Promise<KillEnemyResponseDto> {
    const [progress, player] = await Promise.all([
      this.prisma.stageProgress.findUnique({ where: { playerId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
    ]);

    if (!progress || !player) throw new NotFoundException('Player or progress not found');

    // Anti-cheat: zone must match player's current zone
    if (progress.currentZone !== dto.zone) {
      throw new ForbiddenException('Zone mismatch — cannot kill enemies in a zone you are not in');
    }

    // Anti-cheat: enemy type must exist in this zone definition
    const definition = getZoneSceneDefinition(dto.zone);
    const enemyType = definition.enemyTypes.find((e) => e.id === dto.enemyTypeId);
    if (!enemyType) {
      throw new BadRequestException(`Enemy type '${dto.enemyTypeId}' is not valid for zone ${dto.zone}`);
    }

    // Increment kill count
    const updated = await this.prisma.zoneKillProgress.upsert({
      where: { playerId_zone: { playerId, zone: dto.zone } },
      create: { playerId, zone: dto.zone, kills: 1 },
      update: { kills: { increment: 1 } },
    });

    // Level-up calculation
    const { newLevel, newExp, leveledUp } = this.combat.computeLevelUp(
      player.level,
      Number(player.experience),
      enemyType.expReward,
    );

    const equipBonus = await this.inventory.getEquippedBonuses(playerId);
    const companionBonus = getCompanionBonus(
      (player as { activeCompanionId?: string | null }).activeCompanionId,
    );
    const newPowerScore = this.combat.computePowerScore(
      newLevel,
      player.class,
      equipBonus,
      companionBonus,
    );

    // Grant gold + exp, persist player progression
    await this.prisma.$transaction([
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: { goldShards: { increment: BigInt(enemyType.goldReward) } },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { experience: newExp, level: newLevel, powerScore: newPowerScore },
      }),
    ]);

    // Item drop (non-critical, outside transaction)
    const dropSeed = Date.now() ^ (dto.zone * 17);
    const drop = await this.inventory.rollDrop(playerId, dto.zone, 'NORMAL', dropSeed);

    const bossUnlocked = updated.kills >= definition.requiredKills;

    return {
      kills: updated.kills,
      requiredKills: definition.requiredKills,
      bossUnlocked,
      goldEarned: enemyType.goldReward,
      expEarned: enemyType.expReward,
      drop: drop.dropped,
      leveledUp,
      newLevel,
    };
  }

  // ── Boss fight (zone boss, kill-gated) ───────────────────────────────────

  async fightBoss(
    playerId: string,
    zone: number,
  ): Promise<{ victory: boolean; result: ZoneClearResponseDto | null; combatState: ZoneCombatStateDto }> {
    const [progress, player, killRecord] = await Promise.all([
      this.prisma.stageProgress.findUnique({ where: { playerId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
      this.prisma.zoneKillProgress.findUnique({
        where: { playerId_zone: { playerId, zone } },
      }),
    ]);

    if (!progress || !player) throw new NotFoundException('Player or progress not found');
    if (progress.currentZone !== zone) {
      throw new ForbiddenException('Zone mismatch');
    }

    const definition = getZoneSceneDefinition(zone);
    const kills = killRecord?.kills ?? 0;

    if (kills < definition.requiredKills) {
      throw new ForbiddenException(
        `Kill goal not reached (${kills}/${definition.requiredKills})`,
      );
    }

    // Simulate boss fight
    const equipBonus = await this.inventory.getEquippedBonuses(playerId);
    const companionBonus = getCompanionBonus(
      (player as { activeCompanionId?: string | null }).activeCompanionId,
    );
    const playerStats = this.combat.computePlayerStats(
      player.level,
      player.class,
      equipBonus,
      companionBonus,
    );
    const sim = this.combat.simulateSingleEnemy(
      playerStats,
      definition.boss,
      Date.now() ^ (zone * 31),
    );

    if (!sim.victory) {
      return {
        victory: false,
        result: null,
        combatState: this.buildCombatState(zone, kills, definition.requiredKills),
      };
    }

    // Boss defeated — advance zone
    const nextZone = Math.min(zone + 1, 100);
    const nextDef = getZoneSceneDefinition(nextZone);

    const bossGold = definition.boss.goldReward;
    const bossExp = definition.boss.expReward;
    const { newLevel, newExp, leveledUp } = this.combat.computeLevelUp(
      player.level,
      Number(player.experience),
      bossExp,
    );
    const newPowerScore = this.combat.computePowerScore(
      newLevel,
      player.class,
      equipBonus,
      companionBonus,
    );
    const highestZone = Math.max(progress.highestZone, zone);

    await this.prisma.$transaction([
      this.prisma.stageProgress.update({
        where: { playerId },
        data: { currentZone: nextZone, currentRoom: 1, highestZone },
      }),
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: { goldShards: { increment: BigInt(bossGold) } },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { experience: newExp, level: newLevel, powerScore: newPowerScore },
      }),
    ]);

    void this.inventory.rollDrop(playerId, zone, 'BOSS', Date.now() ^ (zone * 97)).catch(() => undefined);

    const _ = leveledUp; // used by frontend via player state refresh

    return {
      victory: true,
      result: {
        clearedZone: zone,
        newZone: nextZone,
        newZoneName: nextDef.name,
        rewards: { goldBonus: bossGold },
      },
      combatState: this.buildCombatState(nextZone, 0, nextDef.requiredKills),
    };
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  private buildCombatState(
    zone: number,
    kills: number,
    requiredKills: number,
  ): ZoneCombatStateDto {
    return {
      zone,
      kills,
      requiredKills,
      bossUnlocked: kills >= requiredKills,
      zoneCleared: false,
    };
  }
}
