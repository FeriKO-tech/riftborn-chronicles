import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { PlayersService } from './players.service';
import type {
  ClaimOfflineRewardResponseDto,
  HeartbeatResponseDto,
  OfflineRewardPreviewDto,
  PlayerStateDto,
  TokenPayload,
} from '@riftborn/shared';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

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

  // ── Heartbeat (keeps lastHeartbeat fresh for idle calc accuracy) ──────────

  @Post('me/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@CurrentPlayer() payload: TokenPayload): Promise<HeartbeatResponseDto> {
    const player = await this.playersService.findByAccountId(payload.sub);
    return this.playersService.heartbeat(player.id);
  }
}
