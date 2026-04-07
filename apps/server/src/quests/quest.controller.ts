import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { ClaimQuestResponseDto, PlayerQuestDto, TokenPayload } from '@riftborn/shared';
import { PlayersService } from '../players/players.service';
import { QuestService } from './quest.service';

@Controller('quests')
export class QuestController {
  constructor(
    private readonly questService: QuestService,
    private readonly playersService: PlayersService,
  ) {}

  @Get()
  async getActiveQuests(@CurrentPlayer() payload: TokenPayload): Promise<PlayerQuestDto[]> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.questService.getActiveQuests(player.id);
  }

  @Post(':questId/claim')
  @HttpCode(HttpStatus.OK)
  async claimQuest(
    @CurrentPlayer() payload: TokenPayload,
    @Param('questId') questId: string,
  ): Promise<ClaimQuestResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.questService.claimQuest(player.id, questId);
  }
}
