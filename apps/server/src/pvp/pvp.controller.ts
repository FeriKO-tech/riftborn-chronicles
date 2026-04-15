import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { PvpFightResultDto, PvpStateDto, TokenPayload } from '@riftborn/shared';
import { OpponentIdDto } from '../common/dto/id-param.dto';
import { PlayersService } from '../players/players.service';
import { PvpService } from './pvp.service';

@Controller('pvp')
export class PvpController {
  constructor(
    private readonly pvpService: PvpService,
    private readonly playersService: PlayersService,
  ) {}

  @Get('state')
  async getState(@CurrentPlayer() payload: TokenPayload): Promise<PvpStateDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.pvpService.getState(player.id);
  }

  @Post('fight')
  @HttpCode(HttpStatus.OK)
  async fight(
    @CurrentPlayer() payload: TokenPayload,
    @Body() body: OpponentIdDto,
  ): Promise<PvpFightResultDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.pvpService.fight(player.id, body.opponentPlayerId);
  }

  @Post('snapshot/refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refreshSnapshot(@CurrentPlayer() payload: TokenPayload): Promise<void> {
    const player = await this.playersService.findByAccountId(payload.sub);
    await this.pvpService.refreshSnapshot(player.id);
  }
}
