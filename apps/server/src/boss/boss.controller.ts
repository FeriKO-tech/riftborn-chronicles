import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { BossAttemptStatusDto, BossConfigDto, BossFightResponseDto, TokenPayload } from '@riftborn/shared';
import { PlayersService } from '../players/players.service';
import { BossService } from './boss.service';

@Controller('boss')
export class BossController {
  constructor(
    private readonly bossService: BossService,
    private readonly playersService: PlayersService,
  ) {}

  @Get()
  async getState(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<{ bosses: BossConfigDto[]; attempts: Record<string, BossAttemptStatusDto> }> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.bossService.getBossState(player.id);
  }

  @Post(':bossId/fight')
  @HttpCode(HttpStatus.OK)
  async fight(
    @CurrentPlayer() payload: TokenPayload,
    @Param('bossId') bossId: string,
  ): Promise<BossFightResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.bossService.fight(player.id, bossId);
  }
}
