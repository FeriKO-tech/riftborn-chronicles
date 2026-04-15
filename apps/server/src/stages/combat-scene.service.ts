import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  HeroSceneStatsDto,
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
import { AchievementsService } from '../achievements/achievements.service';
import { QuestService } from '../quests/quest.service';
import { getZoneSceneDefinition } from './data/zone-definitions.data';

@Injectable()
export class CombatSceneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly combat: CombatService,
    private readonly inventory: InventoryService,
    private readonly achievements: AchievementsService,
    private readonly quests: QuestService,
  ) {}

  // ── Scene config (initial load) ───────────────────────────────────────────

  async getSceneConfig(playerId: string): Promise<ZoneSceneConfigDto> {
    const [progress, player, killRecord] = await Promise.all([
      this.prisma.stageProgress.findUnique({ where: { playerId } }),
      this.prisma.player.findUnique({ where: { id: playerId } }),
      null as any, // placeholder, resolved below
    ]);
    if (!progress || !player) throw new NotFoundException('Player or progress not found');

    const zone = progress.currentZone;
    const definition = getZoneSceneDefinition(zone);

    const killRec = await this.prisma.zoneKillProgress.findUnique({
      where: { playerId_zone: { playerId, zone } },
    });
    const kills = killRec?.kills ?? 0;

    // Compute hero stats for the client scene
    const equipBonus = await this.inventory.getEquippedBonuses(playerId);
    const companionBonus = await this.getCompanionBonusWithLevel(
      playerId, (player as { activeCompanionId?: string | null }).activeCompanionId,
    );
    const stats = this.combat.computePlayerStats(
      player.level,
      player.class,
      equipBonus,
      companionBonus,
    );
    const heroStats: HeroSceneStatsDto = {
      maxHp: stats.maxHp,
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      critChance: stats.critChance,
      critDamage: stats.critDamage,
    };

    return {
      definition,
      combatState: this.buildCombatState(zone, kills, definition.requiredKills),
      heroStats,
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
    const companionBonus = await this.getCompanionBonusWithLevel(
      playerId, (player as { activeCompanionId?: string | null }).activeCompanionId,
    );
    const newPowerScore = this.combat.computePowerScore(
      newLevel,
      player.class,
      equipBonus,
      companionBonus,
    );

    // Grant gold + exp, persist player progression + increment totalKills
    await this.prisma.$transaction([
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: { goldShards: { increment: BigInt(enemyType.goldReward) } },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { experience: newExp, level: newLevel, powerScore: newPowerScore, totalKills: { increment: 1 } },
      }),
    ]);

    // Item drop (non-critical, outside transaction)
    const dropSeed = Date.now() ^ (dto.zone * 17);
    const drop = await this.inventory.rollDrop(playerId, dto.zone, 'NORMAL', dropSeed);

    const bossUnlocked = updated.kills >= definition.requiredKills;

    // Quest progress (fire-and-forget)
    this.quests.updateBattleProgress(playerId, {
      victory: true,
      goldEarned: enemyType.goldReward,
      zone: dto.zone,
      room: updated.kills,
      isBoss: false,
    }).catch(() => undefined);

    // Achievement check (fire-and-forget)
    const freshPlayer = await this.prisma.player.findUnique({ where: { id: playerId }, select: { totalKills: true, bossKills: true, level: true } });
    const freshCur = await this.prisma.playerCurrencies.findUnique({ where: { playerId }, select: { goldShards: true } });
    const freshProgress = await this.prisma.stageProgress.findUnique({ where: { playerId }, select: { highestZone: true } });
    this.achievements.checkAndUnlock(playerId, {
      totalKills: freshPlayer?.totalKills ?? 0,
      level: freshPlayer?.level ?? 1,
      highestZone: freshProgress?.highestZone ?? 1,
      totalGold: Number(freshCur?.goldShards ?? 0),
    }).catch(() => undefined);

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

    // Client-authoritative boss fight — server just validates kill count
    // and grants rewards. If player couldn't beat boss, client won't call this.
    const equipBonus = await this.inventory.getEquippedBonuses(playerId);
    const companionBonus = await this.getCompanionBonusWithLevel(
      playerId, (player as { activeCompanionId?: string | null }).activeCompanionId,
    );

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

    // Diamond bonus: 1 per zone, boss-only
    const bossDiamonds = Math.max(1, Math.floor(zone * 0.5));

    await this.prisma.$transaction([
      this.prisma.stageProgress.update({
        where: { playerId },
        data: { currentZone: nextZone, currentRoom: 1, highestZone },
      }),
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: {
          goldShards: { increment: BigInt(bossGold) },
          voidCrystals: { increment: bossDiamonds },
        },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { experience: newExp, level: newLevel, powerScore: newPowerScore, bossKills: { increment: 1 } },
      }),
    ]);

    // Quest progress after boss kill (fire-and-forget)
    this.quests.updateBattleProgress(playerId, {
      victory: true,
      goldEarned: bossGold,
      zone,
      room: 10,
      isBoss: true,
    }).catch(() => undefined);

    // Achievement check after boss kill (fire-and-forget)
    const freshP = await this.prisma.player.findUnique({ where: { id: playerId }, select: { totalKills: true, bossKills: true, level: true } });
    const freshC = await this.prisma.playerCurrencies.findUnique({ where: { playerId }, select: { goldShards: true } });
    this.achievements.checkAndUnlock(playerId, {
      totalKills: freshP?.totalKills ?? 0,
      bossKills: freshP?.bossKills ?? 0,
      level: freshP?.level ?? 1,
      highestZone: highestZone,
      totalGold: Number(freshC?.goldShards ?? 0),
    }).catch(() => undefined);

    // Boss drop — always await so we can send the result
    const bossDrop = await this.inventory
      .rollDrop(playerId, zone, 'BOSS', Date.now() ^ (zone * 97))
      .catch(() => ({ dropped: false, item: null } as const));

    const _ = leveledUp; // used by frontend via player state refresh

    return {
      victory: true,
      result: {
        clearedZone: zone,
        newZone: nextZone,
        newZoneName: nextDef.name,
        rewards: {
          goldBonus: bossGold,
          expBonus: bossExp,
          diamonds: bossDiamonds,
          drop: {
            dropped: bossDrop.dropped,
            itemName: bossDrop.item?.name ?? null,
            rarity: bossDrop.item?.rarity ?? null,
          },
        },
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

  private async getCompanionBonusWithLevel(playerId: string, activeCompanionId: string | null | undefined) {
    if (!activeCompanionId) return getCompanionBonus(null);
    const pc = await this.prisma.playerCompanion.findUnique({
      where: { playerId_templateId: { playerId, templateId: activeCompanionId } },
      select: { level: true },
    });
    return getCompanionBonus(activeCompanionId, pc?.level ?? 1);
  }
}
