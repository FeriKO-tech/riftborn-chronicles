import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { Public } from '../common/decorators/public.decorator';
import type {
  BattleResultDto,
  KillEnemyRequestDto,
  KillEnemyResponseDto,
  StageProgressResponseDto,
  ZoneClearResponseDto,
  ZoneDto,
  ZoneSceneConfigDto,
  ZoneSummaryDto,
} from '@riftborn/shared';
import type { TokenPayload } from '@riftborn/shared';
import { PlayersService } from '../players/players.service';
import { StagesService } from './stages.service';
import { CombatSceneService } from './combat-scene.service';

@Controller('stages')
export class StagesController {
  constructor(
    private readonly stagesService: StagesService,
    private readonly playersService: PlayersService,
    private readonly combatScene: CombatSceneService,
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

  // ── Combat scene endpoints — /stages/me/scene ─────────────────────────────

  @Get('me/scene')
  async getSceneConfig(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<ZoneSceneConfigDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.combatScene.getSceneConfig(player.id);
  }

  @Post('me/scene/kill')
  @HttpCode(HttpStatus.OK)
  async killEnemy(
    @CurrentPlayer() payload: TokenPayload,
    @Body() dto: KillEnemyRequestDto,
  ): Promise<KillEnemyResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.combatScene.killEnemy(player.id, dto);
  }

  @Post('me/scene/boss')
  @HttpCode(HttpStatus.OK)
  async fightBoss(
    @CurrentPlayer() payload: TokenPayload,
    @Body('zone', ParseIntPipe) zone: number,
  ): Promise<{ victory: boolean; result: ZoneClearResponseDto | null }> {
    const player = await this.playersService.findByAccountId(payload.sub);
    const { victory, result } = await this.combatScene.fightBoss(player.id, zone);
    return { victory, result };
  }
}
