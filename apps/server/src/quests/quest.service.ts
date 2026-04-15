import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QuestPeriod, QuestType } from '@riftborn/shared';
import type { ClaimQuestResponseDto, PlayerQuestDto } from '@riftborn/shared';
import { PrismaService } from '../database/prisma.service';
import {
  DAILY_QUEST_IDS,
  QUEST_TEMPLATES,
  WEEKLY_QUEST_IDS,
} from './data/quests.data';

export interface BattleQuestEvent {
  victory: boolean;
  goldEarned: number;
  zone: number;
  room: number;
  isBoss: boolean;
}

@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async getActiveQuests(playerId: string): Promise<PlayerQuestDto[]> {
    const dailyKey = this.dailyKey();
    const weeklyKey = this.weeklyKey();

    await this.ensureQuestsExist(playerId, dailyKey, weeklyKey);

    const quests = await this.prisma.playerQuest.findMany({
      where: {
        playerId,
        periodKey: { in: [dailyKey, weeklyKey] },
      },
      orderBy: [{ claimed: 'asc' }, { createdAt: 'asc' }],
    });

    return quests.map((q) => this.toDto(q));
  }

  async updateBattleProgress(playerId: string, event: BattleQuestEvent): Promise<void> {
    const dailyKey = this.dailyKey();
    const weeklyKey = this.weeklyKey();

    await this.ensureQuestsExist(playerId, dailyKey, weeklyKey);

    const quests = await this.prisma.playerQuest.findMany({
      where: { playerId, periodKey: { in: [dailyKey, weeklyKey] }, claimed: false },
    });

    const updates: Array<{ id: string; increment: number }> = [];

    for (const quest of quests) {
      const template = QUEST_TEMPLATES.get(quest.templateId);
      if (!template || quest.progress >= quest.targetValue) continue;

      let increment = 0;
      switch (template.type) {
        case QuestType.CLEAR_ROOMS:
          if (event.victory) increment = 1;
          break;
        case QuestType.WIN_BATTLES:
          if (event.victory) increment = 1;
          break;
        case QuestType.EARN_GOLD:
          increment = event.goldEarned;
          break;
        case QuestType.DEFEAT_BOSS:
          if (event.victory && event.isBoss) increment = 1;
          break;
        case QuestType.REACH_ZONE:
          if (event.zone >= template.targetValue) increment = template.targetValue - quest.progress;
          break;
      }

      if (increment > 0) updates.push({ id: quest.id, increment });
    }

    if (updates.length === 0) return;

    await this.prisma.$transaction(
      updates.map(({ id, increment }) =>
        this.prisma.playerQuest.update({
          where: { id },
          data: { progress: { increment } },
        }),
      ),
    );
  }

  async claimQuest(playerId: string, questId: string): Promise<ClaimQuestResponseDto> {
    const quest = await this.prisma.playerQuest.findUnique({ where: { id: questId } });
    if (!quest || quest.playerId !== playerId) throw new NotFoundException('Quest not found');
    if (quest.claimed) throw new ConflictException('Quest already claimed');
    if (quest.progress < quest.targetValue) throw new BadRequestException('Quest not completed yet');

    const template = QUEST_TEMPLATES.get(quest.templateId);
    if (!template) throw new NotFoundException('Quest template not found');

    const [updatedCurrencies] = await this.prisma.$transaction([
      this.prisma.playerCurrencies.update({
        where: { playerId },
        data: {
          goldShards: { increment: template.goldReward },
          voidCrystals: { increment: template.crystalReward },
        },
      }),
      this.prisma.playerQuest.update({
        where: { id: questId },
        data: { claimed: true },
      }),
    ]);

    return {
      goldEarned: template.goldReward,
      crystalsEarned: template.crystalReward,
      expEarned: template.expReward,
      newGoldBalance: Number(updatedCurrencies.goldShards),
      newCrystalBalance: updatedCurrencies.voidCrystals,
    };
  }

  async trackSingleEvent(playerId: string, type: QuestType): Promise<void> {
    this.logger.log(`trackSingleEvent player=${playerId} type=${type}`);
    const dailyKey = this.dailyKey();
    const weeklyKey = this.weeklyKey();

    await this.ensureQuestsExist(playerId, dailyKey, weeklyKey);

    const quests = await this.prisma.playerQuest.findMany({
      where: { playerId, periodKey: { in: [dailyKey, weeklyKey] }, claimed: false },
    });

    this.logger.log(`trackSingleEvent found ${quests.length} unclaimed quests for keys [${dailyKey}, ${weeklyKey}]`);

    const toUpdate: string[] = [];
    for (const quest of quests) {
      const template = QUEST_TEMPLATES.get(quest.templateId);
      this.logger.debug(`  quest ${quest.templateId} template.type=${template?.type} vs ${type}, progress=${quest.progress}/${quest.targetValue}`);
      if (template?.type === type && quest.progress < quest.targetValue) {
        toUpdate.push(quest.id);
      }
    }

    this.logger.log(`trackSingleEvent updating ${toUpdate.length} quests`);
    if (toUpdate.length === 0) return;

    await this.prisma.$transaction(
      toUpdate.map((id) =>
        this.prisma.playerQuest.update({
          where: { id },
          data: { progress: { increment: 1 } },
        }),
      ),
    );
  }

  // ── Period helpers ─────────────────────────────────────────────────────────

  dailyKey(date = new Date()): string {
    return date.toISOString().slice(0, 10); // "2026-04-07"
  }

  weeklyKey(date = new Date()): string {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    // getUTCDay(): 0=Sun, 1=Mon … 6=Sat  →  daysFromMonday: Sun=6, Mon=0, Tue=1 …
    const dayOfWeek = d.getUTCDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setUTCDate(d.getUTCDate() - daysFromMonday);
    return `week-${d.toISOString().slice(0, 10)}`;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async ensureQuestsExist(
    playerId: string,
    dailyKey: string,
    weeklyKey: string,
  ): Promise<void> {
    const existing = await this.prisma.playerQuest.findMany({
      where: { playerId, periodKey: { in: [dailyKey, weeklyKey] } },
      select: { templateId: true, periodKey: true },
    });

    const existingSet = new Set(existing.map((q) => `${q.templateId}:${q.periodKey}`));
    const toCreate: Array<{ playerId: string; templateId: string; targetValue: number; periodKey: string }> = [];

    for (const id of DAILY_QUEST_IDS) {
      if (!existingSet.has(`${id}:${dailyKey}`)) {
        const t = QUEST_TEMPLATES.get(id)!;
        toCreate.push({ playerId, templateId: id, targetValue: t.targetValue, periodKey: dailyKey });
      }
    }
    for (const id of WEEKLY_QUEST_IDS) {
      if (!existingSet.has(`${id}:${weeklyKey}`)) {
        const t = QUEST_TEMPLATES.get(id)!;
        toCreate.push({ playerId, templateId: id, targetValue: t.targetValue, periodKey: weeklyKey });
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.playerQuest.createMany({ data: toCreate, skipDuplicates: true });
    }
  }

  private toDto(quest: {
    id: string;
    templateId: string;
    progress: number;
    targetValue: number;
    claimed: boolean;
    periodKey: string;
  }): PlayerQuestDto {
    const t = QUEST_TEMPLATES.get(quest.templateId)!;
    return {
      id: quest.id,
      templateId: quest.templateId,
      name: t.name,
      description: t.description,
      icon: t.icon,
      type: t.type,
      period: t.period,
      progress: Math.min(quest.progress, quest.targetValue),
      targetValue: quest.targetValue,
      claimed: quest.claimed,
      completed: quest.progress >= quest.targetValue,
      goldReward: t.goldReward,
      crystalReward: t.crystalReward,
      expReward: t.expReward,
      periodKey: quest.periodKey,
    };
  }
}
