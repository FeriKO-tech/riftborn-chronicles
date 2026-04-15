import { Controller, Get } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import type { TokenPayload, AchievementStateDto } from '@riftborn/shared';
import { AchievementsService } from './achievements.service';
import { PlayersService } from '../players/players.service';

@Controller('achievements')
export class AchievementsController {
  constructor(
    private readonly achievements: AchievementsService,
    private readonly players: PlayersService,
  ) {}

  @Get()
  async getState(@CurrentPlayer() payload: TokenPayload): Promise<AchievementStateDto> {
    const player = await this.players.findByAccountId(payload.sub);
    return this.achievements.getState(player.id);
  }
}
