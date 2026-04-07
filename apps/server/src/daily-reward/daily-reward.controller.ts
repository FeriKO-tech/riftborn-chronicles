import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type {
  ClaimDailyRewardResponseDto,
  DailyRewardStatusDto,
  TokenPayload,
} from '@riftborn/shared';
import { DailyRewardService } from './daily-reward.service';
import { PlayersService } from '../players/players.service';

@Controller('daily-reward')
export class DailyRewardController {
  constructor(
    private readonly dailyRewardService: DailyRewardService,
    private readonly playersService: PlayersService,
  ) {}

  @Get()
  async getStatus(@CurrentPlayer() payload: TokenPayload): Promise<DailyRewardStatusDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.dailyRewardService.getStatus(player.id);
  }

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  async claim(@CurrentPlayer() payload: TokenPayload): Promise<ClaimDailyRewardResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.dailyRewardService.claim(player.id);
  }
}
