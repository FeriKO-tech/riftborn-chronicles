import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PvpBattleHistoryDto,
  PvpFightResultDto,
  PvpOpponentDto,
  PvpProfileDto,
  PvpStateDto,
} from '@riftborn/shared';
import type { CombatStatsDto, EnemyTemplateDto } from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import { CombatService } from '../combat/combat.service';
import { InventoryService } from '../inventory/inventory.service';
import { getCompanionBonus } from '../companions/data/companions.data';

const RATING_WIN = 25;
const RATING_LOSS = 15;
const OPPONENT_POOL_SIZE = 3;
const RATING_BAND = 200;
const REWARD_WIN_GOLD = 800;
const REWARD_WIN_CRYSTALS = 1;
const HISTORY_LIMIT = 10;

interface DefenseSnapshot {
  level: number;
  class: string;
  powerScore: number;
  stats: CombatStatsDto;
}

@Injectable()
export class PvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly combat: CombatService,
    private readonly inventory: InventoryService,
  ) {}

  // ── Get full PvP state ────────────────────────────────────────────────────

  async getState(playerId: string): Promise<PvpStateDto> {
    const profile = await this.ensureProfile(playerId);
    const [opponents, recentBattles] = await Promise.all([
      this.getCandidates(playerId, profile.rating),
      this.getRecentBattles(playerId),
    ]);

    return {
      profile: this.toProfileDto(profile, playerId),
      opponents,
      recentBattles,
    };
  }

  // ── Fight an opponent ─────────────────────────────────────────────────────

  async fight(attackerId: string, opponentPlayerId: string): Promise<PvpFightResultDto> {
    if (attackerId === opponentPlayerId) {
      throw new BadRequestException('Cannot fight yourself');
    }

    const [attacker, attackerProfile, defenderProfile] = await Promise.all([
      this.prisma.player.findUnique({ where: { id: attackerId } }),
      this.ensureProfile(attackerId),
      this.prisma.pvpProfile.findUnique({ where: { playerId: opponentPlayerId } }),
    ]);

    if (!attacker) throw new NotFoundException('Player not found');
    if (!defenderProfile) throw new NotFoundException('Opponent not found or has no PvP profile');

    const snapshot = defenderProfile.defenseSnapshot as unknown as DefenseSnapshot;

    // ── Build attacker live stats ─────────────────────────────────────────
    const [equipBonus] = await Promise.all([this.inventory.getEquippedBonuses(attackerId)]);
    const companionBonus = getCompanionBonus(
      (attacker as { activeCompanionId?: string | null }).activeCompanionId,
    );
    const attackerStats = this.combat.computePlayerStats(
      attacker.level, attacker.class, equipBonus, companionBonus,
    );

    // ── Treat defender snapshot as enemy ─────────────────────────────────
    const defenderAsEnemy: EnemyTemplateDto = {
      id: opponentPlayerId,
      name: snapshot.class,
      hp: snapshot.stats.hp,
      attack: snapshot.stats.attack,
      defense: snapshot.stats.defense,
      speed: snapshot.stats.speed,
      level: snapshot.level,
      expReward: 0,
      goldReward: 0,
    };

    const seed = this.makeSeed(attackerId, opponentPlayerId);
    const sim = this.combat.simulateSingleEnemy(attackerStats, defenderAsEnemy, seed);

    // ── Rating updates ────────────────────────────────────────────────────
    const ratingChange = sim.victory ? RATING_WIN : -RATING_LOSS;
    const safeNewRating = Math.max(100, attackerProfile.rating + ratingChange);

    // ── Persist ───────────────────────────────────────────────────────────
    const profileOp = this.prisma.pvpProfile.update({
      where: { playerId: attackerId },
      data: sim.victory
        ? { rating: safeNewRating, wins: { increment: 1 } }
        : { rating: safeNewRating, losses: { increment: 1 } },
    });

    const battleOp = this.prisma.pvpBattle.create({
      data: {
        attackerId,
        defenderId: opponentPlayerId,
        result: sim.victory ? 'WIN' : 'LOSS',
        ratingChange,
        rewardGold: sim.victory ? REWARD_WIN_GOLD : 0,
        rounds: sim.rounds,
      },
    });

    if (sim.victory) {
      await this.prisma.$transaction([
        profileOp,
        battleOp,
        this.prisma.playerCurrencies.update({
          where: { playerId: attackerId },
          data: {
            goldShards: { increment: REWARD_WIN_GOLD },
            voidCrystals: { increment: REWARD_WIN_CRYSTALS },
          },
        }),
      ]);
    } else {
      await this.prisma.$transaction([profileOp, battleOp]);
    }

    // ── Build opponent DTO ────────────────────────────────────────────────
    const defenderPlayer = await this.prisma.player.findUnique({
      where: { id: opponentPlayerId },
      select: { name: true, class: true },
    });

    const opponentDto: PvpOpponentDto = {
      playerId: opponentPlayerId,
      playerName: defenderPlayer?.name ?? 'Unknown',
      playerClass: snapshot.class,
      level: snapshot.level,
      powerScore: snapshot.powerScore,
      rating: defenderProfile.rating,
      ratingDiff: defenderProfile.rating - attackerProfile.rating,
    };

    return {
      victory: sim.victory,
      ratingChange,
      newRating: safeNewRating,
      opponent: opponentDto,
      rewards: sim.victory
        ? { goldShards: REWARD_WIN_GOLD, voidCrystals: REWARD_WIN_CRYSTALS }
        : null,
      battleRounds: sim.rounds,
      totalDamageDealt: sim.totalDamageDealt,
    };
  }

  // ── Refresh own defense snapshot ─────────────────────────────────────────

  async refreshSnapshot(playerId: string): Promise<void> {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found');

    const equipBonus = await this.inventory.getEquippedBonuses(playerId);
    const companionBonus = getCompanionBonus(
      (player as { activeCompanionId?: string | null }).activeCompanionId,
    );
    const stats = this.combat.computePlayerStats(
      player.level, player.class, equipBonus, companionBonus,
    );
    const powerScore = this.combat.computePowerScore(
      player.level, player.class, equipBonus, companionBonus,
    );

    const snapshot: DefenseSnapshot = {
      level: player.level,
      class: player.class,
      powerScore,
      stats,
    };

    await this.prisma.pvpProfile.upsert({
      where: { playerId },
      create: {
        playerId,
        rating: 1200,
        wins: 0,
        losses: 0,
        defenseSnapshot: snapshot as object,
      },
      update: { defenseSnapshot: snapshot as object },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async ensureProfile(playerId: string) {
    const existing = await this.prisma.pvpProfile.findUnique({ where: { playerId } });
    if (existing) return existing;

    await this.refreshSnapshot(playerId);
    return this.prisma.pvpProfile.findUniqueOrThrow({ where: { playerId } });
  }

  private async getCandidates(playerId: string, rating: number): Promise<PvpOpponentDto[]> {
    const profiles = await this.prisma.pvpProfile.findMany({
      where: {
        playerId: { not: playerId },
        rating: { gte: rating - RATING_BAND, lte: rating + RATING_BAND },
      },
      orderBy: { rating: 'desc' },
      take: OPPONENT_POOL_SIZE * 3,
    });

    const results: PvpOpponentDto[] = [];
    for (const p of profiles.slice(0, OPPONENT_POOL_SIZE)) {
      const snap = p.defenseSnapshot as unknown as DefenseSnapshot;
      const pl = await this.prisma.player.findUnique({
        where: { id: p.playerId },
        select: { name: true },
      });
      results.push({
        playerId: p.playerId,
        playerName: pl?.name ?? 'Unknown',
        playerClass: snap.class,
        level: snap.level,
        powerScore: snap.powerScore,
        rating: p.rating,
        ratingDiff: p.rating - rating,
      });
    }

    return results;
  }

  private async getRecentBattles(playerId: string): Promise<PvpBattleHistoryDto[]> {
    const battles = await this.prisma.pvpBattle.findMany({
      where: { attackerId: playerId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });

    const result: PvpBattleHistoryDto[] = [];
    for (const b of battles) {
      const defender = await this.prisma.player.findUnique({
        where: { id: b.defenderId },
        select: { name: true, class: true },
      });
      result.push({
        id: b.id,
        opponentName: defender?.name ?? 'Unknown',
        opponentClass: defender?.class ?? 'Unknown',
        result: b.result as 'WIN' | 'LOSS',
        ratingChange: b.ratingChange,
        createdAt: b.createdAt.toISOString(),
      });
    }
    return result;
  }

  private toProfileDto(
    profile: { playerId: string; rating: number; wins: number; losses: number },
    playerId: string,
  ): PvpProfileDto {
    const total = profile.wins + profile.losses;
    return {
      playerId,
      rating: profile.rating,
      wins: profile.wins,
      losses: profile.losses,
      winRate: total > 0 ? Math.round((profile.wins / total) * 100) / 100 : 0,
    };
  }

  private makeSeed(attackerId: string, defenderId: string): number {
    let h = 2166136261;
    for (const c of attackerId + defenderId + String(Date.now() % 10000)) {
      h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    }
    return h >>> 0;
  }
}
