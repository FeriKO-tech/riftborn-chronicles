import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';
import type { PlayerSkillDto, SkillStateDto, SkillUpgradeResponseDto } from '@riftborn/shared';
import { getSkillDefinition, getSkillsForClass } from './data/skill-definitions.data';

const KEY = (playerId: string) => `skills:${playerId}`;

@Injectable()
export class SkillsService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getState(playerId: string, playerClass: string): Promise<SkillStateDto> {
    const defs = getSkillsForClass(playerClass);
    const raw = await this.redis.hgetall(KEY(playerId));

    const skills: PlayerSkillDto[] = defs.map((def) => ({
      skillId: def.id,
      level: raw[def.id] ? parseInt(raw[def.id], 10) : 0,
      definition: def,
    }));

    return { skills };
  }

  async upgrade(playerId: string, playerClass: string, skillId: string): Promise<SkillUpgradeResponseDto> {
    const def = getSkillDefinition(skillId);
    if (!def) throw new BadRequestException('Unknown skill');
    if (def.class !== playerClass) throw new BadRequestException('Skill not available for your class');

    const raw = await this.redis.hget(KEY(playerId), skillId);
    const currentLevel = raw ? parseInt(raw, 10) : 0;

    if (currentLevel >= def.maxLevel) throw new BadRequestException('Skill already at max level');

    const goldCost = currentLevel === 0 ? def.unlockCost : def.unlockCost + currentLevel * def.upgradeCostPerLevel;

    // Deduct gold
    const currencies = await this.prisma.playerCurrencies.findUnique({ where: { playerId } });
    if (!currencies || Number(currencies.goldShards) < goldCost) {
      throw new BadRequestException(`Not enough gold (need ${goldCost})`);
    }

    await this.prisma.playerCurrencies.update({
      where: { playerId },
      data: { goldShards: { decrement: goldCost } },
    });

    const newLevel = currentLevel + 1;
    await this.redis.hset(KEY(playerId), skillId, newLevel.toString());

    return {
      skill: { skillId: def.id, level: newLevel, definition: def },
      goldCost,
    };
  }
}
