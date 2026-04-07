import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { CombatService } from '../combat/combat.service';
import { PlayersService } from './players.service';
import type {
  ClaimOfflineRewardResponseDto,
  CombatStatsDto,
  HeartbeatResponseDto,
  OfflineRewardPreviewDto,
  PlayerStateDto,
  TokenPayload,
} from '@riftborn/shared';

@Controller('players')
export class PlayersController {
  constructor(
    private readonly playersService: PlayersService,
    private readonly combatService: CombatService,
  ) {}

  @Get('me')
  async getMyState(@CurrentPlayer() payload: TokenPayload): Promise<PlayerStateDto> {
    return this.playersService.loadPlayerState(payload.sub);
  }

  @Get('me/profile')
  async getMyProfile(@CurrentPlayer() payload: TokenPayload) {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.playersService.toProfileDto(player);
  }

  // ── Offline rewards ───────────────────────────────────────────────────────

  @Get('me/offline-rewards')
  async getOfflineRewardPreview(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<OfflineRewardPreviewDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.playersService.getOfflineRewardPreview(player.id);
  }

  @Post('me/offline-rewards/claim')
  @HttpCode(HttpStatus.OK)
  async claimOfflineReward(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<ClaimOfflineRewardResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.playersService.claimOfflineReward(player.id);
  }

  @Get('me/battles')
  async getMyBattles(
    @CurrentPlayer() payload: TokenPayload,
  ): Promise<object[]> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.playersService.getRecentBattles(player.id);
  }

  @Get('me/stats')
  async getMyStats(@CurrentPlayer() payload: TokenPayload): Promise<CombatStatsDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.combatService.computePlayerStats(player.level, player.class);
  }

  // ── Heartbeat (keeps lastHeartbeat fresh for idle calc accuracy) ──────────

  @Post('me/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@CurrentPlayer() payload: TokenPayload): Promise<HeartbeatResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.playersService.heartbeat(player.id);
  }
}
