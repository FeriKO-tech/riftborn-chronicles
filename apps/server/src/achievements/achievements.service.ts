import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';
import type { AchievementStateDto, PlayerAchievementDto, AchievementUnlockResponseDto } from '@riftborn/shared';
import { ACHIEVEMENT_DEFINITIONS, getAchievementDefinition } from './data/achievement-definitions.data';

const KEY = (playerId: string) => `achievements:${playerId}`;

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getState(playerId: string): Promise<AchievementStateDto> {
    const raw = await this.redis.hgetall(KEY(playerId));
    const unlocked: PlayerAchievementDto[] = [];

    for (const [id, ts] of Object.entries(raw)) {
      const def = getAchievementDefinition(id);
      if (def) unlocked.push({ achievementId: id, unlockedAt: ts, definition: def });
    }

    return { unlocked, all: ACHIEVEMENT_DEFINITIONS };
  }

  async tryUnlock(playerId: string, achievementId: string): Promise<AchievementUnlockResponseDto | null> {
    const def = getAchievementDefinition(achievementId);
    if (!def) return null;

    // Check if already unlocked
    const existing = await this.redis.hget(KEY(playerId), achievementId);
    if (existing) return null;

    // Unlock
    const now = new Date().toISOString();
    await this.redis.hset(KEY(playerId), achievementId, now);

    // Award gold + diamonds
    const updateData: Record<string, unknown> = {};
    if (def.rewardGold > 0) updateData['goldShards'] = { increment: def.rewardGold };
    if (def.rewardDiamonds > 0) updateData['voidCrystals'] = { increment: def.rewardDiamonds };
    if (Object.keys(updateData).length > 0) {
      await this.prisma.playerCurrencies.update({
        where: { playerId },
        data: updateData,
      });
    }

    this.logger.log(`Achievement unlocked: ${def.name} for player ${playerId}`);

    return {
      achievement: { achievementId, unlockedAt: now, definition: def },
      goldAwarded: def.rewardGold,
      diamondsAwarded: def.rewardDiamonds,
    };
  }

  /** Bulk check — call after relevant events. Returns newly unlocked achievements. */
  async checkAndUnlock(
    playerId: string,
    stats: {
      totalKills?: number;
      bossKills?: number;
      pvpWins?: number;
      level?: number;
      highestZone?: number;
      totalGold?: number;
      salvageCount?: number;
      equippedSlots?: number;
      enchantCount?: number;
      hasCompanion?: boolean;
      dailyClaims?: number;
    },
  ): Promise<AchievementUnlockResponseDto[]> {
    const results: AchievementUnlockResponseDto[] = [];

    const checks: [string, boolean][] = [
      // Monster Slayer (progressive kills)
      ['kill_1',          (stats.totalKills ?? 0) >= 1],
      ['kill_100',        (stats.totalKills ?? 0) >= 100],
      ['kill_1000',       (stats.totalKills ?? 0) >= 1000],
      ['kill_10000',      (stats.totalKills ?? 0) >= 10000],
      ['kill_100000',     (stats.totalKills ?? 0) >= 100000],
      // Boss Slayer
      ['boss_1',          (stats.bossKills ?? 0) >= 1],
      ['boss_10',         (stats.bossKills ?? 0) >= 10],
      ['boss_50',         (stats.bossKills ?? 0) >= 50],
      ['boss_100',        (stats.bossKills ?? 0) >= 100],
      // Arena Fighter
      ['pvp_1',           (stats.pvpWins ?? 0) >= 1],
      ['pvp_10',          (stats.pvpWins ?? 0) >= 10],
      ['pvp_50',          (stats.pvpWins ?? 0) >= 50],
      // Leveling
      ['level_5',         (stats.level ?? 0) >= 5],
      ['level_10',        (stats.level ?? 0) >= 10],
      ['level_25',        (stats.level ?? 0) >= 25],
      ['level_50',        (stats.level ?? 0) >= 50],
      ['level_100',       (stats.level ?? 0) >= 100],
      // Zone Explorer
      ['zone_3',          (stats.highestZone ?? 0) >= 3],
      ['zone_5',          (stats.highestZone ?? 0) >= 5],
      ['zone_10',         (stats.highestZone ?? 0) >= 10],
      ['zone_20',         (stats.highestZone ?? 0) >= 20],
      ['zone_50',         (stats.highestZone ?? 0) >= 50],
      // Gold Collector
      ['gold_1000',       (stats.totalGold ?? 0) >= 1000],
      ['gold_10000',      (stats.totalGold ?? 0) >= 10000],
      ['gold_100000',     (stats.totalGold ?? 0) >= 100000],
      // Collection
      ['equip_full',      (stats.equippedSlots ?? 0) >= 6],
      ['enchant_1',       (stats.enchantCount ?? 0) >= 1],
      ['enchant_10',      (stats.enchantCount ?? 0) >= 10],
      ['companion_first', stats.hasCompanion === true],
      // Daily Login
      ['daily_3',         (stats.dailyClaims ?? 0) >= 3],
      ['daily_7',         (stats.dailyClaims ?? 0) >= 7],
      ['daily_30',        (stats.dailyClaims ?? 0) >= 30],
    ];

    for (const [id, met] of checks) {
      if (met) {
        const r = await this.tryUnlock(playerId, id);
        if (r) results.push(r);
      }
    }

    return results;
  }
}
