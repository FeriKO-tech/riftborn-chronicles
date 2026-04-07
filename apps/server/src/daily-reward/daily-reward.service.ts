import { Injectable } from '@nestjs/common';
import type {
  ClaimDailyRewardResponseDto,
  DailyRewardPreviewDto,
  DailyRewardStatusDto,
} from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';

// ── Reward schedule (day 1-7 repeating, bonus multiplier for streaks) ─────────
const BASE_GOLD = 500;
const BASE_CRYSTALS = 0;
const DAY_GOLD_MULT = [1, 1.2, 1.5, 1.8, 2.2, 2.8, 4.0]; // index = (streak-1) % 7
const WEEKLY_CRYSTAL_DAY = 7; // crystals on day 7 (and every 7th day)
const STREAK_BONUS_PER_DAY = 50; // extra gold per consecutive streak day beyond 7

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RESET_HOURS = 28; // grace window: claim available for 28h after midnight to allow timezone variance

@Injectable()
export class DailyRewardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(playerId: string): Promise<DailyRewardStatusDto> {
    const record = await this.getOrCreate(playerId);
    const now = new Date();

    const canClaim = this.canClaimToday(record.lastClaimedAt, now);
    const currentStreak = canClaim ? record.streak : 0;
    const nextStreakDay = (currentStreak % 7) + 1;
    const hoursUntilReset = record.lastClaimedAt
      ? Math.max(0, RESET_HOURS - (now.getTime() - record.lastClaimedAt.getTime()) / 3_600_000)
      : null;

    return {
      canClaim,
      streak: record.streak,
      longestStreak: record.longestStreak,
      lastClaimedAt: record.lastClaimedAt?.toISOString() ?? null,
      totalClaimed: record.totalClaimed,
      nextReward: this.computeReward(record.streak + 1),
      hoursUntilReset: canClaim ? null : (hoursUntilReset !== null ? Math.round(hoursUntilReset * 10) / 10 : null),
    };
  }

  async claim(playerId: string): Promise<ClaimDailyRewardResponseDto> {
    const record = await this.getOrCreate(playerId);
    const now = new Date();

    if (!this.canClaimToday(record.lastClaimedAt, now)) {
      const { ConflictException } = await import('@nestjs/common');
      throw new ConflictException('Daily reward already claimed. Come back tomorrow!');
    }

    // Streak: extend if claimed within 28h of last claim, reset otherwise
    const streakBroken =
      record.lastClaimedAt !== null &&
      now.getTime() - record.lastClaimedAt.getTime() > RESET_HOURS * 3_600_000;

    const newStreak = streakBroken ? 1 : record.streak + 1;
    const longestStreak = Math.max(record.longestStreak, newStreak);
    const reward = this.computeReward(newStreak);

    const [updatedCurrencies] = await this.prisma.$transaction([
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: {
          goldShards: { increment: reward.goldShards },
          voidCrystals: { increment: reward.voidCrystals },
        },
      }),
      this.prisma.dailyReward.update({
        where: { playerId },
        data: {
          streak: newStreak,
          longestStreak,
          lastClaimedAt: now,
          totalClaimed: { increment: 1 },
        },
      }),
    ]);

    return {
      goldShards: reward.goldShards,
      voidCrystals: reward.voidCrystals,
      streakBonus: reward.streakBonus,
      newStreak,
      longestStreak,
      newGoldBalance: Number(updatedCurrencies.goldShards),
      newCrystalBalance: updatedCurrencies.voidCrystals,
    };
  }

  // ── Pure helpers ───────────────────────────────────────────────────────────

  computeReward(streakDay: number): DailyRewardPreviewDto {
    const dayIndex = Math.max(0, (streakDay - 1) % 7);
    const mult = DAY_GOLD_MULT[dayIndex] ?? 1;
    const streakBonus = Math.max(0, streakDay - 7) * STREAK_BONUS_PER_DAY;
    const goldShards = Math.floor(BASE_GOLD * mult) + streakBonus;
    const voidCrystals = streakDay % WEEKLY_CRYSTAL_DAY === 0 ? Math.ceil(streakDay / 7) : BASE_CRYSTALS;

    return {
      goldShards,
      voidCrystals,
      streakBonus,
      streakDay,
    };
  }

  private canClaimToday(lastClaimedAt: Date | null, now: Date): boolean {
    if (!lastClaimedAt) return true;
    return now.getTime() - lastClaimedAt.getTime() >= ONE_DAY_MS;
  }

  private async getOrCreate(playerId: string) {
    const existing = await this.prisma.dailyReward.findUnique({ where: { playerId } });
    if (existing) return existing;
    return this.prisma.dailyReward.create({
      data: { playerId, streak: 0, longestStreak: 0, totalClaimed: 0 },
    });
  }
}
