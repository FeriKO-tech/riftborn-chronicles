import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BossAttemptStatusDto, BossConfigDto, BossFightResponseDto } from '@riftborn/shared';
import type { EnemyTemplateDto } from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { InventoryService } from '../inventory/inventory.service';
import { QuestService } from '../quests/quest.service';
import { QuestType } from '@riftborn/shared';
import { getCompanionBonus } from '../companions/data/companions.data';
import { BOSS_LIST, BOSS_TEMPLATES, DAILY_RESET_HOUR_UTC } from './data/bosses.data';

@Injectable()
export class BossService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly combat: CombatService,
    private readonly inventory: InventoryService,
    private readonly quests: QuestService,
  ) {}

  // ── List bosses + player attempt status ───────────────────────────────────

  async getBossState(playerId: string): Promise<{
    bosses: BossConfigDto[];
    attempts: Record<string, BossAttemptStatusDto>;
  }> {
    const attempts = await this.prisma.bossAttempt.findMany({ where: { playerId } });
    const attemptMap: Record<string, BossAttemptStatusDto> = {};

    for (const boss of BOSS_LIST) {
      const record = attempts.find((a) => a.bossId === boss.id);
      attemptMap[boss.id] = this.toAttemptStatus(boss, record ?? null);
    }

    return { bosses: BOSS_LIST, attempts: attemptMap };
  }

  // ── Fight a boss ─────────────────────────────────────────────────────────

  async fight(playerId: string, bossId: string): Promise<BossFightResponseDto> {
    const boss = BOSS_TEMPLATES.get(bossId);
    if (!boss) throw new NotFoundException(`Boss '${bossId}' not found`);

    const [player, stageProgress, currencies, attemptRecord] = await Promise.all([
      this.prisma.player.findUnique({ where: { id: playerId } }),
      this.prisma.stageProgress.findUnique({ where: { playerId } }),
      this.prisma.playerCurrencies.findUnique({ where: { playerId } }),
      this.prisma.bossAttempt.findUnique({ where: { playerId_bossId: { playerId, bossId } } }),
    ]);

    if (!player || !stageProgress) throw new NotFoundException('Player data not found');
    if (!currencies) throw new NotFoundException('Currencies not found');

    // ── Validate access ───────────────────────────────────────────────────
    if (stageProgress.highestZone < boss.zoneRequirement) {
      throw new ForbiddenException(
        `Reach zone ${boss.zoneRequirement} first (you've cleared zone ${stageProgress.highestZone})`,
      );
    }

    // ── Validate attempts ─────────────────────────────────────────────────
    const attemptsUsed = this.getAttemptsUsedToday(attemptRecord);
    if (attemptsUsed >= boss.maxAttemptsPerDay) {
      throw new BadRequestException(
        `No attempts remaining for '${boss.name}' today (${boss.maxAttemptsPerDay}/${boss.maxAttemptsPerDay})`,
      );
    }

    // ── Build player stats ────────────────────────────────────────────────
    const [equipBonus] = await Promise.all([this.inventory.getEquippedBonuses(playerId)]);
    const companionBonus = getCompanionBonus(
      (player as { activeCompanionId?: string | null }).activeCompanionId,
    );
    const playerStats = this.combat.computePlayerStats(
      player.level, player.class, equipBonus, companionBonus,
    );

    // ── Build boss as enemy ───────────────────────────────────────────────
    const bossEnemy: EnemyTemplateDto = {
      id: boss.id,
      name: boss.name,
      hp: boss.hp,
      attack: boss.attack,
      defense: boss.defense,
      speed: boss.speed,
      level: boss.level,
      expReward: 0,
      goldReward: 0,
    };

    // ── Simulate (seed: bossId hash + timestamp jitter) ──────────────────
    const seed = this.hashStr(bossId) + (Date.now() % 100_000);
    const sim = this.combat.simulateSingleEnemy(playerStats, bossEnemy, seed);

    // ── Persist attempt + rewards ─────────────────────────────────────────
    const newAttemptsUsed = attemptsUsed + 1;
    const now = new Date();

    const bossAttemptUpsert = this.prisma.bossAttempt.upsert({
      where: { playerId_bossId: { playerId, bossId } },
      create: { playerId, bossId, attemptsUsed: newAttemptsUsed, lastAttemptAt: now },
      update: { attemptsUsed: newAttemptsUsed, lastAttemptAt: now },
    });

    if (!sim.victory) {
      await bossAttemptUpsert;
      return {
        victory: false,
        rounds: sim.rounds,
        totalDamageDealt: sim.totalDamageDealt,
        rewards: null,
        attemptsRemaining: boss.maxAttemptsPerDay - newAttemptsUsed,
        leveledUp: false,
        newLevel: player.level,
      };
    }

    // ── Level-up calculation ──────────────────────────────────────────────
    const { newLevel, newExp, leveledUp } = this.combat.computeLevelUp(
      player.level, Number(player.experience), boss.rewards.expBonus,
    );
    const newPowerScore = this.combat.computePowerScore(newLevel, player.class, equipBonus, companionBonus);

    await this.prisma.$transaction([
      bossAttemptUpsert,
      this.prisma.player.update({
        where: { id: playerId },
        data: { level: newLevel, experience: newExp, powerScore: newPowerScore },
      }),
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: {
          goldShards: { increment: boss.rewards.goldShards },
          voidCrystals: { increment: boss.rewards.voidCrystals },
          resonanceCores: { increment: boss.rewards.resonanceCores },
        },
      }),
    ]);

    // ── Track quest (non-critical) ─────────────────────────────────────────
    this.quests.trackSingleEvent(playerId, QuestType.DEFEAT_BOSS).catch(() => undefined);

    return {
      victory: true,
      rounds: sim.rounds,
      totalDamageDealt: sim.totalDamageDealt,
      rewards: {
        goldShards: boss.rewards.goldShards,
        voidCrystals: boss.rewards.voidCrystals,
        resonanceCores: boss.rewards.resonanceCores,
        expEarned: boss.rewards.expBonus,
      },
      attemptsRemaining: boss.maxAttemptsPerDay - newAttemptsUsed,
      leveledUp,
      newLevel,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toAttemptStatus(
    boss: BossConfigDto,
    record: { attemptsUsed: number; lastAttemptAt: Date | null } | null,
  ): BossAttemptStatusDto {
    const attemptsUsed = this.getAttemptsUsedToday(record);
    const resetsAt = this.nextResetAt();
    return {
      bossId: boss.id,
      attemptsUsed,
      maxAttempts: boss.maxAttemptsPerDay,
      attemptsRemaining: Math.max(0, boss.maxAttemptsPerDay - attemptsUsed),
      lastAttemptAt: record?.lastAttemptAt?.toISOString() ?? null,
      resetsAt: resetsAt.toISOString(),
    };
  }

  private getAttemptsUsedToday(
    record: { attemptsUsed: number; lastAttemptAt: Date | null } | null,
  ): number {
    if (!record || !record.lastAttemptAt) return 0;
    const resetAt = this.lastResetAt();
    return record.lastAttemptAt >= resetAt ? record.attemptsUsed : 0;
  }

  private lastResetAt(): Date {
    const now = new Date();
    const reset = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), DAILY_RESET_HOUR_UTC,
    ));
    if (now < reset) reset.setUTCDate(reset.getUTCDate() - 1);
    return reset;
  }

  private nextResetAt(): Date {
    const next = this.lastResetAt();
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  private hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    }
    return h >>> 0;
  }
}
