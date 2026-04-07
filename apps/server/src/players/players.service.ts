import { Injectable, NotFoundException } from '@nestjs/common';
import type { Player, PlayerCurrencies, StageProgress } from '@prisma/client';
import { PlayerClass } from '@riftborn/shared';
import type {
  ClaimOfflineRewardResponseDto,
  HeartbeatResponseDto,
  OfflineRewardPreviewDto,
  PlayerCurrenciesDto,
  PlayerProfileDto,
  PlayerStateDto,
  StageProgressDto,
} from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';

const MAX_IDLE_HOURS = 8;
const IDLE_CAP_HOURS = MAX_IDLE_HOURS;

type PlayerWithRelations = Player & {
  currencies: PlayerCurrencies | null;
  stageProgress: StageProgress | null;
};

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByAccountId(accountId: string): Promise<Player> {
    const player = await this.prisma.player.findUnique({ where: { accountId } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  async findById(id: string): Promise<Player> {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  async create(
    accountId: string,
    name: string,
    playerClass: PlayerClass,
  ): Promise<Player> {
    return this.prisma.player.create({
      data: {
        accountId,
        name,
        class: playerClass,
        currencies: { create: {} },
        stageProgress: { create: {} },
      },
    });
  }

  async loadPlayerState(accountId: string): Promise<PlayerStateDto> {
    const player = await this.prisma.player.findUnique({
      where: { accountId },
      include: { currencies: true, stageProgress: true },
    });
    if (!player) throw new NotFoundException('Player not found');
    return this.toPlayerStateDto(player as PlayerWithRelations);
  }

  async getRecentBattles(playerId: string, limit = 20) {
    return this.prisma.battleLog.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        zone: true,
        room: true,
        victory: true,
        rounds: true,
        goldEarned: true,
        expEarned: true,
        leveledUp: true,
        createdAt: true,
      },
    });
  }

  async updateLastHeartbeat(playerId: string): Promise<void> {
    await this.prisma.player.update({
      where: { id: playerId },
      data: { lastHeartbeat: new Date() },
    });
  }

  toProfileDto(player: Player): PlayerProfileDto {
    const expToNextLevel = Math.floor(
      player.level * 100 * Math.pow(1.15, player.level - 1),
    );
    return {
      id: player.id,
      name: player.name,
      level: player.level,
      class: player.class as unknown as PlayerClass,
      powerScore: Number(player.powerScore),
      vipLevel: player.vipLevel,
      experience: Number(player.experience),
      expToNextLevel,
    };
  }

  private toPlayerStateDto(player: PlayerWithRelations): PlayerStateDto {
    const currencies: PlayerCurrenciesDto = player.currencies
      ? {
          goldShards: Number(player.currencies.goldShards),
          voidCrystals: player.currencies.voidCrystals,
          resonanceCores: player.currencies.resonanceCores,
          forgeDust: player.currencies.forgeDust,
          echoShards: player.currencies.echoShards,
          arenaMarks: player.currencies.arenaMarks,
          bossSeals: player.currencies.bossSeals,
        }
      : {
          goldShards: 500,
          voidCrystals: 0,
          resonanceCores: 150,
          forgeDust: 0,
          echoShards: 0,
          arenaMarks: 0,
          bossSeals: 0,
        };

    const stageProgress: StageProgressDto = player.stageProgress
      ? {
          currentZone: player.stageProgress.currentZone,
          currentRoom: player.stageProgress.currentRoom,
          highestZone: player.stageProgress.highestZone,
        }
      : { currentZone: 1, currentRoom: 1, highestZone: 0 };

    return {
      profile: this.toProfileDto(player),
      currencies,
      stageProgress,
    };
  }

  // ── Offline Rewards ───────────────────────────────────────────────────────

  async getOfflineRewardPreview(playerId: string): Promise<OfflineRewardPreviewDto> {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found');
    return this.computeOfflineReward(player);
  }

  async claimOfflineReward(playerId: string): Promise<ClaimOfflineRewardResponseDto> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { currencies: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    const { goldEarned, idleHours, multiplier } = this.computeOfflineReward(player);

    if (goldEarned === 0) {
      return {
        goldEarned: 0,
        idleHours: 0,
        newGoldBalance: player.currencies ? Number(player.currencies.goldShards) : 500,
      };
    }

    const [updatedCurrencies] = await this.prisma.$transaction([
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: { goldShards: { increment: goldEarned } },
      }),
      this.prisma.player.update({
        where: { id: playerId },
        data: { lastHeartbeat: new Date() },
      }),
      this.prisma.offlineRewardLog.create({
        data: { playerId, idleHours, goldEarned, multiplier },
      }),
    ]);

    return {
      goldEarned,
      idleHours,
      newGoldBalance: Number(updatedCurrencies.goldShards),
    };
  }

  async heartbeat(playerId: string): Promise<HeartbeatResponseDto> {
    await this.prisma.player.update({
      where: { id: playerId },
      data: { lastHeartbeat: new Date() },
    });
    return { ok: true, serverTime: new Date().toISOString() };
  }

  private computeOfflineReward(player: Player): OfflineRewardPreviewDto {
    const now = Date.now();
    const lastSeen = player.lastHeartbeat.getTime();
    const elapsedMs = Math.max(0, now - lastSeen);
    const elapsedHours = Math.min(elapsedMs / 3_600_000, IDLE_CAP_HOURS);

    // Base farm rate: 500 × level^1.4 gold per hour
    const baseRate = 500 * Math.pow(player.level, 1.4);
    const multiplier = 1.0; // VIP/gear multipliers added in Batch E+
    const goldEarned = Math.floor(baseRate * multiplier * elapsedHours);

    return {
      idleHours: Math.round(elapsedHours * 100) / 100,
      goldEarned,
      multiplier,
      cappedAt: IDLE_CAP_HOURS,
    };
  }
}
