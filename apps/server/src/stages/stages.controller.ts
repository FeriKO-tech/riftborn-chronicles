import { Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { Public } from '../common/decorators/public.decorator';
import type {
  BattleResultDto,
  StageProgressResponseDto,
  ZoneDto,
  ZoneSummaryDto,
} from '@riftborn/shared';
import type { TokenPayload } from '@riftborn/shared';
import { PlayersService } from '../players/players.service';
import { StagesService } from './stages.service';

@Controller('stages')
export class StagesController {
  constructor(
    private readonly stagesService: StagesService,
    private readonly playersService: PlayersService,
  ) {}

  // ── Public zone catalogue — /stages/zones (no auth needed) ──────────────

  @Public()
  @Get('zones')
  listZones(): ZoneSummaryDto[] {
    return this.stagesService.listZoneSummaries();
  }

  @Public()
  @Get('zones/:zone')
  getZone(@Param('zone', ParseIntPipe) zone: number): ZoneDto {
    return this.stagesService.getZone(zone);
  }

  // ── Player progression — /stages/me ──────────────────────────────────────

  @Get('me/progress')
  async getMyProgress(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<StageProgressResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.stagesService.getPlayerProgress(player.id);
  }

  @Post('me/advance')
  @HttpCode(HttpStatus.OK)
  async advanceRoom(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<BattleResultDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.stagesService.advanceRoom(player.id);
  }
}
