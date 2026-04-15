import { Controller, Get } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { TokenPayload } from '@riftborn/shared';
import { LeaderboardService } from './leaderboard.service';
import { PlayersService } from '../players/players.service';
import type { LeaderboardResponseDto } from '@riftborn/shared';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly players: PlayersService,
  ) {}

  @Get()
  async getLeaderboard(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<LeaderboardResponseDto> {
    const player = await this.players.findByAccountId(payload.sub);
    return this.leaderboard.getTopPlayers(player.id);
  }
}
