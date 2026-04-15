import { Controller, Get, Post, Param } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { TokenPayload, SkillStateDto, SkillUpgradeResponseDto } from '@riftborn/shared';
import { SkillsService } from './skills.service';
import { PlayersService } from '../players/players.service';

@Controller('skills')
export class SkillsController {
  constructor(
    private readonly skills: SkillsService,
    private readonly players: PlayersService,
  ) {}

  @Get()
  async getState(@CurrentPlayer() payload: TokenPayload): Promise<SkillStateDto> {
    const player = await this.players.findByAccountId(payload.sub);
    return this.skills.getState(player.id, player.class);
  }

  @Post(':skillId/upgrade')
  async upgrade(
    @CurrentPlayer() payload: TokenPayload,
    @Param('skillId') skillId: string,
  ): Promise<SkillUpgradeResponseDto> {
    const player = await this.players.findByAccountId(payload.sub);
    return this.skills.upgrade(player.id, player.class, skillId);
  }
}
