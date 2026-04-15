import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { LeaderboardEntryDto, LeaderboardResponseDto } from '@riftborn/shared';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getTopPlayers(requesterId: string, limit = 50): Promise<LeaderboardResponseDto> {
    const players = await this.prisma.player.findMany({
      where: { level: { gte: 2 }, powerScore: { gt: 0 } },
      orderBy: { powerScore: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        class: true,
        level: true,
        powerScore: true,
        stageProgress: { select: { highestZone: true } },
      },
    });

    const entries: LeaderboardEntryDto[] = players.map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      name: p.name,
      class: p.class,
      level: p.level,
      powerScore: Number(p.powerScore),
      highestZone: p.stageProgress?.highestZone ?? 0,
    }));

    // Find requester rank
    let myRank: number | null = null;
    const myIdx = entries.findIndex((e) => e.playerId === requesterId);
    if (myIdx >= 0) {
      myRank = myIdx + 1;
    } else {
      // Count players with higher PS
      const count = await this.prisma.player.count({
        where: {
          powerScore: {
            gt: (await this.prisma.player.findUnique({
              where: { id: requesterId },
              select: { powerScore: true },
            }))?.powerScore ?? 0,
          },
        },
      });
      myRank = count + 1;
    }

    return { entries, myRank };
  }
}
